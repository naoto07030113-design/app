import { NextRequest, NextResponse } from "next/server";
import { handleRecruitingMessage } from "@/lib/recruiting";
import { replyLineMessage, verifyLineSignature } from "@/lib/line";

type LineTextEvent = {
  type: "message";
  replyToken: string;
  webhookEventId?: string;
  source: { userId: string };
  message: { id: string; type: "text"; text: string };
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
    typeof value.message.id === "string" &&
    value.message.id.length > 0 &&
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
        eventId: typeof event.webhookEventId === "string" ? event.webhookEventId : event.message.id,
      });

      if (result.reply) await replyLineMessage(event.replyToken, result.reply);
    } catch {
      console.error("LINE recruiting webhook processing failed");
      await replyLineMessage(
        event.replyToken,
        "現在、システムの確認に時間がかかっています。保存できていない可能性があるため、少し時間をおいて同じ内容をもう一度送ってください。",
      ).catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true });
}
