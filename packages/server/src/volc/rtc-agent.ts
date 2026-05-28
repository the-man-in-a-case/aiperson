import { request } from "undici";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";
import { signVolcRequest } from "./sign.js";

// VolcEngine RTC AIGC ("AI 实时对话 / 数字人智能体") OpenAPI.
// Doc: https://www.volcengine.com/docs/6348/1310560
// Action / payload shape evolves; everything is env-overridable so the
// caller can adjust without code edits.

const SERVICE = "rtc";
const VERSION = "2024-12-01";
const START_ACTION = process.env.VOLC_RTC_START_ACTION ?? "StartVoiceChat";
const STOP_ACTION = process.env.VOLC_RTC_STOP_ACTION ?? "StopVoiceChat";
const HOST = process.env.VOLC_RTC_HOST ?? "rtc.volcengineapi.com";

export interface StartAgentArgs {
  appId: string;
  roomId: string;
  targetUserId: string;
  agentUserId: string;
  systemPrompt: string;
  voice?: string;
  avatarImageUrl?: string;
}

export async function startVoiceAgent(args: StartAgentArgs): Promise<string> {
  if (!env.visual.ak || !env.visual.sk)
    throw new Error("VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY not set");

  const taskId = randomUUID();
  const payload: Record<string, unknown> = {
    AppId: args.appId,
    RoomId: args.roomId,
    TaskId: taskId,
    AgentConfig: {
      UserId: args.agentUserId,
      TargetUserId: [args.targetUserId],
      WelcomeMessage: "同学们好，有什么问题随时问我。",
    },
    Config: {
      LLMConfig: {
        Mode: "ArkV3",
        EndPointId: env.rtc.agentEndpointId || env.ark.model,
        SystemMessages: [args.systemPrompt],
        Temperature: 0.6,
      },
      TTSConfig: {
        Provider: "volcano",
        ProviderParams: {
          app: { appid: env.tts.appid, token: env.tts.token, cluster: env.tts.cluster },
          audio: { voice_type: args.voice ?? env.tts.voice, emotion: "neutral" },
        },
      },
      ASRConfig: { Provider: "volcano" },
      ...(args.avatarImageUrl
        ? { AvatarConfig: { ImageUrl: args.avatarImageUrl } }
        : {}),
    },
  };

  const signed = signVolcRequest({
    ak: env.visual.ak,
    sk: env.visual.sk,
    host: HOST,
    region: env.visual.region,
    service: SERVICE,
    action: START_ACTION,
    version: VERSION,
    body: JSON.stringify(payload),
  });

  const res = await request(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const text = await res.body.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`RTC agent start invalid JSON: ${text.slice(0, 200)}`);
  }
  const code = json?.ResponseMetadata?.Error?.Code ?? json?.code;
  if (code && code !== "0" && code !== 0)
    throw new Error(`RTC agent start failed: ${JSON.stringify(json).slice(0, 300)}`);
  return taskId;
}

export async function stopVoiceAgent(args: {
  appId: string;
  roomId: string;
  taskId: string;
}): Promise<void> {
  if (!env.visual.ak || !env.visual.sk)
    throw new Error("VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY not set");

  const signed = signVolcRequest({
    ak: env.visual.ak,
    sk: env.visual.sk,
    host: HOST,
    region: env.visual.region,
    service: SERVICE,
    action: STOP_ACTION,
    version: VERSION,
    body: JSON.stringify({
      AppId: args.appId,
      RoomId: args.roomId,
      TaskId: args.taskId,
    }),
  });
  await request(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
}
