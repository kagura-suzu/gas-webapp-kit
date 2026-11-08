# 変更履歴

## 0.1.0（試作）

- Claude Code と Codex の両方に配れる Plugin の形を作成
- 5つのSkill（gas-setup、gas-new-app、gas-develop、gas-release、gas-troubleshoot）
- 本人の操作が要る10の場面の案内台本（steps/）
- 環境チェック（doctor）、アプリのフォルダ作成（new-app）、clasp の許可の案内（clasp-login）
- 雛形：記録アプリの見本、GASを再現するプレビューとテスト、自己テスト（?selftest=1 / ?api=selftest）、公開の確認ページ
- 雛形で固定する版：@google/clasp 3.4.1、vitest 4.1.12（どちらも Node.js 20 以上で動く）
- ライセンス：MIT
- 本物のGASでの確認（2026-11-08）を受けて直したこと
  - 新しく作るシートの時間帯をアプリ（日本）に合わせる。自己テストに「シートの時間帯がアプリと同じ」を追加
  - 会社のGoogleの設定で許可が切れたときに「許可済み」と答えていたのを直す（clasp-login の --status）
  - 案内台本：ブラウザが見えているかの確認、英語で出る許可の画面、許可し直し、既存シートの時間帯
