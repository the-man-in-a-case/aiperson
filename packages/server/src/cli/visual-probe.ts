import "../env.js";
import { submitOmniHumanTask, queryOmniHumanTask } from "../volc/omnihuman.js";

const cmd = process.argv[2];

(async () => {
  try {
  if (cmd === "submit") {
    const imageUrl = process.argv[3];
    const audioUrl = process.argv[4];
    if (!imageUrl || !audioUrl) {
      console.error("usage: visual-probe submit <image_url> <audio_url>");
      process.exit(2);
    }
    const taskId = await submitOmniHumanTask({ imageUrl, audioUrl });
    console.log(`task_id: ${taskId}`);
  } else if (cmd === "query") {
    const taskId = process.argv[3];
    if (!taskId) {
      console.error("usage: visual-probe query <task_id>");
      process.exit(2);
    }
    const r = await queryOmniHumanTask(taskId);
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.error("usage:\n  visual-probe submit <image_url> <audio_url>\n  visual-probe query <task_id>");
    process.exit(2);
  }
  } catch (e) {
    console.error("ERR:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
})();
