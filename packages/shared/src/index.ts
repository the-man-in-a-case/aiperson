export type Emotion =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "surprised"
  | "serious"
  | "gentle";

export interface VideoGenerateRequest {
  imageBase64: string;
  imageMime: string;
  text: string;
  emotion: Emotion;
  voice?: string;
}

export interface VideoGenerateResponse {
  taskId: string;
}

export type VideoTaskStatus = "pending" | "running" | "succeeded" | "failed";

export interface VideoTaskResult {
  taskId: string;
  status: VideoTaskStatus;
  videoUrl?: string;
  errorMessage?: string;
}

export interface BoundaryConfig {
  persona: string;
  allowedTopics: string[];
  forbiddenTopics: string[];
  mustSay: string[];
  freeImprov: string;
  forbiddenKeywords: string[];
  refusalReply: string;
}

export interface LiveSessionRequest {
  imageBase64?: string;
  imageMime?: string;
  boundary: BoundaryConfig;
  voice?: string;
}

export interface LiveSessionResponse {
  sessionId: string;
  rtcAppId: string;
  rtcToken: string;
  roomId: string;
  userId: string;
  avatarUserId: string;
}

export interface ChatStreamRequest {
  sessionId: string;
  userText: string;
}

export interface BoundaryViolation {
  reason: string;
  matched?: string;
}

export function buildSystemPrompt(b: BoundaryConfig): string {
  const lines: string[] = [];
  if (b.persona) lines.push(`你扮演的角色：${b.persona}`);
  if (b.allowedTopics.length)
    lines.push(`你只能在以下话题范围内回答：${b.allowedTopics.join("、")}。`);
  if (b.forbiddenTopics.length)
    lines.push(
      `严禁讨论以下话题，被问到一律按下面"拒答话术"回应：${b.forbiddenTopics.join("、")}。`,
    );
  if (b.mustSay.length)
    lines.push(`如果话题相关，请务必提及以下要点：${b.mustSay.join("；")}。`);
  if (b.freeImprov)
    lines.push(`你可以在以下方面自由发挥：${b.freeImprov}。`);
  if (b.refusalReply)
    lines.push(`当超出范围时，回复："${b.refusalReply}"`);
  lines.push("回答必须简洁、口语化、适合课堂朗读，禁止使用 markdown 列表或代码块。");
  return lines.join("\n");
}
