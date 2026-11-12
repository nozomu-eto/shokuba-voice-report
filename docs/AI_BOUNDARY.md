# AI server boundary (M3)

## Bedrock preparation

`src/lib/ai/adapter.ts` defines a small Bedrock Converse adapter contract. There is intentionally no AWS SDK implementation, network call, API route, Server Action, browser request, or AI button in this milestone. `src/lib/ai/server-config.ts` is marked `server-only`; keep it and all future credential-bearing code out of Client Component imports. Do not prefix private settings with `NEXT_PUBLIC_`.

The runtime configuration parser is pure and takes an environment map so it can be tested without reading secrets. The example environment is disabled. Both `BEDROCK_ANALYSIS_ENABLED=true` and `BEDROCK_LIVE_APPROVED=true` are required before configuration can produce runtime options. The second switch is a guard, not approval by itself: do not enable either switch or implement a live adapter until the user separately approves the exact AWS operation.

| Variable | Allowed value / range | Example |
| --- | --- | --- |
| `BEDROCK_ANALYSIS_ENABLED` | `true` or `false`; default off | `false` |
| `BEDROCK_LIVE_APPROVED` | `true` or `false`; default off | `false` |
| `BEDROCK_MODEL_ID` | `amazon.nova-lite-v1:0`, `us.amazon.nova-lite-v1:0`, or `apac.amazon.nova-lite-v1:0`; only documented model/region pairs below | `apac.amazon.nova-lite-v1:0` |
| `BEDROCK_REGION` | `us-east-1`, `us-west-2`, or `ap-northeast-1`; only documented model/region pairs below | `ap-northeast-1` |
| `BEDROCK_MAX_INPUT_CHARS` | 1,000–12,000 integer | `12000` |
| `BEDROCK_MAX_OUTPUT_TOKENS` | 128–2,048 integer | `1024` |
| `BEDROCK_TIMEOUT_MS` | 500–15,000 integer | `10000` |

Copy `.env.example` to a local ignored environment file only for local configuration experiments. It contains no credentials. Never commit `.env.local`, access keys, or session tokens. The app currently does not read this configuration from a request path or call Bedrock.

The parser allows only these documented model ID and calling-region pairs: `amazon.nova-lite-v1:0` with `ap-northeast-1` (In-Region), `us.amazon.nova-lite-v1:0` with `us-east-1` or `us-west-2` (US Geo), and `apac.amazon.nova-lite-v1:0` with `ap-northeast-1` (APAC Geo). Other combinations fail closed. The APAC profile can route processing outside Japan, including to Seoul, Osaka, Mumbai, Singapore, or Sydney; selecting Tokyo as the calling region does not guarantee Japan-only processing. See the [official Nova Lite model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html) for current regional availability and routing.

Any eventual runtime should use a dedicated, least-privilege execution role separated from developer credentials and roles. Creating or changing that role requires separate explicit approval.

## Output validation and failure behavior

`validateAiAnalysisOutput` accepts a JSON object or one whole-document Markdown JSON fence. It does not search a response for a JSON substring; surrounding prose, partial fences, malformed JSON, missing fields, wrong types, empty themes, excessive theme/text sizes, and malformed citation arrays fail closed. The validator limits the complete response to 12,000 characters, at most 8 themes, and at most 10 IDs per theme.

Every cited ID must exist in the supplied validated responses, may be used only once across the result, and must point to a non-empty comment. The resulting evidence text is copied from the source response, never from model output. Unknown IDs and invalid references reject the analysis; no missing category or citation is invented.

`runAiAnalysis` separates disabled, approval-required, invalid-configuration, adapter-unavailable, input-too-long, timeout, access-denied, invalid-output, and unexpected-provider failures. Failure values contain only a small code; they omit prompt text, response comments, credentials, and adapter exception messages. The service has no logger and does not write to CSV, metrics, or manual report state.

Tests inject a local fake `BedrockConverseAdapter`; the fake returns strings or deliberately malformed values, or throws controlled errors, and makes no network request. Run `pnpm test` to execute the full suite. No AWS SDK is installed, and no AWS API, CLI, Bedrock inference, or other external API was called for implementation or tests.

The validator checks output structure, bounds, citation existence, and source-comment correspondence only. It cannot establish that a theme or summary is semantically accurate. Any future model result must remain a suggestion for a person to compare with source comments and approve. The bundled static analysis remains restricted to the bundled sample, and uploaded CSV analysis or server submission remains unavailable.
