import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MAX_SURVEY_CSV_BYTES, parseSurveyCsv } from "../src/lib/survey/csv.ts";
import { SURVEY_CSV_HEADERS } from "../src/lib/survey/types.ts";

const fixture = await readFile(new URL("../fixtures/employee-survey-sample.csv", import.meta.url), "utf8");

test("同梱の正常CSVを3件の型付き回答として読み込む", () => {
  const result = parseSurveyCsv(fixture);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.responses.length, 3);
  assert.deepEqual(result.responses.map((response) => response.responseId), ["R001", "R002", "R003"]);
});

test("BOM、列順変更、CRLF、引用符内カンマ・改行・エスケープ引用符を扱う", () => {
  const headers = [...SURVEY_CSV_HEADERS].reverse();
  const values = ['R010', '2', '3', '4', '5', '引用符 "付き", コメント\r\n次の行'];
  const ordered = headers.map((header) => {
    const index = SURVEY_CSV_HEADERS.indexOf(header);
    return values[index];
  });
  const csv = `\uFEFF${headers.join(",")}\r\n${ordered.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")}\r\n`;

  const result = parseSurveyCsv(csv);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.responses[0], {
    responseId: "R010",
    workEnvironment: 2,
    easeOfConsultation: 3,
    informationSharing: 4,
    intentionToStay: 5,
    comment: '引用符 "付き", コメント\n次の行',
  });
});

test("必須列の不足と重複ヘッダーを日本語で報告する", () => {
  const missing = parseSurveyCsv("回答ID,働きやすさ\nR001,4");
  assert.equal(missing.success, false);
  if (missing.success) return;
  assert.ok(missing.errors.some((error) => error.code === "missing_header" && error.column === "相談しやすさ"));
  assert.ok(missing.errors.every((error) => /追加してください/.test(error.message)));

  const duplicateHeader = parseSurveyCsv(`${SURVEY_CSV_HEADERS.join(",")},回答ID\nR001,4,2,3,4,コメント,R002`);
  assert.equal(duplicateHeader.success, false);
  if (duplicateHeader.success) return;
  assert.ok(duplicateHeader.errors.some((error) => error.code === "duplicate_header" && error.column === "回答ID"));
});

test("空入力と回答行のないCSVを拒否する", () => {
  const empty = parseSurveyCsv("\uFEFF \r\n");
  assert.equal(empty.success, false);
  if (!empty.success) assert.equal(empty.errors[0].code, "empty");

  const onlyHeader = parseSurveyCsv(`${SURVEY_CSV_HEADERS.join(",")}\n`);
  assert.equal(onlyHeader.success, false);
  if (!onlyHeader.success) assert.match(onlyHeader.errors[0].message, /回答データがありません/);
});

test("重複ID、空ID、前後空白のIDを拒否し、部分結果を返さない", () => {
  const rows = [
    "R001,4,2,3,4,最初の回答",
    "R001,4,2,3,4,重複した回答",
    ",4,2,3,4,IDなし",
    " R004 ,4,2,3,4,空白付きID",
  ].join("\n");
  const result = parseSurveyCsv(`${SURVEY_CSV_HEADERS.join(",")}\n${rows}`);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.errors.some((error) => error.code === "duplicate_id" && error.row === 3));
  assert.ok(result.errors.some((error) => error.code === "empty_id" && error.row === 4));
  assert.ok(result.errors.some((error) => error.code === "invalid_id" && /前後の空白/.test(error.message)));
  assert.equal("responses" in result, false);
});

test("空欄、小数、文字列、範囲外の評価値を拒否する", () => {
  const rows = [
    "R001,,2,3,4,空欄",
    "R002,1.5,2,3,4,小数",
    "R003,五,2,3,4,文字列",
    "R004,0,2,3,4,下限外",
    "R005,6,2,3,4,上限外",
  ].join("\n");
  const result = parseSurveyCsv(`${SURVEY_CSV_HEADERS.join(",")}\n${rows}`);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.errors.filter((error) => error.code === "invalid_score").length, 5);
    assert.ok(result.errors.every((error) => error.column === "働きやすさ" && error.row !== undefined));
    assert.ok(result.errors.every((error) => /1〜5の整数/.test(error.message)));
    assert.equal("responses" in result, false);
  }
});

test("見出しと列数が合わない行、閉じていない引用符を拒否する", () => {
  const wrongWidth = parseSurveyCsv(`${SURVEY_CSV_HEADERS.join(",")}\nR001,4,2,3,4`);
  assert.equal(wrongWidth.success, false);
  if (!wrongWidth.success) assert.ok(wrongWidth.errors.some((error) => error.code === "column_count"));

  const unclosedQuote = parseSurveyCsv(`${SURVEY_CSV_HEADERS.join(",")}\nR001,4,2,3,4,"コメント`);
  assert.equal(unclosedQuote.success, false);
  if (!unclosedQuote.success) assert.ok(unclosedQuote.errors.some((error) => error.code === "malformed"));
});

test("2 MiBを超える入力を解析前に拒否する", () => {
  const tooLarge = `${SURVEY_CSV_HEADERS.join(",")}\nR001,4,2,3,4,${"あ".repeat(MAX_SURVEY_CSV_BYTES)}`;
  const result = parseSurveyCsv(tooLarge);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.errors[0].code, "too_large");
});

test("サイズ上限ちょうどの有効なCSVを受け入れる", () => {
  const prefix = `${SURVEY_CSV_HEADERS.join(",")}\nR001,4,2,3,4,`;
  const suffix = "\n";
  const commentBytes = MAX_SURVEY_CSV_BYTES - new TextEncoder().encode(prefix + suffix).byteLength;
  const csv = `${prefix}${"x".repeat(commentBytes)}${suffix}`;

  assert.equal(new TextEncoder().encode(csv).byteLength, MAX_SURVEY_CSV_BYTES);
  const result = parseSurveyCsv(csv);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.responses.length, 1);
});
