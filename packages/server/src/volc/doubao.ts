import OpenAI from "openai";
import { env } from "../env.js";

let client: OpenAI | null = null;

export function getDoubao(): OpenAI {
  if (!env.ark.apiKey) throw new Error("ARK_API_KEY not set");
  if (!client) {
    client = new OpenAI({
      apiKey: env.ark.apiKey,
      baseURL: env.ark.baseUrl,
    });
  }
  return client;
}

export const DOUBAO_MODEL = env.ark.model;
