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

  // Fox-head constellation in a unit box, listed in the order the lines get drawn:
  // nose -> left cheek -> left ear -> brow -> right ear -> right cheek -> back to the nose.
  var CONSTEL = [[0.5, 1], [0, 0.6], [0.16, 0], [0.38, 0.3], [0.62, 0.3], [0.84, 0], [1, 0.6]];
  var CONSTEL_EYES = [[0.32, 0.6], [0.68, 0.6]];
  var CONSTEL_MARK = [0.5, 0.47];  // the forehead sparkle from the mascot
  var CONSTEL_TILT = -0.08;        // radians, so it reads as a sky pattern rather than an icon

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

  // Seeded PRNG, so the sky looks the same on every launch and after a resize
  function random(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

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
   * @param {number}  [opts.starDensity=1] Multiplier for the number of stars in the sky.
   * @param {boolean} [opts.meteors=true]  Occasional shooting star.
   * @param {Function} [opts.onHidden]    Called after the fade-out, when the node is removed.
   */
  function Loader(opts) {
    opts = opts || {};
    this.parent = opts.parent || null;
    this.minDuration = opts.minDuration == null ? 1200 : opts.minDuration;
    this.fakeProgress = opts.fakeProgress !== false;
    this.showPercent = opts.showPercent !== false;
    this.starDensity = opts.starDensity == null ? 1 : opts.starDensity;
    this.meteors = opts.meteors !== false;
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
    this.canvas = el('canvas', 'ml-stars', sky);
    this.constel = el('canvas', 'ml-constel', sky);
    this.moon = el('i', 'ml-moon', sky);
    this._drawn = -1;

    // A few brighter stars twinkle on top of the static canvas field
    var rnd = random(3);
    for (var i = 0; i < Math.round(8 * this.starDensity); i++) {
      var s = el('i', 'ml-star', sky), size = 1.4 + rnd() * 1.4, dur = 2.4 + rnd() * 3;
      s.style.left = (rnd() * 100).toFixed(2) + '%';
      s.style.top = (Math.pow(rnd(), 1.4) * 100).toFixed(2) + '%';
      s.style.width = s.style.height = size.toFixed(1) + 'px';
      if (rnd() < 0.35) s.style.background = '#d6e4ff';
      s.style.animationDuration = s.style.webkitAnimationDuration = dur.toFixed(2) + 's';
      s.style.animationDelay = s.style.webkitAnimationDelay = (-rnd() * dur).toFixed(2) + 's';
    }

    if (this.meteors) {
      var meteor = this.meteor = el('i', 'ml-meteor', sky), mr = random(5);
      var place = function () {
        meteor.style.left = (25 + mr() * 70).toFixed(1) + '%';
        meteor.style.top = (mr() * 35).toFixed(1) + '%';
      };
      place();
      meteor.addEventListener('animationiteration', place);
      meteor.addEventListener('webkitAnimationIteration', place);
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
    if (w !== this._w || h !== this._h) {
      this._w = w; this._h = h;
      this.drawSky(w, h);
    }
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
    this.placeConstellation(w, h, landscape);
    this.placeMoon(w, h, landscape);
  };

  // Static night sky on a canvas: a faint Milky Way band plus a field of stars whose sizes,
  // brightness and colour temperature follow a natural spread (many faint, very few bright).
  Loader.prototype.drawSky = function (w, h) {
    var c = this.canvas, ctx = c.getContext && c.getContext('2d');
    if (!ctx) return;
    var dpr = Math.min(win.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var rnd = random(11), area = w * h, diag = Math.sqrt(area * 2), i, x, y, r, a, g;
    function gauss() { return (rnd() + rnd() + rnd() + rnd() - 2) / 2; } // ~N(0, 0.29)
    var tints = ['255,255,255', '255,255,255', '214,226,255', '190,208,255', '255,236,214', '255,214,180'];

    // Milky Way: diagonal band of haze, then a dense dust of tiny stars inside it
    ctx.save();
    ctx.translate(w * 0.5, h * 0.42);
    ctx.rotate(-0.55);
    for (i = 0; i < 14; i++) {
      x = (rnd() - 0.5) * diag; y = gauss() * diag * 0.08; r = diag * (0.07 + rnd() * 0.1);
      g = ctx.createRadialGradient(x, y, 0, x, y, r);
      var tint = rnd() < 0.6 ? '140,150,255' : '205,150,255';
      g.addColorStop(0, 'rgba(' + tint + ',' + (0.03 + rnd() * 0.03).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + tint + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    var dust = Math.round(area / 1500 * this.starDensity);
    for (i = 0; i < dust; i++) {
      x = (rnd() - 0.5) * diag; y = gauss() * diag * 0.1;
      a = 0.12 + rnd() * 0.3; r = 0.45 + rnd() * 0.45;
      ctx.fillStyle = 'rgba(' + tints[(rnd() * tints.length) | 0] + ',' + a.toFixed(2) + ')';
      ctx.fillRect(x, y, r, r);
    }
    ctx.restore();

    // Field stars
    var n = Math.round(area / 1900 * this.starDensity);
    for (i = 0; i < n; i++) {
      x = rnd() * w; y = rnd() * h;
      var m = Math.pow(rnd(), 7);                 // magnitude: mostly faint
      r = 0.45 + m * 1.5;
      a = Math.min(1, 0.3 + m * 0.8 + rnd() * 0.35);
      a *= 0.65 + 0.35 * (1 - y / h);             // slightly dimmer towards the horizon haze
      var col = tints[(rnd() * tints.length) | 0];
      if (r > 1.3) {
        g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
        g.addColorStop(0, 'rgba(' + col + ',' + (a * 0.22).toFixed(2) + ')');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      }
      ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(2) + ')';
      if (r < 0.7) ctx.fillRect(x, y, r * 1.4, r * 1.4);
      else { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
    }

    if (this.meteor) this.meteor.style.width = Math.round(clamp(Math.min(w, h) * 0.28, 70, 220)) + 'px';
  };

  // The constellation sits in the largest free patch of sky: above the content on portrait,
  // to the right of it on landscape. On cramped screens (banners) it is skipped.
  Loader.prototype.placeConstellation = function (w, h, landscape) {
    var c = this.constel, hero = this.hero, info = this.info, s, cx, cy;
    if (landscape) {
      var right = Math.max(hero.offsetLeft + hero.offsetWidth, info.offsetLeft + info.offsetWidth), rw = w - right;
      s = Math.min(rw * 0.6, h * 0.42, Math.min(w, h) * 0.34);
      cx = right + rw * 0.5;
      cy = Math.max(h * 0.27, s * 0.62);
    } else {
      var top = Math.min(hero.offsetTop, info.offsetTop);
      s = Math.min(w * 0.42, top * 0.62, Math.min(w, h) * 0.34);
      cx = w * 0.5;
      cy = top * 0.5;
    }
    if (s < 60) { c.style.display = 'none'; this._cs = 0; return; }

    var pad = Math.round(s * 0.22), dpr = Math.min(win.devicePixelRatio || 1, 2);
    var cw = s + pad * 2, ch = s * 0.95 + pad * 2;
    c.style.display = 'block';
    c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
    px(c, { width: cw, height: ch, left: cx - cw / 2, top: cy - ch / 2 });
    this._cs = s; this._cpad = pad; this._cdpr = dpr;
    this.drawConstellation();
  };

  // Moon that waxes with loading: starts as the mascot's crescent, becomes full at 100%.
  // It goes in the corner opposite the constellation: top-right on portrait, top-left on landscape.
  Loader.prototype.placeMoon = function (w, h, landscape) {
    var m = this.moon, d = clamp(Math.min(w, h) * 0.105, 24, 100), x, y;
    if (landscape) {
      x = w * 0.06; y = h * 0.1;
    } else {
      var top = Math.min(this.hero.offsetTop, this.info.offsetTop);
      x = w * 0.9 - d; y = Math.max(12, top * 0.16);
      if (top < d * 1.8) { m.style.display = 'none'; return; }
    }
    m.style.display = 'block';
    px(m, { width: d, height: d, left: x, top: y });
    this._moonD = d;
    this.drawMoon();
  };

  // The lit part is an inset shadow: disc minus the same disc shifted along the light direction.
  // A small shift gives a thin crescent, a shift of one diameter lights the whole disc.
  Loader.prototype.drawMoon = function () {
    var d = this._moonD, p = this.shown;
    if (!d) return;
    var shift = d * (0.26 + 0.76 * p), glow = 0.25 + p * 0.2, halo = 0.14 + p * 0.16;
    this.moon.style.boxShadow = 'inset ' + (shift * 0.923).toFixed(1) + 'px ' + (-shift * 0.385).toFixed(1) + 'px 0 0 #fff1e0, ' +
      '0 0 ' + (d * 0.35).toFixed(1) + 'px rgba(255, 214, 170, ' + glow.toFixed(2) + '), ' +
      '0 0 ' + (d * 1.2).toFixed(1) + 'px rgba(255, 150, 90, ' + halo.toFixed(2) + ')';
  };

  // Lines connect star by star as loading progresses; the eyes and the forehead sparkle light up last.
  Loader.prototype.drawConstellation = function () {
    var c = this.constel, ctx = c.getContext && c.getContext('2d'), s = this._cs;
    this._drawn = this.shown;
    if (!ctx || !s) return;
    var dpr = this._cdpr, pad = this._cpad, H = 0.95, n = CONSTEL.length, i, a, b, f;
    var t = this.shown * (n + 1);
    function pt(q) { return [q[0] * s, q[1] * s * H]; }
    function star(p, lit, r) {
      ctx.shadowBlur = lit * s * 0.07 * dpr;
      ctx.fillStyle = 'rgba(255,' + Math.round(240 - lit * 12) + ',' + Math.round(226 - lit * 26) + ',' + (0.3 + lit * 0.7).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(p[0], p[1], r * (0.6 + lit * 0.4), 0, 6.2832); ctx.fill();
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.translate(pad + s / 2, pad + s * H / 2);
    ctx.rotate(CONSTEL_TILT);
    ctx.translate(-s / 2, -s * H / 2);
    ctx.shadowColor = 'rgba(255, 112, 40, .95)';

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.strokeStyle = 'rgba(255, 138, 70, .7)';
    ctx.shadowBlur = s * 0.035 * dpr;
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      f = clamp(t - i, 0, 1);
      if (!f) break;
      a = pt(CONSTEL[i]); b = pt(CONSTEL[(i + 1) % n]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
    }
    ctx.stroke();

    var r = Math.max(1.5, s * 0.022);
    for (i = 0; i < n; i++) star(pt(CONSTEL[i]), clamp((t - i) * 3, 0, 1), r);
    var e = clamp(t - n, 0, 1);
    for (i = 0; i < CONSTEL_EYES.length; i++) star(pt(CONSTEL_EYES[i]), e, r * 0.85);

    // Four-point sparkle, same motif as on the fox's forehead
    var m = pt(CONSTEL_MARK), k = s * 0.075 * (0.55 + e * 0.45), q = k * 0.22;
    ctx.shadowBlur = e * s * 0.09 * dpr;
    ctx.fillStyle = 'rgba(255, 244, 232, ' + (0.22 + e * 0.78).toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(m[0], m[1] - k); ctx.lineTo(m[0] + q, m[1] - q); ctx.lineTo(m[0] + k, m[1]); ctx.lineTo(m[0] + q, m[1] + q);
    ctx.lineTo(m[0], m[1] + k); ctx.lineTo(m[0] - q, m[1] + q); ctx.lineTo(m[0] - k, m[1]); ctx.lineTo(m[0] - q, m[1] - q);
    ctx.closePath(); ctx.fill();
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
    if (Math.abs(this.shown - this._drawn) > 0.0015 || (this.shown >= 1 && this._drawn < 1)) {
      this.drawConstellation();
      this.drawMoon();
    }

    // Let the completed constellation flash before fading out
    if (this.shown >= 1 && !this._fullAt) {
      this._fullAt = now();
      this.constel.className += ' ml-lit';
    }
    if (this.finishing && this._fullAt && now() - this._fullAt >= 550 && now() - this.started >= this.minDuration) return this.hide();
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
