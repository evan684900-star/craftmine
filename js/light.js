'use strict';
// Extension « Lumière réaliste » : chaque source de lumière a sa couleur (propagée avec la
// lumière des blocs, voir world.js et mesher.js), les flammes vacillent, les lampes ont un
// halo la nuit et les torches fument. Sans l'extension, la lumière reste d'un seul ton chaud.
(function () {
  const NAMED = {
    fire: [1.0, 0.64, 0.34],
    redstone: [1.0, 0.26, 0.2],
    lamp: [1.0, 0.86, 0.62],
    soul: [0.4, 0.86, 1.0],
    portal: [0.7, 0.36, 1.0],
  };
  // Palette : 0 = teinte chaude habituelle (aussi utilisée hors extension).
  const pal = [{ c: [1.0, 0.82, 0.58], f: 0 }];
  const keyOf = (c, f) => c.map((v) => Math.round(v * 40)).join(',') + (f ? 'f' : '');
  const index = new Map([[keyOf(pal[0].c, 0), 0]]);
  function palIndex(c, f) {
    const k = keyOf(c, f);
    if (index.has(k)) return index.get(k);
    if (pal.length >= 255) return 0;
    index.set(k, pal.length);
    pal.push({ c, f: f ? 1 : 0 });
    return pal.length - 1;
  }
  // Couleur d'après les pixels les plus lumineux de la texture (normalisée, un peu adoucie).
  function texColor(name) {
    const cv = name && CM.Textures.canvases[name];
    if (!cv) return null;
    const px = cv.getContext('2d').getImageData(0, 0, 16, 16).data;
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
      const ww = lum * lum * lum;
      r += px[i] * ww;
      g += px[i + 1] * ww;
      b += px[i + 2] * ww;
      w += ww;
    }
    if (!w) return null;
    const c = [r / w / 255, g / w / 255, b / w / 255];
    const m = Math.max(c[0], c[1], c[2]) || 1;
    return c.map((v) => 0.4 + 0.6 * (v / m));
  }
  const FIRE = /TORCH|FIRE|LAVA|CAMPFIRE|LANTERN|FURNACE|SMOKER|MAGMA|JACK|CANDLE|FORGE/;
  const FLICK = /TORCH|FIRE|CAMPFIRE|CANDLE|LANTERN/;
  for (const b of CM.blocks) {
    if (!b || !b.light) continue;
    const lc = b.lightColor;
    let c = null, f = !!b.flicker;
    if (Array.isArray(lc)) c = lc.map((v) => v / 255);
    else if (typeof lc === 'string' && NAMED[lc]) {
      c = NAMED[lc];
      if (lc === 'fire' && b.flicker !== false) f = true;
    } else if (/SOUL/.test(b.key)) {
      c = NAMED.soul;
      f = FLICK.test(b.key);
    } else if (b.portal) c = NAMED.portal;
    else if (FIRE.test(b.key)) {
      c = NAMED.fire;
      f = FLICK.test(b.key);
    } else c = texColor(b.tex && (b.tex.side || b.tex.top));
    b.lci = c ? palIndex(c, f) : 0;
    // halo : sources ponctuelles (torches, lanternes, lampes, néons…)
    b.halo = b.render === 'torch' ? 1.0 : /LANTERN|CANDLE/.test(b.key) ? 1.2 : b.render === 'cube' ? 1.9 : 1.4;
  }
  CM.LIGHT_PAL = pal;
  CM.lightRGB = (id) => {
    const b = CM.blocks[id];
    return b && b.lci ? pal[b.lci].c : pal[0].c;
  };

  // --------------------------------------------------------- en jeu ----
  CM.Light = {
    // Option cochée, et extension pas décochée à la création du monde (les mondes créés avant
    // l'extension l'ont aussi : elle ne change que l'affichage).
    on(g) {
      const e = g.settings && g.settings.ext;
      return g.options.realLight !== false && !(e && e.light === false);
    },
    // Couleur de la lumière des blocs à cet endroit.
    colorAt(w, x, y, z) {
      const c = w.chunkAt(x, z);
      if (!c || y < CM.WORLD.MINY || y >= CM.WORLD.H) return pal[0].c;
      const i = ((y - CM.WORLD.MINY) << 8) | ((z & 15) << 4) | (x & 15);
      if (!(c.light[i] & 15)) return pal[0].c;
      return pal[c.lcol[i]] ? pal[c.lcol[i]].c : pal[0].c;
    },
    heldColor(g) {
      // la main (principale ou secondaire) qui éclaire le plus
      const a = g.inventory.held(), b = g.inventory.offhand;
      const s = g.player.lightOf(b) > g.player.lightOf(a) ? b : a;
      if (s && s.id >= CM.ITEM_BASE && CM.itemInfo(s.id).type === 'flashlight') return [0.92, 0.97, 1.0];
      if (!s || s.id >= CM.ITEM_BASE) return pal[0].c;
      return CM.lightRGB(s.id);
    },
    // Halos (additifs) et fumée des torches autour du joueur. Renvoie les sommets des halos.
    glow(g, right, up, cam, dt) {
      const r = g.renderer, w = g.world, p = g.player;
      const out = this.buf || (this.buf = new Float32Array(9 * 4 * 600));
      let n = 0;
      const night = 1 - Math.max(0, Math.min(1, (g.daylight - 0.15) / 0.6));
      const smoke = g.options.particles !== 0;
      for (const sec of r.sections.values()) {
        const e = sec.emit;
        if (!e) continue;
        if (Math.abs(sec.cx * 16 + 8 - cam[0]) > 56 || Math.abs(sec.cz * 16 + 8 - cam[2]) > 56) continue;
        for (let i = 0; i < e.length; i += 4) {
          const x = e[i], y = e[i + 1], z = e[i + 2], id = e[i + 3];
          const b = CM.blocks[w.get(x, y, z)];
          if (!b || b.id !== id || !b.light) continue;
          const cx = x + 0.5, cy = y + (b.render === 'torch' ? 0.72 : 0.5), cz = z + 0.5;
          const dx = cx - cam[0], dy = cy - cam[1], dz = cz - cam[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > 48 * 48) continue;
          // fumée et petites flammes au-dessus des torches
          if (smoke && b.render === 'torch' && CM.LIGHT_PAL[b.lci].f && d2 < 18 * 18 && Math.random() < dt * 0.9)
            g.entities.burst(CM.Textures.layer.smoke, cx, cy + 0.1, cz, 1, { speed: 0.1, grav: -0.9, life: 1.1, size: 0.06, spread: 0.05 });
          if (n >= 600) continue;
          // le halo se voit surtout la nuit et sous terre
          const sky = w.skyAt(x, y, z) / 15;
          const vis = (1 - sky * (1 - night)) * (b.light / 15);
          if (vis < 0.05) continue;
          const [cr, cg, cb] = CM.LIGHT_PAL[b.lci || 0].c;
          const fl = CM.LIGHT_PAL[b.lci || 0].f ? 0.9 + 0.1 * Math.sin(g.clock * 11 + x * 1.7 + z) : 1;
          const s = b.halo * (0.85 + 0.15 * fl);
          const a = 0.7 * vis * fl;
          for (let k = 0; k < 4; k++) {
            const u = k === 0 || k === 3 ? -1 : 1, v = k < 2 ? -1 : 1, o = (n * 4 + k) * 9;
            out[o] = dx + (right[0] * u + up[0] * v) * s;
            out[o + 1] = dy + (right[1] * u + up[1] * v) * s;
            out[o + 2] = dz + (right[2] * u + up[2] * v) * s;
            out[o + 3] = u;
            out[o + 4] = v;
            out[o + 5] = cr;
            out[o + 6] = cg;
            out[o + 7] = cb;
            out[o + 8] = a;
          }
          n++;
        }
      }
      void p;
      return { data: out, quads: n };
    },
  };
})();
