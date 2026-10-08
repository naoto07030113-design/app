import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { advanceIntake, departmentOf, initialState, intakeSummary, readState } from "@/lib/recruiting-flow";
import { informationReply } from "@/lib/recruiting-content";
export type { Department } from "@/lib/recruiting-flow";

export async function handleRecruitingMessage(params: { lineUserId: string; message: string; eventId: string }) {
  const supabase = getSupabaseAdmin();
  const { error: createError } = await supabase.from("applicants").upsert(
    { line_user_id: params.lineUserId, source: "line" },
    { onConflict: "line_user_id", ignoreDuplicates: true },
  );
  if (createError) throw createError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: applicant, error } = await supabase.from("applicants")
      .select("id,department,status,intake_state,intake_revision")
      .eq("line_user_id", params.lineUserId).single();
    if (error) throw error;
    const previous = readState(applicant.intake_state ?? initialState());
    const managed = !["new", "ai_handling", "human_review"].includes(applicant.status);
    if (managed) { previous.mode = "human"; delete previous.screen; }
    const browse = informationReply(params.message.normalize("NFKC").trim().replace(/:/g, "："));
    const result = advanceIntake(previous, managed && !browse ? "" : params.message.slice(0, 5000));
    const profileAnswers = (state: typeof previous) => Object.fromEntries(Object.entries(state.answers).filter(([key]) => !["consultTopic", "consultNote", "visitTiming"].includes(key)));
    const answersChanged = JSON.stringify(profileAnswers(previous)) !== JSON.stringify(profileAnswers(result.state));
    const department = managed || !answersChanged ? applicant.department : departmentOf(result.state);
    const { data: committed, error: commitError } = await supabase.rpc("recruiting_commit_turn", {
      p_applicant_id: applicant.id, p_revision: applicant.intake_revision, p_event_id: params.eventId,
      p_state: result.state, p_inbound: params.message.slice(0, 5000), p_outbound: result.reply.text,
      p_department: department, p_summary: intakeSummary(result.state), p_handoff: result.handoff, p_apply_answers: answersChanged,
    });
    if (commitError) throw commitError;
    if (committed === "duplicate") return { reply: null, applicantId: applicant.id, department };
    if (committed === "committed") return { reply: result.reply, applicantId: applicant.id, department };
  }
  throw new Error("Recruiting conversation is busy; please retry.");
}
