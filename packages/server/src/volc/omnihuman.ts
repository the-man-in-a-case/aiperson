import { request } from "undici";
import { env } from "../env.js";
import { signVolcRequest } from "./sign.js";

// VolcEngine 智能视觉 - OmniHuman 1.5 数字人视频
// Doc: https://www.volcengine.com/docs/85621/1829013
//
// Service=cv, Region=cn-north-1, Action=CVSubmitTask | CVGetResult,
// Version=2022-08-31. Both image and audio are passed as PUBLIC URLs
// (not base64), so the caller must host them somewhere reachable
// from VolcEngine's servers.

const SERVICE = "cv";
const VERSION = "2022-08-31";

export interface SubmitArgs {
  imageUrl: string;
  audioUrl: string;
  prompt?: string;
  seed?: number;
  outputResolution?: 720 | 1080;
  peFastMode?: boolean;
  maskUrls?: string[];
}

export async function submitOmniHumanTask(args: SubmitArgs): Promise<string> {
  if (!env.visual.ak || !env.visual.sk)
    throw new Error("VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY not set");

  const payload: Record<string, unknown> = {
    req_key: env.visual.reqKey,
    image_url: args.imageUrl,
    audio_url: args.audioUrl,
  };
  if (args.prompt) payload.prompt = args.prompt;
  if (args.seed !== undefined) payload.seed = args.seed;
  if (args.outputResolution) payload.output_resolution = args.outputResolution;
  if (args.peFastMode !== undefined) payload.pe_fast_mode = args.peFastMode;
  if (args.maskUrls?.length) payload.mask_url = args.maskUrls;

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
  const raw = await res.body.text();
  let json: { code?: number; message?: string; data?: { task_id?: string } };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      `OmniHuman submit non-JSON response (status=${res.statusCode}): ${raw.slice(0, 300)}`,
    );
  }
  if (json.code === 50200)
    throw new Error(
      `OmniHuman 服务未在你的账号开通或 req_key 不匹配。${json.message ?? ""}`,
    );
  if (json.code === 50400)
    throw new Error(`OmniHuman 访问被拒绝。${json.message ?? ""}`);
  if (json.code !== 10000 || !json.data?.task_id)
    throw new Error(
      `OmniHuman submit failed: code=${json.code} ${json.message ?? "unknown"}`,
    );
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
  const raw = await res.body.text();
  let json: {
    code?: number;
    message?: string;
    data?: { status?: string; video_url?: string };
  };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`OmniHuman query invalid JSON: ${raw.slice(0, 200)}`);
  }
  if (json.code !== undefined && json.code !== 10000 && !json.data?.status) {
    return {
      status: "failed",
      message: `${json.code}: ${json.message ?? raw.slice(0, 200)}`,
    };
  }
  const s = json.data?.status ?? "";
  const map: Record<string, QueryResult["status"]> = {
    processing: "pending",
    in_queue: "pending",
    generating: "running",
    done: "succeeded",
    not_found: "failed",
    expired: "failed",
  };
  const status = map[s] ?? "running";
  return { status, videoUrl: json.data?.video_url, message: json.message };
}
