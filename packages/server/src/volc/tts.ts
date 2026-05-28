import { request } from "undici";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";

// HTTP one-shot TTS (大模型语音合成). Returns base64-encoded audio.
// Doc: https://www.volcengine.com/docs/6561/79817

export interface TtsArgs {
  text: string;
  voice?: string;
  emotion?: string;
}

export async function synthesize(args: TtsArgs): Promise<{ audioBase64: string }> {
  if (!env.tts.appid || !env.tts.token)
    throw new Error("VOLC_TTS_APPID / VOLC_TTS_TOKEN not set");

  const body = {
    app: {
      appid: env.tts.appid,
      token: env.tts.token,
      cluster: env.tts.cluster,
    },
    user: { uid: "aiperson" },
    audio: {
      voice_type: args.voice ?? env.tts.voice,
      encoding: "mp3",
      speed_ratio: 1.0,
      emotion: args.emotion ?? "neutral",
    },
    request: {
      reqid: randomUUID(),
      text: args.text,
      operation: "query",
    },
  };

  const res = await request(`https://${env.tts.host}/api/v1/tts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer;${env.tts.token}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.body.json()) as {
    code?: number;
    message?: string;
    data?: string;
  };
  if (json.code !== 3000 || !json.data)
    throw new Error(`TTS failed: ${json.message ?? "unknown"}`);
  return { audioBase64: json.data };
}
