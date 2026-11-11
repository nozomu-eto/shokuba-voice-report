import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getMockAiAvailability,
  SAMPLE_AI_LABEL,
  UPLOADED_AI_UNAVAILABLE_MESSAGE,
  validateMockAiAnalysis,
} from "../src/lib/survey/ai-analysis.ts";
import { parseSurveyCsv } from "../src/lib/survey/csv.ts";
import { BUNDLED_SAMPLE_RESPONSES } from "../src/lib/survey/sample.ts";
import type { SurveyResponse } from "../src/lib/survey/types.ts";

const sampleCsv = await readFile(new URL("../fixtures/employee-survey-sample.csv", import.meta.url), "utf8");
const mockJson = await readFile(new URL("../fixtures/ai-analysis-mock.json", import.meta.url), "utf8");
const fixture: unknown = JSON.parse(mockJson);

function sampleResponses(): SurveyResponse[] {
  const result = parseSurveyCsv(sampleCsv);
  assert.equal(result.success, true);
  if (!result.success) throw new Error("サンプルCSVが有効である必要があります。");
  return result.responses;
}

function mutableFixture(): Record<string, unknown> {
  return JSON.parse(mockJson) as Record<string, unknown>;
}

test("サンプルのテーマをR001〜R003と元コメントに紐付ける", () => {
  const result = validateMockAiAnalysis(fixture, sampleResponses());
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.analysis.label, SAMPLE_AI_LABEL);
  assert.deepEqual(
    result.analysis.themes.map(({ theme, evidence }) => [theme, evidence[0].responseId]),
    [["業務手順の違い", "R001"], ["相談相手の不足", "R002"], ["情報共有の効果", "R003"]],
  );
  assert.equal(result.analysis.themes[0].evidence[0].comment, sampleResponses()[0].comment);
});

test("存在しない回答IDを含む分析を拒否する", () => {
  const value = mutableFixture();
  const themes = value.themes as Array<Record<string, unknown>>;
  themes[0] = { ...themes[0], response_ids: ["MISSING"] };
  const result = validateMockAiAnalysis(value, sampleResponses());
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.errors.some((error) => error.includes("MISSING") && error.includes("見つかりません")));
});

test("テーマをまたぐ重複した回答ID参照を拒否する", () => {
  const value = mutableFixture();
  const themes = value.themes as Array<Record<string, unknown>>;
  themes[1] = { ...themes[1], response_ids: ["R001"] };
  const result = validateMockAiAnalysis(value, sampleResponses());
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.errors.some((error) => error.includes("R001") && error.includes("複数回")));
});

test("根拠IDが空のテーマを拒否する", () => {
  const value = mutableFixture();
  const themes = value.themes as Array<Record<string, unknown>>;
  themes[0] = { ...themes[0], response_ids: [] };
  const result = validateMockAiAnalysis(value, sampleResponses());
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.errors.some((error) => error.includes("根拠IDがありません")));
});

test("自由記述が空の回答への参照を拒否する", () => {
  const responses = sampleResponses().map((response) =>
    response.responseId === "R001" ? { ...response, comment: "  " } : response,
  );
  const result = validateMockAiAnalysis(fixture, responses);
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.errors.some((error) => error.includes("R001") && error.includes("自由記述が空")));
});

test("不正なJSON構造を正常な分析として返さない", () => {
  for (const malformed of [null, [], { ...mutableFixture(), themes: "themes" }]) {
    const result = validateMockAiAnalysis(malformed, sampleResponses());
    assert.equal(result.success, false);
  }
});

test("ユーザーアップロードはAIを利用できず、日本語の説明を返す", () => {
  const result = getMockAiAvailability({ kind: "user-upload" }, fixture, sampleResponses());
  assert.deepEqual(result, { available: false, message: UPLOADED_AI_UNAVAILABLE_MESSAGE });
});

test("内容がサンプルCSVと同一でもアップロード由来ならAIを利用できない", () => {
  const uploaded = parseSurveyCsv(sampleCsv);
  assert.equal(uploaded.success, true);
  if (!uploaded.success) return;
  const result = getMockAiAvailability({ kind: "user-upload" }, fixture, uploaded.responses);
  assert.equal(result.available, false);
  if (!result.available) assert.equal(result.message, UPLOADED_AI_UNAVAILABLE_MESSAGE);
});

test("同梱サンプル由来では検証済みの分析を利用できる", () => {
  const result = getMockAiAvailability({ kind: "bundled-sample" }, fixture, sampleResponses());
  assert.equal(result.available, true);
  if (result.available) assert.equal(result.analysis.themes.length, 3);
});

test("正規データ定数は同梱CSVを既存パーサーで読んだ結果と一致する", () => {
  assert.deepEqual(BUNDLED_SAMPLE_RESPONSES, sampleResponses());
});

test("回答の並び順が異なっても同じサンプル内容ならAIを利用できる", () => {
  const result = getMockAiAvailability(
    { kind: "bundled-sample" },
    fixture,
    sampleResponses().toReversed(),
  );
  assert.equal(result.available, true);
});

test("R001の自由記述だけが変更された回答ではAIを利用できない", () => {
  const responses = sampleResponses().map((response) =>
    response.responseId === "R001" ? { ...response, comment: "内容を変更しました。" } : response,
  );
  const result = getMockAiAvailability({ kind: "bundled-sample" }, fixture, responses);
  assert.equal(result.available, false);
});

test("評価値が1項目だけ変更された回答ではAIを利用できない", () => {
  const responses = sampleResponses().map((response) =>
    response.responseId === "R001" ? { ...response, workEnvironment: 5 as const } : response,
  );
  const result = getMockAiAvailability({ kind: "bundled-sample" }, fixture, responses);
  assert.equal(result.available, false);
});

test("回答の削除または追加がある場合はAIを利用できない", () => {
  const responses = sampleResponses();
  const deleted = getMockAiAvailability({ kind: "bundled-sample" }, fixture, responses.slice(1));
  const added = getMockAiAvailability(
    { kind: "bundled-sample" },
    fixture,
    [...responses, { ...responses[0], responseId: "R004" }],
  );
  assert.equal(deleted.available, false);
  assert.equal(added.available, false);
});

test("回答IDが変更された場合はAIを利用できない", () => {
  const responses = sampleResponses().map((response) =>
    response.responseId === "R001" ? { ...response, responseId: "R010" } : response,
  );
  const result = getMockAiAvailability({ kind: "bundled-sample" }, fixture, responses);
  assert.equal(result.available, false);
});

test("サンプル由来でも不正な分析は正常な結果として利用できない", () => {
  const result = getMockAiAvailability({ kind: "bundled-sample" }, { themes: [] }, sampleResponses());
  assert.equal(result.available, false);
  if (!result.available) {
    assert.match(result.message, /検証できないため/);
    assert.ok(result.errors && result.errors.length > 0);
  }
});
