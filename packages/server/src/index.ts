import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { env } from "./env.js";
import { videoRoutes } from "./routes/video.js";
import { liveRoutes } from "./routes/live.js";

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: env.logLevel },
    bodyLimit: 50 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(","),
    credentials: true,
  });
  await app.register(sensible);

  app.get("/health", async () => ({
    ok: true,
    service: "aiperson-server",
    time: new Date().toISOString(),
    checks: {
      ark: Boolean(env.ark.apiKey),
      visual: Boolean(env.visual.ak && env.visual.sk),
      tts: Boolean(env.tts.appid && env.tts.token),
      rtc: Boolean(env.rtc.appId && env.rtc.appKey),
    },
  }));

  await app.register(videoRoutes);
  await app.register(liveRoutes);

  await app.listen({ port: env.port, host: "0.0.0.0" });
  app.log.info(`aiperson-server listening on :${env.port}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
