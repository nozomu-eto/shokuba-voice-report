# AWS Amplify公開計画（承認前）

作成・公式資料確認日：2026-11-12（JST）

**本書は設計・費用検討資料です。AWSアカウント、AWS CLI/API、Amplify、IAM、Budgets、Bedrockには接続・操作していません。公開はIssue #13の明示承認後に別作業として扱います。**

## 構成と推奨方式

アプリはNext.js 16.4.6 App Routerです。トップページ自体はクライアント操作（サンプル読み込み、ブラウザ内集計、報告書編集、`window.print()`）を含み、サーバーAPI・Route Handler・Server Action・DB・認証・実行時データ取得を持ちません。Bedrock設定準備コードは`server-only`境界にあります。

選択肢は次のとおりです。

| 方式 | 概要 | 判断 |
| --- | --- | --- |
| 静的書き出し（SSG / `output: "export"`） | ビルド時HTMLと静的資産を配信。実行サーバーを必要としない | **推奨**。現在の機能にSSRを必要とする処理がなく、公開物を静的資産に限定できる。AmplifyのNext.js 16 SSR互換性に依存しない |
| Amplify Next.js SSR（compute） | `.next`アーティファクトを使い、Next.jsサーバー機能を実行 | 推奨しない。AWS公式の現行資料はAmplify Hosting computeのNext.js対応を15までとしており、Next.js 16は明記されていない。対応確認なしで選ばない |

Next.js 16のローカルガイド `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` では、`output: "export"`が`out`へHTML等を出力する一方、Proxy、Server Actions、動的Request依存などサーバー機能は非対応と説明されています。このアプリの現行ルートで実際に静的書き出しが成功することを、将来の承認済み準備段階で追加確認してから採用を確定します。AWS公式のNext.js対応表ではSSR computeがNext.js 12〜15を対象としているため、16のSSR利用は未確認です。

## 専用アプリ案・対象の確認

- 既存アプリや無関係なリソースは再利用・変更しない。`shokuba-voice-report-public-demo`等の用途を識別できる**新規の専用Amplifyアプリ**を候補とし、既存名との重複は作成前に利用者が確認する。
- 接続先GitHubリポジトリは`nozomu-eto/shokuba-voice-report`、ブランチは`main`を候補とする。PRブランチの自動公開は設定しない。
- AWSアカウントID、アカウントの所有者・請求先、組織/メンバーアカウント区分、対象AWSリージョン、利用可能なAmplifyの提供条件は未確認。AWS操作前に利用者が指定し、本人がAWSコンソールのアカウント選択を照合する。
- 専用サブドメインは必要性と所有者を確認してから選ぶ。初期案はAmplify提供ドメインとし、独自ドメインはDNS変更が別途必要なため自動で設定しない。
- Amplify GitHub Appを使う場合は当該リポジトリだけの読み取りアクセスに限定し、GitHub側の権限表示を確認してから接続する。個人アクセストークンをソースへ保存しない。

## IAMとBedrockの境界

- ビルドにAWSサービス操作を追加しない。静的サイトのみなら、Bedrock・S3アプリデータ・DynamoDB・Lambda等の権限は付与しない。
- Amplifyのサービスロールが必要と判断された場合は、専用アプリ専用のロールを候補にし、AWS公式のロール要件と実際に必要な機能を確認して、対象リソース・操作を最小化する。管理者権限や既存の個人ロールを流用しない。ポリシー・信頼関係の作成は今回の承認には含まれない。
- AWS公式のSSR手順にはAmplifyのCloudWatch Logs配信向けサービスロールが説明されています。ログ機能を有効にする場合は、ログに利用者入力を含まないこと、保存期間、ロググループの削除を個別に設計する。静的サイトにSSRログを追加しない。
- Bedrockは公開デモで無効のままにする。`BEDROCK_ANALYSIS_ENABLED` / `BEDROCK_LIVE_APPROVED`はどちらもfalseのままとし、公開コードにはAWS SDK・実アダプター・API・Server Action・AI実行UIを含めない。公開ビルド後にコード検索とNetwork確認を行う。フラグ値は承認の代わりにならない。

## 合成データ限定の確認

1. productionビルドで「CSVを選択」コントロールが存在せず、同梱サンプル読み込みだけが表示されることを確認する。
2. 公開URLでサンプルを読み込み、回答ID・コメントがリポジトリ内の合成フィクスチャと一致することを確認する。
3. クライアントJS、静的HTML、ソースマップ、ビルドアーティファクトに`.env.local`、実従業員データ、認証情報、デバッグ値がないことをスキャンする。
4. Browser Networkパネルでサンプル操作、集計、報告書編集時にアプリ由来の外部データ送信やAPI要求がないことを確認する（静的配信の通常リクエストを除く）。
5. Bedrock関連の公開呼び出し先がなく、画面に「サンプルAI分析（事前生成・デモ用）」と根拠確認の注意が出ることを確認する。
6. 架空データ以外を入力しないよう、公開ページと利用説明に明示する。公開デモ利用者がCSVをアップロードできる設定にはしない。

## 将来のデプロイ操作一覧

承認後も、実行直前に対象と費用を再提示して承認範囲を確認する。想定操作は以下のとおり。

1. 利用者が指定したアカウント・リージョンをAWSコンソールで確認する。
2. GitHub Appを当該リポジトリの読取専用で認可する。
3. 指定リージョンに専用Amplifyアプリを作成し、`main`ブランチを接続する。
4. 静的書き出し設定、Node.js/pnpmビルド環境、成果物ディレクトリを設定する。リージョンと実行時点のAmplify仕様を再確認する。
5. 必要性を確認した場合のみ専用IAMサービスロールとログ設定を構成する。
6. 初回ビルド・公開を実行し、発行URLを確認する。
7. 動作・安全性・料金メーターを確認し、結果を記録する。

これらは予定一覧であり、今回は実施していません。DNS、独自ドメイン、WAF、Budgets、IAM変更、Bedrock、既存AWSリソースの調査・変更は、個別に承認された場合を除いて対象外です。

## 費用見積もりと不確実性

確認日現在の[AWS Amplify料金ページ](https://aws.amazon.com/amplify/pricing/)は、標準ビルド時間、CDN保存、データ転送、SSR要求・実行時間などの従量項目とFree Tier条件を掲載しています。料金ページ記載額・無料枠はアカウント資格、リージョン、契約・クレジット、為替、税、仕様変更で変わり得ます。公開時点で必ず再確認してください。

静的ホスティング案で想定する月額は、単純化すると以下です。

`ビルド分数 × 適用リージョン/ビルド種別の単価 + CDN保存GB月 × 単価 + 配信GB × 単価 + 任意機能の費用 + 税等`

Amplify料金ページ（2026-11-12確認）には、標準ビルドが無料枠超過後`USD 0.01/分`、CDN保存が無料枠超過後`USD 0.023/GB月`、転送が無料枠超過後`USD 0.15/GB`と表示されます。これらは掲載ページ上の参考値で、実際の請求価格や無料枠適用を確約しません。SSRを選ぶ場合は別途リクエスト数・実行時間が加わります。WAFを有効にするとページ記載の固定アプリ料金とWAF費用も追加されるため、初期案では有効化しません。

利用者数、平均転送量、ビルド回数・時間、対象リージョン、AWSアカウントのFree Tier資格・クレジットが不明なので、**月額の単一数値は現時点で確定できません**。承認時に想定利用量を入力してAWS Pricing Calculatorで再計算し、見積もりを保管してください。Free Tier内でも「無料公開」とは断定せず、上限超過や他機能の費用可能性を残します。

### 監視案

- Amplifyアプリに用途を示すタグを設定し、Cost Explorerでサービス・リージョン・タグ別に費用を確認する。
- 利用者承認後に限り専用の月額AWS Budgetと実績/予測アラートを設定する。Budgetは通知であり、費用上限を強制停止するものではない。
- AWS Free Tier利用状況、請求ダッシュボード、Cost Anomaly Detectionも定期確認する。これらの有効化・通知先設定は今回操作していない。
- 最初の週はビルド回数と転送量を頻繁に確認し、以降は月次で見直す。

## 公開URLの動作確認手順

1. シークレットウィンドウとスマートフォン幅でページを開き、公開モードの説明とサンプルボタンのみを確認する。
2. サンプルCSV相当の同梱データを読み込み、3件と4項目平均3.3 / 2.7 / 3.0 / 3.7を照合する。
3. 各AI根拠IDを選び、原文が表示されること、分析が事前生成の参考情報と明示されることを確認する。
4. タイトル・本文を編集し、数値は変更されないこと、更新やデータ切替で編集状態が初期化されることを確認する。
5. キーボード操作、フォーカス、拡大表示、A4縦印刷プレビュー、PDF保存を確認する。
6. Networkパネル、Console、配信アーティファクトの点検を行い、外部API要求、Bedrock、実データ、秘密情報、デバッグ出力がないことを記録する。
7. 不正CSV入力UIが公開版にないことを確認する。CSVパーサー自体のエラー試験はローカル合成データによる自動テストで行う。

## 停止・削除・費用抑止案

公開を停止するときは、まずAmplifyブランチの自動ビルドを停止またはGit接続を解除し、専用アプリを無効化・削除する。独自ドメインを別途設定していた場合はドメイン関連付けとDNSレコードを担当者が確認し、不要レコードを削除する。アプリ専用に作成したIAMロール、CloudWatchロググループ、アプリ関連リソースは依存関係を確認してから削除する。Cost Explorer/Billingで翌請求期間まで費用を確認する。AWS Budgetsは通知であり、削除だけが費用発生を防ぐ保証ではないため、保存資産・ログ・ドメイン・配信を確認する。

これは将来の手順案です。削除は破壊的なため、対象ARN/IDとデータ影響を提示し、実行前に別途承認を得ます。

## 公開前の利用者承認チェックリスト

- [ ] AWSアカウントID、所有者、請求先を利用者が確認した
- [ ] 対象リージョンとAmplify提供状況を確認した
- [ ] Next.js 16静的書き出しをローカル検証し、SSRを避けられると確認した
- [ ] 専用アプリ名と既存アプリに影響しないことを確認した
- [ ] GitHub Appに与えるリポジトリ権限を確認した
- [ ] 最小権限ロールが必要か、ログを有効にするかを承認した
- [ ] AWS Pricing Calculatorで利用量・Free Tier条件を反映した見積もりを確認した
- [ ] Budget通知先、しきい値、通知の限界を確認した
- [ ] Bedrock・AWS SDK・データ送信が公開物にないことを確認した
- [ ] 合成サンプル限定、問い合わせ先、停止・削除手順を確認した
- [ ] AWS操作一覧と費用発生可能性を確認し、この実行に対する明示承認を行った

## AWS公式出典

- [Amplify support for Next.js](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html) — SSR compute対応バージョンと機能表
- [Deploying a Next.js SSR application to Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-app.html) — SSR/SSGビルド成果物と設定の説明
- [Setting up Amplify access to GitHub repositories](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html) — GitHub Appのリポジトリ単位アクセス
- [Adding a service role with permissions to deploy backend resources](https://docs.aws.amazon.com/amplify/latest/userguide/amplify-service-role.html) — Amplifyサービスロールと信頼関係
- [AWS Amplify Pricing](https://aws.amazon.com/amplify/pricing/) — 料金項目と掲載単価（動的ページ）
- [Managing your costs with AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) — 予算アラートと通知の遅れ・超過可能性
- [AWS Billing and Cost Management](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/) — Cost Explorer、Budgets、Cost Anomaly Detection
