import { useEffect, useRef, useState } from "react";
import type { BoundaryConfig, LiveSessionResponse } from "@aiperson/shared";
import { ImageUpload, type UploadedImage } from "../components/ImageUpload.js";
import { ChipInput } from "../components/ChipInput.js";
import {
  chatStream,
  startAgent,
  startLive,
  stopLive,
} from "../api/client.js";
import { joinAvatarRoom, type RtcSession } from "../rtc/client.js";

interface Message {
  role: "user" | "assistant" | "refusal";
  text: string;
}

const DEFAULT_BOUNDARY: BoundaryConfig = {
  persona: "一位耐心的中学物理老师，名叫小理",
  allowedTopics: ["牛顿三定律", "力与运动", "课堂例题"],
  forbiddenTopics: ["政治", "宗教", "其他学科超纲内容"],
  mustSay: ["回答时鼓励学生提问"],
  freeImprov: "可以举生活中的例子帮助理解",
  forbiddenKeywords: [],
  refusalReply: "这个问题超出了我们今天课堂的范围，我们继续看下一个内容。",
};

export function LivePanel(): JSX.Element {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [boundary, setBoundary] = useState<BoundaryConfig>(DEFAULT_BOUNDARY);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rtcInfo, setRtcInfo] = useState<LiveSessionResponse | null>(null);
  const [agentReady, setAgentReady] = useState<boolean>(false);
  const [micOn, setMicOn] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const rtcRef = useRef<RtcSession | null>(null);

  useEffect(() => {
    return () => {
      if (rtcRef.current) void rtcRef.current.leave();
    };
  }, []);

  const update = <K extends keyof BoundaryConfig>(
    k: K,
    v: BoundaryConfig[K],
  ): void => setBoundary((prev) => ({ ...prev, [k]: v }));

  const scrollToBottom = (): void => {
    requestAnimationFrame(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  const onStart = async (): Promise<void> => {
    setError("");
    try {
      const r = await startLive({
        boundary,
        imageBase64: image?.base64,
        imageMime: image?.mime,
      });
      setSessionId(r.sessionId);
      setRtcInfo(r);
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onJoinRtc = async (): Promise<void> => {
    if (!sessionId || !rtcInfo || !videoContainerRef.current) return;
    setError("");
    try {
      const session = await joinAvatarRoom({
        appId: rtcInfo.rtcAppId,
        token: rtcInfo.rtcToken,
        roomId: rtcInfo.roomId,
        userId: rtcInfo.userId,
        avatarUserId: rtcInfo.avatarUserId,
        remoteVideoEl: videoContainerRef.current,
        onError: (msg) => setError(msg),
      });
      rtcRef.current = session;
      await startAgent({
        sessionId,
        roomId: rtcInfo.roomId,
        userId: rtcInfo.userId,
      });
      setAgentReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onToggleMic = async (): Promise<void> => {
    if (!rtcRef.current) return;
    const next = !micOn;
    try {
      await rtcRef.current.toggleMic(next);
      setMicOn(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onStop = async (): Promise<void> => {
    if (!sessionId) return;
    if (rtcRef.current) {
      await rtcRef.current.leave();
      rtcRef.current = null;
    }
    await stopLive(sessionId, rtcInfo?.roomId);
    setSessionId(null);
    setRtcInfo(null);
    setAgentReady(false);
    setMicOn(false);
  };

  const onSend = async (): Promise<void> => {
    if (!sessionId || !input.trim() || streaming) return;
    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    setStreaming(true);
    scrollToBottom();
    await chatStream(sessionId, userText, {
      onDelta: (delta) => {
        setMessages((prev) => {
          const arr = [...prev];
          const last = arr[arr.length - 1];
          if (last && last.role === "assistant")
            arr[arr.length - 1] = { ...last, text: last.text + delta };
          return arr;
        });
        scrollToBottom();
      },
      onRefusal: (text) => {
        setMessages((prev) => {
          const arr = [...prev];
          if (arr[arr.length - 1]?.role === "assistant") arr.pop();
          arr.push({ role: "refusal", text });
          return arr;
        });
        scrollToBottom();
      },
      onError: (msg) => setError(msg),
      onDone: () => setStreaming(false),
    });
    setStreaming(false);
  };

  if (!sessionId) {
    return (
      <div className="panel">
        <h3>形态二 · 实时互动角色</h3>
        <div className="field-hint" style={{ marginBottom: 12 }}>
          配置角色边界后启动会话，进入放映模式时角色会浮在幻灯片上响应学生提问。
        </div>

        <div className="field">
          <label className="field-label">角色形象（可选）</label>
          <ImageUpload value={image} onChange={setImage} />
        </div>

        <div className="field">
          <label className="field-label">角色设定</label>
          <textarea
            value={boundary.persona}
            onChange={(e) => update("persona", e.target.value)}
            placeholder="例如：一位耐心的中学物理老师，名叫小理"
          />
        </div>

        <div className="field">
          <label className="field-label">只能讨论的话题（白名单）</label>
          <ChipInput
            values={boundary.allowedTopics}
            onChange={(v) => update("allowedTopics", v)}
            placeholder="按回车添加，如：牛顿三定律"
          />
        </div>

        <div className="field">
          <label className="field-label">禁止讨论的话题（黑名单）</label>
          <ChipInput
            values={boundary.forbiddenTopics}
            onChange={(v) => update("forbiddenTopics", v)}
            placeholder="按回车添加"
          />
        </div>

        <div className="field">
          <label className="field-label">必须提及的要点</label>
          <ChipInput
            values={boundary.mustSay}
            onChange={(v) => update("mustSay", v)}
            placeholder="按回车添加"
          />
        </div>

        <div className="field">
          <label className="field-label">可自由发挥的范围</label>
          <textarea
            value={boundary.freeImprov}
            onChange={(e) => update("freeImprov", e.target.value)}
            placeholder="例如：可以举生活中的例子帮助理解"
          />
        </div>

        <div className="field">
          <label className="field-label">敏感词（硬过滤）</label>
          <ChipInput
            values={boundary.forbiddenKeywords}
            onChange={(v) => update("forbiddenKeywords", v)}
            placeholder="按回车添加"
          />
        </div>

        <div className="field">
          <label className="field-label">越界时的拒答话术</label>
          <input
            type="text"
            value={boundary.refusalReply}
            onChange={(e) => update("refusalReply", e.target.value)}
          />
        </div>

        <button
          className="primary"
          onClick={onStart}
          style={{ width: "100%" }}
        >
          启动实时角色
        </button>
        {error && <div className="status error">错误：{error}</div>}
      </div>
    );
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <h3>实时对话 · {boundary.persona || "未命名角色"}</h3>
      {rtcInfo && (
        <div className="field-hint" style={{ marginBottom: 8 }}>
          RTC 房间：{rtcInfo.roomId} · 用户：{rtcInfo.userId.slice(0, 12)}
          {agentReady ? " · 智能体已就位" : ""}
        </div>
      )}

      <div
        ref={videoContainerRef}
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#0d1117",
          borderRadius: 6,
          marginBottom: 8,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {!agentReady && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8b949e",
              fontSize: 12,
            }}
          >
            点击"启动数字人"加入 RTC 房间
          </div>
        )}
      </div>

      <div className="row" style={{ marginBottom: 8 }}>
        {!agentReady ? (
          <button className="primary" onClick={onJoinRtc}>
            启动数字人
          </button>
        ) : (
          <button onClick={onToggleMic}>
            {micOn ? "🎙️ 关闭麦克风" : "🎙️ 开启麦克风"}
          </button>
        )}
        <button onClick={onStop}>结束会话</button>
      </div>

      <div className="messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="field-hint">输入第一句话开始测试角色对话边界</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text || (streaming && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
      </div>
      <div className="row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="模拟学生提问…"
          rows={2}
        />
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="primary" onClick={onSend} disabled={streaming}>
          发送（文本通道）
        </button>
      </div>
      {error && <div className="status error">错误：{error}</div>}
    </div>
  );
}
