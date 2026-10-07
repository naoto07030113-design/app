import { NextRequest, NextResponse } from "next/server";
import { handleRecruitingMessage } from "@/lib/recruiting";
import { replyLineMessage, verifyLineSignature } from "@/lib/line";

type LineTextEvent = {
  type: "message";
  replyToken: string;
  source: { userId?: string };
  message: { type: "text"; text: string };
};

type LineWebhookBody = {
  events?: Array<LineTextEvent | Record<string, unknown>>;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as LineWebhookBody;

  for (const event of body.events ?? []) {
    if (
      event.type !== "message" ||
      !("message" in event) ||
      event.message.type !== "text" ||
      !event.source.userId
    ) {
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
