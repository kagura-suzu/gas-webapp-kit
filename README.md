# GAS Webアプリ開発キット（試作）

Googleのスプレッドシートとつながる業務用のWebアプリ（Google Apps Script）を、AIと話しながら作り、確かめ、公開まで進めるためのキットです。Claude Code と Codex の両方で使えます。

> 状態：試作（0.1.0）。社外への配布前に、設計書の「試作で確かめること」を終える予定です。

## 使い方（アプリを作る方へ）

### 1. キットを入れる（最初の1回だけ）

Claude（デスクトップアプリ、Claude Code）：

```
/plugin marketplace add kagura-suzu/gas-webapp-kit
/plugin install gas-webapp@gas-webapp-kit
```

Codex：

```
codex plugin marketplace add kagura-suzu/gas-webapp-kit
```

そのあと Codex の `/plugins` から「GAS Webアプリ開発キット」を入れます。

### 2. 話しかける

「GASでWebアプリを作りたい」と送ってください。あとはAIが1つずつ案内します。Googleへのログインや許可など、ご本人の操作が要るところは、アプリ内ブラウザで画面を開いてから説明します。

## 中身（開発する方へ）

```
gas-webapp-kit/
├─ .claude-plugin/marketplace.json     Claude Code用（Codexも互換で読む）
├─ .agents/plugins/marketplace.json    Codex用
├─ plugins/gas-webapp/
│  ├─ .claude-plugin/plugin.json       2つのマニフェストは版をそろえる
│  ├─ .codex-plugin/plugin.json
│  ├─ .mcp.json                        Google Workspace Developer のドキュメント検索
│  ├─ skills/                          gas-setup / gas-new-app / gas-develop / gas-release / gas-troubleshoot
│  ├─ shared/                          話し方の決まり・AIに任せる範囲（正本。各Skillの references/ にコピー）
│  ├─ steps/                           本人の操作が要る10の場面の案内台本
│  ├─ scripts/                         doctor（環境チェック）、new-app（フォルダ作成）、clasp-login（許可の案内）
│  └─ templates/webapp/                アプリの雛形
└─ tools/                              キット開発用（同期・形の確認・雛形の通し確認）
```

### 雛形の主なコマンド

| コマンド | すること |
| --- | --- |
| `npm test` | ロジックのテスト（Vitest。`preview/gas-runtime.mjs` でGASのコードを読み込む） |
| `npm run preview` | パソコンの中の画面（http://localhost:8787/ 、`?selftest=1` で自己テスト） |
| `npm run create -- --title "名前" [--sheet URL]` | Googleにアプリを作り、スプレッドシートを新しく作るか今あるものに紐づける |
| `npm run push` | Googleに送る（確認用の画面だけに反映） |
| `npm run urls` | 確認用の画面・シート・エディタのURL |
| `npm run release` | 公開の確認ページを用意する。本人がアプリ名を入力して「公開する」を押したときだけ公開される |

### キットの開発

```
node tools/sync-shared.mjs      # shared/ を各Skillへコピー
node tools/check.mjs            # マニフェストの版・Skillの書式・台本の参照を確認
node tools/test-template.mjs    # 一時フォルダに雛形からアプリを作ってテスト（Googleには接続しない）
```

自分の clasp のログインを汚さずに試すときは、環境変数 `GAS_KIT_CLASP_USER` に名前を入れると、clasp の `--user` で別の許可として保存されます。

## まだ確かめていないこと

設計書の「試作で確かめること」のうち、次の3つが残っています。Claudeのアプリ内ブラウザでのログイン・claspの許可・本物のGAS画面の操作・公開は、2026-11-08 に確認しました。

- Codexのアプリ内ブラウザでの通し確認
- 管理者の承認が要る会社のアカウントでの確認
- ITに慣れていない方による通し確認

## ライセンス

[MIT License](LICENSE)。© 2026 株式会社神楽鈴
