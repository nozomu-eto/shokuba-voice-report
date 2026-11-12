export const ALLOWED_BEDROCK_MODEL_IDS = ["us.amazon.nova-lite-v1:0"] as const;
export const ALLOWED_BEDROCK_REGIONS = ["us-east-1", "us-west-2", "ap-northeast-1"] as const;

export type BedrockModelId = (typeof ALLOWED_BEDROCK_MODEL_IDS)[number];
export type BedrockRegion = (typeof ALLOWED_BEDROCK_REGIONS)[number];

export type BedrockRuntimeOptions = {
  modelId: BedrockModelId;
  region: BedrockRegion;
  maxInputChars: number;
  maxOutputTokens: number;
  timeoutMs: number;
};

export type BedrockConfiguration =
  | { status: "disabled"; reason: "feature_disabled" | "approval_required" }
  | { status: "invalid"; reason: "invalid_configuration" }
  | { status: "enabled"; options: BedrockRuntimeOptions };

export type BedrockEnvironment = Readonly<Record<string, string | undefined>>;

const LIMITS = {
  maxInputChars: { min: 1_000, max: 12_000 },
  maxOutputTokens: { min: 128, max: 2_048 },
  timeoutMs: { min: 500, max: 15_000 },
} as const;

function boundedInteger(
  value: string | undefined,
  limits: { min: number; max: number },
): number | null {
  if (!value || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= limits.min && number <= limits.max ? number : null;
}

/** Parse only explicit environment values; unknown or malformed values fail closed. */
export function readBedrockConfiguration(env: BedrockEnvironment): BedrockConfiguration {
  const enabled = env.BEDROCK_ANALYSIS_ENABLED;
  const approved = env.BEDROCK_LIVE_APPROVED;
  if (
    (enabled !== undefined && enabled !== "true" && enabled !== "false") ||
    (approved !== undefined && approved !== "true" && approved !== "false")
  ) {
    return { status: "invalid", reason: "invalid_configuration" };
  }
  if (enabled !== "true") return { status: "disabled", reason: "feature_disabled" };
  if (approved !== "true") return { status: "disabled", reason: "approval_required" };

  const modelId = ALLOWED_BEDROCK_MODEL_IDS.find((allowed) => allowed === env.BEDROCK_MODEL_ID);
  const region = ALLOWED_BEDROCK_REGIONS.find((allowed) => allowed === env.BEDROCK_REGION);
  const maxInputChars = boundedInteger(env.BEDROCK_MAX_INPUT_CHARS, LIMITS.maxInputChars);
  const maxOutputTokens = boundedInteger(env.BEDROCK_MAX_OUTPUT_TOKENS, LIMITS.maxOutputTokens);
  const timeoutMs = boundedInteger(env.BEDROCK_TIMEOUT_MS, LIMITS.timeoutMs);

  if (
    modelId === undefined || region === undefined ||
    maxInputChars === null || maxOutputTokens === null || timeoutMs === null
  ) {
    return { status: "invalid", reason: "invalid_configuration" };
  }

  return {
    status: "enabled",
    options: {
      modelId,
      region,
      maxInputChars,
      maxOutputTokens,
      timeoutMs,
    },
  };
}
