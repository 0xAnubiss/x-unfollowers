(() => {
  'use strict';

  const FALLBACK_BEARER =
    'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  const FALLBACK_FEATURES = JSON.stringify({
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false
  });

  const FALLBACK_QUERY_IDS = [
    'zx6e-TLzRkeDO_a7p4b3JQ',
    'g5P4cbXR4ta4oCeE7y2vLQ'
  ];

  const state = {
    bearer: null,
    queryId: null,
    features: null,
    fieldToggles: null,
    userId: null,
    accounts: [],
    selected: new Set(),
    whitelist: new Set(),
    scanning: false,
    unfollowing: false,
    stopFlag: false,
    delaySeconds: 30,
    jitter: true,
    dailyCount: 0,
    dailyDate: '',
    nativePages: [],
    query: '',
    host: null,
    els: {}
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function selfId() {
    if (state.userId) return state.userId;
    const twid = getCookie('twid') || '';
    const m = twid.match(/(\d{5,})/);
    return m ? m[1] : null;
  }

  function origin() {
    return location.hostname.includes('twitter.com') ? 'https://twitter.com' : 'https://x.com';
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get('xtc');
    const s = data.xtc || {};
    state.delaySeconds = clamp(Number(s.delaySeconds) || 30, 5, 600);
    state.jitter = s.jitter !== false;
    state.whitelist = new Set(s.whitelist || []);
    if (s.dailyDate === today()) state.dailyCount = Number(s.dailyCount) || 0;
    else {
      state.dailyCount = 0;
      state.dailyDate = today();
    }
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      xtc: {
        delaySeconds: state.delaySeconds,
        jitter: state.jitter,
        whitelist: [...state.whitelist],
        dailyDate: today(),
        dailyCount: state.dailyCount
      }
    });
  }

  function askBridge() {
    window.postMessage({ source: 'xtc-panel', type: 'request-credentials' }, '*');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'xtc-bridge') return;
    if (data.type === 'bearer' && data.authorization) {
      state.bearer = data.authorization;
    }
    if (data.type === 'credentials') {
      if (data.authorization) state.bearer = data.authorization;
      if (data.queryId) state.queryId = data.queryId;
      if (data.features) state.features = data.features;
      if (data.fieldToggles) state.fieldToggles = data.fieldToggles;
      if (data.userId) state.userId = data.userId;
    }
    if (data.type === 'following-page' && data.json) {
      state.nativePages.push(data.json);
    }
  });

  async function xRequest(path, options = {}) {
    const csrf = getCookie('ct0');
    if (!csrf) throw new Error('X oturumu bulunamadı. x.com’a giriş yap.');
    const retry = options._retry || 0;
    const headers = {
      authorization: state.bearer || FALLBACK_BEARER,
      'x-csrf-token': csrf,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': (navigator.language || 'tr').slice(0, 2),
      accept: '*/*',
      ...(options.headers || {})
    };
    if (options.body && !headers['content-type']) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    const res = await fetch(origin() + path, {
      method: options.method || 'GET',
      headers,
      body: options.body || undefined,
      credentials: 'include'
    });
    if (res.status === 429 && retry < 4) {
      const wait = Math.max(Number(res.headers.get('retry-after') || 45) * 1000, 20000);
      setStatus(`X hız sınırı. ${Math.ceil(wait / 1000)} sn bekleniyor…`, 'warn');
      await sleep(wait);
      return xRequest(path, { ...options, _retry: retry + 1 });
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      const msg =
        (json && (json.errors?.[0]?.message || json.error)) ||
        `X API ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  function extractUser(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const node = raw.result && raw.result.legacy ? raw.result : raw;
    if (!node || node.__typename === 'UserUnavailable') return null;
    const legacy = node.legacy || {};
    const core = node.core || {};
    const rel = node.relationship_perspectives || {};
    const id = String(node.rest_id || node.id_str || legacy.id_str || '');
    const username = core.screen_name || legacy.screen_name || '';
    if (!id || !username) return null;
    const followedBy = rel.followed_by;
    const followedByLegacy = legacy.followed_by;
    return {
      id,
      username,
      name: core.name || legacy.name || username,
      avatar: (node.avatar && node.avatar.image_url) || legacy.profile_image_url_https || '',
      followers: legacy.followers_count || 0,
      followingCount: legacy.friends_count || 0,
      followedBy: typeof followedBy === 'boolean' ? followedBy : (typeof followedByLegacy === 'boolean' ? followedByLegacy : null),
      verified: !!(node.is_blue_verified || legacy.verified)
    };
  }

  function walkGraphQL(json) {
    const users = [];
    const seen = new Set();
    let cursor = null;
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (node.cursorType && /bottom/i.test(String(node.cursorType)) && typeof node.value === 'string') {
        cursor = node.value;
      }
      const ur = (node.user_results && node.user_results.result) || (node.userResults && node.userResults.result);
      if (ur) {
        const u = extractUser(ur);
        if (u && !seen.has(u.id)) {
          seen.add(u.id);
          users.push(u);
        }
      }
      for (const k of Object.keys(node)) visit(node[k]);
    };
    visit(json);
    if (cursor === '0') cursor = null;
    return { users, cursor };
  }

  function mapRestUser(u) {
    return {
      id: String(u.id_str || u.id),
      username: u.screen_name,
      name: u.name || u.screen_name,
      avatar: u.profile_image_url_https || '',
      followers: u.followers_count || 0,
      followingCount: u.friends_count || 0,
      followedBy: typeof u.followed_by === 'boolean' ? u.followed_by : null,
      verified: !!u.verified
    };
  }

  async function fetchFollowingGraphQL(queryId, features) {
    const uid = selfId();
    if (!uid) throw new Error('Kullanıcı kimliği okunamadı. x.com’a giriş yap.');
    const all = [];
    const seen = new Set();
    let cursor = null;
    let pages = 0;
    while (!state.stopFlag) {
      pages += 1;
      const variables = {
        userId: uid,
        count: 100,
        includePromotedContent: false
      };
      if (cursor) variables.cursor = cursor;
      let path = `/i/api/graphql/${queryId}/Following?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(features || FALLBACK_FEATURES)}`;
      if (state.fieldToggles) {
        path += `&fieldToggles=${encodeURIComponent(state.fieldToggles)}`;
      }
      const json = await xRequest(path);
      const parsed = walkGraphQL(json);
      for (const u of parsed.users) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          all.push(u);
        }
      }
      setStatus(`Takip listesi taranıyor… ${all.length} hesap`);
      if (!parsed.cursor || parsed.users.length === 0) break;
      cursor = parsed.cursor;
      await sleep(800 + Math.floor(Math.random() * 700));
      if (pages > 250) break;
    }
    return all;
  }

  async function fetchFollowingRest() {
    const all = [];
    const seen = new Set();
    let cursor = '-1';
    let pages = 0;
    while (!state.stopFlag && cursor && cursor !== '0') {
      pages += 1;
      const json = await xRequest(`/i/api/1.1/friends/list.json?count=200&cursor=${encodeURIComponent(cursor)}&skip_status=true&include_user_entities=false`);
      const users = Array.isArray(json?.users) ? json.users : [];
      for (const raw of users) {
        const u = mapRestUser(raw);
        if (u.id && u.username && !seen.has(u.id)) {
          seen.add(u.id);
          all.push(u);
        }
      }
      setStatus(`Takip listesi taranıyor… ${all.length} hesap`);
      cursor = json?.next_cursor_str || '0';
      if (!users.length) break;
      await sleep(800 + Math.floor(Math.random() * 700));
      if (pages > 250) break;
    }
    return all;
  }

  async function lookupFollowedBy(accounts) {
    const unknown = accounts.filter((u) => u.followedBy == null);
    for (let i = 0; i < unknown.length; i += 100) {
      if (state.stopFlag) break;
      const batch = unknown.slice(i, i + 100);
      const ids = batch.map((u) => u.id).join(',');
      const json = await xRequest(`/i/api/1.1/friendships/lookup.json?user_id=${ids}`);
      const rows = Array.isArray(json) ? json : [];
      const map = new Map();
      for (const row of rows) {
        const id = String(row.id_str || row.id);
        const connections = row.connections || [];
        map.set(id, connections.includes('followed_by'));
      }
      for (const u of batch) {
        if (map.has(u.id)) u.followedBy = map.get(u.id);
      }
      setStatus(`Geri takip kontrolü… ${Math.min(i + 100, unknown.length)}/${unknown.length}`);
      if (i + 100 < unknown.length) await sleep(600);
    }
  }

  async function waitForAuth() {
    askBridge();
    const start = Date.now();
    let sawCsrf = false;
    while (Date.now() - start < 8000) {
      if (getCookie('ct0')) sawCsrf = true;
      if (sawCsrf && (state.queryId || Date.now() - start > 1800)) return;
      await sleep(250);
      askBridge();
    }
    if (!getCookie('ct0')) throw new Error('X oturumu bulunamadı. x.com’a giriş yap ve sayfayı yenile.');
  }

  async function scan() {
    if (state.scanning || state.unfollowing) return;
    state.scanning = true;
    state.stopFlag = false;
    state.accounts = [];
    state.selected.clear();
    renderList();
    updateCounts();
    setButtons();
    try {
      await waitForAuth();
      setStatus('Takip listen alınıyor…');
      let following = [];
      const fromNative = [];
      const queryIds = [...new Set([state.queryId, ...FALLBACK_QUERY_IDS].filter(Boolean))];
      const features = state.features || FALLBACK_FEATURES;
      let lastErr = null;

      if (state.nativePages.length) {
        const seen = new Set();
        for (const page of state.nativePages) {
          for (const u of walkGraphQL(page).users) {
            if (!seen.has(u.id)) {
              seen.add(u.id);
              fromNative.push(u);
            }
          }
        }
      }

      for (const qid of queryIds) {
        try {
          following = await fetchFollowingGraphQL(qid, features);
          state.queryId = qid;
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (err.status && err.status !== 404 && err.status !== 400) throw err;
        }
      }

      if (!following.length) {
        try {
          following = await fetchFollowingRest();
        } catch (err) {
          lastErr = err;
        }
      }

      if (!following.length) following = fromNative;

      if (!following.length) {
        const extra = lastErr ? ` (${lastErr.message})` : '';
        throw new Error(
          'Liste alınamadı' + extra +
          '. Following sayfasını aç, biraz aşağı kaydır, sonra taramayı tekrar başlat.'
        );
      }

      setStatus(`Geri takip kontrol ediliyor… ${following.length} hesap`);
      try {
        await lookupFollowedBy(following);
      } catch (err) {
        if (following.every((u) => u.followedBy == null)) throw err;
      }
      if (following.every((u) => u.followedBy == null)) {
        throw new Error('Geri takip bilgisi alınamadı. Following sayfasını açıp biraz kaydır, sonra tekrar tara.');
      }
      if (state.stopFlag) {
        setStatus('Tarama durduruldu.', 'warn');
        return;
      }

      const non = following.filter((u) => u.followedBy === false);
      state.accounts = non;
      renderList();
      updateCounts();
      if (!non.length) setStatus('Seni takip etmeyen kimse yok. Hepsi geri takipte.', 'ok');
      else setStatus(`${non.length} kişi seni takip etmiyor. Çıkarmak istediklerini işaretle.`, 'ok');
    } catch (err) {
      setStatus(err.message || String(err), 'err');
    } finally {
      state.scanning = false;
      setButtons();
    }
  }

  async function unfollowOne(user) {
    await xRequest('/i/api/1.1/friendships/destroy.json', {
      method: 'POST',
      body: new URLSearchParams({ user_id: user.id }).toString()
    });
  }

  function delayMs() {
    const base = state.delaySeconds * 1000;
    if (!state.jitter) return base;
    return Math.round(base * (0.8 + Math.random() * 0.4));
  }

  async function waitBetween() {
    const ms = delayMs();
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (state.stopFlag) return;
      const left = Math.ceil((end - Date.now()) / 1000);
      const { countdown } = state.els;
      if (countdown) countdown.textContent = `Sonraki kişi ${left} sn sonra`;
      await sleep(200);
    }
  }

  async function unfollowSelected() {
    if (state.unfollowing || state.scanning) return;
    const targets = state.accounts.filter((u) => state.selected.has(u.id) && !state.whitelist.has(u.id));
    if (!targets.length) {
      setStatus('Önce listeden çıkarılacak hesapları işaretle.', 'warn');
      return;
    }
    if (state.delaySeconds < 15) {
      const ok = confirm(
        `Aralık ${state.delaySeconds} sn. X hız sınırına takılma riski artar. 30+ saniye daha güvenli. Yine de devam edilsin mi?`
      );
      if (!ok) return;
    }
    state.unfollowing = true;
    state.stopFlag = false;
    setButtons();
    let done = 0;
    let failed = 0;
    try {
      for (let i = 0; i < targets.length; i += 1) {
        if (state.stopFlag) break;
        const user = targets[i];
        setStatus(`Takipten çıkarılıyor: @${user.username} (${i + 1}/${targets.length})`);
        setProgress(i / targets.length);
        try {
          await unfollowOne(user);
          done += 1;
          state.dailyCount += 1;
          state.selected.delete(user.id);
          state.accounts = state.accounts.filter((u) => u.id !== user.id);
          renderList();
          updateCounts();
          await saveSettings();
        } catch (err) {
          failed += 1;
          if (err.status === 429) {
            setStatus('X geçici olarak durdurdu. Bekleniyor…', 'warn');
            await sleep(60000);
            i -= 1;
            continue;
          }
          setStatus(`@${user.username} çıkarılamadı: ${err.message}`, 'warn');
          await sleep(1500);
        }
        if (i < targets.length - 1 && !state.stopFlag) await waitBetween();
      }
      setProgress(1);
      const { countdown } = state.els;
      if (countdown) countdown.textContent = '';
      if (state.stopFlag) setStatus(`Durduruldu. ${done} kişi çıkarıldı${failed ? `, ${failed} hata` : ''}.`, 'warn');
      else setStatus(`Bitti. ${done} kişi takipten çıkarıldı${failed ? `, ${failed} hata` : ''}.`, 'ok');
    } finally {
      state.unfollowing = false;
      setButtons();
      updateCounts();
    }
  }

  function visibleAccounts() {
    const q = state.query.trim().toLowerCase();
    return state.accounts.filter((u) => {
      if (!q) return true;
      return u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
    });
  }

  function setStatus(text, kind) {
    const el = state.els.status;
    if (!el) return;
    el.textContent = text;
    el.className = 'xtc-status' + (kind ? ' ' + kind : '');
  }

  function setProgress(ratio) {
    const bar = state.els.bar;
    if (bar) bar.style.width = `${Math.round(clamp(ratio, 0, 1) * 100)}%`;
  }

  function updateCounts() {
    const { stats, selectedLabel } = state.els;
    const vis = visibleAccounts();
    const selected = vis.filter((u) => state.selected.has(u.id) && !state.whitelist.has(u.id)).length;
    if (stats) {
      stats.innerHTML = '';
      const chips = [
        `${state.accounts.length} takip etmeyen`,
        `${selected} seçili`,
        `bugün ${state.dailyCount} çıkarıldı`
      ];
      for (const t of chips) {
        const s = document.createElement('span');
        s.className = 'xtc-chip';
        s.textContent = t;
        stats.appendChild(s);
      }
    }
    if (selectedLabel) selectedLabel.textContent = `${selected} seçili`;
  }

  function setButtons() {
    const busy = state.scanning || state.unfollowing;
    const { scanBtn, stopScanBtn, unfollowBtn, stopUnfollowBtn, delay, jitter } = state.els;
    if (scanBtn) scanBtn.disabled = busy;
    if (stopScanBtn) stopScanBtn.disabled = !state.scanning;
    if (unfollowBtn) unfollowBtn.disabled = busy || !state.selected.size;
    if (stopUnfollowBtn) stopUnfollowBtn.disabled = !state.unfollowing;
    if (delay) delay.disabled = state.unfollowing;
    if (jitter) jitter.disabled = state.unfollowing;
  }

  function renderList() {
    const box = state.els.list;
    if (!box) return;
    box.innerHTML = '';
    const rows = visibleAccounts();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'xtc-empty';
      empty.textContent = state.accounts.length
        ? 'Aramaya uyan hesap yok.'
        : 'Henüz tarama yok. Taramayı Başlat ile seni takip etmeyenler listelenir.';
      box.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    for (const u of rows) {
      const row = document.createElement('label');
      row.className = 'xtc-item' + (state.whitelist.has(u.id) ? ' protected' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.selected.has(u.id) && !state.whitelist.has(u.id);
      cb.disabled = state.whitelist.has(u.id) || state.unfollowing;
      cb.addEventListener('change', () => {
        if (cb.checked) state.selected.add(u.id);
        else state.selected.delete(u.id);
        updateCounts();
        setButtons();
      });
      const img = document.createElement('img');
      img.alt = '';
      img.src = (u.avatar || '').replace('_normal', '_bigger') ||
        'https://abs.twimg.com/sticky/default_profile_images/default_profile_bigger.png';
      img.addEventListener('error', () => {
        img.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_bigger.png';
      });
      const meta = document.createElement('div');
      meta.className = 'xtc-meta';
      const name = document.createElement('div');
      name.className = 'xtc-name';
      name.textContent = u.name;
      const handle = document.createElement('div');
      handle.className = 'xtc-user';
      handle.textContent = `@${u.username} · ${u.followers} takipçi`;
      meta.append(name, handle);
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'xtc-mini';
      star.title = state.whitelist.has(u.id) ? 'Korumayı kaldır' : 'Koruma listesine ekle';
      star.textContent = state.whitelist.has(u.id) ? '★' : '☆';
      star.addEventListener('click', async (ev) => {
        ev.preventDefault();
        if (state.whitelist.has(u.id)) state.whitelist.delete(u.id);
        else {
          state.whitelist.add(u.id);
          state.selected.delete(u.id);
        }
        await saveSettings();
        renderList();
        updateCounts();
        setButtons();
      });
      row.append(cb, img, meta, star);
      frag.appendChild(row);
    }
    box.appendChild(frag);
  }

  function selectVisible(on) {
    for (const u of visibleAccounts()) {
      if (state.whitelist.has(u.id)) continue;
      if (on) state.selected.add(u.id);
      else state.selected.delete(u.id);
    }
    renderList();
    updateCounts();
    setButtons();
  }

  async function mount() {
    if (document.getElementById('xtc-host')) return;
    await loadSettings();
    const css = await fetch(chrome.runtime.getURL('overlay.css')).then((r) => r.text());
    const host = document.createElement('div');
    host.id = 'xtc-host';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${css}</style>
      <button class="xtc-fab" id="fab" title="Takipten Çıkar" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="8" r="3.2"/>
          <path d="M6.5 18c.8-2.8 2.9-4.2 5.5-4.2"/>
          <circle cx="17.2" cy="16.8" r="3.3" fill="#1d9bf0" stroke="none"/>
          <path d="M15.6 16.8h3.2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
      </button>
      <aside class="xtc-panel" id="panel" hidden>
        <div class="xtc-head">
          <div>
            <h1>Takipten Çıkar</h1>
            <p>Seni takip etmeyenler · sen seçersin</p>
          </div>
          <button class="xtc-icon-btn" id="close" type="button" title="Kapat">×</button>
        </div>
        <div class="xtc-body">
          <div class="xtc-row">
            <span class="xtc-label">Aralık</span>
            <input class="xtc-input" id="delay" type="number" min="5" max="600" step="1" />
            <span class="xtc-label">saniye / kişi</span>
            <label class="xtc-check"><input id="jitter" type="checkbox" /> rastgele sapma</label>
          </div>
          <p class="xtc-note">X’in hız sınırına takılmamak için 30 saniye ve üzeri önerilir. Çıkarma işlemi yalnızca işaretlediklerin için çalışır.</p>
          <div class="xtc-actions">
            <button class="xtc-btn xtc-btn-primary" id="scan" type="button">Taramayı Başlat</button>
            <button class="xtc-btn xtc-btn-ghost" id="stop-scan" type="button" disabled>Taramayı Durdur</button>
            <button class="xtc-btn xtc-btn-ghost" id="open-following" type="button">Following’i aç</button>
          </div>
          <div class="xtc-status" id="status">x.com’da girişliysen taramayı başlat.</div>
          <div class="xtc-stats" id="stats"></div>
          <div class="xtc-toolbar">
            <input class="xtc-search" id="search" type="search" placeholder="İsim veya @kullanıcı ara" />
            <button class="xtc-btn xtc-btn-ghost" id="all" type="button">Tümü</button>
            <button class="xtc-btn xtc-btn-ghost" id="none" type="button">Hiçbiri</button>
          </div>
          <div class="xtc-list" id="list"></div>
        </div>
        <div class="xtc-foot">
          <div class="xtc-progress"><span id="bar"></span></div>
          <div class="xtc-row">
            <span class="xtc-label" id="selected-label">0 seçili</span>
            <span class="xtc-label" id="countdown"></span>
          </div>
          <div class="xtc-actions">
            <button class="xtc-btn xtc-btn-danger" id="unfollow" type="button">Seçilenleri Çıkar</button>
            <button class="xtc-btn xtc-btn-ghost" id="stop-unf" type="button" disabled>Durdur</button>
          </div>
        </div>
      </aside>
    `;
    document.documentElement.appendChild(host);
    state.host = host;
    const $ = (id) => shadow.getElementById(id);
    state.els = {
      panel: $('panel'),
      fab: $('fab'),
      status: $('status'),
      stats: $('stats'),
      list: $('list'),
      scanBtn: $('scan'),
      stopScanBtn: $('stop-scan'),
      unfollowBtn: $('unfollow'),
      stopUnfollowBtn: $('stop-unf'),
      delay: $('delay'),
      jitter: $('jitter'),
      bar: $('bar'),
      countdown: $('countdown'),
      selectedLabel: $('selected-label')
    };
    state.els.delay.value = String(state.delaySeconds);
    state.els.jitter.checked = state.jitter;
    renderList();
    updateCounts();
    setButtons();
    askBridge();

    const toggle = (open) => {
      const show = open == null ? state.els.panel.hasAttribute('hidden') : open;
      if (show) state.els.panel.removeAttribute('hidden');
      else state.els.panel.setAttribute('hidden', '');
      if (show) askBridge();
    };

    $('fab').addEventListener('click', () => toggle());
    $('close').addEventListener('click', () => toggle(false));
    $('scan').addEventListener('click', scan);
    $('stop-scan').addEventListener('click', () => { state.stopFlag = true; });
    $('open-following').addEventListener('click', () => {
      location.href = origin() + '/following';
    });
    $('unfollow').addEventListener('click', unfollowSelected);
    $('stop-unf').addEventListener('click', () => { state.stopFlag = true; });
    $('all').addEventListener('click', () => selectVisible(true));
    $('none').addEventListener('click', () => selectVisible(false));
    $('search').addEventListener('input', (e) => {
      state.query = e.target.value || '';
      renderList();
      updateCounts();
    });
    $('delay').addEventListener('change', async () => {
      state.delaySeconds = clamp(Number($('delay').value) || 30, 5, 600);
      $('delay').value = String(state.delaySeconds);
      await saveSettings();
    });
    $('jitter').addEventListener('change', async () => {
      state.jitter = $('jitter').checked;
      await saveSettings();
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'xtc-toggle-panel') {
        toggle();
        sendResponse({ ok: true });
      }
    });
  }

  mount().catch((err) => console.warn('[X Takipten Çıkar]', err));
})();
