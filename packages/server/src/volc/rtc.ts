import crypto from "node:crypto";
import { env } from "../env.js";
import { generateAccessToken } from "./rtc-token-v3.js";

// VolcEngine RTC token generation.
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
  if (!env.rtc.appId) throw new Error("VOLC_RTC_APP_ID not set");

  // Preferred path: V3 token signed locally with appKey — supports per-session
  // roomId/userId.
  if (env.rtc.appKey) {
    const roomId = opts.roomId ?? `room_${Date.now()}`;
    const userId =
      opts.userId ?? `u_${crypto.randomBytes(4).toString("hex")}`;
    const token = generateAccessToken({
      appId: env.rtc.appId,
      appKey: env.rtc.appKey,
      roomId,
      userId,
      ttlSeconds: opts.ttlSeconds ?? 24 * 3600,
    });
    return { appId: env.rtc.appId, token, roomId, userId };
  }

  // Fallback: a console-issued test token bound to a fixed room/user.
  if (env.rtc.testToken) {
    return {
      appId: env.rtc.appId,
      token: env.rtc.testToken,
      roomId: env.rtc.testRoom || opts.roomId || `room_${Date.now()}`,
      userId:
        env.rtc.testUser ||
        opts.userId ||
        `u_${crypto.randomBytes(4).toString("hex")}`,
    };
  }

  throw new Error("VOLC_RTC_APP_KEY or VOLC_RTC_TEST_TOKEN must be set");
}
