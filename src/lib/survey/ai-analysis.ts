import type { SurveyResponse } from "./types.ts";

export const SAMPLE_AI_LABEL = "サンプルAI分析（事前生成・デモ用）";
export const UPLOADED_AI_UNAVAILABLE_MESSAGE =
  "アップロードしたCSVのAI分析は現在利用できません。数値集計のみ表示しています。";

export type SurveyDataSource =
  | { kind: "bundled-sample" }
  | { kind: "user-upload" };

export type MockAiTheme = {
  theme: string;
  summary: string;
  evidence: Array<{ responseId: string; comment: string }>;
};

export type MockAiAnalysis = {
  label: typeof SAMPLE_AI_LABEL;
  overall: string;
  limitations: string;
  themes: MockAiTheme[];
};

export type MockAiValidationResult =
  | { success: true; analysis: MockAiAnalysis }
  | { success: false; errors: string[] };

export type MockAiAvailability =
  | { available: true; analysis: MockAiAnalysis }
  | { available: false; message: string; errors?: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates fixture structure and citations against actual non-empty comments.
 * This checks traceability only; it does not verify whether generated prose is true.
 */
export function validateMockAiAnalysis(
  input: unknown,
  responses: readonly SurveyResponse[],
): MockAiValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { success: false, errors: ["AI分析データの形式が正しくありません。"] };
  }

  if (input.source !== "precomputed-nova-lite-demo") errors.push("AI分析データのsourceが正しくありません。");
  if (input.synthetic !== true) errors.push("AI分析データが架空データ用として明示されていません。");
  if (!isNonEmptyString(input.model)) errors.push("AI分析データのmodelがありません。");
  if (!isNonEmptyString(input.region)) errors.push("AI分析データのregionがありません。");
  if (!isNonEmptyString(input.generated_on)) errors.push("AI分析データのgenerated_onがありません。");
  if (!isNonEmptyString(input.warning)) errors.push("AI分析データのwarningがありません。");
  if (!isNonEmptyString(input.overall)) errors.push("AI分析データのoverallがありません。");
  if (!isNonEmptyString(input.limitations)) errors.push("AI分析データのlimitationsがありません。");
  if (!Array.isArray(input.themes) || input.themes.length === 0) {
    errors.push("AI分析データにテーマがありません。");
    return { success: false, errors };
  }

  const responseById = new Map(responses.map((response) => [response.responseId, response]));
  const referencedIds = new Set<string>();
  const themes: MockAiTheme[] = [];

  for (const [themeIndex, rawTheme] of input.themes.entries()) {
    if (!isRecord(rawTheme)) {
      errors.push(`${themeIndex + 1}件目のテーマの形式が正しくありません。`);
      continue;
    }
    const theme = isNonEmptyString(rawTheme.theme) ? rawTheme.theme : "";
    const summary = isNonEmptyString(rawTheme.summary) ? rawTheme.summary : "";
    if (!theme) errors.push(`${themeIndex + 1}件目のテーマ名がありません。`);
    if (!summary) errors.push(`${themeIndex + 1}件目の要約がありません。`);
    if (!Array.isArray(rawTheme.response_ids) || rawTheme.response_ids.length === 0) {
      errors.push(`${theme || `${themeIndex + 1}件目のテーマ`}: 根拠IDがありません。`);
      continue;
    }

    const evidence: MockAiTheme["evidence"] = [];
    for (const rawId of rawTheme.response_ids) {
      if (!isNonEmptyString(rawId)) {
        errors.push(`${theme || `${themeIndex + 1}件目のテーマ`}: 根拠IDが空か文字列ではありません。`);
        continue;
      }
      const response = responseById.get(rawId);
      if (!response) {
        errors.push(`${theme || `${themeIndex + 1}件目のテーマ`}: 回答ID「${rawId}」が見つかりません。`);
        continue;
      }
      if (referencedIds.has(rawId)) {
        errors.push(`回答ID「${rawId}」が複数回参照されています。`);
        continue;
      }
      referencedIds.add(rawId);
      if (!response.comment.trim()) {
        errors.push(`回答ID「${rawId}」の自由記述が空のため、根拠にできません。`);
        continue;
      }
      evidence.push({ responseId: rawId, comment: response.comment });
    }
    if (evidence.length > 0 && theme && summary) themes.push({ theme, summary, evidence });
  }

  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    analysis: {
      label: SAMPLE_AI_LABEL,
      overall: typeof input.overall === "string" ? input.overall : "",
      limitations: typeof input.limitations === "string" ? input.limitations : "",
      themes,
    },
  };
}

/** Only an explicitly tagged bundled-sample load may use the static fixture. */
export function getMockAiAvailability(
  source: SurveyDataSource,
  fixture: unknown,
  responses: readonly SurveyResponse[],
): MockAiAvailability {
  if (source.kind !== "bundled-sample") {
    return { available: false, message: UPLOADED_AI_UNAVAILABLE_MESSAGE };
  }
  const validated = validateMockAiAnalysis(fixture, responses);
  if (!validated.success) {
    return {
      available: false,
      message: "サンプルAI分析を検証できないため、表示できません。",
      errors: validated.errors,
    };
  }
  return { available: true, analysis: validated.analysis };
}
