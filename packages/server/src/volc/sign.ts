import crypto from "node:crypto";

// VolcEngine OpenAPI Signature V4. Spec:
// https://www.volcengine.com/docs/6369/67269

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function hash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function uriEncode(s: string, encodeSlash = true): string {
  let out = "";
  for (const ch of s) {
    if (/[A-Za-z0-9\-._~]/.test(ch)) out += ch;
    else if (ch === "/" && !encodeSlash) out += ch;
    else out += encodeURIComponent(ch).replace(/!/g, "%21").replace(/\*/g, "%2A");
  }
  return out;
}

function canonicalQuery(query: Record<string, string>): string {
  const keys = Object.keys(query).sort();
  return keys
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k]!)}`)
    .join("&");
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface SignParams {
  ak: string;
  sk: string;
  host: string;
  region: string;
  service: string;
  action: string;
  version: string;
  method?: "GET" | "POST";
  body?: string;
}

export function signVolcRequest(p: SignParams): SignedRequest {
  const method = p.method ?? "POST";
  const body = p.body ?? "";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const xDate =
    now.getUTCFullYear().toString() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z";
  const shortDate = xDate.slice(0, 8);

  const query: Record<string, string> = {
    Action: p.action,
    Version: p.version,
  };
  const contentSha = hash(body);
  const headers: Record<string, string> = {
    host: p.host,
    "x-date": xDate,
    "x-content-sha256": contentSha,
    "content-type": "application/json",
  };

  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders =
    signedHeaderKeys.map((k) => `${k}:${headers[k]!.trim()}`).join("\n") + "\n";
  const signedHeaders = signedHeaderKeys.join(";");

  const canonicalRequest = [
    method,
    "/",
    canonicalQuery(query),
    canonicalHeaders,
    signedHeaders,
    contentSha,
  ].join("\n");

  const credentialScope = `${shortDate}/${p.region}/${p.service}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    hash(canonicalRequest),
  ].join("\n");

  const kDate = hmac(p.sk, shortDate);
  const kRegion = hmac(kDate, p.region);
  const kService = hmac(kRegion, p.service);
  const kSigning = hmac(kService, "request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  const authorization =
    `HMAC-SHA256 Credential=${p.ak}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${p.host}/?${canonicalQuery(query)}`,
    headers: { ...headers, Authorization: authorization },
    body,
  };
}
