# CSVスキーマ（暫定）

このスキーマは `docs/IMPLEMENTATION_BRIEF.md` に基づくスターター仕様です。過去の正式仕様を確認したものではありません。正式な仕様が提供された場合は、型・文書・テストを一緒に更新してください。

CSVはUTF-8（BOM可）です。列の対応付けはヘッダー名で行い、列順には依存しません。同梱フィクスチャは以下の順でヘッダーを記載しています。

| CSVヘッダー | TypeScriptの項目 | 条件 |
| --- | --- | --- |
| `回答ID` | `responseId` | 必須。空欄・重複不可 |
| `働きやすさ` | `workEnvironment` | 必須。1〜5の整数 |
| `相談しやすさ` | `easeOfConsultation` | 必須。1〜5の整数 |
| `情報共有` | `informationSharing` | 必須。1〜5の整数 |
| `継続意向` | `intentionToStay` | 必須。1〜5の整数 |
| `自由記述` | `comment` | 列は必須。値は空欄可 |

`SurveyResponse` は検証済みの1回答を表し、評価値は `SurveyScore`（整数の1〜5）です。CSVからこの型へ変換する際には、パースと実行時検証を行ってください。TypeScriptの型だけで入力値が妥当だとはみなしません。

同梱の `fixtures/employee-survey-sample.csv` は、R001〜R003の架空回答3件です。`fixtures/ai-analysis-mock.json` もこのサンプル用の静的デモ結果です。
