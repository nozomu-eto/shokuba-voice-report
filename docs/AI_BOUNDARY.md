# AI server boundary (M3)

## Bedrock preparation

`src/lib/ai/adapter.ts` defines a small Bedrock Converse adapter contract. There is intentionally no AWS SDK implementation, network call, API route, Server Action, browser request, or AI button in this milestone. `src/lib/ai/server-config.ts` is marked `server-only`; keep it and all future credential-bearing code out of Client Component imports. Do not prefix private settings with `NEXT_PUBLIC_`.

The runtime configuration parser is pure and takes an environment map so it can be tested without reading secrets. The example environment is disabled. Both `BEDROCK_ANALYSIS_ENABLED=true` and `BEDROCK_LIVE_APPROVED=true` are required before configuration can produce runtime options. The second switch is a guard, not approval by itself: do not enable either switch or implement a live adapter until the user separately approves the exact AWS operation.

| Variable | Allowed value / range | Example |
| --- | --- | --- |
| `BEDROCK_ANALYSIS_ENABLED` | `true` or `false`; default off | `false` |
| `BEDROCK_LIVE_APPROVED` | `true` or `false`; default off | `false` |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-lite-v1:0` only | `us.amazon.nova-lite-v1:0` |
| `BEDROCK_REGION` | `us-east-1`, `us-west-2`, or `ap-northeast-1` | `ap-northeast-1` |
| `BEDROCK_MAX_INPUT_CHARS` | 1,000–12,000 integer | `12000` |
| `BEDROCK_MAX_OUTPUT_TOKENS` | 128–2,048 integer | `1024` |
| `BEDROCK_TIMEOUT_MS` | 500–15,000 integer | `10000` |

Copy `.env.example` to a local ignored environment file only for local configuration experiments. It contains no credentials. Never commit `.env.local`, access keys, or session tokens. The app currently does not read this configuration from a request path or call Bedrock.

Any eventual runtime should use a dedicated, least-privilege execution role separated from developer credentials and roles. Creating or changing that role requires separate explicit approval.
