import type { BedrockRuntimeOptions } from "./config.ts";

/** Narrow boundary for a future Bedrock Converse adapter. No SDK adapter is provided. */
export interface BedrockConverseAdapter {
  invoke(
    request: {
      modelId: BedrockRuntimeOptions["modelId"];
      region: BedrockRuntimeOptions["region"];
      prompt: string;
      maxOutputTokens: number;
    },
    signal: AbortSignal,
  ): Promise<string>;
}

export class BedrockAdapterError extends Error {
  readonly code: "access_denied" | "provider_error";

  constructor(code: "access_denied" | "provider_error") {
    super(code);
    this.name = "BedrockAdapterError";
    this.code = code;
  }
}
