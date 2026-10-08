import { informationReply, JOBS, WORK_ORDER, type WorkName } from "./recruiting-content";
export type Department = "welfare" | "therapy" | "unknown";
type AnswerKey = "work" | "role" | "employment" | "sideJob" | "time" | "frequency" | "qualification" | "drive" | "start" | "next" | "visitTiming" | "consultTopic" | "consultNote";
export type IntakeState = { version: 1; answers: Partial<Record<AnswerKey, string>>; mode: "intake" | "human"; entry?: "work" | "working" | "visit" | "apply"; screen?: "consult-topic" | "consult-note" };
export type Choice = { label: string; text: string; uri?: string };
export type FlowReply = { title?: string; text: string; choices: Choice[] };
type Question = { key: AnswerKey; text: string; options: string[] };
const CONSULT = "相談して決めたい";
const WORK = { home: "グループホーム", day: "デイサービス・介護", clinic: "院での施術・受付", visit: "訪問マッサージ" } as const;
export const initialState = (): IntakeState => ({ version: 1, answers: {}, mode: "intake" });

export function readState(value: unknown): IntakeState {
  if (!value || typeof value !== "object") return initialState();
  const v = value as Partial<IntakeState>;
  if (v.version !== 1 || !v.answers || typeof v.answers !== "object") return initialState();
  const state = initialState();
  for (const key of ["work", "role", "employment", "sideJob", "time", "frequency", "qualification", "drive", "start", "next", "visitTiming", "consultTopic", "consultNote"] as AnswerKey[]) {
    const answer = v.answers[key];
    if (typeof answer === "string" && answer.length <= (key === "consultNote" ? 1500 : 200)) state.answers[key] = answer;
  }
  state.mode = v.mode === "human" ? "human" : "intake";
  if (["work", "working", "visit", "apply"].includes(v.entry ?? "")) state.entry = v.entry;
  if (v.screen === "consult-topic" || v.screen === "consult-note") state.screen = v.screen;
  return state;
}

export function departmentOf(state: IntakeState): Department {
  const work = state.answers.work;
  return work === WORK.home || work === WORK.day ? "welfare" : work === WORK.clinic || work === WORK.visit ? "therapy" : "unknown";
}

function questions(state: IntakeState): Question[] {
  const a = state.answers;
  const roles = a.work === WORK.home ? ["生活支援・夜間見守り", "看護", "サービス管理責任者", CONSULT]
    : a.work === WORK.day ? ["介護", "送迎", "調理", "看護", "機能訓練", CONSULT]
    : a.work === WORK.clinic ? ["施術", "受付", CONSULT] : ["訪問マッサージ", CONSULT];
  const night = a.work === WORK.home && a.role === "生活支援・夜間見守り";
  const qualified = a.role === "看護" ? ["看護師", "准看護師", "取得予定", "資格なし", "その他・相談"]
    : a.role === "サービス管理責任者" ? ["研修修了・要件確認希望", "研修受講中・予定", "その他・相談"]
    : a.role === "施術" ? ["柔道整復師", "はり師・きゅう師", "あん摩マッサージ指圧師", "複数資格あり", "取得予定", "資格なし", "その他・相談"]
    : a.work === WORK.visit || a.role === "機能訓練" ? ["あん摩マッサージ指圧師", "はり師・きゅう師", "柔道整復師", "複数資格あり", "取得予定", "資格なし", "その他・相談"]
    : a.role === "受付" || a.role === "調理" || a.role === CONSULT ? ["資格なし", "関連資格あり", "取得予定", "その他・相談"]
    : ["資格なし", "初任者研修", "実務者研修", "介護福祉士", "複数資格あり", "その他・相談"];
  const result: Question[] = [
    { key: "work", text: "どのお仕事に興味がありますか？\n募集状況は採用担当が確認します。", options: [...WORK_ORDER, CONSULT] },
    { key: "role", text: "希望に近い仕事内容を選んでください。", options: roles },
    { key: "employment", text: "希望する雇用形態を選んでください。", options: ["正社員を希望", "パートを希望", CONSULT] },
    { key: "sideJob", text: "副業としての勤務を希望しますか？", options: ["副業ではない", "副業を希望", CONSULT] },
    { key: "time", text: night ? "希望する時間帯を選んでください。\n配属先・募集状況により調整します。" : "勤務できる曜日の希望を選んでください。\n具体的な時間は担当者と調整します。", options: night ? ["16〜22時", "22〜翌5時", "22〜翌9時", "複数の時間帯が可能", CONSULT] : ["平日中心", "土日も勤務可能", "土日中心", CONSULT] },
    { key: "frequency", text: "希望する勤務回数を選んでください。", options: ["週4回以上", "週2〜3回", "週1回程度", CONSULT] },
    { key: "qualification", text: "保有資格に近いものを選んでください。\n複数資格の詳細は担当者が確認します。", options: qualified },
  ];
  if (state.entry === "visit") return [result[0], result[1], { key: "visitTiming", text: "見学の候補として都合のよい時間帯を選んでください。\n担当者が日程・場所を確認します。", options: ["平日の日中", "平日の夕方", "土日を希望", "時間帯は相談したい"] }];
  if (a.role === "送迎" || a.work === WORK.visit) result.push({ key: "drive", text: "業務での運転について選んでください。", options: ["運転可能", "免許あり・運転は要相談", "運転不可"] });
  result.push(
    { key: "start", text: "いつ頃から勤務を希望しますか？", options: ["できるだけ早く", "1か月以内", "2〜3か月後", CONSULT] },
    { key: "next", text: "次に希望することを選んでください。", options: ["まず見学したい", "応募を進めたい", "担当者に相談したい"] },
  );
  if (state.entry === "working") {
    const order: AnswerKey[] = ["employment", "sideJob", "frequency", "work", "role", "time", "qualification", "drive", "start", "next"];
    result.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }
  return result;
}

export function intakeSummary(state: IntakeState): string {
  const names: Record<AnswerKey, string> = { work: "仕事", role: "職種", employment: "雇用形態", sideJob: "副業", time: "勤務条件", frequency: "勤務回数", qualification: "資格", drive: "運転", start: "開始希望", next: "次の希望", visitTiming: "見学の希望時間帯", consultTopic: "相談項目", consultNote: "相談内容" };
  return (Object.keys(names) as AnswerKey[]).filter(key => state.answers[key]).map(key => `${names[key]}：${state.answers[key]}`).join("\n");
}

function reply(text: string, labels: string[]): FlowReply {
  return { text, choices: labels.map(label => ({ label, text: label })) };
}

export function promptFor(state: IntakeState): FlowReply {
  if (state.screen === "consult-topic") return { title: "担当者と相談", ...reply("聞きたいことを選んでください。次に相談内容を自由に入力できます。\n勤務条件、業務の不安、応募前の確認などを相談内容として保存します。", ["仕事内容を相談", "勤務条件を相談", "給与・待遇を相談", "見学・応募を相談", "その他を相談", "採用相談を再開"]) };
  if (state.screen === "consult-note") return { title: "相談内容を入力", ...reply(`相談項目：${state.answers.consultTopic}\n\n聞きたいことを1通で送ってください。例：「副業で月4回の夜勤を希望しています。募集の有無と休憩時間を確認したいです」\n\n入力内容は担当者の確認用に保存します。自動で回答日時は確約しません。`, ["項目だけで確認を依頼", "担当者に相談", "採用相談を再開"]) };
  if (state.mode === "human") return reply("担当者への確認待ちとして保存しています。追加のご希望は、このトークに送れます。", ["採用相談を再開", "会社・職場情報"]);
  const q = questions(state).find(q => !state.answers[q.key]);
  if (!q) return { title: state.entry === "visit" ? "見学希望の確認" : state.entry === "apply" ? "応募希望の確認" : "希望内容の確認", ...reply(`ご希望はこちらで合っていますか？\n\n${intakeSummary(state)}\n\n募集枠・条件・見学日時は担当者が確認します。`, ["この内容で確認を依頼", "前の質問に戻る", "会社・職場情報"]) };
  return { title: state.entry === "visit" ? "見学の希望" : state.entry === "working" ? "働き方の希望" : state.entry === "apply" ? "応募の希望" : "お仕事の希望", ...reply(`${q.text}\n\n${q.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\n大きなボタンまたは番号で回答できます。`, [...q.options, ...(Object.keys(state.answers).length ? ["前の質問に戻る"] : []), "担当者に相談", "会社・職場情報"]) };
}

function inferWork(message: string): string | undefined {
  if (/グループホーム|ぷらねっと|世話人|夜勤/.test(message)) return WORK.home;
  if (/デイサービス|介護|送迎|調理/.test(message)) return WORK.day;
  if (/訪問|在宅.*マッサージ/.test(message)) return WORK.visit;
  if (/院|整骨|鍼灸|受付|療術/.test(message)) return WORK.clinic;
  return undefined;
}

export function advanceIntake(previous: IntakeState, raw: string): { state: IntakeState; reply: FlowReply; handoff: boolean } {
  const state = readState(previous);
  const input = raw.normalize("NFKC").trim().replace(/:/g, "：");
  const finish = (response = promptFor(state), handoff = false) => ({ state, reply: response, handoff });
  const info = informationReply(input);
  if (info) return finish(info);
  const chooseWork = (work: string) => {
    if (state.answers.work !== work) {
      for (const key of ["role", "time", "qualification", "drive", "visitTiming"] as AnswerKey[]) delete state.answers[key];
    }
    state.answers.work = work;
  };
  if (input.startsWith("仕事を希望：") || input.startsWith("見学する仕事：")) {
    const visiting = input.startsWith("見学する仕事：");
    const work = input.slice(visiting ? 7 : 6) as WorkName;
    if (!JOBS[work]) return finish();
    chooseWork(work);
    state.entry = visiting ? "visit" : "work";
    if (visiting) state.answers.next = "まず見学したい";
    state.mode = "intake"; delete state.screen;
    return finish();
  }
  if (input.startsWith("働き方：")) {
    const selected = input.slice(4);
    if (!["正社員", "パート", "副業", "夜間", "未定"].includes(selected)) return finish();
    state.entry = "working"; state.mode = "intake"; delete state.screen;
    if (selected === "正社員") state.answers.employment = "正社員を希望";
    if (selected === "パート") state.answers.employment = "パートを希望";
    if (selected === "副業") state.answers.sideJob = "副業を希望";
    if (selected === "夜間") {
      chooseWork(WORK.home); state.answers.role = "生活支援・夜間見守り";
      delete state.answers.time;
    }
    return finish();
  }
  if (input === "見学の希望を入力" || input === "応募の希望を入力") {
    state.entry = input === "見学の希望を入力" ? "visit" : "apply";
    state.answers.next = state.entry === "visit" ? "まず見学したい" : "応募を進めたい";
    state.mode = "intake"; delete state.screen;
    return finish();
  }
  if (input === "担当者に相談") {
    state.screen = "consult-topic";
    return finish();
  }
  const topics = ["給与・待遇を相談", "勤務条件を相談", "仕事内容を相談", "見学・応募を相談", "その他を相談"];
  if (state.screen === "consult-topic" && topics.includes(input)) {
    state.answers.consultTopic = input; delete state.answers.consultNote; state.screen = "consult-note";
    return finish();
  }
  const navigation = ["採用相談を再開", "最初から", "この内容で確認を依頼", "前の質問に戻る"];
  if (state.screen === "consult-note" && !navigation.includes(input)) {
    if (!input) return finish();
    if (raw.trim().length > 1500) return finish(reply("相談内容は1500文字以内で送ってください。", ["採用相談を再開"]));
    if (input !== "項目だけで確認を依頼") state.answers.consultNote = raw.trim();
    state.mode = "human"; delete state.screen;
    return finish({ title: "相談内容を保存しました", ...reply(`相談内容を担当者の確認待ちとして保存しました。

${intakeSummary(state)}

追加の内容はこのトークに送れます。回答は担当者による確認が必要です。`, ["担当者に相談", "採用相談を再開", "会社・職場情報"]) }, true);
  }
  if (state.screen && !navigation.includes(input)) return finish();
  if (input === "最初から") return { state: initialState(), reply: promptFor(initialState()), handoff: false };
  if (input === "この内容で確認を依頼") {
    if (input === "この内容で確認を依頼" && questions(state).some(q => !state.answers[q.key])) return finish();
    state.mode = "human"; delete state.screen;
    return finish(reply(`担当者への確認待ちとして保存しました。\n${intakeSummary(state)}\n\n追加のご希望はこのトークに送ってください。`, ["採用相談を再開", "会社・職場情報"]), true);
  }
  if (input === "採用相談を再開") { state.mode = "intake"; delete state.screen; return finish(); }
  if (state.mode === "human") return finish();
  const qs = questions(state);
  if (input === "前の質問に戻る") {
    delete state.screen;
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
  if (q.key === "work") chooseWork(selected);
  if (q.key === "role" && state.answers.role !== selected) {
    for (const key of ["time", "qualification", "drive"] as AnswerKey[]) delete state.answers[key];
  }
  state.answers[q.key] = selected;
  if (q.key === "work" && selected === CONSULT) {
    state.mode = "human";
    return finish(undefined, true);
  }
  return finish();
}
