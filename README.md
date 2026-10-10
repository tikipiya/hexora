# Hexora

ブラウザ内バイナリ解析（PE / ELF）— Cloudflare Pages + Pages Functions。

## 機能

- **Structure** — PE / ELF ヘッダーとセクション表
- **Hex** — 16 バイト行、オフセット / hex / ASCII 検索
- **Strings** — ASCII / UTF-16LE 抽出
- **Entropy** — 256 バイトチャンクのヒートマップ
- **Hashes** — CRC32 / MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512（コピー・進捗表示）
- **ファイル読み込み** — ストリーム読み込み・進捗・キャンセル・256 MiB 上限
- **Hex** — 仮想スクロール・検索（hex / regex / ジャンプ）・範囲コピー・セクション境界
- **Strings** — ASCII / Latin-1 / UTF-8 / UTF-16、タグ付け・フィルタ・エクスポート
- **Disasm** — x86/x64（4 KiB 以下はブラウザ、それ以上は `POST /api/disasm`）

## 開発

```bash
npm install
npm run dev
```

API（ディスアセンブリ）をローカルで試す場合:

```bash
npm run build
npm run preview
```

Vite の dev サーバーは `/api` を `8788` にプロキシします（`preview` 起動時）。

## デプロイ

```bash
npm run deploy
```

Cloudflare ダッシュボードで Pages プロジェクトを作成し、`wrangler pages deploy` または Git 連携を使用してください。

## デザイン

UI は `DESIGN.md`（AuthKit スタイルリファレンス）のトークンに基づき、Inter / Space Grotesk / JetBrains Mono で代替フォントを使用しています。
