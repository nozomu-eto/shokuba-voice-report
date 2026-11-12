import type { SurveyResponse } from "@/lib/survey/types";
import type { BedrockAdapterError, BedrockConverseAdapter } from "./adapter.ts";
import type { BedrockConfiguration } from "./config.ts";
import { validateAiAnalysisOutput, type ValidatedAiAnalysis } from "./output-validation.ts";

export type AiAnalysisFailureCode =
  | "disabled"
  | "approval_required"
  | "invalid_configuration"
  | "adapter_unavailable"
  | "input_too_long"
  | "empty_input"
  | "timeout"
  | "access_denied"
  | "invalid_output"
  | "provider_error";

export type AiAnalysisResult =
  | { status: "success"; analysis: ValidatedAiAnalysis }
  | { status: "unavailable" | "failed"; code: AiAnalysisFailureCode };

type AdapterOutcome =
  | { kind: "response"; value: unknown }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" };

function createPrompt(responses: readonly SurveyResponse[]): string {
  return JSON.stringify({
    task: "自由記述の傾向を根拠ID付きで整理してください。数値の集計は行わないでください。",
    output_schema: {
      overall: "短い全体要約",
      limitations: "解釈上の制約",
      themes: [{ theme: "分類名", summary: "要約", response_ids: ["回答ID"] }],
    },
    responses: responses.map(({ responseId, comment }) => ({ response_id: responseId, comment })),
  });
}

function isAdapterError(error: unknown): error is BedrockAdapterError {
  return error instanceof Error && error.name === "BedrockAdapterError" &&
    "code" in error && (error.code === "access_denied" || error.code === "provider_error");
}

/**
 * Injectable orchestration boundary. No production adapter or HTTP entry point
 * exists; callers must inject a provider implementation explicitly.
 */
export async function runAiAnalysis(
  configuration: BedrockConfiguration,
  adapter: BedrockConverseAdapter | undefined,
  responses: readonly SurveyResponse[],
): Promise<AiAnalysisResult> {
  if (configuration.status === "disabled") {
    return {
      status: "unavailable",
      code: configuration.reason === "approval_required" ? "approval_required" : "disabled",
    };
  }
  if (configuration.status === "invalid") return { status: "unavailable", code: "invalid_configuration" };
  if (!adapter) return { status: "unavailable", code: "adapter_unavailable" };
  if (responses.length === 0) return { status: "failed", code: "empty_input" };

  const prompt = createPrompt(responses);
  if (prompt.length > configuration.options.maxInputChars) {
    return { status: "failed", code: "input_too_long" };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const adapterPromise: Promise<AdapterOutcome> = Promise.resolve()
    .then(() => adapter.invoke({
      modelId: configuration.options.modelId,
      region: configuration.options.region,
      prompt,
      maxOutputTokens: configuration.options.maxOutputTokens,
    }, controller.signal))
    .then((value: unknown) => ({ kind: "response", value }), (error: unknown) => ({ kind: "error", error }));
  const timeoutPromise = new Promise<AdapterOutcome>((resolve) => {
    timeoutId = setTimeout(() => resolve({ kind: "timeout" }), configuration.options.timeoutMs);
  });

  let outcome: AdapterOutcome;
  try {
    outcome = await Promise.race([adapterPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
  if (outcome.kind === "timeout") {
    controller.abort();
    return { status: "failed", code: "timeout" };
  }
  if (outcome.kind === "error") {
    return {
      status: "failed",
      code: isAdapterError(outcome.error) && outcome.error.code === "access_denied"
        ? "access_denied"
        : "provider_error",
    };
  }

  if (typeof outcome.value !== "string") return { status: "failed", code: "invalid_output" };
  const validation = validateAiAnalysisOutput(outcome.value, responses);
  if (!validation.success) return { status: "failed", code: "invalid_output" };
  return { status: "success", analysis: validation.analysis };
}
