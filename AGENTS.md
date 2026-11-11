# Codex agent instructions — 職場の声レポート

## Mission
Build a small, polished, reliable Japanese employee-survey reporting portfolio app. Prioritize a **working local vertical slice** over redesigns or expanding the scope.

Read `docs/IMPLEMENTATION_BRIEF.md` and `docs/CODEX_START.md` first. Inspect the existing Next.js repo before changing it. Maintain existing project settings.

## Tech and workflow
- Next.js App Router + TypeScript + Tailwind CSS, pnpm only. Use `pnpm` for every dependency/script. Keep `pnpm-lock.yaml`; do not add npm/yarn lockfiles.
- Prefer a minimal dependency footprint. Explain any new dependency before adding it. Avoid DB, auth, payments, charts libraries, analytics, upload services, or external APIs for the first milestone.
- Implement in small, testable, reviewable changes. Avoid changing `next.config` / eslint config unless needed.
- Write UI and user-visible errors in natural, accessible Japanese.
- Use strict typing; no `any` without a justified local exception. No fake dynamic data.

## AWS & privacy: hard stop
- **Never call any AWS API, deploy, create/modify/delete cloud resources, change IAM or budgets, or invoke Bedrock** without the user's explicit advance approval for the exact operation. This includes "harmless" live test prompts that incur charges.
- Existing ChatGPT AWS connection may be root. Do not use it. Do not request, create, store, or commit AWS credentials/access keys.
- In this milestone, **do not integrate a live Bedrock SDK call, endpoint, or API key**. Keep analysis a clearly labeled local demo fixture.
- Only synthetic, anonymous test data. Never log, persist, upload, or expose real employee records. Process CSV in browser memory where feasible.

## Data integrity and AI output safety
- Deterministic code calculates all numeric metrics; never ask the LLM to calculate averages/counts.
- Every AI category must cite existing response IDs; reject or visibly flag unknown/duplicate IDs and unsupported claims.
- **Do not present static mock AI analysis as the result of an arbitrary uploaded CSV.** Show fixture AI findings only for the app's bundled sample dataset, labeled 「サンプルAI分析（事前生成・デモ用）」. Any other user-uploaded dataset gets numerical analysis only, with a clear AI-unavailable explanation.
- The sample CSV schema bundled here is a **provisional starter schema**, not a verified copy of older specs. If actual earlier spec/sample files are provided, reconcile them explicitly before silently changing fields.

## Visual quality
- Simple Japanese HR-oriented interface: white background, blue/green accents, Noto Sans JP or sensible system fallback, 16px+ body text, generous spacing, ~44–48px interactive targets, obvious focus states, responsive layout, accessible labels, no clutter.
- Make it clear when metrics are computed, when AI text is a demo fixture, and what evidence supports each claim.
- Print-friendly report can be a later milestone; do not block the first vertical slice on it.

## First milestone acceptance
1. `pnpm dev` works and bundled sample data loads with one click.
2. CSV file can be read locally with validation (UTF-8 BOM, quoted fields/commas, missing columns, duplicate IDs, invalid 1–5 values, empty CSV), and errors are actionable in Japanese.
3. Calculate counts and per-question averages deterministically; handle invalid/empty input without NaN or silent coercion.
4. Show sample AI categories and source response IDs with a click-to-view original comment; label them static demo results.
5. Uploading a different CSV cannot cause the sample AI categories to be displayed as though they came from uploaded data.
6. Tests cover parsing, aggregation, ID cross-check, and mock gating. Run `pnpm exec tsc --noEmit`, available lint script, tests, and `pnpm build`; report exact commands/results.
7. Summarize edited files, known limitations, and follow-up tasks. Do not claim live Bedrock integration or production readiness.

## Completion discipline
Implement only milestone 1 in the first Codex run. After reporting successful local build and tests, stop and ask for review before adding Bedrock, AWS Amplify, PDF generation packages, persistence, or other major scope.
