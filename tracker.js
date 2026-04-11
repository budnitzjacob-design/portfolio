/**
 * BUDNITZ ANALYTICS — Tracker v3
 * Tracks: pageviews, clicks, scroll depth, mouse movements (sampled),
 * session data, device info, referrers, UTM params, performance timing,
 * copy/paste, focus/blur, JS errors, custom events.
 *
 * Usage: <script src="tracker.js" defer></script>
 */
(function() {
  'use strict';

  var ENDPOINT       = 'https://jb-analytics.fly.dev/api/events';
  var BATCH_INTERVAL = 5000;
  var SESSION_TIMEOUT = 30 * 60 * 1000;
  var MOUSE_SAMPLE_MS = 200; // sample mouse position every 200ms

  var queue = [];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function getOrCreateVisitorId() {
    try {
      var vid = localStorage.getItem('budnitz_vid');
      if (!vid) { vid = uid(); localStorage.setItem('budnitz_vid', vid); }
      return vid;
    } catch(e) { return uid(); }
  }

  function getOrCreateSession() {
    try {
      var raw = sessionStorage.getItem('budnitz_session');
      var session = raw ? JSON.parse(raw) : null;
      var now = Date.now();
      if (!session || (now - session.lastActivity > SESSION_TIMEOUT)) {
        session = { id: uid(), startedAt: now, lastActivity: now, pageCount: 0 };
      }
      session.lastActivity = now;
      session.pageCount++;
      sessionStorage.setItem('budnitz_session', JSON.stringify(session));
      return session;
    } catch(e) { return { id: uid(), startedAt: Date.now(), lastActivity: Date.now(), pageCount: 1 }; }
  }

  function getDeviceInfo() {
    var ua = navigator.userAgent;
    var deviceType = /Mobi|Android/i.test(ua) ? 'mobile' : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop';
    var browser = 'other';
    if      (/Chrome/i.test(ua) && !/Edge|OPR/i.test(ua)) browser = 'Chrome';
    else if (/Firefox/i.test(ua))                          browser = 'Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua))   browser = 'Safari';
    else if (/Edge/i.test(ua))                             browser = 'Edge';
    else if (/OPR|Opera/i.test(ua))                       browser = 'Opera';
    var os = 'other';
    if      (/Win/i.test(ua))            os = 'Windows';
    else if (/Mac/i.test(ua))            os = 'macOS';
    else if (/Android/i.test(ua))        os = 'Android';
    else if (/iOS|iPhone|iPad/i.test(ua))os = 'iOS';
    else if (/Linux/i.test(ua))          os = 'Linux';
    var conn = null;
    try { conn = navigator.connection?.effectiveType || null; } catch(e) {}
    return {
      type: deviceType, browser: browser, os: os,
      screenWidth: screen.width, screenHeight: screen.height,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      language: navigator.language || 'unknown',
      touchCapable: 'ontouchstart' in window,
      connection: conn,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
    };
  }

  function getReferrer() {
    var ref = document.referrer;
    if (!ref) return { source: 'direct', raw: '' };
    try {
      var url = new URL(ref);
      if (url.hostname === location.hostname) return { source: 'internal', raw: ref };
      if (/google\./i.test(url.hostname))    return { source: 'google', raw: ref };
      if (/bing\./i.test(url.hostname))      return { source: 'bing', raw: ref };
      if (/twitter\.com|x\.com/i.test(url.hostname)) return { source: 'twitter', raw: ref };
      if (/instagram\.com/i.test(url.hostname))       return { source: 'instagram', raw: ref };
      if (/linkedin\.com/i.test(url.hostname))        return { source: 'linkedin', raw: ref };
      if (/facebook\.com/i.test(url.hostname))        return { source: 'facebook', raw: ref };
      if (/github\.com/i.test(url.hostname))          return { source: 'github', raw: ref };
      return { source: url.hostname, raw: ref };
    } catch(e) { return { source: 'unknown', raw: ref }; }
  }

  function getUTMs() {
    try {
      var p = new URLSearchParams(location.search);
      var utms = {};
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(k) {
        var v = p.get(k);
        if (v) utms[k] = v;
      });
      return Object.keys(utms).length ? utms : null;
    } catch(e) { return null; }
  }

  function getPerformanceTiming() {
    try {
      var perf = performance.getEntriesByType('navigation')[0] || performance.timing;
      if (!perf) return null;
      var nav = perf.responseEnd != null ? {
        dns:       Math.round(perf.domainLookupEnd  - perf.domainLookupStart),
        tcp:       Math.round(perf.connectEnd       - perf.connectStart),
        ttfb:      Math.round(perf.responseStart    - perf.requestStart),
        domLoad:   Math.round(perf.domContentLoadedEventEnd - perf.startTime),
        pageLoad:  Math.round(perf.loadEventEnd     - perf.startTime),
      } : null;
      return nav;
    } catch(e) { return null; }
  }

  // ── Flush ──────────────────────────────────────────────────────────────────
  function flush() {
    if (queue.length === 0) return;
    var batch = queue.splice(0, 100);
    var payload = JSON.stringify(batch);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function(){});
    }
  }

  setInterval(flush, BATCH_INTERVAL);

  // ── Init ───────────────────────────────────────────────────────────────────
  var visitorId = getOrCreateVisitorId();
  var session   = getOrCreateSession();
  var device    = getDeviceInfo();
  var referrer  = getReferrer();
  var utms      = getUTMs();

  function record(type, data) {
    queue.push({
      id:         uid(),
      type:       type,
      timestamp:  new Date().toISOString(),
      epoch:      Date.now(),
      visitorId:  visitorId,
      sessionId:  session.id,
      page:       location.pathname || '/',
      pageTitle:  document.title,
      device:     device,
      referrer:   referrer,
      data:       Object.assign({}, data || {}, utms ? { utms: utms } : {}),
    });
  }

  // ── Pageview ───────────────────────────────────────────────────────────────
  record('pageview', { url: location.href, sessionPageCount: session.pageCount });

  // Fire performance timing after page fully loads
  window.addEventListener('load', function() {
    setTimeout(function() {
      var timing = getPerformanceTiming();
      if (timing) record('performance', timing);
    }, 500);
  });

  // ── Clicks ─────────────────────────────────────────────────────────────────
  document.addEventListener('click', function(e) {
    var target = e.target.closest('a, button, [data-track]') || e.target;
    record('click', {
      tag:            target.tagName,
      text:           (target.textContent || '').trim().substring(0, 100),
      href:           target.href || null,
      id:             target.id || null,
      classes:        (target.className || '').toString().substring(0, 100),
      x:              Math.round(e.clientX),
      y:              Math.round(e.clientY),
      pageX:          Math.round(e.pageX),
      pageY:          Math.round(e.pageY),
      viewportWidth:  window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight:     document.documentElement.scrollHeight,
    });
  }, { passive: true });

  // ── Mouse movement (sampled) ───────────────────────────────────────────────
  var lastMouseSample = 0;
  var mousePoints = [];
  document.addEventListener('mousemove', function(e) {
    var now = Date.now();
    if (now - lastMouseSample < MOUSE_SAMPLE_MS) return;
    lastMouseSample = now;
    mousePoints.push([
      Math.round(e.clientX),
      Math.round(e.clientY),
      Math.round(e.pageX),
      Math.round(e.pageY),
    ]);
    // Batch flush mouse points every 20 samples
    if (mousePoints.length >= 20) {
      record('mouse_move', { points: mousePoints.slice(), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight });
      mousePoints = [];
    }
  }, { passive: true });

  // ── Scroll ─────────────────────────────────────────────────────────────────
  var maxScroll = 0;
  var hitMilestones = {};
  function updateScroll() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    var pct = Math.min(100, Math.round((scrollTop / docHeight) * 100));
    if (pct > maxScroll) maxScroll = pct;
    [25, 50, 75, 90, 100].forEach(function(m) {
      if (pct >= m && !hitMilestones[m]) {
        hitMilestones[m] = true;
        record('scroll_milestone', { milestone: m, maxScroll: maxScroll });
      }
    });
  }
  window.addEventListener('scroll', updateScroll, { passive: true });

  // ── Copy / Paste ───────────────────────────────────────────────────────────
  document.addEventListener('copy', function() {
    var sel = (window.getSelection() || '').toString().substring(0, 200);
    record('copy', { text: sel, page: location.pathname });
  });

  // ── Focus / Blur ───────────────────────────────────────────────────────────
  var blurTime = null;
  window.addEventListener('blur', function() { blurTime = Date.now(); });
  window.addEventListener('focus', function() {
    if (blurTime) {
      record('refocus', { awayMs: Date.now() - blurTime });
      blurTime = null;
    }
  });

  // ── JS errors ─────────────────────────────────────────────────────────────
  window.addEventListener('error', function(e) {
    record('js_error', {
      message: e.message,
      source:  e.filename,
      line:    e.lineno,
      col:     e.colno,
    });
  });

  // ── Exit ───────────────────────────────────────────────────────────────────
  var pageLoadTime = Date.now();
  function recordExit() {
    // Flush remaining mouse points
    if (mousePoints.length) {
      record('mouse_move', { points: mousePoints.slice(), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight });
      mousePoints = [];
    }
    record('page_exit', { duration: Math.round((Date.now() - pageLoadTime) / 1000), maxScroll: maxScroll });
    flush();
  }
  window.addEventListener('beforeunload', recordExit);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') recordExit();
  });

  // ── Public API ─────────────────────────────────────────────────────────────
  window.BudnitzAnalytics = {
    track: function(eventName, data) {
      record('custom', Object.assign({ eventName: eventName }, data || {}));
    },
  };

})();
