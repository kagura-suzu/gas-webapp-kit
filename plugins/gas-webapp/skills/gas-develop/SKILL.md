---
name: gas-develop
description: このキットの雛形で作ったGAS（Google Apps Script）Webアプリの画面と処理を作る・直すときの決まり。HtmlServiceの画面、google.script.runでのサーバー呼び出し、スプレッドシートの読み書き、権限、6分の実行制限、テストとローカルの画面確認の進め方をまとめる。アプリの画面や機能を追加・修正するとき、相手の要望をコードにするときに使う。Use while building or changing screens and server functions of a Google Apps Script web app made from this kit.
---

# 画面と処理の作り方

最初に [references/plain-language.md](references/plain-language.md) と [references/boundaries.md](references/boundaries.md) を読む。相手への説明はやさしい言葉で、コードの中のコメントは日本語で短く書く。

## アプリのフォルダの構成

| 場所 | 中身 |
| --- | --- |
| `src/appsscript.json` | 時間帯、公開範囲（webapp.access）、実行ユーザー（webapp.executeAs） |
| `src/server/config.js` | アプリ名、シートのID、シート名、見出し |
| `src/server/main.js` | `doGet`、`include` |
| `src/server/*.js` | 画面から呼ぶ処理。名前が `_` で終わる関数は画面から呼べない（内部用） |
| `src/server/selftest.js` | 確認用の画面の自己テスト（`?selftest=1`、`?api=selftest`） |
| `src/client/index.html` | 画面。`<?!= include('client/css'); ?>` で部品を読み込む |
| `src/client/js.html` | 画面の動き。`call('関数名', 引数)` でサーバーを呼ぶ |
| `preview/` | パソコンの中で画面を確かめる仕組み（Googleの機能の一部を再現） |
| `test/` | ロジックのテスト（Vitest） |

`src/` の中身だけがGoogleに送られる。GASではnpmのパッケージを使えない。

## 作るときの決まり

- 要望を聞いたら、先に「何を表示して、何を保存するか」を1〜3行で確かめてから作る。
- サーバーの関数は `src/server/` に、画面の動きは `src/client/js.html` に書く。
- 画面からの呼び出しは `call()`（Promiseにしたgoogle.script.run）を使い、失敗したときの表示を必ず作る。
- 画面に返す値に日付（Date）を入れない。本物のGASでは画面に `null` が届く。文字列にしてから返す。プレビューでも警告が出る。
- スプレッドシートは `getValues()` / `setValues()` でまとめて読み書きする。1セルずつのループは遅い。
- 書き込みは `LockService.getScriptLock()` で同時実行を防ぐ。
- 1回の処理は6分まで。大量のデータは分けて処理する。
- 画面に文字を出すときは `textContent` を使う（`innerHTML` に入力値を入れない）。
- 新しい列を足すときは `CONFIG.HEADERS` と、読み書きする処理と、自己テストの見出しの確認をそろえて直す。
- Gmailの送信など、新しい種類の機能を使うと、初めて動かすときと同じ許可の画面がもう一度出る。相手に先に伝える。
- GASの関数やクラスの使い方に迷ったら、同梱の Google Workspace Developer のドキュメント検索（MCP）で確かめてから書く。
- `src/appsscript.json` の `webapp`（誰が開けるか・誰の権限で動くか）は、相手が決めたとき（場面7）だけ変える。

## 確かめ方（3段階）

1. ロジック：`npm test`。処理を足したら `test/` にテストも足す。テストは `preview/gas-runtime.mjs` でGASの関数を読み込んで呼ぶ。
2. 画面：プレビューをアプリ内ブラウザで開き、表示・入力・ボタン・入力ミスの表示・読み込み中・失敗したとき・スマートフォン幅を確かめる。プレビューのデータは `preview/sample-data.json`。再起動すると元に戻る。
3. 実環境：`npm run push` → `npm run urls` の `devUrl` に `?selftest=1` を付けて開き、アドレスバーの `#selftest=pass-...` を確かめる。本物のGASの画面は中身を文字として読めないため、結果はURLとスクリーンショットで確かめる。サーバーだけの確認は `<devUrl>?api=selftest`（JSONが文字で読める）。
   - 結果が出るまで20秒ほどかかることがある。30秒までは待ってから判断する
   - 本物の画面の中の操作は、アプリ内ブラウザが表示されているときだけマウスのクリックが届く。非表示のときはクリックが「could not be attributed to a frame」で止まり、画面も実際と違う大きさで描かれる。表示してもらうか、キーボード（Tab で移動、Enter で押す、文字の入力）で操作する

新しい機能を足したら、`src/server/selftest.js` と `src/client/js.html` の自己テストにも確認を1つ足す（データを書き換えない確認にする）。

## 相手への報告

作ったら、何ができるようになったかを1〜2文で伝え、確認用の画面で触ってもらう。みんなが使う画面に出すのは `gas-release` で、相手の確認を経てから。
