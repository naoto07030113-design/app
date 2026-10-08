# ITO AI Recruiting

LINE公式アカウントと採用管理システムを接続するMVPです。

## 現在実装済み
- LINE Messaging API webhook: `POST /api/line/webhook`
- X-Line-Signature検証
- LINE user IDと応募者の紐付け
- 会話履歴のSupabase保存
- 福祉 / 療術部門の簡易自動判定
- 求人マスタを根拠にしたAI回答
- 部門別RLS（welfare / therapy / admin）

## 必要な環境変数
Vercelに以下を設定してください。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`（任意）

**Channel Secret / Access TokenをGitHubやチャットへ貼らないでください。**

## Supabase
`supabase/schema.sql` をSupabase SQL Editorで実行してください。

### staff_profiles.department
- `welfare`: 福祉部門
- `therapy`: 療術部門
- `admin`: 本部・全体管理

## LINE Developers
Vercel公開後にWebhook URLを次の形式で設定します。

`https://<your-vercel-domain>/api/line/webhook`

その後「検証」を実行し、「Webhookの利用」をONにします。

## 初期テスト
LINEから次のような文章を送信します。

- 「訪問マッサージの求人について知りたい」→ therapy
- 「グループホームで働きたい」→ welfare
- 「求人について聞きたい」→ 部門選択を質問

本番前に求人マスタへ正確な給与・休日・資格要件を登録してください。
