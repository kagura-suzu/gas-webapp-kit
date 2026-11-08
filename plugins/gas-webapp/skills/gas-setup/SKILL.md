---
name: gas-setup
description: GAS（Google Apps Script）のWebアプリ作りの準備と環境チェック。土台ソフト（Node.js）、パソコンとGoogleをつなぐ道具（clasp）、Googleへのログインと許可、Apps Script APIのスイッチを順に確かめ、足りないものを入れ、本人の操作が要るところはアプリ内ブラウザで1つずつ案内する。「GASでアプリを作りたい」と言われた最初の1回、準備やGoogleとの接続でうまくいかないときに使う。Use for first-time setup and environment checks of Node.js, clasp and Google login for Google Apps Script web apps.
---

# GASアプリ作りの準備

相手はパソコンの専門用語を知らない人だと考えて進める。最初に次の2つを読み、この会話の間ずっと守る。

- [references/plain-language.md](references/plain-language.md)：やさしい言葉の決まり
- [references/boundaries.md](references/boundaries.md)：AIに任せる範囲

## 場所の呼び方

- `<kit>`：このSkillのフォルダから2つ上のフォルダ（Pluginのフォルダ）。`<kit>/scripts/` と `<kit>/steps/` がある
- `<app>`：アプリのフォルダ（`gas-new-app` で作る）
- WindowsのPowerShellでは `npm` の代わりに `npm.cmd` を使う（実行ポリシーで `npm.ps1` が止められることがあるため。実行ポリシーは変えない）

## 進め方

1. 前回の続きか確かめる。`<app>/.gas-kit/progress.json` があれば読み、「前回の続きから始めます」と伝えて、終わっていない段階から再開する。
2. 土台ソフトを確かめる。`node -v` を実行する。
   - 見つからない、または v20 より古い：`<kit>/steps/01-install-node.md` の手順で、承認を得てから入れる。
3. 環境チェックを実行する。
   - アプリのフォルダがまだない：`node "<kit>/scripts/doctor.mjs"`
   - アプリのフォルダがある：`node "<kit>/scripts/doctor.mjs" --app "<app>" --fix --online`
   - 結果はJSON。`checks` の各項目と、次にやること `next` が入っている。`next.step` があれば、その場面の台本 `<kit>/steps/<step>.md` を読んで案内する。
4. アプリ内ブラウザを用意する。Googleの画面を開く前に、`<kit>/steps/00-show-browser.md` で表示してもらう。
5. アプリのフォルダがまだなければ、`gas-new-app` に進む。ログインと許可（場面2・3）は、アプリのフォルダを作って道具を準備したあとに行う。
6. すべての項目が `ok` になったら、短く伝えて次の段階へ進む。

## 本人の操作が要る場面

どれも、AIがアプリ内ブラウザでその画面を開いてから1つずつ案内する。終わったら「できました」と送ってもらい、AIが画面と結果を見て確かめてから次へ進む。台本は `<kit>/steps/` にある。

| 場面 | 台本 |
| --- | --- |
| アプリ内ブラウザを表示する | 00-show-browser.md |
| 土台ソフト（Node.js）を入れる | 01-install-node.md |
| Googleにログインする | 02-google-login.md |
| 道具（clasp）に許可を出す | 03-clasp-allow.md |
| Apps Script API のスイッチを入れる | 04-apps-script-api.md |
| 会社の管理者の許可が要るとき | 09-admin-approval.md |

Googleの画面は変わることがある。台本の「探すもの」を手がかりに、実際の画面をスクリーンショットで確かめてから案内する。

## 迷ったとき

- Googleの仕様は、同梱の Google Workspace Developer のドキュメント検索（MCP）で確かめてから答える。
- エラーが出たら `gas-troubleshoot` を使う。
