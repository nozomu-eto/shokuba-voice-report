import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aggregateSurveyResponses, formatSurveyAverage } from "../src/lib/survey/aggregate.ts";
import { parseSurveyCsv } from "../src/lib/survey/csv.ts";
import type { SurveyResponse } from "../src/lib/survey/types.ts";

const sampleCsv = await readFile(new URL("../fixtures/employee-survey-sample.csv", import.meta.url), "utf8");

function parseSample(): SurveyResponse[] {
  const parsed = parseSurveyCsv(sampleCsv);
  assert.equal(parsed.success, true);
  if (!parsed.success) throw new Error("サンプルCSVが有効である必要があります。");
  return parsed.responses;
}

test("同梱サンプルCSVを決定論的に集計し、平均は内部で丸めない", () => {
  const result = aggregateSurveyResponses(parseSample());
  assert.equal(result.status, "success");
  if (result.status !== "success") return;

  assert.equal(result.responseCount, 3);
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.ratings).map(([field, rating]) => [field, rating.total])),
    { workEnvironment: 10, easeOfConsultation: 8, informationSharing: 9, intentionToStay: 11 },
  );
  assert.equal(result.ratings.workEnvironment.average, 10 / 3);
  assert.equal(result.ratings.easeOfConsultation.average, 8 / 3);
  assert.equal(result.ratings.informationSharing.average, 3);
  assert.equal(result.ratings.intentionToStay.average, 11 / 3);
  assert.deepEqual(
    Object.values(result.ratings).map(({ average }) => formatSurveyAverage(average)),
    ["3.3", "2.7", "3.0", "3.7"],
  );
});

test("1件の回答では各合計と平均がその回答値になる", () => {
  const response = parseSample()[0];
  const result = aggregateSurveyResponses([response]);
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.responseCount, 1);
  for (const rating of Object.values(result.ratings)) {
    assert.equal(rating.total, rating.average);
  }
});

test("複数件の合計を各回答から算出する", () => {
  const result = aggregateSurveyResponses(parseSample().slice(0, 2));
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.responseCount, 2);
  assert.equal(result.ratings.workEnvironment.total, 6);
  assert.equal(result.ratings.workEnvironment.average, 3);
});

test("空配列は明示的な集計対象なし状態を返す", () => {
  assert.deepEqual(aggregateSurveyResponses([]), { status: "empty" });
});

test("型を迂回した不正な実行時スコアは補正せず無効として返す", () => {
  const valid = parseSample()[0];
  const invalid = { ...valid, informationSharing: 0 } as unknown as SurveyResponse;
  const result = aggregateSurveyResponses([valid, invalid]);
  assert.deepEqual(result, { status: "invalid", responseIndex: 1, field: "informationSharing" });
});

test("型を迂回したnull回答を安全に拒否する", () => {
  const result = aggregateSurveyResponses([null] as unknown as SurveyResponse[]);
  assert.deepEqual(result, { status: "invalid", responseIndex: 0, field: "response" });
});
