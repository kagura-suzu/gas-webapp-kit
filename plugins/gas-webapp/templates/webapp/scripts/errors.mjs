// claspやGoogleのエラーの文章から、原因と次にやることを見分ける。
// 相手への説明（message）はやさしい言葉で書く。step は gas-webapp Plugin の steps/ の台本。

const RULES = [
  {
    id: 'api-disabled',
    test: /has not enabled the Apps Script API|Apps Script API has not been used|script\.google\.com\/home\/usersettings/i,
    step: '04-apps-script-api',
    message: 'パソコンから操作するためのスイッチがまだ入っていません。',
  },
  {
    id: 'admin-blocked',
    test: /admin_policy_enforced|blocked by (your|the) administrator|disabled by (your|the) (domain )?administrator|org_internal|access_not_configured/i,
    step: '09-admin-approval',
    message: '会社のGoogleの設定で止められています。',
  },
  {
    id: 'not-logged-in',
    test: /No credentials found|NO_CREDENTIALS|invalid_grant|Not logged in|unauthorized_client|Login Required|UNAUTHENTICATED|invalid_rapt|Request had invalid authentication credentials/i,
    step: '03-clasp-allow',
    message: 'パソコンとGoogleをつなぐ道具の許可が切れています。',
  },
  {
    id: 'no-permission',
    test: /PERMISSION_DENIED|caller does not have permission|Insufficient Permission|insufficientPermissions|Requested entity was not found|File not found/i,
    step: '05-choose-sheet',
    message: 'そのファイルを編集する権限がないか、ファイルが見つからないようです。',
  },
  {
    id: 'network',
    test: /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|getaddrinfo|socket hang up/i,
    step: null,
    message: 'インターネットにつながっていないようです。',
  },
  {
    id: 'not-created',
    test: /Project settings not found|Project file .*not found|\.clasp\.json.*not found|No script ID|Could not find script/i,
    step: null,
    message: 'このフォルダはまだGoogleとつながっていません。',
  },
  {
    id: 'syntax',
    test: /Syntax error|SyntaxError|Unexpected token/i,
    step: null,
    message: 'プログラムに書き間違いがあります。AIが直します。',
  },
];

function tail(text, max = 1200) {
  const t = String(text || '').trim();
  return t.length > max ? `…${t.slice(-max)}` : t;
}

/** エラーの文章から { id, step, message, detail } を返す */
export function explainError(text) {
  const t = String(text || '');
  for (const rule of RULES) {
    if (rule.test.test(t)) return { id: rule.id, step: rule.step, message: rule.message, detail: tail(t) };
  }
  return { id: 'unknown', step: null, message: 'うまくいきませんでした。AIが原因を調べます。', detail: tail(t) };
}
