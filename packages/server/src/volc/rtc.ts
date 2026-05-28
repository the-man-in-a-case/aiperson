import crypto from "node:crypto";
import { env } from "../env.js";

// VolcEngine RTC token generation (simplified static token model).
// Production should use the official server SDK to generate signed tokens.
// Doc: https://www.volcengine.com/docs/6348/70121

export interface RtcToken {
  appId: string;
  token: string;
  roomId: string;
  userId: string;
}

export function generateRtcToken(opts: {
  roomId?: string;
  userId?: string;
  ttlSeconds?: number;
}): RtcToken {
  if (!env.rtc.appId || !env.rtc.appKey)
    throw new Error("VOLC_RTC_APP_ID / VOLC_RTC_APP_KEY not set");
  const roomId = opts.roomId ?? `room_${Date.now()}`;
  const userId = opts.userId ?? `u_${crypto.randomBytes(4).toString("hex")}`;
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 3600);
  const payload = `${env.rtc.appId}:${roomId}:${userId}:${exp}`;
  const sig = crypto
    .createHmac("sha256", env.rtc.appKey)
    .update(payload)
    .digest("base64url");
  const token = Buffer.from(`${payload}:${sig}`).toString("base64url");
  return { appId: env.rtc.appId, token, roomId, userId };
}
