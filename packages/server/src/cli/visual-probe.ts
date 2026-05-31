import "../env.js";
import { request } from "undici";
import { env } from "../env.js";
import { signVolcRequest } from "../volc/sign.js";

const candidates = [
  // User-provided seed + variants
  "jimeng_realman_avatar_picture_omni_v15",
  "realman_avatar_picture_omni_v15",
  "jimeng_realman_avatar_picture_omni_human_v15",
  "jimeng_realman_avatar_omni_v15",
  "jimeng_realman_picture_omni_v15",
  "jimeng_avatar_picture_omni_v15",
  "jimeng_omni_v15",
  "jimeng_realman_avatar_picture_omni",
  "jimeng_realman_avatar_picture_omnihuman_v15",
  "jimeng_realman_avatar_picture_omni_v1_5",
  "jimeng_realman_avatar_picture_omni_15",
  // Step-3 specific (video generation step)
  "jimeng_realman_avatar_picture_omni_v15_video",
  "jimeng_realman_avatar_picture_omni_v15_gen",
  // Audio2Video / lipsync framing
  "jimeng_realman_avatar_audio_omni_v15",
  "jimeng_avatar_a2v_omni_v15",
  "jimeng_lip_sync_omni_v15",
];

(async () => {
  for (const reqKey of candidates) {
    const signed = signVolcRequest({
      ak: env.visual.ak,
      sk: env.visual.sk,
      host: env.visual.host,
      region: env.visual.region,
      service: "cv",
      action: env.visual.submitAction,
      version: "2022-08-31",
      body: JSON.stringify({ req_key: reqKey, image_base64: "AAAA" }),
    });
    const res = await request(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
    });
    const json = (await res.body.json()) as {
      code?: number;
      message?: string;
    };
    const msg = json.message ?? "";
    const status =
      json.code === 10000
        ? "OK     "
        : msg.includes("not supported")
          ? "NO     "
          : msg.includes("Access Denied")
            ? "DENIED "
            : "MAYBE  ";
    console.log(`${status} ${reqKey.padEnd(55)} code=${json.code} msg=${msg.slice(0, 80)}`);
  }
})();
