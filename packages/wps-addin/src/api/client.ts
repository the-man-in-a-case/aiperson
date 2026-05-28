import type {
  BoundaryConfig,
  Emotion,
  LiveSessionResponse,
  VideoTaskResult,
} from "@aiperson/shared";

const BASE = (import.meta.env.VITE_API_BASE as string) ?? "http://localhost:8787";

export async function generateVideo(args: {
  imageBase64: string;
  imageMime: string;
  text: string;
  emotion: Emotion;
  voice?: string;
}): Promise<{ taskId: string }> {
  const res = await fetch(`${BASE}/video/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`generate failed: ${res.status}`);
  return res.json();
}

export async function pollVideo(taskId: string): Promise<VideoTaskResult> {
  const res = await fetch(`${BASE}/video/task/${taskId}`);
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function startLive(args: {
  boundary: BoundaryConfig;
  imageBase64?: string;
  imageMime?: string;
  voice?: string;
}): Promise<LiveSessionResponse> {
  const res = await fetch(`${BASE}/live/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return res.json();
}

export async function startAgent(args: {
  sessionId: string;
  roomId: string;
  userId: string;
  avatarImageUrl?: string;
}): Promise<{ taskId: string; agentUserId: string }> {
  const res = await fetch(`${BASE}/live/agent/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`agent start failed: ${t}`);
  }
  return res.json();
}

export async function stopLive(sessionId: string, roomId?: string): Promise<void> {
  await fetch(`${BASE}/live/stop`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, roomId }),
  });
}

export interface ChatStreamHandlers {
  onDelta?: (text: string) => void;
  onRefusal?: (text: string, reason: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (msg: string) => void;
}

export async function chatStream(
  sessionId: string,
  userText: string,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, userText }),
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(`stream failed: ${res.status}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const block of events) {
      const lines = block.split("\n");
      let eventName = "message";
      let data = "";
      for (const ln of lines) {
        if (ln.startsWith("event:")) eventName = ln.slice(6).trim();
        else if (ln.startsWith("data:")) data += ln.slice(5).trim();
      }
      if (!data) continue;
      let payload: any;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      if (eventName === "delta") {
        full += payload.text ?? "";
        handlers.onDelta?.(payload.text ?? "");
      } else if (eventName === "refusal") {
        handlers.onRefusal?.(
          payload.text ?? "",
          payload.violation?.reason ?? "out_of_scope",
        );
      } else if (eventName === "done") {
        handlers.onDone?.(payload.text ?? full);
      } else if (eventName === "error") {
        handlers.onError?.(payload.message ?? "unknown");
      }
    }
  }
}
