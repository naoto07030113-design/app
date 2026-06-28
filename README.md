# 月間予定表アップロード編集システム

管理者が月間予定表の JPG / PNG / PDF をアップロードし、左側に「備考列」と「犬の足跡マーク列」を追加して編集できる React + TypeScript + Tailwind CSS アプリです。

## ローカル起動

```bash
npm install
npm run dev
```

## Netlify デプロイ

このリポジトリは Netlify の Git 連携でそのままデプロイできます。

- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: `20`

設定は `netlify.toml` に含めています。SPA のリロード対策として `public/_redirects` も配置しています。

## ダウンロード機能

- `画像出力`: 編集画面全体を SVG ファイルとして保存します。
- `元ファイルDL`: アップロード済みの JPG / PNG / PDF を再ダウンロードします。
- `編集データDL`: 備考・足跡マーク・アップロード情報を JSON ファイルとしてバックアップします。
- `PDF出力`: ブラウザの印刷画面を開き、PDF として保存できます。

## データ保存

現時点ではブラウザの `localStorage` に月ごとに保存します。将来的に Supabase へ差し替えやすいよう、月単位のデータ構造で管理しています。
