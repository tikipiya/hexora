# Hexora

ブラウザ内バイナリ解析（PE / ELF / Mach-O）— Cloudflare Pages + Pages Functions。

## 機能

- **共有パーサー (`@hexora/shared`)** — `BinaryReader`、ELF（Phdr/Shdr/sym/dynamic/rel）、PE（Data Directory、Import/Export）、厳密/寛容モード
- **アドレス変換** — ELF は PT_LOAD 基準（BSS 識別）、PE は RVA/VA/File（未初期化セクション識別）
- **Workers API** — `POST /api/analyze/{elf,pe}`、`POST /api/address/{elf,pe}`（base64、最大 4 MiB 既定）
- **Structure** — PE / ELF ヘッダーとセクション表
- **Hex** — 16 バイト行、オフセット / hex / ASCII 検索
- **Strings** — ASCII / UTF-16LE / UTF-8 抽出（`strings.ts` オプション）
- **Entropy** — 256 バイトチャンクのヒートマップ
- **Hashes** — 読み込みと同時に **インクリメンタル**（CRC32 / MD5 / SHA-*、`@noble/hashes`）
- **ファイル読み込み** — ストリーム読み込み・読み込み中ハッシュ・進捗・キャンセル
- **Hex** — 仮想スクロール・Inspector（整数/浮動小数/ポインタ追跡）・構造体配列ビュー
- **Strings** — 1 MiB 超は **Web Worker**、進捗付きスキャン、マルチエンコーディング
- **Disasm** — x86/x64、セクション／オフセット選択（4 KiB 以下はブラウザ、それ以上は `POST /api/disasm`）
- **Structure** — PE リソース・リロック、ELF dynamic/rel、Mach-O セグメント
- **Transform** — XOR（1-byte / 繰り返しキー候補）、Encoding（base64/hex/rot13 等）、Compression 署名検出 + gzip/zlib/deflate 展開、ファイルカービング（PNG/JPEG/PDF/ZIP/ELF/MZ 等）— 512 KiB 超は Worker
- **Workers API** — 上記に加え `POST /api/transform/scan`（ヒューリスティックスキャン、base64・最大 4 MiB 既定）
- **Diff** — 2 ファイルのバイト比較、差分ジャンプ
- **共有 URL** — `#tab=hex&off=0x1000` ハッシュと「リンクをコピー」

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
