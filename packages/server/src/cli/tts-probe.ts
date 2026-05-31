import fs from "node:fs";
import { synthesize } from "../volc/tts.js";
import "../env.js";

const text = process.argv[2] ?? "同学们好，今天我们一起学习牛顿第一定律。";
const out = process.argv[3] ?? "/tmp/aiperson-tts.mp3";

(async () => {
  try {
    const r = await synthesize({ text, emotion: "happy" });
    const audio = Buffer.from(r.audioBase64, "base64");
    fs.writeFileSync(out, audio);
    console.log(`OK ${audio.length} bytes -> ${out}`);
  } catch (e) {
    console.error("FAIL:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
})();
