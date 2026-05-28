import { request } from "undici";
import { env } from "../env.js";
import { signVolcRequest } from "./sign.js";

// OmniHuman is exposed under VolcEngine 视觉智能 OpenAPI (service "cv").
// Submit -> returns task_id; Query -> returns status + result urls.
// Refer to: https://www.volcengine.com/docs/6791

const SERVICE = "cv";
const VERSION = "2022-08-31";

export interface SubmitArgs {
  imageBase64: string;
  audioBase64?: string;
  audioUrl?: string;
  text?: string;
  voice?: string;
}

export async function submitOmniHumanTask(args: SubmitArgs): Promise<string> {
  if (!env.visual.ak || !env.visual.sk)
    throw new Error("VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY not set");

  const payload: Record<string, unknown> = {
    req_key: env.visual.reqKey,
    image_base64: args.imageBase64,
  };
  if (args.audioBase64) payload.audio_base64 = args.audioBase64;
  if (args.audioUrl) payload.audio_url = args.audioUrl;
  if (args.text) payload.text = args.text;
  if (args.voice) payload.voice = args.voice;

  const signed = signVolcRequest({
    ak: env.visual.ak,
    sk: env.visual.sk,
    host: env.visual.host,
    region: env.visual.region,
    service: SERVICE,
    action: env.visual.submitAction,
    version: VERSION,
    body: JSON.stringify(payload),
  });

  const res = await request(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const json = (await res.body.json()) as {
    code?: number;
    message?: string;
    data?: { task_id?: string };
  };
  if (json.code !== 10000 || !json.data?.task_id)
    throw new Error(`OmniHuman submit failed: ${json.message ?? "unknown"}`);
  return json.data.task_id;
}

export interface QueryResult {
  status: "pending" | "running" | "succeeded" | "failed";
  videoUrl?: string;
  message?: string;
}

export async function queryOmniHumanTask(taskId: string): Promise<QueryResult> {
  if (!env.visual.ak || !env.visual.sk)
    throw new Error("VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY not set");

  const payload = { req_key: env.visual.reqKey, task_id: taskId };
  const signed = signVolcRequest({
    ak: env.visual.ak,
    sk: env.visual.sk,
    host: env.visual.host,
    region: env.visual.region,
    service: SERVICE,
    action: env.visual.queryAction,
    version: VERSION,
    body: JSON.stringify(payload),
  });

  const res = await request(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const json = (await res.body.json()) as {
    code?: number;
    message?: string;
    data?: { status?: string; video_url?: string; resp_data?: string };
  };
  const s = json.data?.status ?? "";
  const map: Record<string, QueryResult["status"]> = {
    in_queue: "pending",
    generating: "running",
    done: "succeeded",
    not_found: "failed",
    expire: "failed",
  };
  const status = map[s] ?? "running";
  let videoUrl = json.data?.video_url;
  if (!videoUrl && json.data?.resp_data) {
    try {
      const parsed = JSON.parse(json.data.resp_data) as { video_url?: string };
      videoUrl = parsed.video_url;
    } catch {
      // resp_data may be a plain URL string
      videoUrl = json.data.resp_data;
    }
  }
  return { status, videoUrl, message: json.message };
}
