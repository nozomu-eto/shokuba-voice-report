import assert from "node:assert/strict";
import test from "node:test";
import { BedrockAdapterError, type BedrockConverseAdapter } from "../src/lib/ai/adapter.ts";
import { readBedrockConfiguration } from "../src/lib/ai/config.ts";
import { runAiAnalysis } from "../src/lib/ai/run-analysis.ts";
import { aggregateSurveyResponses } from "../src/lib/survey/aggregate.ts";
import { BUNDLED_SAMPLE_RESPONSES } from "../src/lib/survey/sample.ts";
import { INITIAL_REPORT_DRAFT, updateReportDraft } from "../src/lib/survey/report.ts";

const configValues = {
  BEDROCK_ANALYSIS_ENABLED: "true",
  BEDROCK_LIVE_APPROVED: "true",
  BEDROCK_MODEL_ID: "apac.amazon.nova-lite-v1:0",
  BEDROCK_REGION: "ap-northeast-1",
  BEDROCK_MAX_INPUT_CHARS: "12000",
  BEDROCK_MAX_OUTPUT_TOKENS: "1024",
  BEDROCK_TIMEOUT_MS: "500",
};
const enabled = readBedrockConfiguration(configValues);
assert.equal(enabled.status, "enabled");
if (enabled.status !== "enabled") throw new Error("test configuration must be enabled");

const validOutput = JSON.stringify({
  overall: "参考要約",
  limitations: "意味上の確認が必要です。",
  themes: [{ theme: "相談", summary: "相談先について", response_ids: ["R002"] }],
});

function adapter(invoke: BedrockConverseAdapter["invoke"]): BedrockConverseAdapter {
  return { invoke };
}

async function failureCode(result: ReturnType<typeof runAiAnalysis> extends Promise<infer T> ? T : never) {
  if (result.status === "success") throw new Error("expected an AI failure result");
  return result.code;
}

test("disabled, unapproved, invalid, or missing adapter states never invoke the adapter", async () => {
  let calls = 0;
  const fake = adapter(async () => { calls += 1; return validOutput; });
  const defaultDisabled = readBedrockConfiguration({});
  const approvalRequired = readBedrockConfiguration({ BEDROCK_ANALYSIS_ENABLED: "true" });
  const invalid = readBedrockConfiguration({ ...configValues, BEDROCK_MAX_INPUT_CHARS: "999999" });
  assert.equal(await failureCode(await runAiAnalysis(defaultDisabled, fake, BUNDLED_SAMPLE_RESPONSES)), "disabled");
  assert.equal(await failureCode(await runAiAnalysis(approvalRequired, fake, BUNDLED_SAMPLE_RESPONSES)), "approval_required");
  assert.equal(await failureCode(await runAiAnalysis(invalid, fake, BUNDLED_SAMPLE_RESPONSES)), "invalid_configuration");
  assert.equal(await failureCode(await runAiAnalysis(enabled, undefined, BUNDLED_SAMPLE_RESPONSES)), "adapter_unavailable");
  assert.equal(calls, 0);
});

test("injected fake adapter returns validated data without network calls", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { throw new Error("network access is forbidden in this test"); };
  try {
    const result = await runAiAnalysis(enabled, adapter(async (request) => {
      calls += 1;
      assert.equal(request.modelId, "apac.amazon.nova-lite-v1:0");
      assert.equal(request.region, "ap-northeast-1");
      assert.ok(request.prompt.includes("R002"));
      return validOutput;
    }), BUNDLED_SAMPLE_RESPONSES);
    assert.equal(result.status, "success");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("timeout, access denial, malformed citations, empty result, and unexpected exceptions fail closed", async () => {
  let observedSignal: AbortSignal | undefined;
  const timeoutResult = await runAiAnalysis(enabled, adapter((_request, signal) => {
    observedSignal = signal;
    return new Promise<string>(() => {});
  }), BUNDLED_SAMPLE_RESPONSES);
  assert.deepEqual(timeoutResult, { status: "failed", code: "timeout" });
  assert.equal(observedSignal?.aborted, true);

  const denied = await runAiAnalysis(enabled, adapter(async () => { throw new BedrockAdapterError("access_denied"); }), BUNDLED_SAMPLE_RESPONSES);
  assert.deepEqual(denied, { status: "failed", code: "access_denied" });
  const invalidCitation = await runAiAnalysis(enabled, adapter(async () => validOutput.replace("R002", "R999")), BUNDLED_SAMPLE_RESPONSES);
  assert.deepEqual(invalidCitation, { status: "failed", code: "invalid_output" });
  const emptyThemes = await runAiAnalysis(enabled, adapter(async () => JSON.stringify({ overall: "", limitations: "", themes: [] })), BUNDLED_SAMPLE_RESPONSES);
  assert.deepEqual(emptyThemes, { status: "failed", code: "invalid_output" });
  const unexpected = await runAiAnalysis(enabled, adapter(async () => { throw new Error("sensitive details must not escape"); }), BUNDLED_SAMPLE_RESPONSES);
  assert.deepEqual(unexpected, { status: "failed", code: "provider_error" });
});

test("non-string adapter results fail safely without exposing returned data", async () => {
  for (const malformed of [undefined, null, { sensitive: "do not expose" }]) {
    const result = await runAiAnalysis(enabled, adapter(async () => malformed as unknown as string), BUNDLED_SAMPLE_RESPONSES);
    assert.deepEqual(result, { status: "failed", code: "invalid_output" });
    assert.equal(JSON.stringify(result).includes("sensitive"), false);
  }
});

test("input length limit stops before adapter invocation", async () => {
  let calls = 0;
  const longResponses = BUNDLED_SAMPLE_RESPONSES.map((response, index) =>
    index === 0 ? { ...response, comment: "x".repeat(13_000) } : response,
  );
  const result = await runAiAnalysis(enabled, adapter(async () => { calls += 1; return validOutput; }), longResponses);
  assert.deepEqual(result, { status: "failed", code: "input_too_long" });
  assert.equal(calls, 0);
});

test("AI failure does not alter deterministic metrics or manually edited report state", async () => {
  const report = updateReportDraft(INITIAL_REPORT_DRAFT, "challenges", "担当者が記入した文章");
  const beforeMetrics = aggregateSurveyResponses(BUNDLED_SAMPLE_RESPONSES);
  const beforeReport = { ...report };
  const result = await runAiAnalysis(enabled, adapter(async () => { throw new Error("provider unavailable"); }), BUNDLED_SAMPLE_RESPONSES);
  const afterMetrics = aggregateSurveyResponses(BUNDLED_SAMPLE_RESPONSES);
  assert.deepEqual(result, { status: "failed", code: "provider_error" });
  assert.deepEqual(afterMetrics, beforeMetrics);
  assert.deepEqual(report, beforeReport);
});
