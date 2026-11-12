import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getDemoMode, LOCAL_MODE_NOTICE, PUBLIC_DEMO_NOTICE } from "../src/lib/survey/demo-mode.ts";
import { getMockAiAvailability } from "../src/lib/survey/ai-analysis.ts";
import fixture from "../fixtures/ai-analysis-mock.json" with { type: "json" };
import { aggregateSurveyResponses, formatSurveyAverage } from "../src/lib/survey/aggregate.ts";
import { BUNDLED_SAMPLE_RESPONSES } from "../src/lib/survey/sample.ts";
import { INITIAL_REPORT_DRAFT, updateReportDraft } from "../src/lib/survey/report.ts";
import { parseSurveyCsv } from "../src/lib/survey/csv.ts";

test("production and unknown environments default to sample-only public demo", () => {
  assert.equal(getDemoMode("production"), "public");
  assert.equal(getDemoMode(undefined), "public");
  assert.equal(getDemoMode("test"), "public");
  assert.equal(getDemoMode("development"), "local");
  assert.match(PUBLIC_DEMO_NOTICE, /架空サンプルのみ/);
  assert.match(LOCAL_MODE_NOTICE, /実在データではなく架空データ/);
});

test("bundled sample flow computes the expected count and four ratings", () => {
  const result = aggregateSurveyResponses(BUNDLED_SAMPLE_RESPONSES);
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.responseCount, 3);
  assert.deepEqual(Object.values(result.ratings).map(({ average }) => formatSurveyAverage(average)), ["3.3", "2.7", "3.0", "3.7"]);
  assert.equal(parseSurveyCsv("" ).success, false);
});

test("only bundled data gets static AI evidence; report edits do not change computed values", () => {
  const sampleAi = getMockAiAvailability({ kind: "bundled-sample" }, fixture, BUNDLED_SAMPLE_RESPONSES);
  const uploadedAi = getMockAiAvailability({ kind: "user-upload" }, fixture, BUNDLED_SAMPLE_RESPONSES);
  assert.equal(sampleAi.available, true);
  assert.equal(uploadedAi.available, false);
  const initial = aggregateSurveyResponses(BUNDLED_SAMPLE_RESPONSES);
  const draft = updateReportDraft(INITIAL_REPORT_DRAFT, "positives", "担当者が確認した文章");
  const afterEdit = aggregateSurveyResponses(BUNDLED_SAMPLE_RESPONSES);
  assert.deepEqual(afterEdit, initial);
  assert.equal(draft.positives, "担当者が確認した文章");
  assert.notEqual(draft, INITIAL_REPORT_DRAFT);
  assert.equal(INITIAL_REPORT_DRAFT.positives, "");
});

test("public page has no upload control or Bedrock invocation path", async () => {
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /getDemoMode\(process\.env\.NODE_ENV\)/);
  assert.match(page, /demoMode !== "local"/);
  assert.match(page, /setReport\(INITIAL_REPORT_DRAFT\)/);
  assert.doesNotMatch(page, /server-config|runAiAnalysis|BedrockConverseAdapter|fetch\(/);
  const serverConfig = await readFile(new URL("../src/lib/ai/server-config.ts", import.meta.url), "utf8");
  assert.match(serverConfig, /^import "server-only";/);
  assert.doesNotMatch(page, /@\/lib\/ai\//);
});
