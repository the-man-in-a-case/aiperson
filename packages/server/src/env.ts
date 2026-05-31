import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
for (const candidate of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(here, "../../../.env"),
  path.resolve(here, "../../../../.env"),
]) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

function get(name: string, fallback = ""): string {
  const v = process.env[name];
  return v == null || v === "" ? fallback : v;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const env = {
  port: Number(get("PORT", "8787")),
  corsOrigin: get("CORS_ORIGIN", "http://localhost:5173"),
  logLevel: get("LOG_LEVEL", "info"),

  ark: {
    apiKey: get("ARK_API_KEY"),
    baseUrl: get("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
    model: get("ARK_MODEL", "doubao-1-5-pro-32k-250115"),
  },

  visual: {
    ak: get("VOLC_ACCESS_KEY_ID"),
    sk: get("VOLC_SECRET_ACCESS_KEY"),
    host: get("VOLC_VISUAL_HOST", "visual.volcengineapi.com"),
    region: get("VOLC_REGION", "cn-north-1"),
    reqKey: get("VOLC_OMNIHUMAN_REQ_KEY", "realman_avatar_picture_omni_human"),
    submitAction: get("VOLC_OMNIHUMAN_SUBMIT_ACTION", "CVSync2AsyncSubmitTask"),
    queryAction: get("VOLC_OMNIHUMAN_QUERY_ACTION", "CVSync2AsyncGetResult"),
  },

  tts: {
    appid: get("VOLC_TTS_APPID"),
    token: get("VOLC_TTS_TOKEN"),
    sk: get("VOLC_TTS_SK"),
    cluster: get("VOLC_TTS_CLUSTER", "volcano_tts"),
    voice: get("VOLC_TTS_VOICE", "BV700_streaming"),
    host: get("VOLC_TTS_HOST", "openspeech.bytedance.com"),
  },

  rtc: {
    appId: get("VOLC_RTC_APP_ID"),
    appKey: get("VOLC_RTC_APP_KEY"),
    agentEndpointId: get("VOLC_RTC_AGENT_ENDPOINT_ID"),
    testToken: get("VOLC_RTC_TEST_TOKEN"),
    testRoom: get("VOLC_RTC_TEST_ROOM"),
    testUser: get("VOLC_RTC_TEST_USER"),
  },
};

export { required };
