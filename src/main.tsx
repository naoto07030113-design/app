import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

type DaySchedule = {
  day: number;
  note: string;
  hasPaw: boolean;
};

type MonthSchedule = {
  monthKey: string;
  imageDataUrl: string | null;
  imageName: string | null;
  fileType: 'image' | 'pdf' | null;
  rows: DaySchedule[];
  updatedAt: string;
};

const STORAGE_PREFIX = 'monthly-schedule-editor:';
const DEFAULT_MONTH = new Date().toISOString().slice(0, 7);

const createRows = (): DaySchedule[] =>
  Array.from({ length: 31 }, (_, index) => ({ day: index + 1, note: '', hasPaw: false }));

const getStorageKey = (monthKey: string) => `${STORAGE_PREFIX}${monthKey}`;

const loadMonth = (monthKey: string): MonthSchedule => {
  const stored = localStorage.getItem(getStorageKey(monthKey));
  if (!stored) {
    return { monthKey, imageDataUrl: null, imageName: null, fileType: null, rows: createRows(), updatedAt: new Date().toISOString() };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<MonthSchedule>;
    const storedRows = parsed.rows ?? [];
    const rows = createRows().map((row) => ({
      ...row,
      ...(storedRows.find((item) => item.day === row.day) ?? {}),
    }));

    return {
      monthKey,
      imageDataUrl: parsed.imageDataUrl ?? null,
      imageName: parsed.imageName ?? null,
      fileType: parsed.fileType ?? null,
      rows,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { monthKey, imageDataUrl: null, imageName: null, fileType: null, rows: createRows(), updatedAt: new Date().toISOString() };
  }
};

const readImageFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function App() {
  const [monthKey, setMonthKey] = useState(DEFAULT_MONTH);
  const [schedule, setSchedule] = useState<MonthSchedule>(() => loadMonth(DEFAULT_MONTH));
  const [status, setStatus] = useState('月を選択して画像をアップロードしてください。');
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSchedule(loadMonth(monthKey));
    setStatus(`${monthKey} の保存データを読み込みました。`);
  }, [monthKey]);

  const isDirty = useMemo(() => true, [schedule]);

  const saveSchedule = (nextSchedule = schedule) => {
    const payload = { ...nextSchedule, updatedAt: new Date().toISOString() };
    localStorage.setItem(getStorageKey(monthKey), JSON.stringify(payload));
    setSchedule(payload);
    setStatus(`${monthKey} の予定表を保存しました。`);
  };

  const updateRow = (day: number, patch: Partial<DaySchedule>) => {
    setSchedule((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.day === day ? { ...row, ...patch } : row)),
    }));
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('画像を読み込んでいます...');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const imageDataUrl = await readImageFile(file);
      const next = { ...schedule, imageDataUrl, imageName: file.name, fileType: isPdf ? 'pdf' as const : 'image' as const };
      saveSchedule(next);
    } catch (error) {
      setStatus(`アップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      event.target.value = '';
    }
  };

  const downloadImage = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const { width, height } = exportRef.current.getBoundingClientRect();
    const html = new XMLSerializer().serializeToString(exportRef.current);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
    const link = document.createElement('a');
    link.download = `monthly-schedule-${monthKey}.svg`;
    link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    link.click();
    setIsExporting(false);
    setStatus('編集後の予定表を画像（SVG）としてダウンロードしました。');
  };

  const downloadPdf = async () => {
    setStatus('PDF出力用の印刷画面を開きます。保存先で「PDFに保存」を選択してください。');
    window.print();
  };

  return (
    <main className="min-h-screen bg-[#f4f8f4] px-8 py-6 text-[#123228]">
      <section className="no-print mx-auto mb-5 max-w-[1500px] rounded-2xl border-2 border-[#1f5b45] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.28em] text-[#2d6b52]">MONTHLY SCHEDULE EDITOR</p>
            <h1 className="mt-1 text-3xl font-black">月間予定表アップロード編集システム</h1>
            <p className="mt-2 text-sm text-[#496c5d]">備考列・犬の足跡マーク列を追加し、月ごとにlocalStorageへ保存します。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="grid gap-1 text-sm font-bold">
              対象月
              <input className="rounded-lg border-2 border-[#1f5b45] px-3 py-2" type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
            </label>
            <label className="cursor-pointer rounded-lg bg-[#1f5b45] px-4 py-3 font-bold text-white shadow hover:bg-[#174635]">
              画像/PDFアップロード
              <input className="hidden" type="file" accept="image/png,image/jpeg,application/pdf" onChange={handleUpload} />
            </label>
            <button className="rounded-lg border-2 border-[#1f5b45] bg-white px-4 py-3 font-bold hover:bg-[#eaf3ee]" onClick={() => saveSchedule()} disabled={!isDirty}>保存</button>
            <button className="rounded-lg border-2 border-[#1f5b45] bg-white px-4 py-3 font-bold hover:bg-[#eaf3ee]" onClick={downloadImage}>画像出力</button>
            <button className="rounded-lg bg-[#1f5b45] px-4 py-3 font-bold text-white hover:bg-[#174635]" onClick={downloadPdf}>PDF出力</button>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-[#eaf3ee] px-4 py-2 text-sm font-semibold text-[#1f5b45]">{status}</div>
      </section>

      <section className="mx-auto max-w-[1500px] overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <div ref={exportRef} className={`inline-block min-w-full bg-white p-4 ${isExporting ? 'shadow-none' : ''}`}>
          <div className="mb-3 flex items-center justify-between border-b-4 border-[#1f5b45] pb-3">
            <div>
              <h2 className="text-2xl font-black">{monthKey} 月間予定表</h2>
              <p className="text-sm text-[#567266]">{schedule.imageName ? `アップロード: ${schedule.imageName}` : '未アップロード'}</p>
            </div>
            <p className="text-sm font-bold text-[#2d6b52]">備考・🐾は1日〜31日まで保存されます</p>
          </div>

          <div className="grid grid-cols-[300px_86px_minmax(720px,1fr)] items-stretch border-2 border-[#1f5b45]">
            <div className="border-r-2 border-[#1f5b45]">
              <div className="flex h-12 items-center justify-center border-b-2 border-[#1f5b45] bg-[#dfeee6] text-lg font-black">備考</div>
              {schedule.rows.map((row) => (
                <div key={row.day} className="flex h-12 items-center gap-2 border-b border-[#1f5b45]/60 px-2 last:border-b-0">
                  <span className="w-8 shrink-0 text-right font-black text-[#1f5b45]">{row.day}</span>
                  <textarea className="h-9 flex-1 resize-none rounded border border-[#9ab5a7] px-2 py-1 text-sm outline-[#1f5b45]" value={row.note} onChange={(e) => updateRow(row.day, { note: e.target.value })} placeholder="メモ" />
                </div>
              ))}
            </div>

            <div className="border-r-2 border-[#1f5b45]">
              <div className="flex h-12 items-center justify-center border-b-2 border-[#1f5b45] bg-[#dfeee6] text-lg font-black">🐾</div>
              {schedule.rows.map((row) => (
                <button key={row.day} className="flex h-12 w-full items-center justify-center border-b border-[#1f5b45]/60 text-2xl transition hover:bg-[#eaf3ee] last:border-b-0" onClick={() => updateRow(row.day, { hasPaw: !row.hasPaw })} aria-label={`${row.day}日の足跡マークを${row.hasPaw ? 'オフ' : 'オン'}`}>
                  {row.hasPaw ? '🐾' : <span className="text-sm text-[#9ab5a7]">＋</span>}
                </button>
              ))}
            </div>

            <div className="flex min-h-[1536px] items-start justify-center bg-white">
              {schedule.imageDataUrl && schedule.fileType === 'pdf' ? (
                <object className="h-[1536px] w-full" data={schedule.imageDataUrl} type="application/pdf" aria-label="アップロードされたPDF月間予定表" />
              ) : schedule.imageDataUrl ? (
                <img className="h-[1536px] w-full object-fill" src={schedule.imageDataUrl} alt="アップロードされた月間予定表" />
              ) : (
                <div className="flex h-[1536px] w-full items-center justify-center bg-[#fbfdfb] text-center text-[#6c8378]">
                  <div>
                    <div className="text-6xl">📄</div>
                    <p className="mt-4 text-xl font-bold">JPG / PNG / PDF をアップロードしてください</p>
                    <p className="mt-2 text-sm">左の31行と画像の予定表行が揃うよう、高さを固定して表示します。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
