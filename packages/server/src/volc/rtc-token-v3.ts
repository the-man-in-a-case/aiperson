import crypto from "node:crypto";

// VolcEngine RTC AccessToken V3 generator.
// Faithful port of the official Node.js reference:
// https://github.com/volcengine/rtc-aigc-demo/blob/main/Server/token.js
//
// Wire format (all multi-byte ints are little-endian):
//   "001" + appId(24) + base64(
//     u16 msgLen || msg || u16 sigLen || sig
//   )
//   msg = u32 nonce
//       + u32 issuedAt
//       + u32 expireAt
//       + u16 roomIdLen + roomIdBytes
//       + u16 userIdLen + userIdBytes
//       + u16 numPrivs
//       + foreach priv: u16 key + u32 value
//   sig = HMAC_SHA256(appKey, msg)   // 32 bytes

export const VERSION = "001";
export const APP_ID_LENGTH = 24;

export enum Privilege {
  PublishStream = 0,
  PublishAudioStream = 1,
  PublishVideoStream = 2,
  PublishDataStream = 3,
  SubscribeStream = 4,
}

export interface TokenArgs {
  appId: string;
  appKey: string;
  roomId: string;
  userId: string;
  ttlSeconds?: number;
  privileges?: Partial<Record<Privilege, number>>;
}

class ByteBuf {
  private buf: number[] = [];

  putUint16(v: number): this {
    this.buf.push(v & 0xff, (v >>> 8) & 0xff);
    return this;
  }

  putUint32(v: number): this {
    this.buf.push(
      v & 0xff,
      (v >>> 8) & 0xff,
      (v >>> 16) & 0xff,
      (v >>> 24) & 0xff,
    );
    return this;
  }

  putBytes(b: Uint8Array): this {
    this.putUint16(b.length);
    for (const x of b) this.buf.push(x);
    return this;
  }

  putString(s: string): this {
    return this.putBytes(new TextEncoder().encode(s));
  }

  putRawBytes(b: Uint8Array): this {
    for (const x of b) this.buf.push(x);
    return this;
  }

  pack(): Buffer {
    return Buffer.from(this.buf);
  }
}

function packMsg(args: {
  nonce: number;
  issuedAt: number;
  expireAt: number;
  roomId: string;
  userId: string;
  privileges: Record<number, number>;
}): Buffer {
  const buf = new ByteBuf();
  buf.putUint32(args.nonce);
  buf.putUint32(args.issuedAt);
  buf.putUint32(args.expireAt);
  buf.putString(args.roomId);
  buf.putString(args.userId);
  const entries = Object.entries(args.privileges);
  buf.putUint16(entries.length);
  for (const [k, v] of entries) {
    buf.putUint16(Number(k));
    buf.putUint32(v);
  }
  return buf.pack();
}

export function generateAccessToken(args: TokenArgs): string {
  const ttl = args.ttlSeconds ?? 24 * 3600;
  const issuedAt = Math.floor(Date.now() / 1000);
  const expireAt = issuedAt + ttl;
  const nonce = crypto.randomBytes(4).readUInt32LE(0);

  const defaultPrivs: Record<number, number> = {
    [Privilege.PublishStream]: expireAt,
    [Privilege.PublishAudioStream]: expireAt,
    [Privilege.PublishVideoStream]: expireAt,
    [Privilege.PublishDataStream]: expireAt,
    [Privilege.SubscribeStream]: expireAt,
  };
  const privileges: Record<number, number> = {
    ...defaultPrivs,
    ...(args.privileges as Record<number, number> | undefined),
  };

  const msg = packMsg({
    nonce,
    issuedAt,
    expireAt,
    roomId: args.roomId,
    userId: args.userId,
    privileges,
  });

  const sig = crypto
    .createHmac("sha256", args.appKey)
    .update(msg)
    .digest();

  const content = new ByteBuf().putBytes(msg).putBytes(sig).pack();
  return VERSION + args.appId + content.toString("base64");
}

export interface DecodedToken {
  version: string;
  appId: string;
  nonce: number;
  issuedAt: number;
  expireAt: number;
  roomId: string;
  userId: string;
  privileges: Record<number, number>;
  signatureHex: string;
  signatureValid?: boolean;
}

class ReadByteBuf {
  private off = 0;
  constructor(private buf: Buffer) {}

  getUint16(): number {
    const v = this.buf.readUInt16LE(this.off);
    this.off += 2;
    return v;
  }
  getUint32(): number {
    const v = this.buf.readUInt32LE(this.off);
    this.off += 4;
    return v;
  }
  getBytes(): Buffer {
    const len = this.getUint16();
    const out = this.buf.subarray(this.off, this.off + len);
    this.off += len;
    return out;
  }
  getString(): string {
    return this.getBytes().toString("utf-8");
  }
}

export function decodeAccessToken(
  token: string,
  appKey?: string,
): DecodedToken {
  const version = token.slice(0, VERSION.length);
  const appId = token.slice(VERSION.length, VERSION.length + APP_ID_LENGTH);
  const content = Buffer.from(
    token.slice(VERSION.length + APP_ID_LENGTH),
    "base64",
  );

  const top = new ReadByteBuf(content);
  const msg = top.getBytes();
  const sig = top.getBytes();

  const m = new ReadByteBuf(msg);
  const nonce = m.getUint32();
  const issuedAt = m.getUint32();
  const expireAt = m.getUint32();
  const roomId = m.getString();
  const userId = m.getString();
  const numPrivs = m.getUint16();
  const privileges: Record<number, number> = {};
  for (let i = 0; i < numPrivs; i++) {
    const k = m.getUint16();
    const v = m.getUint32();
    privileges[k] = v;
  }

  let signatureValid: boolean | undefined;
  if (appKey) {
    const computed = crypto
      .createHmac("sha256", appKey)
      .update(msg)
      .digest();
    signatureValid = computed.equals(sig);
  }

  return {
    version,
    appId,
    nonce,
    issuedAt,
    expireAt,
    roomId,
    userId,
    privileges,
    signatureHex: sig.toString("hex"),
    signatureValid,
  };
}
