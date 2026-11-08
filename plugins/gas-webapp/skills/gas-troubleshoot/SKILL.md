---
name: gas-troubleshoot
description: GAS（Google Apps Script）Webアプリ作りで、うまくいかないときの原因の見分け方と、やさしい説明・次にやること。ログインや許可の期限切れ、Apps Script APIのスイッチ、会社の管理者の制限、シートの権限、通信、許可の画面、画面に何も出ない、日付がnullになる、などを扱う。キットのスクリプトやclaspが失敗したとき、相手が「動かない」「エラーが出た」と言ったときに使う。Use when anything in the Google Apps Script web app workflow fails or the user says it does not work.
---

# うまくいかないとき

最初に [references/plain-language.md](references/plain-language.md) と [references/boundaries.md](references/boundaries.md) を読む。`<kit>` はこのSkillのフォルダから2つ上のフォルダ。

## 基本の進め方

1. 相手には「うまくいかなかったので、原因を調べます。少しお待ちください」とだけ伝える。エラーの文章はそのまま見せない。
2. キットのスクリプトの結果はJSON。`error.id` と `error.step` を見る。
3. 全体の状態は `node "<kit>/scripts/doctor.mjs" --app "<app>" --online` で確かめる。
4. 原因が分かったら「何が起きたか」と「次に何をするか」を1〜2文で伝えて直す。
5. 同じ方法で2回直らなければ、別の方法を考える。3回目も同じなら、状況を短くまとめて相手に伝え、どうするか選んでもらう。

## よくある原因

| error.id | 何が起きたか（相手への説明） | 次にやること |
| --- | --- | --- |
| `not-logged-in` | パソコンとGoogleをつなぐ道具の許可が切れています | `<kit>/steps/03-clasp-allow.md` |
| `api-disabled` | パソコンから操作するためのスイッチがまだ入っていません | `<kit>/steps/04-apps-script-api.md`。オンにしたあと1〜2分待って再実行 |
| `admin-blocked` | 会社のGoogleの設定で止められています | `<kit>/steps/09-admin-approval.md` |
| `no-permission` | そのファイルを編集する権限がないようです | アカウントを確かめる。シートなら `<kit>/steps/05-choose-sheet.md` |
| `network` | インターネットにつながっていないようです | 接続を確かめてもらい、少し待って再実行 |
| `not-created` | このフォルダはまだGoogleとつながっていません | `gas-new-app` の4へ |
| `syntax` | プログラムに書き間違いがあります（AIが直します） | 該当ファイルを直して `npm test` |
| `unknown` | うまくいきませんでした | 記録（`detail`）を読んで原因を調べる |

## 画面での症状

| 症状 | よくある原因 | 直し方 |
| --- | --- | --- |
| 画面が真っ白 | `src/client/*.html` の書き間違い、`include` の名前違い | プレビューで開いてコンソールを読む |
| 一覧が出ない・`null` が届く | サーバーから日付（Date）を返している | 文字列にして返す（プレビューでも警告が出る） |
| 「Script function not found」 | 関数名の打ち間違い、名前が `_` で終わる関数を画面から呼んでいる | 関数名を直す |
| 許可の画面が何度も出る | 別のアカウントで開いている | アプリ内ブラウザのアカウントを確かめる |
| 「このアプリはブロックされています」 | 会社の管理者の設定 | `<kit>/steps/09-admin-approval.md` |
| 自己テストが `not-allowed` | 作った人以外のアカウントで開いている、または `SELFTEST_ENABLED` が false | 作った人のアカウントで開く |
| 確認用の画面は新しいのに、みんなが使う画面が古い | 公開（`gas-release`）をしていない | `gas-release` へ |
| Windowsで「スクリプトの実行が無効」 | PowerShellの実行ポリシー | `npm.cmd` / `node` で実行する。実行ポリシーは変えない |

## 調べるときの道具

- 本物のGASの画面は別ドメインのiframeの中にあり、中身を文字として読めない。URLの `#selftest=...`、スクリーンショット、`<devUrl>?api=selftest` のJSONで確かめる。
- 画面の不具合は、プレビュー（http://localhost:8787/）で再現させるとコンソールとページの文字を読める。
- Googleの仕様は、同梱の Google Workspace Developer のドキュメント検索（MCP）で確かめる。
