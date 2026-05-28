import type { BoundaryConfig, BoundaryViolation } from "@aiperson/shared";

export function checkUserInput(
  text: string,
  b: BoundaryConfig,
): BoundaryViolation | null {
  const lower = text.toLowerCase();
  for (const kw of b.forbiddenKeywords) {
    if (kw && lower.includes(kw.toLowerCase()))
      return { reason: "forbidden_keyword", matched: kw };
  }
  for (const topic of b.forbiddenTopics) {
    if (topic && lower.includes(topic.toLowerCase()))
      return { reason: "forbidden_topic", matched: topic };
  }
  return null;
}

export function checkOutputChunk(
  text: string,
  b: BoundaryConfig,
): BoundaryViolation | null {
  const lower = text.toLowerCase();
  for (const kw of b.forbiddenKeywords) {
    if (kw && lower.includes(kw.toLowerCase()))
      return { reason: "forbidden_keyword", matched: kw };
  }
  return null;
}
