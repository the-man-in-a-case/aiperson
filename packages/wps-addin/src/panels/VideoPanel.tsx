import { useEffect, useRef, useState } from "react";
import type { Emotion } from "@aiperson/shared";
import { ImageUpload, type UploadedImage } from "../components/ImageUpload.js";
import { generateVideo, pollVideo } from "../api/client.js";
import { insertVideoToSlide, isInWps } from "../wps/wps.js";

const EMOTIONS: { value: Emotion; label: string }[] = [
  { value: "neutral", label: "中性" },
  { value: "happy", label: "开心" },
  { value: "serious", label: "严肃" },
  { value: "gentle", label: "温和" },
  { value: "surprised", label: "惊讶" },
  { value: "sad", label: "难过" },
  { value: "angry", label: "气愤" },
];

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "polling"; taskId: string; videoUrl?: string }
  | { kind: "ready"; videoUrl: string }
  | { kind: "error"; message: string };

export function VideoPanel(): JSX.Element {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [text, setText] = useState<string>("");
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, []);

  const startPolling = (taskId: string): void => {
    const tick = async (): Promise<void> => {
      try {
        const r = await pollVideo(taskId);
        if (r.status === "succeeded" && r.videoUrl) {
          setStatus({ kind: "ready", videoUrl: r.videoUrl });
          return;
        }
        if (r.status === "failed") {
          setStatus({
            kind: "error",
            message: r.errorMessage ?? "生成失败",
          });
          return;
        }
        pollTimer.current = window.setTimeout(tick, 4000);
      } catch (e) {
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    };
    tick();
  };

  const onGenerate = async (): Promise<void> => {
    if (!image) {
      setStatus({ kind: "error", message: "请先上传角色图片" });
      return;
    }
    if (!text.trim()) {
      setStatus({ kind: "error", message: "请输入要说的内容" });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const { taskId } = await generateVideo({
        imageBase64: image.base64,
        imageMime: image.mime,
        text: text.trim(),
        emotion,
      });
      setStatus({ kind: "polling", taskId });
      startPolling(taskId);
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const onInsert = async (): Promise<void> => {
    if (status.kind !== "ready") return;
    await insertVideoToSlide(status.videoUrl);
  };

  return (
    <div className="panel">
      <h3>形态一 · 数字人视频</h3>
      <div className="field-hint" style={{ marginBottom: 12 }}>
        上传角色图，输入要说的话与情绪，生成视频后一键插入到当前幻灯片。适用于课前介绍、重点讲解。
      </div>

      <div className="field">
        <label className="field-label">角色图片</label>
        <ImageUpload value={image} onChange={setImage} />
      </div>

      <div className="field">
        <label className="field-label">要说的内容</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：同学们好，今天我们来讲讲牛顿三定律的第一定律——惯性定律……"
          maxLength={2000}
        />
        <div className="field-hint">{text.length} / 2000 字</div>
      </div>

      <div className="field">
        <label className="field-label">情绪</label>
        <select
          value={emotion}
          onChange={(e) => setEmotion(e.target.value as Emotion)}
        >
          {EMOTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <button
        className="primary"
        onClick={onGenerate}
        disabled={status.kind === "submitting" || status.kind === "polling"}
        style={{ width: "100%" }}
      >
        {status.kind === "submitting"
          ? "提交中…"
          : status.kind === "polling"
            ? "生成中（约 30s-2min）…"
            : "生成视频"}
      </button>

      {status.kind === "polling" && (
        <div className="status info">
          任务 ID: {status.taskId.slice(0, 8)}… 视频生成中，请稍候。
        </div>
      )}

      {status.kind === "ready" && (
        <>
          <div className="status success">视频已生成</div>
          <video
            src={status.videoUrl}
            controls
            style={{ width: "100%", marginTop: 8, borderRadius: 6 }}
          />
          <button
            className="primary"
            onClick={onInsert}
            style={{ width: "100%", marginTop: 8 }}
          >
            {isInWps() ? "插入到当前幻灯片" : "在新窗口打开（非 WPS 环境）"}
          </button>
        </>
      )}

      {status.kind === "error" && (
        <div className="status error">错误：{status.message}</div>
      )}
    </div>
  );
}
