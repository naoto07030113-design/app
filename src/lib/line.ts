import crypto from "node:crypto";
import type { FlowReply } from "@/lib/recruiting-flow";

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

export function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature);
  return (
    expectedBytes.length === signatureBytes.length &&
    crypto.timingSafeEqual(expectedBytes, signatureBytes)
  );
}

export function buildLineTextMessage(reply: string | FlowReply) {
  const text = typeof reply === "string" ? reply : reply.text;
  const choices = typeof reply === "string" ? [] : reply.choices;
  return {
    type: "text", text: text.slice(0, 5000),
    ...(choices.length ? { quickReply: { items: choices.slice(0, 13).map(choice => ({
      type: "action", action: { type: "message", label: choice.label.slice(0, 20), text: choice.text },
    })) } } : {}),
  };
}

export async function replyLineMessage(replyToken: string, reply: string | FlowReply) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured.");
  }

  const response = await fetch(LINE_REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [buildLineTextMessage(reply)],
    }),
  });

  if (!response.ok) {
    throw new Error(`LINE reply failed: ${response.status}`);
  }
}
