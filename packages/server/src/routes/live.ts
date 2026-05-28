import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { generateRtcToken } from "../volc/rtc.js";
import { startVoiceAgent, stopVoiceAgent } from "../volc/rtc-agent.js";
import { putSession, getSession, dropSession } from "../session.js";
import { getDoubao, DOUBAO_MODEL } from "../volc/doubao.js";
import {
  buildSystemPrompt,
  type BoundaryConfig,
} from "@aiperson/shared";
import { checkUserInput, checkOutputChunk } from "../boundary/filter.js";
import { env } from "../env.js";

const boundarySchema = z.object({
  persona: z.string().default(""),
  allowedTopics: z.array(z.string()).default([]),
  forbiddenTopics: z.array(z.string()).default([]),
  mustSay: z.array(z.string()).default([]),
  freeImprov: z.string().default(""),
  forbiddenKeywords: z.array(z.string()).default([]),
  refusalReply: z
    .string()
    .default("这个问题超出了我们今天课堂的讨论范围，我们继续看下一个内容。"),
});

const startSchema = z.object({
  imageBase64: z.string().optional(),
  imageMime: z.string().optional(),
  boundary: boundarySchema,
  voice: z.string().optional(),
});

const chatSchema = z.object({
  sessionId: z.string(),
  userText: z.string().min(1).max(2000),
});

export async function liveRoutes(app: FastifyInstance): Promise<void> {
  app.post("/live/start", async (req, reply) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });
    const sessionId = randomUUID();
    const boundary = parsed.data.boundary as BoundaryConfig;
    putSession({
      id: sessionId,
      boundary,
      voice: parsed.data.voice,
      history: [],
      createdAt: Date.now(),
    });
    let rtc: ReturnType<typeof generateRtcToken> | null = null;
    try {
      rtc = generateRtcToken({ roomId: `aiperson_${sessionId.slice(0, 8)}` });
    } catch {
      // RTC not configured — text channel still works
    }
    return reply.send({
      sessionId,
      rtcAppId: rtc?.appId ?? "",
      rtcToken: rtc?.token ?? "",
      roomId: rtc?.roomId ?? "",
      userId: rtc?.userId ?? "",
      avatarUserId: rtc ? `avatar_${rtc.userId}` : "",
    });
  });

  app.post("/live/agent/start", async (req, reply) => {
    const body = req.body as {
      sessionId: string;
      roomId: string;
      userId: string;
      avatarImageUrl?: string;
    };
    const session = getSession(body.sessionId);
    if (!session)
      return reply.code(404).send({ error: "session_not_found" });
    const agentUserId = `avatar_${body.userId}`;
    try {
      const taskId = await startVoiceAgent({
        appId: env.rtc.appId,
        roomId: body.roomId,
        targetUserId: body.userId,
        agentUserId,
        systemPrompt: buildSystemPrompt(session.boundary),
        voice: session.voice,
        avatarImageUrl: body.avatarImageUrl,
      });
      (session as any).agentTaskId = taskId;
      return reply.send({ taskId, agentUserId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send({ error: msg });
    }
  });

  app.post("/live/stop", async (req, reply) => {
    const body = req.body as { sessionId?: string; roomId?: string };
    if (body.sessionId) {
      const s = getSession(body.sessionId);
      const taskId = (s as any)?.agentTaskId as string | undefined;
      if (taskId && body.roomId) {
        try {
          await stopVoiceAgent({
            appId: env.rtc.appId,
            roomId: body.roomId,
            taskId,
          });
        } catch {
          /* swallow: best-effort cleanup */
        }
      }
      dropSession(body.sessionId);
    }
    return reply.send({ ok: true });
  });

  app.post("/chat/stream", async (req, reply) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });
    const session = getSession(parsed.data.sessionId);
    if (!session)
      return reply.code(404).send({ error: "session_not_found" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const violation = checkUserInput(parsed.data.userText, session.boundary);
    if (violation) {
      send("refusal", { text: session.boundary.refusalReply, violation });
      send("done", {});
      reply.raw.end();
      return;
    }

    session.history.push({ role: "user", content: parsed.data.userText });

    try {
      const client = getDoubao();
      const stream = await client.chat.completions.create({
        model: DOUBAO_MODEL,
        stream: true,
        temperature: 0.6,
        messages: [
          { role: "system", content: buildSystemPrompt(session.boundary) },
          ...session.history.slice(-12),
        ],
      });

      let buffer = "";
      let aborted = false;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (!delta) continue;
        buffer += delta;
        const outViolation = checkOutputChunk(buffer, session.boundary);
        if (outViolation) {
          send("refusal", {
            text: session.boundary.refusalReply,
            violation: outViolation,
          });
          aborted = true;
          break;
        }
        send("delta", { text: delta });
      }
      if (!aborted) {
        session.history.push({ role: "assistant", content: buffer });
        send("done", { text: buffer });
      } else {
        send("done", {});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      send("error", { message: msg });
    } finally {
      reply.raw.end();
    }
  });
}
