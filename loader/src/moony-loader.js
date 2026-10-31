/*! Moony Dreams loading screen for the web. Self-contained: no network requests, ES5, no dependencies. */
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
    this.starDensity = opts.starDensity == null ? 0.35 : opts.starDensity;
    this.meteors = opts.meteors === true;
    this.autoTheme = opts.autoTheme !== false;
    this.themeColor = opts.themeColor;
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
    this.updateTheme();
    var self = this;
    if (this.autoTheme && !this.themeColor) this._themeTimer = setInterval(function () { self.updateTheme(); }, 1200);
    raf(this._tick);
  };

  // Sizes are computed from the real viewport so the composition holds on any aspect ratio,
  // from 320x480 phones to 4K, and inside webviews and iframes that get resized.
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

  // Read host colours only; unreadable or empty game canvases fall back to page styling.
  Loader.prototype.updateTheme = function () {
    var sample = doc.createElement('canvas'); sample.width = sample.height = 24;
    var ctx = sample.getContext('2d');
    if (!ctx || this.destroyed) return;
    var rgb = null, scope = this.parent || doc, canvases = scope.querySelectorAll('canvas');
    var buckets = {}, best = 0;
    if (this.autoTheme && !this.themeColor) {
      for (var i = 0; i < canvases.length; i++) {
        var canvas = canvases[i];
        if (this.root.contains(canvas) || !canvas.width || !canvas.height) continue;
        try {
          ctx.clearRect(0, 0, 24, 24); ctx.drawImage(canvas, 0, 0, 24, 24);
          var data = ctx.getImageData(0, 0, 24, 24).data;
          for (var j = 0; j < data.length; j += 4) {
            var r = data[j], g = data[j + 1], b = data[j + 2];
            if (data[j + 3] < 180 || Math.max(r,g,b) - Math.min(r,g,b) < 18) continue;
            var key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
            var bin = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
            bin.n++; bin.r += r; bin.g += g; bin.b += b;
            if (bin.n > best) { best = bin.n; rgb = [bin.r / best, bin.g / best, bin.b / best]; }
          }
        } catch (e) { /* Cross-origin canvas: retain the page fallback. */ }
      }
    }
    if (!rgb) {
      // A tainted sampling canvas must be replaced before parsing CSS colours.
      sample.width = 24; ctx = sample.getContext('2d');
      var meta = doc.querySelector('meta[name="theme-color"]');
      var colors = this.themeColor ? [this.themeColor] : [];
      if (this.autoTheme && !this.themeColor) {
        if (meta) colors.push(meta.content);
        var game = scope.querySelector('#unity-canvas, #game, #unity-container, canvas') || this.parent || doc.body;
        while (game && game.nodeType === 1 && win.getComputedStyle) {
          colors.push(win.getComputedStyle(game).backgroundColor); game = game.parentNode;
        }
      }
      for (var k = 0; k < colors.length; k++) {
        ctx.clearRect(0,0,24,24); ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillStyle = colors[k]; ctx.fillRect(0,0,1,1);
        var c = ctx.getImageData(0,0,1,1).data;
        if (c[3] > 180 && Math.max(c[0],c[1],c[2]) - Math.min(c[0],c[1],c[2]) > 12) { rgb = c; break; }
      }
    }
    rgb = rgb || [116,132,184];
    var r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min, h = 225;
    if (d) h = (max === r ? (g-b)/d + (g < b ? 6 : 0) : max === g ? (b-r)/d + 2 : (r-g)/d + 4) * 60;
    h = Math.round(h/5)*5;
    if (h === this._themeHue) return;
    this._themeHue = h;
    function color(s,l) { return 'hsl(' + h + ',' + s + '%,' + l + '%)'; }
    this.root.style.background = 'radial-gradient(ellipse at 50% 100%, ' + color(24,21) + ', transparent 75%), linear-gradient(' + color(22,7) + ', ' + color(25,13) + ')';
    this.fill.style.background = 'linear-gradient(90deg, ' + color(38,53) + ', ' + color(48,74) + ')';
    this.fill.style.boxShadow = '0 0 12px ' + color(28,36);
    this.glow.style.background = 'radial-gradient(circle, hsla(' + h + ',40%,65%,.22), transparent 68%)';
    this.pct.style.color = color(20,78);
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
    if (this.shown >= 1 && !this._fullAt) this._fullAt = now();
    if (this.finishing && this._fullAt && now() - this._fullAt >= 220 && now() - this.started >= this.minDuration) return this.hide();
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
    clearInterval(this._themeTimer);
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
