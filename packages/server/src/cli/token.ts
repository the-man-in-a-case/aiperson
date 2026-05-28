import "../env.js";
import { env } from "../env.js";
import {
  decodeAccessToken,
  generateAccessToken,
} from "../volc/rtc-token-v3.js";

const [, , cmd, ...rest] = process.argv;

if (cmd === "gen") {
  const roomId = rest[0] ?? "test01";
  const userId = rest[1] ?? "techer01";
  if (!env.rtc.appId || !env.rtc.appKey) {
    console.error("VOLC_RTC_APP_ID / VOLC_RTC_APP_KEY must be set in .env");
    process.exit(2);
  }
  const token = generateAccessToken({
    appId: env.rtc.appId,
    appKey: env.rtc.appKey,
    roomId,
    userId,
    ttlSeconds: 24 * 3600,
  });
  console.log(token);
} else if (cmd === "decode") {
  const token = rest[0] ?? env.rtc.testToken;
  if (!token) {
    console.error("usage: token decode <token>");
    process.exit(2);
  }
  console.log(JSON.stringify(decodeAccessToken(token, env.rtc.appKey), null, 2));
} else if (cmd === "verify") {
  const token = rest[0] ?? env.rtc.testToken;
  if (!token || !env.rtc.appKey) {
    console.error("usage: token verify <token>  (requires VOLC_RTC_APP_KEY)");
    process.exit(2);
  }
  const d = decodeAccessToken(token, env.rtc.appKey);
  console.log(`signature valid: ${d.signatureValid}`);
  process.exit(d.signatureValid ? 0 : 1);
} else {
  console.error(
    "usage:\n  token gen [roomId] [userId]\n  token decode [token]\n  token verify [token]",
  );
  process.exit(2);
}
