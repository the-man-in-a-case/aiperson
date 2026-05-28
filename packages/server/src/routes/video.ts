import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  submitOmniHumanTask,
  queryOmniHumanTask,
} from "../volc/omnihuman.js";
import { synthesize } from "../volc/tts.js";

const generateSchema = z.object({
  imageBase64: z.string().min(100),
  imageMime: z.string().default("image/png"),
  text: z.string().min(1).max(2000),
  emotion: z
    .enum(["neutral", "happy", "sad", "angry", "surprised", "serious", "gentle"])
    .default("neutral"),
  voice: z.string().optional(),
});

export async function videoRoutes(app: FastifyInstance): Promise<void> {
  app.post("/video/generate", async (req, reply) => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });
    const { imageBase64, text, emotion, voice } = parsed.data;

    const tts = await synthesize({ text, voice, emotion });
    const taskId = await submitOmniHumanTask({
      imageBase64,
      audioBase64: tts.audioBase64,
    });
    return reply.send({ taskId });
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
