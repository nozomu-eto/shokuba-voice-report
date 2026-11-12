import assert from "node:assert/strict";
import test from "node:test";
import { AI_OUTPUT_LIMITS, validateAiAnalysisOutput } from "../src/lib/ai/output-validation.ts";
import { BUNDLED_SAMPLE_RESPONSES } from "../src/lib/survey/sample.ts";

function output(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    overall: "コメントから見られる傾向です。",
    limitations: "少数回答の参考情報です。",
    themes: [{ theme: "相談", summary: "相談先に関する記述", response_ids: ["R002"] }],
    ...overrides,
  });
}

test("valid JSON and a whole-document JSON code fence validate and resolve original comments", () => {
  for (const text of [output(), `\`\`\`json\n${output()}\n\`\`\``]) {
    const result = validateAiAnalysisOutput(text, BUNDLED_SAMPLE_RESPONSES);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.analysis.themes[0].evidence[0].responseId, "R002");
      assert.equal(result.analysis.themes[0].evidence[0].comment, BUNDLED_SAMPLE_RESPONSES[1].comment);
    }
  }
});

test("malformed JSON, prose-wrapped JSON, and partial fences fail without extraction", () => {
  for (const text of ["{broken", `前置き\n${output()}`, `\`\`\`json\n${output()}\n\`\`\`\n補足`]) {
    assert.deepEqual(validateAiAnalysisOutput(text, BUNDLED_SAMPLE_RESPONSES), {
      success: false,
      issues: ["invalid_json"],
    });
  }
});

test("required fields, value types, empty themes, and empty text are rejected", () => {
  const wrongTypes = output({ overall: 12 });
  const emptyTheme = output({ themes: [{ theme: " ", summary: "説明", response_ids: ["R001"] }] });
  for (const text of [
    JSON.stringify({ overall: "要約", themes: [] }),
    wrongTypes,
    output({ themes: [] }),
    emptyTheme,
    output({ themes: [{ theme: "相談", summary: "説明", response_ids: "R002" }] }),
  ]) {
    assert.equal(validateAiAnalysisOutput(text, BUNDLED_SAMPLE_RESPONSES).success, false);
  }
});

test("unknown IDs, duplicate IDs, empty source comments, and missing citations fail", () => {
  assert.deepEqual(validateAiAnalysisOutput(output({ themes: [{ theme: "相談", summary: "説明", response_ids: ["R999"] }] }), BUNDLED_SAMPLE_RESPONSES), {
    success: false,
    issues: ["evidence_unknown"],
  });
  assert.ok(!validateAiAnalysisOutput(output({ themes: [
    { theme: "A", summary: "説明", response_ids: ["R001"] },
    { theme: "B", summary: "説明", response_ids: ["R001"] },
  ] }), BUNDLED_SAMPLE_RESPONSES).success);
  const blankCommentResponses = BUNDLED_SAMPLE_RESPONSES.map((response) =>
    response.responseId === "R002" ? { ...response, comment: " " } : response,
  );
  assert.ok(!validateAiAnalysisOutput(output(), blankCommentResponses).success);
  assert.ok(!validateAiAnalysisOutput(output({ themes: [{ theme: "相談", summary: "説明", response_ids: [] }] }), BUNDLED_SAMPLE_RESPONSES).success);
});

test("theme count, text length, total size, and malformed citation arrays are bounded", () => {
  const manyThemes = Array.from({ length: AI_OUTPUT_LIMITS.themeCount + 1 }, (_, index) => ({
    theme: `分類${index}`,
    summary: "説明",
    response_ids: [index === 0 ? "R001" : `R00${index + 1}`],
  }));
  assert.ok(!validateAiAnalysisOutput(output({ themes: manyThemes }), BUNDLED_SAMPLE_RESPONSES).success);
  assert.ok(!validateAiAnalysisOutput(output({ overall: "x".repeat(AI_OUTPUT_LIMITS.overallChars + 1) }), BUNDLED_SAMPLE_RESPONSES).success);
  assert.deepEqual(validateAiAnalysisOutput(" ".repeat(AI_OUTPUT_LIMITS.totalChars + 1), BUNDLED_SAMPLE_RESPONSES), {
    success: false,
    issues: ["invalid_text"],
  });
  assert.ok(!validateAiAnalysisOutput(output({ themes: [{ theme: "相談", summary: "説明", response_ids: [1] }] }), BUNDLED_SAMPLE_RESPONSES).success);
});
