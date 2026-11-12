export type DemoMode = "local" | "public";

/** Only an explicit Next.js development build may accept a local CSV. */
export function getDemoMode(nodeEnvironment: string | undefined): DemoMode {
  return nodeEnvironment === "development" ? "local" : "public";
}

export const PUBLIC_DEMO_NOTICE =
  "公開デモでは同梱の架空サンプルのみ利用できます。実在する従業員データや社内情報は入力しないでください。";

export const LOCAL_MODE_NOTICE =
  "ローカル開発モードです。CSVはこのブラウザ内で処理されます。実在データではなく架空データを使用してください。";
