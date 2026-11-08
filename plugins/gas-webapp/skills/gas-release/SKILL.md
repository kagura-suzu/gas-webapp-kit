---
name: gas-release
description: GAS（Google Apps Script）Webアプリを、確認用の画面で確かめてから、みんなが使う画面として公開・更新する。誰が使えるかを本人に決めてもらい、公開の確認ページで本人がアプリ名を入力して「公開する」を押したときだけ反映する。「公開したい」「みんなが使えるようにして」「使っている画面を新しくして」と言われたときに使う。Use when publishing or updating the production web app deployment of a Google Apps Script project made with this kit.
---

# みんなが使う画面に公開する

最初に [references/plain-language.md](references/plain-language.md) と [references/boundaries.md](references/boundaries.md) を読む。`<kit>` はこのSkillのフォルダから2つ上のフォルダ。WindowsのPowerShellでは `npm` の代わりに `npm.cmd` を使う。

みんなが使う画面の更新は、本人が確認ページで操作したときだけ行われる。AIは `clasp deploy` などで直接公開しない。確認ページの入力とボタンを操作しない。

## 流れ（相手には「全4つのうち○つ目」と伝える）

1. 確認用の画面で最終確認する
   - `npm test` が通ること
   - `npm run push` のあと、`<devUrl>?selftest=1` で `#selftest=pass-...` になること
   - 相手にも確認用の画面を触ってもらい、「これで公開してよいですか？」と聞く
2. 誰が使えるかを決める（初めての公開、または相手が変えたいとき）
   - `<kit>/steps/07-who-can-use.md` の選択肢で決めてもらう
   - 決まった内容を `src/appsscript.json` の `webapp` に書き、`npm run push`
3. 公開の確認ページを開く
   - `npm run release` を実行する。テストとGoogleへの送信をしてから、確認ページを準備して終わる
   - 結果の `confirmUrl` をアプリ内ブラウザで開き、`<kit>/steps/08-release-confirm.md` で案内する
4. 結果を確かめる
   - 相手から「できました」が届いたら `npm run release -- --status`
   - `released`：`execUrl` を開いて表示を確かめ、相手にURLを伝える
   - `cancelled`：やめたことを受け止め、直したいところがあるか聞く
   - `waiting`：まだ操作されていない。急かさない
   - `expired` / `failed`：`message` を元に説明し、必要ならもう一度 `npm run release`

## 公開したあと

- 公開するたびに同じURLのまま中身が新しくなる（URLは変わらない）。
- 前の状態に戻したいと言われたら、直したコードで同じ流れをもう一度行う。元のコードに戻すときは、どの時点に戻すかを相手と確かめる。
