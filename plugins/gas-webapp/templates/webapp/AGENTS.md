# {{APP_NAME}}

Google Apps Script（GAS）のWebアプリ。gas-webapp-kit の雛形から作成した。

## このアプリを使う人について

アプリを作っている本人は、パソコンの専門用語やコマンドを知らないことが多い。

- 専門用語を使わず、「次に何をすればいいか」が分かる言葉で話す（push →「Googleに送る」、deploy →「公開する」、/dev →「確認用の画面」、/exec →「みんなが使う画面」）
- 1回にお願いするのは1つだけ。コマンドを本人に打ってもらわない
- エラーの文章はそのまま見せず、「何が起きたか」と「次に何をするか」だけ伝える
- gas-webapp Plugin が入っていれば、その Skill（gas-setup、gas-new-app、gas-develop、gas-release、gas-troubleshoot）に従う

## よく使うコマンド

WindowsのPowerShellでは `npm` の代わりに `npm.cmd` を使う（実行ポリシーは変えない）。

| コマンド | すること |
| --- | --- |
| `npm test` | ロジックのテスト |
| `npm run preview` | パソコンの中の画面（http://localhost:8787/ 、`?selftest=1` で自己テスト） |
| `npm run push` | Googleに送る（確認用の画面だけに反映） |
| `npm run urls` | 確認用の画面・シート・エディタなどのURL |
| `npm run release` | 公開の確認ページを用意する（本人が確認ページで操作したときだけ公開される） |

## 守ること

- 公開（みんなが使う画面の更新）は必ず `npm run release` を通す。`clasp deploy` / `redeploy` / `create-deployment` / `update-deployment` を直接実行しない
- 公開の確認ページの入力とボタンは本人が操作する。AIは操作しない
- `src/appsscript.json` の `webapp`（誰が開けるか・誰の権限で動くか）は、本人が決めたときだけ変える
- パスワードを入力しない。Googleの許可の画面のボタンは本人が押す
- 画面に返す値に日付（Date）を入れない（本物のGASでは null が届く）
- 確認は3段階：`npm test` → プレビュー → `npm run push` 後に確認用の画面を `?selftest=1` で開き、URLの `#selftest=pass-...` を確かめる

## 構成

- `src/`：Googleに送るコード（`server/` がサーバー、`client/` が画面）
- `preview/`：パソコンの中で画面を確かめる仕組み
- `test/`：ロジックのテスト
- `scripts/`：Googleとのやりとり（作成、送信、URL、公開）
- `.clasp.json`：送り先のGAS（`npm run create` が作る）
- `release.config.json`：アプリ名と、みんなが使う画面の公開ID
- `.gas-kit/`：進み具合と記録
