/*
 * Numberle cross-domain stats migration — OLD SITE transfer script.
 *
 * Numberle moved to numberle.com. localStorage is origin-scoped, so the new
 * site can't read a returning player's saved stats directly. This script reads
 * them here, bundles them into a base64url URL fragment, and redirects to
 * numberle.com, which decodes and merges them.
 *
 * Loaded by two pages on this origin:
 *   - index.html    — the SEO landing page; a normal visit (an old bookmark) is
 *                     a "push". The script runs first in <head> and navigates
 *                     before the <noscript> meta-refresh fallback matters.
 *   - transfer.html — a JS-only page the NEW site navigates to (?nmpull=1) when
 *                     it wants the data for a returning player. No meta tag, so
 *                     nothing competes with this script — the "sure thing" pull.
 *
 * For LOCAL TESTING ONLY, a page may set window.__NM_TARGET__ before this loads
 * to override the destination origin. In production it's never set, so we
 * always target the real new site.
 */
(function () {
  'use strict';

  var TARGET =
    (typeof window !== 'undefined' && window.__NM_TARGET__) ||
    'https://numberle.com/';

  // Keys the legacy site persists. Settings travel too so the player's theme
  // carries over.
  var KEYS = ['statistics', 'gameState', 'darkTheme', 'colorBlindTheme'];

  function base64url(str) {
    // Plain btoa, symmetric with the new site's decoder (atob + JSON.parse).
    // Payload is JSON over Numberle's ASCII stats keys/digits, so btoa is safe;
    // then make it URL-fragment safe.
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function buildPayload() {
    var payload = {};
    for (var i = 0; i < KEYS.length; i++) {
      var key = KEYS[i];
      try {
        var raw = window.localStorage.getItem(key);
        if (raw === null) continue;
        // statistics / gameState are JSON; darkTheme / colorBlindTheme are JSON
        // booleans. Parse so the new site receives real values, not strings.
        try {
          payload[key] = JSON.parse(raw);
        } catch (e) {
          payload[key] = raw;
        }
      } catch (e) {
        // localStorage unavailable (private mode, blocked) — skip this key.
      }
    }
    return payload;
  }

  function go() {
    var url = TARGET;
    try {
      var payload = buildPayload();
      // Only attach a fragment if we actually have something to carry.
      if (Object.keys(payload).length > 0) {
        url = TARGET + '#nmtransfer=' + base64url(JSON.stringify(payload));
      }
    } catch (e) {
      // Any failure: still send the player to the new site, just without data.
    }
    // replace() so the old URL isn't left in history (no back-button trap).
    window.location.replace(url);
  }

  // An explicit pull (the new site sent the player here via ?nmpull=1) must
  // ALWAYS bundle and return the data, even if this origin was already visited
  // this session.
  var isPull = window.location.search.indexOf('nmpull=1') !== -1;
  // For a normal (push) visit, guard against a pathological redirect loop
  // within a session. Normal flow leaves this origin entirely, so this never
  // trips; the pull path skips it so a deliberate request always gets its data.
  if (!isPull) {
    try {
      if (window.sessionStorage.getItem('nmRedirected')) {
        window.location.replace(TARGET);
        return;
      }
      window.sessionStorage.setItem('nmRedirected', '1');
    } catch (e) {
      // sessionStorage unavailable — proceed anyway.
    }
  }

  go();
})();
