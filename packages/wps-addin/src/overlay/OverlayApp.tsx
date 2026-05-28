import { useEffect, useRef, useState } from "react";
import { joinAvatarRoom, type RtcSession } from "../rtc/client.js";
import { startAgent, stopLive } from "../api/client.js";
import { readOverlayPayload, type OverlayPayload } from "./bridge.js";

export function OverlayApp(): JSX.Element {
  const [payload] = useState<OverlayPayload | null>(() => readOverlayPayload());
  const [micOn, setMicOn] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("正在连接…");
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const rtcRef = useRef<RtcSession | null>(null);

  useEffect(() => {
    if (!payload || !videoRef.current) {
      setStatus("缺少会话信息，请回主面板重新启动");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { rtcInfo, sessionId } = payload;
        const sess = await joinAvatarRoom({
          appId: rtcInfo.rtcAppId,
          token: rtcInfo.rtcToken,
          roomId: rtcInfo.roomId,
          userId: `${rtcInfo.userId}_overlay`,
          avatarUserId: rtcInfo.avatarUserId,
          remoteVideoEl: videoRef.current!,
          onError: (m) => setStatus(`错误：${m}`),
        });
        if (cancelled) {
          await sess.leave();
          return;
        }
        rtcRef.current = sess;
        await startAgent({
          sessionId,
          roomId: rtcInfo.roomId,
          userId: `${rtcInfo.userId}_overlay`,
        });
        setStatus("");
      } catch (e) {
        setStatus(`启动失败：${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
      if (rtcRef.current) void rtcRef.current.leave();
    };
  }, [payload]);

  const toggleMic = async (): Promise<void> => {
    if (!rtcRef.current) return;
    const next = !micOn;
    await rtcRef.current.toggleMic(next);
    setMicOn(next);
  };

  const onClose = async (): Promise<void> => {
    if (rtcRef.current) await rtcRef.current.leave();
    if (payload) await stopLive(payload.sessionId, payload.rtcInfo.roomId);
    window.close();
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "rgba(13, 17, 23, 0.92)",
        color: "#fff",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0,0,0,0.4)",
          cursor: "move",
          userSelect: "none",
        }}
      >
        <span>{payload?.personaLabel ?? "AI 数字人"}</span>
        <span style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={miniBtn}
          >
            {collapsed ? "展开" : "收起"}
          </button>
          <button onClick={onClose} style={miniBtn}>关闭</button>
        </span>
      </div>

      {!collapsed && (
        <div
          ref={videoRef}
          style={{
            flex: 1,
            background: "#000",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {status && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: "#8b949e",
                textAlign: "center",
                padding: 12,
              }}
            >
              {status}
            </div>
          )}
        </div>
      )}

      {!collapsed && (
        <div
          style={{
            padding: 8,
            display: "flex",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          <button
            onClick={toggleMic}
            style={{
              ...miniBtn,
              padding: "6px 14px",
              background: micOn ? "#1f883d" : "#30363d",
            }}
          >
            {micOn ? "🎙️ 麦克风开" : "🎙️ 麦克风关"}
          </button>
        </div>
      )}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "2px 8px",
  border: "1px solid #30363d",
  background: "#21262d",
  color: "#fff",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
};
