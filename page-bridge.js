/**
 * MAIN world, document_start.
 * X'in kendi isteklerinden Bearer token ve GraphQL Following parametrelerini yakalar.
 */
(function () {
  'use strict';
  if (window.__xtcBridge) return;
  window.__xtcBridge = true;

  const SOURCE = 'xtc-bridge';
  const FOLLOWING_RE = /\/i\/api\/graphql\/[A-Za-z0-9_-]+\/Following(?!\w)/;

  let bearer = null;
  let queryId = null;
  let features = null;
  let fieldToggles = null;
  let userId = null;
  let credsSent = null;
  const pendingPages = [];
  let listenerReady = false;

  function post(type, extra) {
    window.postMessage({ source: SOURCE, type, ...extra }, '*');
  }

  function userIdFromCookie() {
    const m = document.cookie.match(/(?:^|;\s*)twid=u(?:%3D|=)"?(\d+)/i);
    return m ? m[1] : null;
  }

  function extractFromUrl(url) {
    try {
      const queryMatch = String(url).match(/\/graphql\/([A-Za-z0-9_-]+)\//);
      if (!queryMatch) return null;
      const u = new URL(url, location.href);
      const rawVars = u.searchParams.get('variables');
      let parsedUserId = null;
      if (rawVars) {
        try { parsedUserId = JSON.parse(rawVars).userId || null; } catch (_) {}
      }
      return {
        queryId: queryMatch[1],
        features: u.searchParams.get('features'),
        fieldToggles: u.searchParams.get('fieldToggles'),
        userId: parsedUserId,
        rawVars
      };
    } catch (_) {
      return null;
    }
  }

  function captureBearer(value) {
    const v = String(value || '');
    if (!v.startsWith('Bearer ')) return;
    const changed = bearer !== v;
    bearer = v;
    if (changed) {
      post('bearer', { authorization: bearer });
      relayCreds();
    }
  }

  function relayCreds() {
    const uid = userId || userIdFromCookie();
    if (!bearer || !uid) return;
    const next = {
      queryId,
      features,
      fieldToggles,
      userId: uid,
      authorization: bearer
    };
    const key = JSON.stringify(next);
    if (key === credsSent) return;
    credsSent = key;
    post('credentials', next);
  }

  function extractBottomCursor(json) {
    try {
      const walk = (node) => {
        if (!node || typeof node !== 'object') return null;
        if (Array.isArray(node)) {
          for (const item of node) {
            const found = walk(item);
            if (found) return found;
          }
          return null;
        }
        if (node.cursorType && /bottom/i.test(String(node.cursorType)) && typeof node.value === 'string') {
          return node.value;
        }
        for (const k of Object.keys(node)) {
          const found = walk(node[k]);
          if (found) return found;
        }
        return null;
      };
      return walk(json);
    } catch (_) {
      return null;
    }
  }

  function handleFollowingUrl(url) {
    const extracted = extractFromUrl(url);
    if (!extracted) return;
    queryId = extracted.queryId;
    if (extracted.features) features = extracted.features;
    if (extracted.fieldToggles) fieldToggles = extracted.fieldToggles;
    if (extracted.userId) userId = extracted.userId;
    relayCreds();
  }

  function handleFollowingJson(json) {
    const cursor = extractBottomCursor(json);
    const payload = { json, cursor };
    if (!listenerReady) pendingPages.push(payload);
    post('following-page', payload);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'xtc-panel') return;
    if (data.type === 'request-credentials') {
      listenerReady = true;
      relayCreds();
      if (bearer) post('bearer', { authorization: bearer });
      for (const page of pendingPages) post('following-page', page);
    }
  });

  const nativeSet = Headers.prototype.set;
  Headers.prototype.set = function (name, value) {
    if (String(name).toLowerCase() === 'authorization') captureBearer(value);
    return nativeSet.apply(this, arguments);
  };

  const nativeAppend = Headers.prototype.append;
  Headers.prototype.append = function (name, value) {
    if (String(name).toLowerCase() === 'authorization') captureBearer(value);
    return nativeAppend.apply(this, arguments);
  };

  function readAuthFromArgs(args) {
    try {
      const init = args[1] || {};
      const hdrs = init.headers || (typeof args[0] === 'object' ? args[0].headers : null);
      if (!hdrs) return;
      if (typeof hdrs.get === 'function') {
        captureBearer(hdrs.get('authorization') || hdrs.get('Authorization'));
        return;
      }
      captureBearer(hdrs.authorization || hdrs.Authorization);
    } catch (_) {}
  }

  const nativeFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = (typeof args[0] === 'string' ? args[0] : args[0] && args[0].url) || '';
    readAuthFromArgs(args);
    const resp = await nativeFetch.apply(this, args);
    if (FOLLOWING_RE.test(url)) {
      handleFollowingUrl(url);
      resp.clone().json().then(handleFollowingJson).catch(() => {});
    }
    return resp;
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__xtcUrl = url;
    this.__xtcFollowing = FOLLOWING_RE.test(String(url || ''));
    if (this.__xtcFollowing) handleFollowingUrl(url);
    return nativeOpen.apply(this, [method, url, ...rest]);
  };

  const nativeSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (String(name).toLowerCase() === 'authorization') captureBearer(value);
    return nativeSetHeader.apply(this, arguments);
  };

  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__xtcFollowing) {
      this.addEventListener('load', function () {
        if (this.status < 200 || this.status >= 300) return;
        try { handleFollowingJson(JSON.parse(this.responseText)); } catch (_) {}
      });
    }
    return nativeSend.apply(this, args);
  };
})();
