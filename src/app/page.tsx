"use client";

import { Fragment, useReducer, useRef, useState, type ChangeEvent } from "react";
import fixture from "../../fixtures/ai-analysis-mock.json";
import {
  getMockAiAvailability,
  UPLOADED_AI_UNAVAILABLE_MESSAGE,
  type SurveyDataSource,
} from "@/lib/survey/ai-analysis";
import { aggregateSurveyResponses, formatSurveyAverage } from "@/lib/survey/aggregate";
import { MAX_SURVEY_CSV_BYTES, parseSurveyCsv } from "@/lib/survey/csv";
import { BUNDLED_SAMPLE_RESPONSES } from "@/lib/survey/sample";
import type { SurveyRatingField } from "@/lib/survey/types";
import { INITIAL_REPORT_DRAFT, updateReportDraft, type ReportDraftField } from "@/lib/survey/report";
import {
  INITIAL_SURVEY_WORKFLOW_STATE,
  surveyWorkflowReducer,
} from "@/lib/survey/workflow";

const RATING_LABELS: Record<SurveyRatingField, string> = {
  workEnvironment: "働きやすさ",
  easeOfConsultation: "相談しやすさ",
  informationSharing: "情報共有",
  intentionToStay: "継続意向",
};

export default function Home() {
  const [state, dispatch] = useReducer(surveyWorkflowReducer, INITIAL_SURVEY_WORKFLOW_STATE);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [report, setReport] = useState(INITIAL_REPORT_DRAFT);
  const requestId = useRef(0);

  function startLoad(source: SurveyDataSource["kind"]): number {
    const id = requestId.current + 1;
    requestId.current = id;
    setSelectedResponseId(null);
    setReport(INITIAL_REPORT_DRAFT);
    dispatch({ type: "begin", requestId: id, source });
    return id;
  }

  function loadSample() {
    const id = startLoad("bundled-sample");
    dispatch({ type: "success", requestId: id, responses: [...BUNDLED_SAMPLE_RESPONSES] });
  }

  async function loadUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const id = startLoad("user-upload");
    if (file.size > MAX_SURVEY_CSV_BYTES) {
      dispatch({
        type: "failure",
        requestId: id,
        errors: [{ code: "too_large", message: "ファイルサイズが2 MiBを超えています。2 MiB以下のCSVを選択してください。" }],
      });
      return;
    }

    try {
      const result = parseSurveyCsv(await file.text());
      if (result.success) dispatch({ type: "success", requestId: id, responses: result.responses });
      else dispatch({ type: "failure", requestId: id, errors: result.errors });
    } catch {
      dispatch({
        type: "failure",
        requestId: id,
        errors: [{ code: "malformed", message: "ファイルを読み込めませんでした。UTF-8形式のCSVを選び直してください。" }],
      });
    }
  }

  const responses = state.status === "ready" ? state.responses : [];
  const summary = state.status === "ready" ? aggregateSurveyResponses(responses) : null;
  const source: SurveyDataSource | null = state.status === "ready" ? { kind: state.source } : null;
  const ai = source ? getMockAiAvailability(source, fixture, responses) : null;
  const selectedResponse = responses.find((response) => response.responseId === selectedResponseId);

  function editReport(field: ReportDraftField, value: string) {
    setReport((current) => updateReportDraft(current, field, value));
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
      <header className="mb-9 flex items-center gap-3">
        <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
          <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth="1.8"><path d="M5 19V9m7 10V5m7 14v-7M3 19h18" strokeLinecap="round" /></svg>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-emerald-800">職場の声レポート</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">アンケート結果を、根拠と一緒に確認</h1>
        </div>
      </header>

      <section className="mb-8 rounded-3xl bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-6 py-7 sm:px-9 sm:py-9">
        <p className="mb-2 text-sm font-semibold text-blue-800">ローカルで安全に集計</p>
        <h2 className="max-w-2xl text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">CSVを読み込んで、職場の傾向を見てみましょう</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">選択したファイルはこのブラウザ内で処理します。アプリからサーバーへ送信・保存しません。</p>
      </section>

      <section aria-labelledby="load-title" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800">1</span>
          <div>
            <h2 id="load-title" className="text-lg font-bold text-slate-900">データを読み込む</h2>
            <p className="text-sm text-slate-600">同梱サンプル、またはお手元のCSVを選べます。</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={loadSample} className="min-h-12 rounded-xl bg-blue-700 px-5 text-base font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            サンプルで試す
          </button>
          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-emerald-700 bg-white px-5 text-base font-semibold text-emerald-800 hover:bg-emerald-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700">
            CSVを選択
            <input className="sr-only" type="file" accept=".csv,text/csv" aria-label="集計するCSVファイルを選択" onChange={loadUpload} />
          </label>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">UTF-8形式、2 MiB以下。見出しは「回答ID、働きやすさ、相談しやすさ、情報共有、継続意向、自由記述」です。</p>
        <div className="mt-4" aria-live="polite" aria-atomic="true">
          {state.status === "idle" && <p className="text-base text-slate-600">まだデータを読み込んでいません。</p>}
          {state.status === "loading" && <p className="text-base font-medium text-blue-800">{state.source === "bundled-sample" ? "サンプル" : "CSV"}を読み込んでいます…</p>}
          {state.status === "ready" && <p className="text-base font-medium text-emerald-800">{state.source === "bundled-sample" ? "サンプルを読み込みました。" : "CSVを読み込みました。"} 集計結果を表示しています。</p>}
          {state.status === "error" && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-base text-red-950"><p className="font-bold">CSVを読み込めませんでした</p><ul className="mt-1 list-disc space-y-1 pl-5">{state.errors.map((error, index) => <li key={`${error.code}-${index}`}>{error.message}</li>)}</ul></div>}
        </div>
      </section>

      {state.status === "ready" && <>
        <section aria-labelledby="report-title" className="report-sheet mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="report-title" className="text-lg font-bold text-slate-900">報告書を編集</h2><p className="text-sm text-slate-600">自由記述欄は手動記入です。内容はこのタブのメモリ内だけで保持されます。</p></div>
            <button type="button" onClick={() => window.print()} className="min-h-12 rounded-xl bg-emerald-700 px-5 text-base font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">印刷／PDF保存</button>
          </div>
          <p className="no-print mb-4 text-sm text-slate-600">ブラウザの印刷画面で「PDFとして保存」を選ぶとPDFを作成できます。</p>
          <h1 className="report-heading text-2xl font-bold text-slate-900">{report.title || "（タイトル未入力）"}</h1>
          <p className="print-copy mt-2 text-base">対象組織：{report.organization || "（未記入）"}　調査期間：{report.surveyPeriod || "（未記入）"}</p>
          <div className="no-print mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-base font-semibold text-slate-800">報告書タイトル<input className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 font-normal focus-visible:outline-2 focus-visible:outline-blue-700" value={report.title} onChange={(event) => editReport("title", event.currentTarget.value)} /></label>
            <label className="block text-base font-semibold text-slate-800">対象組織（架空の組織名）<input className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 font-normal focus-visible:outline-2 focus-visible:outline-blue-700" placeholder="例：青葉サンプル事業所" value={report.organization} onChange={(event) => editReport("organization", event.currentTarget.value)} /></label>
            <label className="block text-base font-semibold text-slate-800 sm:col-span-2">調査期間<input className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 font-normal focus-visible:outline-2 focus-visible:outline-blue-700" placeholder="例：2026年4月1日〜4月30日" value={report.surveyPeriod} onChange={(event) => editReport("surveyPeriod", event.currentTarget.value)} /></label>
          </div>
          <dl className="report-summary mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-sm text-slate-600">回答件数（計算値）</dt><dd className="mt-1 text-xl font-bold">{summary?.status === "success" ? `${summary.responseCount}件` : "集計不可"}</dd></div>
            {Object.entries(summary?.status === "success" ? summary.ratings : {}).map(([field, rating]) => <div key={field} className="rounded-xl bg-slate-50 p-3"><dt className="text-sm text-slate-600">{RATING_LABELS[field as SurveyRatingField]}（計算値）</dt><dd className="mt-1 text-xl font-bold">{formatSurveyAverage(rating.average)} / 5</dd></div>)}
          </dl>
          <div className="mt-6 grid gap-5">
            {([ ["positives", "良い点"], ["challenges", "課題"], ["nextChecks", "次に確認する事項"] ] as const).map(([field, label]) => <section key={field} className="report-section">
              <h2 className="text-lg font-bold text-slate-900">{label}</h2>
              <div className="no-print"><label className="mt-2 block text-sm font-medium text-slate-700" htmlFor={`report-${field}`}>手動記入欄（空欄から編集してください）</label><textarea id={`report-${field}`} rows={4} value={report[field]} onChange={(event) => editReport(field, event.currentTarget.value)} placeholder={`${label}を確認して記入してください。`} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base leading-7 focus-visible:outline-2 focus-visible:outline-blue-700" /></div>
              <p className="print-copy mt-2 whitespace-pre-wrap text-base leading-7">{report[field] || "（未記入）"}</p>
            </section>)}
          </div>
          {ai?.available && <section className="report-section mt-7 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-lg font-bold text-slate-900">参考情報：{ai.analysis.label}</h2>
            <p className="mt-2 text-sm leading-6">事前生成のデモ用参考情報です。AI推論は実行しておらず、内容の正確性は保証されません。人が根拠を確認して利用してください。</p>
            <p className="mt-2 text-base leading-7">{ai.analysis.overall}</p>
            <ul className="mt-3 space-y-3">{ai.analysis.themes.map((theme) => <li key={theme.theme} className="report-evidence rounded-lg border border-amber-200 bg-white p-3"><h3 className="font-bold">{theme.theme}</h3><p className="mt-1 leading-6">{theme.summary}</p><p className="no-print mt-2 text-sm font-semibold">根拠回答（選択して画面上で原文を確認）</p><div className="mt-2 flex flex-wrap gap-2">{theme.evidence.map((item) => <Fragment key={item.responseId}><button type="button" onClick={() => setSelectedResponseId(item.responseId)} className="no-print min-h-11 rounded-lg border border-blue-300 bg-blue-50 px-3 font-semibold text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-700">回答 {item.responseId}を確認</button><span className="print-copy font-semibold">根拠回答ID: {item.responseId}</span></Fragment>)}</div>{theme.evidence.map((item) => <blockquote key={item.responseId} className="mt-2 border-l-2 border-emerald-600 pl-3 text-sm leading-6">回答 {item.responseId}: {item.comment}</blockquote>)}</li>)}</ul>
            <p className="mt-3 text-sm leading-6">{ai.analysis.limitations}</p>
          </section>}
          <p className="print-copy mt-6 text-xs leading-5">集計値は入力回答から決定論的に計算しています。サンプルAI分析は同梱の架空データ向け事前生成デモであり、正確性を保証しません。必ず根拠回答と照合してください。</p>
        </section>
        <section aria-labelledby="summary-title" className="no-print mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">2</span>
            <div><h2 id="summary-title" className="text-lg font-bold text-slate-900">数値サマリー</h2><p className="text-sm text-slate-600">検証済みの回答から計算しています。</p></div>
          </div>
          {summary?.status === "success" ? <>
            <p className="mb-4 text-base font-semibold text-slate-800">回答件数 <span className="ml-2 text-2xl font-bold text-blue-800">{summary.responseCount}件</span></p>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(summary.ratings).map(([field, rating]) => <div key={field} className="rounded-xl bg-slate-50 p-4"><dt className="text-sm font-medium text-slate-600">{RATING_LABELS[field as SurveyRatingField]}</dt><dd className="mt-1 text-2xl font-bold text-slate-900">{formatSurveyAverage(rating.average)}<span className="ml-1 text-sm font-medium text-slate-500">/ 5</span></dd></div>)}</dl>
          </> : <p className="text-base text-slate-700">有効な回答がないため、数値を集計できません。</p>}
        </section>

        <section aria-labelledby="analysis-title" className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800">3</span>
            <div><h2 id="analysis-title" className="text-lg font-bold text-slate-900">自由記述の傾向</h2><p className="text-sm text-slate-600">根拠となる回答を選ぶと、元のコメントを確認できます。</p></div>
          </div>
          {ai?.available ? <div>
            <p className="mb-3 inline-flex min-h-9 items-center rounded-full bg-amber-100 px-3 text-sm font-bold text-amber-950">{ai.analysis.label}</p>
            <p className="mb-3 text-sm leading-6 text-slate-600">この画面でAI推論は実行していません。事前生成の参考例であり、内容の正確性は保証されません。</p>
            <p className="mb-4 text-base leading-7 text-slate-800">{ai.analysis.overall}</p>
            <ul className="space-y-3">{ai.analysis.themes.map((theme) => <li key={theme.theme} className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-base font-bold text-slate-900">{theme.theme}</h3><p className="mt-1 text-base leading-6 text-slate-700">{theme.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2" aria-label={`${theme.theme}の根拠回答`}>
                {theme.evidence.map((item) => <button type="button" key={item.responseId} aria-pressed={selectedResponseId === item.responseId} onClick={() => setSelectedResponseId(item.responseId)} className="min-h-11 rounded-lg border border-blue-300 bg-blue-50 px-4 text-base font-semibold text-blue-900 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 aria-pressed:bg-blue-800 aria-pressed:text-white">根拠 {item.responseId}</button>)}
              </div>
            </li>)}</ul>
            <p className="mt-4 text-sm leading-6 text-slate-600">{ai.analysis.limitations}</p>
            {selectedResponse && <aside className="mt-4 rounded-xl border-l-4 border-emerald-600 bg-emerald-50 p-4" aria-live="polite"><h3 className="text-base font-bold text-emerald-950">回答 {selectedResponse.responseId} の自由記述</h3><blockquote className="mt-2 text-base leading-7 text-slate-800">{selectedResponse.comment}</blockquote></aside>}
          </div> : <p className="rounded-xl bg-slate-50 p-4 text-base leading-7 text-slate-700">{ai?.message ?? UPLOADED_AI_UNAVAILABLE_MESSAGE}</p>}
        </section>
      </>}
      <footer className="no-print mt-8 text-sm leading-6 text-slate-600">集計対象のCSVは端末内でのみ処理されます。サンプルAI分析は同梱の架空データに対する事前生成デモで、内容の正確性を保証するものではありません。</footer>
    </main>
  );
}
