/**
 * BUDNITZ ANALYTICS — Tracker v2
 * Collects pageviews, clicks, scroll depth, session data,
 * device info, referrers, and custom events.
 * Sends batched events to the analytics backend.
 *
 * Usage: <script src="tracker.js"></script>
 */
(function() {
  'use strict';

  // CHANGE THIS to your Fly.io app URL after deploy
  var ENDPOINT = 'https://budnitz-analytics.fly.dev/api/events';
  var BATCH_INTERVAL = 5000; // send every 5 seconds
  var SESSION_TIMEOUT = 30 * 60 * 1000;

  var queue = [];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function getOrCreateVisitorId() {
    var vid = localStorage.getItem('budnitz_vid');
    if (!vid) {
      vid = uid();
      localStorage.setItem('budnitz_vid', vid);
    }
    return vid;
  }

  function getOrCreateSession() {
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
  }

  function getDeviceInfo() {
    var ua = navigator.userAgent;
    var deviceType = 'desktop';
    if (/Mobi|Android/i.test(ua)) deviceType = 'mobile';
    else if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet';

    var browser = 'other';
    if (/Chrome/i.test(ua) && !/Edge|OPR/i.test(ua)) browser = 'Chrome';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Edge/i.test(ua)) browser = 'Edge';

    var os = 'other';
    if (/Win/i.test(ua)) os = 'Windows';
    else if (/Mac/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iOS|iPhone|iPad/i.test(ua)) os = 'iOS';

    return {
      type: deviceType, browser: browser, os: os,
      screenWidth: screen.width, screenHeight: screen.height,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      language: navigator.language || 'unknown',
      touchCapable: 'ontouchstart' in window
    };
  }

  function getReferrer() {
    var ref = document.referrer;
    if (!ref) return { source: 'direct', raw: '' };
    try {
      var url = new URL(ref);
      if (url.hostname === location.hostname) return { source: 'internal', raw: ref };
      if (/google\./i.test(url.hostname)) return { source: 'google', raw: ref };
      if (/bing\./i.test(url.hostname)) return { source: 'bing', raw: ref };
      if (/twitter\.com|x\.com/i.test(url.hostname)) return { source: 'twitter', raw: ref };
      if (/instagram\.com/i.test(url.hostname)) return { source: 'instagram', raw: ref };
      if (/linkedin\.com/i.test(url.hostname)) return { source: 'linkedin', raw: ref };
      if (/facebook\.com/i.test(url.hostname)) return { source: 'facebook', raw: ref };
      if (/github\.com/i.test(url.hostname)) return { source: 'github', raw: ref };
      return { source: url.hostname, raw: ref };
    } catch(e) {
      return { source: 'unknown', raw: ref };
    }
  }

  // --- Flush queue to backend ---
  function flush() {
    if (queue.length === 0) return;
    var batch = queue.splice(0, 100);
    var payload = JSON.stringify(batch);
    // Use sendBeacon if available (works on page exit), else fetch
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(function() {});
    }
  }

  // Flush on interval
  setInterval(flush, BATCH_INTERVAL);

  // --- Record ---
  var visitorId = getOrCreateVisitorId();
  var session = getOrCreateSession();
  var device = getDeviceInfo();
  var referrer = getReferrer();

  function record(type, data) {
    queue.push({
      id: uid(),
      type: type,
      timestamp: new Date().toISOString(),
      epoch: Date.now(),
      visitorId: visitorId,
      sessionId: session.id,
      page: location.pathname || '/',
      pageTitle: document.title,
      device: device,
      referrer: referrer,
      data: data || {}
    });
  }

  // --- Pageview ---
  record('pageview', { url: location.href, sessionPageCount: session.pageCount });

  // --- Clicks ---
  document.addEventListener('click', function(e) {
    var target = e.target.closest('a, button, [data-track]') || e.target;
    record('click', {
      tag: target.tagName,
      text: (target.textContent || '').trim().substring(0, 100),
      href: target.href || null,
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
      pageX: Math.round(e.pageX),
      pageY: Math.round(e.pageY),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight
    });
  }, { passive: true });

  // --- Scroll ---
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

  // --- Exit ---
  var pageLoadTime = Date.now();
  function recordExit() {
    record('page_exit', {
      duration: Math.round((Date.now() - pageLoadTime) / 1000),
      maxScroll: maxScroll
    });
    flush(); // send immediately on exit
  }
  window.addEventListener('beforeunload', recordExit);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') recordExit();
  });

  // --- Public API ---
  window.BudnitzAnalytics = {
    track: function(eventName, data) {
      record('custom', Object.assign({ eventName: eventName }, data || {}));
    }
  };

})();
