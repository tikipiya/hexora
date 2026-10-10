# Hexora

ブラウザ内バイナリ解析（PE / ELF）— Cloudflare Pages + Pages Functions。

## 機能

- **Structure** — PE / ELF ヘッダーとセクション表
- **Hex** — 16 バイト行、オフセット / hex / ASCII 検索
- **Strings** — ASCII / UTF-16LE 抽出
- **Entropy** — 256 バイトチャンクのヒートマップ
- **Hashes** — 読み込みと同時に **インクリメンタル**（CRC32 / MD5 / SHA-*、`@noble/hashes`）
- **ファイル読み込み** — ストリーム読み込み・読み込み中ハッシュ・進捗・キャンセル
- **Hex** — 仮想スクロール・Inspector（整数/浮動小数/ポインタ追跡）・構造体配列ビュー
- **Strings** — 1 MiB 超は **Web Worker**、進捗付きスキャン、マルチエンコーディング
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
