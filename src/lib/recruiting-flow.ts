export type Department = "welfare" | "therapy" | "unknown";
type AnswerKey = "work" | "role" | "employment" | "sideJob" | "time" | "frequency" | "qualification" | "drive" | "start" | "next";
export type IntakeState = { version: 1; answers: Partial<Record<AnswerKey, string>>; mode: "intake" | "human" };
export type Choice = { label: string; text: string };
export type FlowReply = { text: string; choices: Choice[] };
type Question = { key: AnswerKey; text: string; options: string[] };
const CONSULT = "相談して決めたい";
const WORK = ["グループホーム", "デイサービス・介護", "院での施術・受付", "訪問マッサージ", CONSULT];
export const initialState = (): IntakeState => ({ version: 1, answers: {}, mode: "intake" });

export function readState(value: unknown): IntakeState {
  if (!value || typeof value !== "object") return initialState();
  const v = value as Partial<IntakeState>;
  if (v.version !== 1 || !v.answers || typeof v.answers !== "object") return initialState();
  const state = initialState();
  for (const key of ["work", "role", "employment", "sideJob", "time", "frequency", "qualification", "drive", "start", "next"] as AnswerKey[]) {
    const answer = v.answers[key];
    if (typeof answer === "string" && answer.length <= 200) state.answers[key] = answer;
  }
  state.mode = v.mode === "human" ? "human" : "intake";
  return state;
}

export function departmentOf(state: IntakeState): Department {
  const work = state.answers.work;
  return work === WORK[0] || work === WORK[1] ? "welfare" : work === WORK[2] || work === WORK[3] ? "therapy" : "unknown";
}

function questions(state: IntakeState): Question[] {
  const a = state.answers;
  const roles = a.work === WORK[0] ? ["生活支援・夜間見守り", "看護", "サービス管理責任者", CONSULT]
    : a.work === WORK[1] ? ["介護", "送迎", "調理", "看護", "機能訓練", CONSULT]
    : a.work === WORK[2] ? ["施術", "受付", CONSULT] : ["訪問マッサージ", CONSULT];
  const night = a.work === WORK[0] && a.role === "生活支援・夜間見守り";
  const qualified = a.role === "看護" ? ["看護師", "准看護師", "取得予定", "資格なし", "その他・相談"]
    : a.role === "サービス管理責任者" ? ["研修修了・要件確認希望", "研修受講中・予定", "その他・相談"]
    : a.role === "施術" || a.work === WORK[3] || a.role === "機能訓練" ? ["あん摩マッサージ指圧師", "はり師・きゅう師", "柔道整復師", "複数資格あり", "取得予定", "資格なし", "その他・相談"]
    : a.role === "受付" || a.role === "調理" || a.role === CONSULT ? ["資格なし", "関連資格あり", "取得予定", "その他・相談"]
    : ["資格なし", "初任者研修", "実務者研修", "介護福祉士", "複数資格あり", "その他・相談"];
  const result: Question[] = [
    { key: "work", text: "どのお仕事に興味がありますか？\n募集状況は採用担当が確認します。", options: WORK },
    { key: "role", text: "希望に近い仕事内容を選んでください。", options: roles },
    { key: "employment", text: "希望する雇用形態を選んでください。", options: ["正社員を希望", "パートを希望", CONSULT] },
    { key: "sideJob", text: "副業としての勤務を希望しますか？", options: ["副業を希望", "副業ではない", CONSULT] },
    { key: "time", text: night ? "希望する時間帯を選んでください。\n配属先・募集状況により調整します。" : "勤務できる曜日の希望を選んでください。\n具体的な時間は担当者と調整します。", options: night ? ["16〜22時", "22〜翌5時", "22〜翌9時", "複数の時間帯が可能", CONSULT] : ["平日中心", "土日も勤務可能", "土日中心", CONSULT] },
    { key: "frequency", text: "希望する勤務回数を選んでください。", options: ["週1回程度", "週2〜3回", "週4回以上", CONSULT] },
    { key: "qualification", text: "保有資格に近いものを選んでください。\n複数資格の詳細は担当者が確認します。", options: qualified },
  ];
  if (a.role === "送迎" || a.work === WORK[3]) result.push({ key: "drive", text: "業務での運転について選んでください。", options: ["運転可能", "免許あり・運転は要相談", "運転不可"] });
  result.push(
    { key: "start", text: "いつ頃から勤務を希望しますか？", options: ["できるだけ早く", "1か月以内", "2〜3か月後", CONSULT] },
    { key: "next", text: "次に希望することを選んでください。", options: ["まず見学したい", "応募を進めたい", "担当者に相談したい"] },
  );
  return result;
}

export function intakeSummary(state: IntakeState): string {
  const names: Record<AnswerKey, string> = { work: "仕事", role: "職種", employment: "雇用形態", sideJob: "副業", time: "勤務条件", frequency: "勤務回数", qualification: "資格", drive: "運転", start: "開始希望", next: "次の希望" };
  return questions(state).filter(q => state.answers[q.key]).map(q => `${names[q.key]}：${state.answers[q.key]}`).join("\n");
}

function reply(text: string, labels: string[]): FlowReply {
  return { text, choices: labels.map(label => ({ label, text: label })) };
}

export function promptFor(state: IntakeState): FlowReply {
  if (state.mode === "human") return reply("担当者への確認待ちとして保存しています。追加のご希望は、このトークに送れます。", ["採用相談を再開", "会社・職場情報"]);
  const q = questions(state).find(q => !state.answers[q.key]);
  if (!q) return reply(`ご希望はこちらで合っていますか？\n\n${intakeSummary(state)}\n\n募集枠・条件は担当者が確認します。`, ["この内容で確認を依頼", "前の質問に戻る", "最初から", "会社・職場情報"]);
  return reply(`${q.text}\n\n${q.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\nボタンまたは番号で回答できます。`, [...q.options, ...(Object.keys(state.answers).length ? ["前の質問に戻る"] : []), "担当者に相談", "会社・職場情報"]);
}

function inferWork(message: string): string | undefined {
  if (/グループホーム|ぷらねっと|世話人|夜勤/.test(message)) return WORK[0];
  if (/デイサービス|介護|送迎|調理/.test(message)) return WORK[1];
  if (/訪問|在宅.*マッサージ/.test(message)) return WORK[3];
  if (/院|整骨|鍼灸|受付|療術/.test(message)) return WORK[2];
  return undefined;
}

export function advanceIntake(previous: IntakeState, raw: string): { state: IntakeState; reply: FlowReply; handoff: boolean } {
  const state = readState(previous);
  const input = raw.normalize("NFKC").trim();
  const finish = (response = promptFor(state), handoff = false) => ({ state, reply: response, handoff });
  if (["会社・職場情報", "会社情報", "HP", "ホームページ"].includes(input)) return finish(reply("有限会社イトーメディカルケア\n\n公式HP：https://ito-chiryoin.com/\n会社案内：https://ito-chiryoin.com/会社案内/\n院・事業紹介：https://ito-chiryoin.com/\n訪問サービス：https://ito-chiryoin.com/reha/\n\nグループホームやデイサービスの仕事についても、この採用窓口でご希望を伺います。\n回答途中の内容は保持しています。", ["採用相談を再開", "仕事内容", "よくある質問"]));
  if (input === "仕事内容") return finish(reply("希望する仕事を選んで、職種・働き方の相談を進められます。\nグループホーム：生活支援・夜間見守りなど\nデイサービス：介護・送迎・調理など\n療術：院での施術・受付、訪問マッサージ\n\n募集枠と具体的な業務は採用担当が確認します。", ["採用相談を再開", "会社・職場情報"]));
  if (input === "よくある質問") return finish(reply("見学から相談できますか？\n→「まず見学したい」を選んでご希望を保存できます。日時は担当者が確認します。\n\n資格がなくても相談できますか？\n→資格なしのご希望も受け付けます。職種ごとの応募条件は担当者が確認します。\n\n給与・休日は？\n→希望する仕事・働き方に応じて担当者が確認します。", ["採用相談を再開", "担当者に相談"]));
  if (input === "見学・応募") {
    return finish(reply("仕事・働き方の希望を順に伺った後、見学または応募を選べます。途中の回答は保持しています。", ["採用相談を再開", "担当者に相談"]));
  }
  if (input === "最初から") return { state: initialState(), reply: promptFor(initialState()), handoff: false };
  if (input === "担当者に相談" || input === "この内容で確認を依頼") {
    if (input === "この内容で確認を依頼" && questions(state).some(q => !state.answers[q.key])) return finish();
    state.mode = "human";
    return finish(reply(`担当者への確認待ちとして保存しました。\n${intakeSummary(state)}\n\n追加のご希望はこのトークに送ってください。`, ["採用相談を再開", "会社・職場情報"]), true);
  }
  if (input === "採用相談を再開" || input === "採用相談" || input === "働き方を選ぶ") { state.mode = "intake"; return finish(); }
  if (state.mode === "human") return finish();
  const qs = questions(state);
  if (input === "前の質問に戻る") {
    const last = [...qs].reverse().find(q => state.answers[q.key]);
    if (last) {
      const index = qs.indexOf(last);
      for (const q of qs.slice(index)) delete state.answers[q.key];
    }
    return finish();
  }
  const q = qs.find(q => !state.answers[q.key]);
  if (!q) return finish();
  let selected = q.options.find(o => o.normalize("NFKC") === input);
  if (!selected && /^\d+$/.test(input)) selected = q.options[Number(input) - 1];
  if (!selected && q.key === "work") selected = inferWork(input);
  if (!selected) return finish({ ...promptFor(state), text: `希望を取り違えないよう、選択肢から選んでください。自由な相談は「担当者に相談」で保存できます。\n\n${promptFor(state).text}` });
  state.answers[q.key] = selected;
  if (q.key === "work" && selected === CONSULT) {
    state.mode = "human";
    return finish(undefined, true);
  }
  return finish();
}
