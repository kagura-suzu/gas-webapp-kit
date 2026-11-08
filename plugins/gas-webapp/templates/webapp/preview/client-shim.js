// プレビュー用の google.script（本物のGASの画面で使える仕組み）の代わり。
// google.script.run の呼び出しは、プレビューのサーバーのGAS再現環境に送る。
(function () {
  'use strict';
  var LATENCY_MS = 150;

  function formToObject(form) {
    var obj = {};
    new FormData(form).forEach(function (value, key) {
      if (typeof value !== 'string') return; // ファイルはプレビューでは扱わない
      if (key in obj) obj[key] = [].concat(obj[key], value);
      else obj[key] = value;
    });
    return obj;
  }

  function findIllegal(value, seen) {
    if (value instanceof Date) return 'Date';
    if (typeof value === 'function') return 'Function';
    if (value && typeof value === 'object') {
      seen = seen || [];
      if (seen.indexOf(value) !== -1) return null;
      seen.push(value);
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i++) {
        var found = findIllegal(value[keys[i]], seen);
        if (found) return found;
      }
    }
    return null;
  }

  function makeRunner(config) {
    var base = {
      withSuccessHandler: function (fn) { return makeRunner(Object.assign({}, config, { success: fn })); },
      withFailureHandler: function (fn) { return makeRunner(Object.assign({}, config, { failure: fn })); },
      withUserObject: function (obj) { return makeRunner(Object.assign({}, config, { userObject: obj })); },
    };
    return new Proxy(base, {
      get: function (target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop !== 'string') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments).map(function (a) {
            return typeof HTMLFormElement !== 'undefined' && a instanceof HTMLFormElement ? formToObject(a) : a;
          });
          function fail(err) {
            setTimeout(function () {
              if (config.failure) config.failure(err, config.userObject);
              else console.error('google.script.run の失敗（withFailureHandler がありません）:', err);
            }, LATENCY_MS);
          }
          for (var i = 0; i < args.length; i++) {
            var illegal = findIllegal(args[i]);
            if (illegal) {
              console.warn('【プレビューの注意】' + prop + ' に ' + illegal + ' を渡しています。本物のGASでは失敗します。');
              fail(new Error('Failed due to illegal value in property: ' + i));
              return;
            }
          }
          fetch('/__gas/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fn: prop, args: args }),
          })
            .then(function (r) { return r.json(); })
            .then(function (res) {
              (res.warnings || []).forEach(function (w) { console.warn('【プレビューの注意】' + w); });
              if (res.ok) {
                setTimeout(function () {
                  if (config.success) config.success(res.value, config.userObject);
                }, LATENCY_MS);
              } else {
                var err = new Error(res.error.message);
                err.name = res.error.name || 'Error';
                fail(err);
              }
            })
            .catch(function (err) {
              fail(new Error('プレビューのサーバーにつながりません: ' + err.message));
            });
        };
      },
    });
  }

  function currentLocation() {
    var parameter = {};
    var parameters = {};
    new URLSearchParams(location.search).forEach(function (value, key) {
      (parameters[key] = parameters[key] || []).push(value);
      if (!(key in parameter)) parameter[key] = value;
    });
    return { hash: location.hash.replace(/^#/, ''), parameter: parameter, parameters: parameters };
  }

  function buildUrl(params, hash) {
    var query = location.search;
    if (params) {
      var sp = new URLSearchParams();
      Object.keys(params).forEach(function (k) {
        [].concat(params[k]).forEach(function (v) { sp.append(k, v); });
      });
      var q = sp.toString();
      query = q ? '?' + q : '';
    }
    return location.pathname + query + (hash ? '#' + hash : '');
  }

  window.google = {
    script: {
      run: makeRunner({}),
      url: {
        getLocation: function (callback) { setTimeout(function () { callback(currentLocation()); }, 0); },
      },
      history: {
        push: function (state, params, hash) { history.pushState(state, '', buildUrl(params, hash)); },
        replace: function (state, params, hash) { history.replaceState(state, '', buildUrl(params, hash)); },
        setChangeHandler: function (fn) {
          window.addEventListener('popstate', function (e) { fn({ state: e.state, location: currentLocation() }); });
        },
      },
      host: {
        origin: location.origin,
        close: function () {},
        setHeight: function () {},
        setWidth: function () {},
        editor: { focus: function () {} },
      },
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    var badge = document.createElement('div');
    badge.id = '__gas-preview-badge';
    badge.textContent = 'プレビュー（パソコンの中だけ）';
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;background:#59636e;color:#fff;' +
      'font:12px/1.4 system-ui,sans-serif;padding:4px 8px;border-radius:4px;opacity:.85;pointer-events:none';
    document.body.appendChild(badge);
  });
})();
