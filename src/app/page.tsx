"use client";

import { useReducer, useRef, useState, type ChangeEvent } from "react";
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
  const requestId = useRef(0);

  function startLoad(source: SurveyDataSource["kind"]): number {
    const id = requestId.current + 1;
    requestId.current = id;
    setSelectedResponseId(null);
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
        <section aria-labelledby="summary-title" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">2</span>
            <div><h2 id="summary-title" className="text-lg font-bold text-slate-900">数値サマリー</h2><p className="text-sm text-slate-600">検証済みの回答から計算しています。</p></div>
          </div>
          {summary?.status === "success" ? <>
            <p className="mb-4 text-base font-semibold text-slate-800">回答件数 <span className="ml-2 text-2xl font-bold text-blue-800">{summary.responseCount}件</span></p>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(summary.ratings).map(([field, rating]) => <div key={field} className="rounded-xl bg-slate-50 p-4"><dt className="text-sm font-medium text-slate-600">{RATING_LABELS[field as SurveyRatingField]}</dt><dd className="mt-1 text-2xl font-bold text-slate-900">{formatSurveyAverage(rating.average)}<span className="ml-1 text-sm font-medium text-slate-500">/ 5</span></dd></div>)}</dl>
          </> : <p className="text-base text-slate-700">有効な回答がないため、数値を集計できません。</p>}
        </section>

        <section aria-labelledby="analysis-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
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
      <footer className="mt-8 text-sm leading-6 text-slate-600">集計対象のCSVは端末内でのみ処理されます。サンプルAI分析は同梱の架空データに対する事前生成デモで、内容の正確性を保証するものではありません。</footer>
    </main>
  );
}
