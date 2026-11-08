---
name: gas-new-app
description: 雛形から新しいGAS（Google Apps Script）のWebアプリを作る。アプリのフォルダを用意し、Googleへのログインと許可を案内し、データを入れるスプレッドシートを新しく作るか今あるシートに紐づけ、確認用の画面で動くところまで進める。「GASでアプリを作りたい」「新しいアプリを作って」「このスプレッドシートを使うアプリを作って」と言われたときに使う。Use when creating a new Google Apps Script web app bound to a new or existing Google Sheet.
---

# 新しいアプリを作る

最初に [references/plain-language.md](references/plain-language.md) と [references/boundaries.md](references/boundaries.md) を読み、この会話の間ずっと守る。`<kit>` はこのSkillのフォルダから2つ上のフォルダ。WindowsのPowerShellでは `npm` の代わりに `npm.cmd` を使う。

## 全体の流れ（相手には「全6つのうち○つ目」と伝える）

1. どんなアプリかを聞く
2. アプリのフォルダを用意する
3. Googleにログインして、道具に許可を出す
4. スプレッドシートを用意して、Googleにアプリを作る
5. パソコンの中の画面で動きを確かめる
6. 確認用の画面で動きを確かめる

各段階が終わるたびに `<app>/.gas-kit/progress.json` の `steps` を更新する（`"done"` と日時）。

## 1. どんなアプリかを聞く

- アプリの名前と、何に使うかを1〜2文で聞く。決まっていなければ例を出す（「日報を記録するアプリ」など）。
- 誰が使うか（自分だけ、社内の人、社外の人）もこの段階で軽く聞いておく。決めるのは公開のとき（場面7）。

## 2. アプリのフォルダを用意する

```
node "<kit>/scripts/new-app.mjs" --name "<アプリ名>"
```

- 置き場所は既定で「ドキュメント／GASアプリ／<アプリ名>」。相手から指定があれば `--dir "<フォルダ>"` を付ける。
- 雛形のコピーと道具の準備（`npm install`）まで自動で行う。結果のJSONの `appDir` を `<app>` として以後使う。
- 作業する場所を `<app>` に移せる場合は移す（相手に確認が出る場合は「アプリのフォルダで作業します」と伝える）。

## 3. Googleにログインして、道具に許可を出す

1. `node "<kit>/scripts/clasp-login.mjs" --app "<app>" --status` で、すでに許可済みか確かめる。`loggedIn: true` なら、表示されたアカウントで作ってよいかだけ確かめて次へ。
2. まだなら、`<kit>/steps/02-google-login.md` → `<kit>/steps/03-clasp-allow.md` の順に案内する。

## 4. スプレッドシートを用意して、Googleにアプリを作る

1. `<kit>/steps/05-choose-sheet.md` で、新しく作るか今あるシートを使うかを決めてもらう。
2. `<app>` で実行する。
   - 新しく作る：`npm run create -- --title "<アプリ名>"`
   - 今あるシート：`npm run create -- --title "<アプリ名>" --sheet "<シートのURL>"`
3. 結果が `api-disabled` なら `<kit>/steps/04-apps-script-api.md` でスイッチを入れてもらい、1〜2分待ってから再実行する。ほかのエラーは `gas-troubleshoot` へ。
4. 成功したら `sheetUrl` を開いて、相手にシートを見せる。

## 5. パソコンの中の画面で動きを確かめる

- `npm test` でロジックのテストを実行する。
- 画面のプレビューを起動して、アプリ内ブラウザで開く。
  - Claude：`<app>/.claude/launch.json` の `preview` を起動する
  - そのほか：`npm run preview` をバックグラウンドで起動し、http://localhost:8787/ を開く
- 一覧の表示、入力、ボタン、入力ミスの表示、スマートフォン幅を確かめる。`?selftest=1` を付けると自己テストも動く。

## 6. 確認用の画面で動きを確かめる

1. `npm run push` でGoogleに送る。
2. `npm run urls` で `devUrl` を取得し、`<devUrl>?selftest=1` をアプリ内ブラウザで開く。
3. 初めてなら許可の画面が出る。`<kit>/steps/06-first-run-permission.md` で案内する。
4. アドレスバーのURLの最後が `#selftest=pass-<成功数>-0` になれば完了。`fail-...` なら画面の結果を読んで直し、2からやり直す。

完了したら、できたこと（スプレッドシートと確認用の画面）を短く伝え、次は画面や機能を相手の希望に合わせて作っていくこと（`gas-develop`）を伝える。

## 今あるGAS（Webエディタで作ったもの）を取り込む場合

この版ではまだ対応していない。相手には「今あるGASの取り込みは、まだこのキットでは対応していません」と伝え、新しく作る方法をすすめる。
