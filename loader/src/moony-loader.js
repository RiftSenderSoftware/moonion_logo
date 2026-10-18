/*! Moony Dreams loading screen for playables. Self-contained: no network requests, ES5, no dependencies. */
(function (win, doc) {
  'use strict';

  // Filled in by build.py
  var FOX = '__FOX__';
  var LOGO = '__LOGO__';
  var FOX_RATIO = __FOX_RATIO__;   // height / width
  var LOGO_RATIO = __LOGO_RATIO__; // height / width
  var CSS = __CSS__;

  var STYLE_ID = 'moony-loader-style';
  var LANDSCAPE_FROM = 1.25; // width / height at which the layout switches to a row

  function el(tag, cls, parent) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function px(e, props) {
    for (var k in props) e.style[k] = Math.round(props[k] * 10) / 10 + 'px';
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function now() { return win.performance && performance.now ? performance.now() : Date.now(); }

  var raf = win.requestAnimationFrame || win.webkitRequestAnimationFrame || function (cb) { return setTimeout(function () { cb(now()); }, 16); };

  function injectStyle() {
    if (doc.getElementById(STYLE_ID)) return;
    var s = el('style');
    s.id = STYLE_ID;
    s.appendChild(doc.createTextNode(CSS));
    (doc.head || doc.documentElement).appendChild(s);
  }

  /**
   * @param {Object} [opts]
   * @param {HTMLElement} [opts.parent]     Container to cover. Default: whole page (position: fixed).
   * @param {number}  [opts.minDuration=1200] Minimum time on screen, ms. Avoids a flash on fast loads.
   * @param {boolean} [opts.fakeProgress=true] Bar creeps towards 90% by itself until real progress / finish().
   * @param {boolean} [opts.showPercent=true]
   * @param {number}  [opts.stars=34]
   * @param {Function} [opts.onHidden]    Called after the fade-out, when the node is removed.
   */
  function Loader(opts) {
    opts = opts || {};
    this.parent = opts.parent || null;
    this.minDuration = opts.minDuration == null ? 1200 : opts.minDuration;
    this.fakeProgress = opts.fakeProgress !== false;
    this.showPercent = opts.showPercent !== false;
    this.starCount = opts.stars == null ? 34 : opts.stars;
    this.onHidden = opts.onHidden || null;

    this.real = 0;
    this.fake = 0;
    this.shown = 0;
    this.finishing = false;
    this.destroyed = false;
    this.started = now();
    this.last = this.started;

    var self = this;
    this._onResize = function () { self.layout(); };
    this._tick = function (t) { self.tick(t); };

    injectStyle();
    this.build();
    if (this.parent || doc.body) this.mount();
    else doc.addEventListener('DOMContentLoaded', function () { self.mount(); });
  }

  Loader.prototype.build = function () {
    var root = this.root = el('div', 'ml-root' + (this.parent ? ' ml-abs' : ''));
    root.setAttribute('role', 'progressbar');
    root.setAttribute('aria-valuemin', '0');
    root.setAttribute('aria-valuemax', '100');

    var sky = el('div', 'ml-sky', root);
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (var i = 0; i < this.starCount; i++) {
      var s = el('i', 'ml-star', sky), size = 1 + rnd() * 2.2;
      s.style.left = (rnd() * 100).toFixed(2) + '%';
      s.style.top = (rnd() * 100).toFixed(2) + '%';
      s.style.width = s.style.height = size.toFixed(1) + 'px';
      s.style.animationDelay = s.style.webkitAnimationDelay = (-rnd() * 3.2).toFixed(2) + 's';
    }

    this.stage = el('div', 'ml-stage', root);
    this.hero = el('div', 'ml-hero', this.stage);
    this.glow = el('div', 'ml-glow', this.hero);
    this.shadow = el('div', 'ml-shadow', this.hero);
    var fox = el('img', 'ml-fox', this.hero);
    fox.src = FOX; fox.alt = ''; fox.draggable = false;

    this.info = el('div', 'ml-info', this.stage);
    var logo = this.logo = el('img', 'ml-logo', this.info);
    logo.src = LOGO; logo.alt = 'Moony Dreams'; logo.draggable = false;
    this.bar = el('div', 'ml-bar', this.info);
    this.fill = el('div', 'ml-fill', this.bar);
    this.pct = el('div', 'ml-pct' + (this.showPercent ? '' : ' ml-hidden'), this.info);
    this.pct.textContent = '0%';
  };

  Loader.prototype.mount = function () {
    if (this.destroyed) return;
    (this.parent || doc.body).appendChild(this.root);
    win.addEventListener('resize', this._onResize);
    win.addEventListener('orientationchange', this._onResize);
    this.layout();
    raf(this._tick);
  };

  // Sizes are computed from the real viewport so the composition holds on any aspect ratio,
  // from 320x480 phones to 4K, and inside MRAID webviews that resize the ad.
  Loader.prototype.layout = function () {
    var w = this.root.clientWidth || win.innerWidth, h = this.root.clientHeight || win.innerHeight;
    if (!w || !h) return;
    var landscape = w / h >= LANDSCAPE_FROM, fox, col, gap;

    if (landscape) {
      fox = Math.min(h * 0.56 / FOX_RATIO, w * 0.34);
      col = Math.min(fox * 1.15, w * 0.4);
      gap = fox * 0.16;
    } else {
      fox = Math.min(w * 0.6, h * 0.34 / FOX_RATIO);
      col = Math.min(fox * 1.1, w * 0.78);
      gap = fox * 0.1;
    }

    var barW = col * (landscape ? 0.86 : 0.78);
    var barH = clamp(Math.round(fox * 0.034), 5, 14);
    var fs = clamp(fox * 0.052, 10, 18);

    this.stage.className = 'ml-stage' + (landscape ? ' ml-row' : '');
    px(this.hero, { width: fox, height: fox * FOX_RATIO });
    this.hero.style.margin = landscape ? '0 ' + gap + 'px 0 0' : '0 0 ' + gap + 'px';
    px(this.glow, { width: fox * 1.7, height: fox * 1.7 });
    px(this.shadow, { width: fox * 0.78, height: fox * 0.12, bottom: -fox * 0.035 });
    px(this.logo, { width: col, height: col * LOGO_RATIO });
    px(this.bar, { width: barW, height: barH, marginTop: fox * 0.13 });
    px(this.pct, { fontSize: fs, marginTop: barH + fs * 0.5 });
  };

  Loader.prototype.tick = function (t) {
    if (this.destroyed) return;
    t = t || now();
    var dt = Math.min(64, t - this.last);
    this.last = t;

    if (this.fakeProgress && !this.finishing) this.fake += (0.9 - this.fake) * dt * 0.0007;
    var target = this.finishing ? 1 : Math.min(0.99, Math.max(this.real, this.fake));
    this.shown += (target - this.shown) * Math.min(1, dt * (this.finishing ? 0.012 : 0.006));
    if (target - this.shown < 0.002) this.shown = target;

    var p = Math.round(this.shown * 100);
    this.fill.style.width = (this.shown * 100).toFixed(2) + '%';
    if (p !== this._p) {
      this._p = p;
      this.pct.textContent = p + '%';
      this.root.setAttribute('aria-valuenow', p);
    }

    if (this.finishing && this.shown >= 1 && now() - this.started >= this.minDuration) return this.hide();
    raf(this._tick);
  };

  /** Real loading progress, 0..1. Values only move the bar forward. */
  Loader.prototype.setProgress = function (p) {
    this.real = Math.max(this.real, clamp(+p || 0, 0, 1));
    return this;
  };

  /** Fill the bar to 100%, respect minDuration, fade out and remove. */
  Loader.prototype.finish = function (cb) {
    if (cb) this.onHidden = cb;
    this.finishing = true;
    return this;
  };

  Loader.prototype.hide = function () {
    var self = this;
    if (this.hiding) return;
    this.hiding = true;
    this.root.className += ' ml-out';
    setTimeout(function () { self.destroy(); if (self.onHidden) self.onHidden(); }, 520);
  };

  /** Remove immediately, no animation. */
  Loader.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    win.removeEventListener('resize', this._onResize);
    win.removeEventListener('orientationchange', this._onResize);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };

  var api = {
    Loader: Loader,
    /** Create and show a loader. Returns the instance. */
    show: function (opts) { return (api.current = new Loader(opts)); },
    setProgress: function (p) { if (api.current) api.current.setProgress(p); },
    finish: function (cb) { if (api.current) api.current.finish(cb); else if (cb) cb(); }
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  win.MoonyLoader = api;

  // A data-autoshow attribute on the script tag shows the loader without any code.
  var me = doc.currentScript;
  if (me && me.hasAttribute('data-autoshow')) api.show();
})(window, document);
