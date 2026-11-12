import type { SurveyResponse } from "@/lib/survey/types";

export const AI_OUTPUT_LIMITS = {
  totalChars: 12_000,
  overallChars: 1_000,
  limitationsChars: 1_000,
  themeCount: 8,
  themeNameChars: 100,
  summaryChars: 700,
  evidenceIdsPerTheme: 10,
  responseIdChars: 80,
} as const;

export type ValidatedAiTheme = {
  theme: string;
  summary: string;
  evidence: Array<{ responseId: string; comment: string }>;
};

export type ValidatedAiAnalysis = {
  overall: string;
  limitations: string;
  themes: ValidatedAiTheme[];
};

export type AiOutputIssueCode =
  | "invalid_json"
  | "invalid_schema"
  | "invalid_text"
  | "theme_limit"
  | "evidence_limit"
  | "evidence_missing"
  | "evidence_unknown"
  | "evidence_duplicate"
  | "evidence_empty_comment";

export type AiOutputValidation =
  | { success: true; analysis: ValidatedAiAnalysis }
  | { success: false; issues: AiOutputIssueCode[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseWholeJsonDocument(text: string): unknown {
  const trimmed = text.trim();
  let jsonText = trimmed;
  if (trimmed.startsWith("```") || trimmed.endsWith("```")) {
    const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
    if (!fenced) throw new SyntaxError("invalid fenced document");
    jsonText = fenced[1];
  }
  return JSON.parse(jsonText) as unknown;
}

/**
 * Validates model text and replaces every citation with the original comment
 * from the supplied, already-validated responses. This cannot assess semantic truth.
 */
export function validateAiAnalysisOutput(
  text: string,
  responses: readonly SurveyResponse[],
): AiOutputValidation {
  if (text.length > AI_OUTPUT_LIMITS.totalChars) {
    return { success: false, issues: ["invalid_text"] };
  }

  let value: unknown;
  try {
    value = parseWholeJsonDocument(text);
  } catch {
    return { success: false, issues: ["invalid_json"] };
  }
  if (!isRecord(value)) return { success: false, issues: ["invalid_schema"] };

  const issues: AiOutputIssueCode[] = [];
  const overall = value.overall;
  const limitations = value.limitations;
  const rawThemes = value.themes;
  if (
    typeof overall !== "string" || !overall.trim() || overall.length > AI_OUTPUT_LIMITS.overallChars ||
    typeof limitations !== "string" || !limitations.trim() || limitations.length > AI_OUTPUT_LIMITS.limitationsChars
  ) issues.push("invalid_text");
  if (!Array.isArray(rawThemes) || rawThemes.length === 0) {
    return { success: false, issues: [...issues, "invalid_schema"] };
  }
  if (rawThemes.length > AI_OUTPUT_LIMITS.themeCount) issues.push("theme_limit");

  const responsesById = new Map(responses.map((response) => [response.responseId, response]));
  const usedIds = new Set<string>();
  const themes: ValidatedAiTheme[] = [];
  for (const rawTheme of rawThemes.slice(0, AI_OUTPUT_LIMITS.themeCount)) {
    if (!isRecord(rawTheme)) {
      issues.push("invalid_schema");
      continue;
    }
    const theme = rawTheme.theme;
    const summary = rawTheme.summary;
    const responseIds = rawTheme.response_ids;
    if (
      typeof theme !== "string" || !theme.trim() || theme.length > AI_OUTPUT_LIMITS.themeNameChars ||
      typeof summary !== "string" || !summary.trim() || summary.length > AI_OUTPUT_LIMITS.summaryChars
    ) {
      issues.push("invalid_text");
      continue;
    }
    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      issues.push("evidence_missing");
      continue;
    }
    if (responseIds.length > AI_OUTPUT_LIMITS.evidenceIdsPerTheme) {
      issues.push("evidence_limit");
      continue;
    }

    const evidence: ValidatedAiTheme["evidence"] = [];
    let themeHasInvalidEvidence = false;
    for (const rawId of responseIds) {
      if (typeof rawId !== "string" || !rawId.trim() || rawId.length > AI_OUTPUT_LIMITS.responseIdChars) {
        issues.push("invalid_schema");
        themeHasInvalidEvidence = true;
        continue;
      }
      const response = responsesById.get(rawId);
      if (!response) {
        issues.push("evidence_unknown");
        themeHasInvalidEvidence = true;
        continue;
      }
      if (usedIds.has(rawId)) {
        issues.push("evidence_duplicate");
        themeHasInvalidEvidence = true;
        continue;
      }
      if (!response.comment.trim()) {
        issues.push("evidence_empty_comment");
        themeHasInvalidEvidence = true;
        continue;
      }
      usedIds.add(rawId);
      evidence.push({ responseId: rawId, comment: response.comment });
    }
    if (themeHasInvalidEvidence || evidence.length === 0) continue;
    themes.push({ theme, summary, evidence });
  }

  if (issues.length > 0 || typeof overall !== "string" || typeof limitations !== "string" || themes.length === 0) {
    return { success: false, issues: issues.length > 0 ? issues : ["invalid_schema"] };
  }
  return { success: true, analysis: { overall, limitations, themes } };
}
