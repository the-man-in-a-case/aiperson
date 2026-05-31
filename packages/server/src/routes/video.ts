import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  submitOmniHumanTask,
  queryOmniHumanTask,
} from "../volc/omnihuman.js";
import { synthesize } from "../volc/tts.js";
import { storeBlob } from "./media.js";

const generateSchema = z.object({
  imageBase64: z.string().min(100),
  imageMime: z.string().default("image/png"),
  text: z.string().min(1).max(2000),
  emotion: z
    .enum(["neutral", "happy", "sad", "angry", "surprised", "serious", "gentle"])
    .default("neutral"),
  voice: z.string().optional(),
  prompt: z.string().optional(),
  outputResolution: z.union([z.literal(720), z.literal(1080)]).optional(),
  peFastMode: z.boolean().optional(),
});

export async function videoRoutes(app: FastifyInstance): Promise<void> {
  app.post("/video/generate", async (req, reply) => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });
    const {
      imageBase64,
      imageMime,
      text,
      emotion,
      voice,
      prompt,
      outputResolution,
      peFastMode,
    } = parsed.data;

    const imageUrl = storeBlob(Buffer.from(imageBase64, "base64"), imageMime);
    const tts = await synthesize({ text, voice, emotion });
    const audioUrl = storeBlob(Buffer.from(tts.audioBase64, "base64"), "audio/mp3");

    const taskId = await submitOmniHumanTask({
      imageUrl,
      audioUrl,
      prompt,
      outputResolution,
      peFastMode,
    });
    return reply.send({ taskId, imageUrl, audioUrl });
  });

  app.get<{ Params: { taskId: string } }>(
    "/video/task/:taskId",
    async (req, reply) => {
      const r = await queryOmniHumanTask(req.params.taskId);
      return reply.send({
        taskId: req.params.taskId,
        status: r.status,
        videoUrl: r.videoUrl,
        errorMessage: r.status === "failed" ? r.message : undefined,
      });
    },
  );
}
