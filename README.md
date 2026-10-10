# Hexora

ブラウザ内バイナリ解析（PE / ELF / Mach-O / **WebAssembly**）— Cloudflare Pages + Pages Functions。

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
- **Disasm** — **Capstone WASM**（x86 / x64 / **ARM64** / **Wasm bytecode**）、セクション／関数ボディ選択；`.wasm` は **wabt** で WAT 表示
- **Xref** — import/export/reloc/symbol と Disasm 上の call/jump 参照（Hex Inspector）
- **CFG** — Disasm スライスから基本ブロックグラフ（SVG・Hex ジャンプ）
- **マルチファイル** — タブで複数バイナリを同時に開く、Diff で開いているファイル同士を比較
- **ワークスペース** — IndexedDB 保存・JSON エクスポート/インポート（バイト + UI 状態・メモ）
- **Structure** — PE リソース・リロック、ELF dynamic/rel、Mach-O セグメント
- **Transform** — XOR、Encoding、Compression（gzip/zlib/zip/**bzip2**/**zstd**/**xz** 展開）、カービング — 512 KiB 超は Worker
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
