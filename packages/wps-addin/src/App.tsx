import { useState } from "react";
import { VideoPanel } from "./panels/VideoPanel.js";
import { LivePanel } from "./panels/LivePanel.js";

type Tab = "video" | "live";

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("video");
  return (
    <div className="app">
      <div className="tabs">
        <div
          className={`tab ${tab === "video" ? "active" : ""}`}
          onClick={() => setTab("video")}
        >
          数字人视频
        </div>
        <div
          className={`tab ${tab === "live" ? "active" : ""}`}
          onClick={() => setTab("live")}
        >
          实时互动
        </div>
      </div>
      {tab === "video" ? <VideoPanel /> : <LivePanel />}
    </div>
  );
}
