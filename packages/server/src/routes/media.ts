import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../env.js";

const MEDIA_DIR = "/tmp/aiperson-media";
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// GC files older than 6h every 30min
setInterval(
  () => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(MEDIA_DIR)) {
      try {
        const p = path.join(MEDIA_DIR, f);
        if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
      } catch {
        /* noop */
      }
    }
  },
  30 * 60 * 1000,
).unref();

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "video/mp4": "mp4",
};

export function storeBlob(buf: Buffer, mime: string): string {
  const ext = MIME_EXT[mime] ?? "bin";
  const id = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(MEDIA_DIR, id), buf);
  return `${env.publicBaseUrl.replace(/\/$/, "")}/media/${id}`;
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/media/:id", async (req, reply) => {
    const id = req.params.id;
    if (!/^[A-Za-z0-9._-]+$/.test(id))
      return reply.code(400).send({ error: "bad_id" });
    const p = path.join(MEDIA_DIR, id);
    if (!fs.existsSync(p)) return reply.code(404).send({ error: "not_found" });
    const ext = id.split(".").pop()!;
    const mime =
      ext === "mp3"
        ? "audio/mpeg"
        : ext === "wav"
          ? "audio/wav"
          : ext === "png"
            ? "image/png"
            : ext === "jpg"
              ? "image/jpeg"
              : ext === "webp"
                ? "image/webp"
                : ext === "mp4"
                  ? "video/mp4"
                  : "application/octet-stream";
    reply.header("Content-Type", mime);
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(fs.createReadStream(p));
  });
}
