import assert from "node:assert/strict";
import test from "node:test";
import { readBedrockConfiguration, type BedrockEnvironment } from "../src/lib/ai/config.ts";

const enabledConfiguration: BedrockEnvironment = {
  BEDROCK_ANALYSIS_ENABLED: "true",
  BEDROCK_LIVE_APPROVED: "true",
  BEDROCK_MODEL_ID: "apac.amazon.nova-lite-v1:0",
  BEDROCK_REGION: "ap-northeast-1",
  BEDROCK_MAX_INPUT_CHARS: "12000",
  BEDROCK_MAX_OUTPUT_TOKENS: "1024",
  BEDROCK_TIMEOUT_MS: "10000",
};

test("missing and default switches fail closed without producing runtime options", () => {
  assert.deepEqual(readBedrockConfiguration({}), {
    status: "disabled",
    reason: "feature_disabled",
  });
  assert.deepEqual(readBedrockConfiguration({ BEDROCK_ANALYSIS_ENABLED: "true" }), {
    status: "disabled",
    reason: "approval_required",
  });
  assert.deepEqual(readBedrockConfiguration({ ...enabledConfiguration, BEDROCK_ANALYSIS_ENABLED: "false" }), {
    status: "disabled",
    reason: "feature_disabled",
  });
  assert.deepEqual(readBedrockConfiguration({ ...enabledConfiguration, BEDROCK_LIVE_APPROVED: "false" }), {
    status: "disabled",
    reason: "approval_required",
  });
});

test("only allowlisted model, region, and bounded integer limits enable the boundary", () => {
  assert.deepEqual(readBedrockConfiguration(enabledConfiguration), {
    status: "enabled",
    options: {
      modelId: "apac.amazon.nova-lite-v1:0",
      region: "ap-northeast-1",
      maxInputChars: 12000,
      maxOutputTokens: 1024,
      timeoutMs: 10000,
    },
  });

  const invalidConfigurations: BedrockEnvironment[] = [
    { ...enabledConfiguration, BEDROCK_MODEL_ID: "arbitrary-model" },
    { ...enabledConfiguration, BEDROCK_REGION: "eu-west-3" },
    { ...enabledConfiguration, BEDROCK_MODEL_ID: "us.amazon.nova-lite-v1:0" },
    { ...enabledConfiguration, BEDROCK_MODEL_ID: "amazon.nova-lite-v1:0", BEDROCK_REGION: "us-east-1" },
    { ...enabledConfiguration, BEDROCK_MODEL_ID: "apac.amazon.nova-lite-v1:0", BEDROCK_REGION: "us-east-1" },
    { ...enabledConfiguration, BEDROCK_MAX_INPUT_CHARS: "999999" },
    { ...enabledConfiguration, BEDROCK_MAX_OUTPUT_TOKENS: "1.5" },
    { ...enabledConfiguration, BEDROCK_TIMEOUT_MS: "0" },
    { ...enabledConfiguration, BEDROCK_ANALYSIS_ENABLED: "yes" },
  ];

  for (const env of invalidConfigurations) {
    assert.deepEqual(readBedrockConfiguration(env), {
      status: "invalid",
      reason: "invalid_configuration",
    });
  }
});

test("accepts only documented Nova Lite model and calling-region pairs", () => {
  const validPairs = [
    ["amazon.nova-lite-v1:0", "ap-northeast-1"],
    ["us.amazon.nova-lite-v1:0", "us-east-1"],
    ["us.amazon.nova-lite-v1:0", "us-west-2"],
    ["apac.amazon.nova-lite-v1:0", "ap-northeast-1"],
  ] as const;
  for (const [modelId, region] of validPairs) {
    assert.equal(readBedrockConfiguration({
      ...enabledConfiguration,
      BEDROCK_MODEL_ID: modelId,
      BEDROCK_REGION: region,
    }).status, "enabled", `${modelId} with ${region}`);
  }
});
