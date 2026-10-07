import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type Department = "welfare" | "therapy" | "unknown";

function inferDepartment(input: string): Department {
  const normalized = input.toLowerCase();
  if (/グループホーム|gh|デイ|介護|福祉|生活支援|世話人/.test(normalized)) return "welfare";
  if (/訪問マッサージ|マッサージ|鍼灸|整骨|柔整|療術|あん摩/.test(normalized)) return "therapy";
  return "unknown";
}

function fallbackReply(message: string, department: Department) {
  if (department === "welfare") {
    return "ありがとうございます。福祉部門の採用についてご案内します。希望する職種、保有資格、勤務できる曜日・時間帯を教えてください。";
  }
  if (department === "therapy") {
    return "ありがとうございます。療術部門の採用についてご案内します。希望する職種、保有資格、希望勤務日数を教えてください。";
  }
  return "お問い合わせありがとうございます。ご希望は「福祉のお仕事」と「療術のお仕事」のどちらでしょうか？";
}

export async function handleRecruitingMessage(params: {
  lineUserId: string;
  message: string;
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: applicantLookupError } = await supabase
    .from("applicants")
    .select("id, department, status")
    .eq("line_user_id", params.lineUserId)
    .maybeSingle();

  if (applicantLookupError) throw applicantLookupError;

  const inferred = inferDepartment(params.message);
  const department =
    existing?.department && existing.department !== "unknown"
      ? existing.department
      : inferred;

  let applicantId = existing?.id as string | undefined;

  if (!applicantId) {
    const { data: inserted, error } = await supabase
      .from("applicants")
      .insert({
        line_user_id: params.lineUserId,
        department,
        status: "ai_handling",
        source: "line",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) throw error;
    applicantId = inserted.id;
  } else {
    const updates: Record<string, unknown> = { updated_at: now };
    if ((!existing?.department || existing.department === "unknown") && inferred !== "unknown") {
      updates.department = inferred;
    }
    await supabase.from("applicants").update(updates).eq("id", applicantId);
  }

  const { error: messageSaveError } = await supabase.from("messages").insert({
    applicant_id: applicantId,
    direction: "inbound",
    channel: "line",
    body: params.message,
    created_at: now,
  });
  if (messageSaveError) throw messageSaveError;

  let reply = fallbackReply(params.message, department);

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-5.6-mini";
    const { data: jobs } = await supabase
      .from("jobs")
      .select("title, department, employment_type, salary_text, schedule_text, location_text, required_qualifications, description")
      .eq("active", true)
      .in("department", department === "unknown" ? ["welfare", "therapy"] : [department]);

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "あなたは有限会社イトーメディカルケアのAI採用担当です。登録された求人情報だけを根拠に回答してください。推測で給与や休日を作らないでください。不明な場合は本部確認が必要と伝えてください。採否判断はせず、応募者の希望・資格・勤務条件を整理し、見学または人間の採用担当につなげてください。回答はLINE向けに簡潔な日本語で。",
        },
        {
          role: "user",
          content: `応募者メッセージ: ${params.message}\n\n現在の部門: ${department}\n\n求人情報: ${JSON.stringify(jobs ?? [])}`,
        },
      ],
    });
    if (response.output_text?.trim()) reply = response.output_text.trim();
  }

  const { error: replySaveError } = await supabase.from("messages").insert({
    applicant_id: applicantId,
    direction: "outbound",
    channel: "line",
    body: reply,
    created_at: new Date().toISOString(),
  });
  if (replySaveError) throw replySaveError;

  return { reply, applicantId, department };
}
