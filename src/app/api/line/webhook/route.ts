import { NextRequest, NextResponse } from "next/server";
import { handleRecruitingMessage } from "@/lib/recruiting";
import { replyLineMessage, verifyLineSignature } from "@/lib/line";

type LineTextEvent = {
  type: "message";
  replyToken: string;
  source: { userId: string };
  message: { type: "text"; text: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLineTextEvent(value: unknown): value is LineTextEvent {
  return (
    isRecord(value) &&
    value.type === "message" &&
    typeof value.replyToken === "string" &&
    value.replyToken.length > 0 &&
    isRecord(value.source) &&
    typeof value.source.userId === "string" &&
    value.source.userId.length > 0 &&
    isRecord(value.message) &&
    value.message.type === "text" &&
    typeof value.message.text === "string"
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!isRecord(body) || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "invalid events" }, { status: 400 });
  }

  for (const event of body.events) {
    if (!isLineTextEvent(event)) {
      continue;
    }

    try {
      const result = await handleRecruitingMessage({
        lineUserId: event.source.userId,
        message: event.message.text,
      });

      await replyLineMessage(event.replyToken, result.reply);
    } catch (error) {
      console.error("LINE recruiting webhook error", error);
      await replyLineMessage(
        event.replyToken,
        "現在、採用担当システムで確認に時間がかかっています。内容は受け付けていますので、採用担当からの確認をお待ちください。",
      ).catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true });
}
