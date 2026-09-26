'use strict';
// Météo : beau temps, pluie (neige dans les biomes froids) et orage avec éclairs. Réglée par la
// commande /météo ; l'hôte (ou la partie solo) décide, les invités reçoivent la météo et les éclairs.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  M.textures.push(function (X) {
    X.make('weather_rain', (d) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) X.put(d, x, y, [120 + y * 4, 145 + y * 4, 200 + y * 3]);
    });
    X.make('weather_bolt', (d) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) X.put(d, x, y, [236, 240, 255]);
    });
  });

  const NAMES = { clear: 'Beau temps', rain: 'Pluie', thunder: 'Orage' };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hash = (x, z, s) => CM.hash3(x, s, z, 911);
  let COLD = null;

  const W = (CM.Weather = {
    NAMES,
    state(g) {
      if (!g.weather || !NAMES[g.weather.type]) g.weather = { type: 'clear', t: 0 };
      return g.weather;
    },
    // Change la météo (dur : secondes ; 0 = jusqu'au prochain changement).
    set(g, type, dur) {
      const s = W.state(g);
      s.type = NAMES[type] ? type : 'clear';
      s.t = Math.max(0, dur || 0);
      if (g.net && g.net.isHost) g.net.broadcast({ t: 'wx', w: s.type, d: Math.round(s.t) });
    },
    // Neige plutôt que pluie ?
    cold(g, x, z) {
      if (!COLD) COLD = new Set([CM.BIO.SNOWY_TAIGA, CM.BIO.TUNDRA, CM.BIO.ICE_SPIKES]);
      return COLD.has(g.world.column(Math.floor(x), Math.floor(z)).bi);
    },
    // À ciel ouvert (rien au-dessus) ?
    exposed(g, x, y, z) {
      return g.world.skyAt(Math.floor(x), Math.floor(y), Math.floor(z)) >= 15;
    },
    update(g, dt) {
      const s = W.state(g), net = g.net;
      const wet = !g.world.nether && s.type !== 'clear';
      g.wLevel = (g.wLevel || 0) + ((wet ? 1 : 0) - (g.wLevel || 0)) * Math.min(1, dt * 0.9);
      g.wDark = (g.wDark || 0) + ((s.type === 'thunder' ? 1 : s.type === 'rain' ? 0.6 : g.wDark || 0) - (g.wDark || 0)) * Math.min(1, dt);
      g.flash = Math.max(0, (g.flash || 0) - dt * 2.5);
      if (g.bolts) g.bolts = g.bolts.filter((b) => (b.t -= dt) > 0);
      if (!net.isClient) {
        if (s.t > 0) {
          s.t -= dt;
          if (s.t <= 0) W.set(g, 'clear');
        }
        // orage : un éclair de temps en temps près d'un joueur
        if (s.type === 'thunder' && !g.world.nether) {
          g.boltT = (g.boltT === undefined ? 6 : g.boltT) - dt;
          if (g.boltT <= 0) {
            g.boltT = 4 + Math.random() * 12;
            const pls = net.simPlayers().filter((q) => q.alive !== false);
            const q = pls[Math.floor(Math.random() * pls.length)];
            if (q) {
              const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 40;
              W.strike(g, q.x + Math.cos(a) * r, q.z + Math.sin(a) * r);
            }
          }
        }
      }
      // la pluie éteint un joueur en feu à ciel ouvert
      const p = g.player;
      if (g.wLevel > 0.5 && p && p.burning > 0 && W.exposed(g, p.x, p.y + 1, p.z) && !W.cold(g, p.x, p.z)) p.burning = 0;
    },
    // Éclair (hôte ou solo) : tombe sur le sol, blesse et enflamme autour, allume un feu.
    strike(g, x, z, opts) {
      const w = g.world, bx = Math.floor(x), bz = Math.floor(z);
      if (!w.loaded(bx, bz)) return false;
      const y = w.groundBelow(bx, CM.WORLD.H - 1, bz) + 1;
      if (y <= CM.WORLD.MINY) return false;
      W.boltFx(g, bx + 0.5, y, bz + 0.5);
      if (g.net) g.net.fx({ k: 'bolt', x: bx + 0.5, y, z: bz + 0.5 });
      if (g.options.fireSpread !== false || (opts && opts.fire)) {
        const here = w.get(bx, y, bz);
        if ((here === 0 || CM.blocks[here].replaceable) && CM.blocks[w.get(bx, y - 1, bz)].solid) w.setBlock(bx, y, bz, CM.B.FIRE);
      }
      const R = 3.5, dmg = (opts && opts.dmg) || 5;
      for (const m of g.entities.mobs) {
        if (m.dead || Math.hypot(m.x - x, m.z - z) > R || Math.abs(m.y - y) > 5) continue;
        g.entities.hurtMob(m, dmg, null);
        m.fire = Math.max(m.fire || 0, 5);
      }
      for (const q of g.net.simPlayers()) {
        if (q.alive === false || Math.hypot(q.x - x, q.z - z) > R || Math.abs(q.y - y) > 5) continue;
        q.damage(dmg, x, z, 'La foudre');
        if (q === g.player) g.player.burning = Math.max(g.player.burning || 0, 4);
      }
      return true;
    },
    // Effet d'un éclair : zigzag lumineux, flash du ciel, tonnerre.
    boltFx(g, x, y, z) {
      const pts = [[x, y, z]];
      let cx = x, cz = z;
      for (let h = y + 3; h < y + 90; h += 3 + Math.random() * 4) {
        cx += (Math.random() - 0.5) * 1.6;
        cz += (Math.random() - 0.5) * 1.6;
        pts.push([cx, h, cz]);
      }
      (g.bolts || (g.bolts = [])).push({ pts, t: 0.45 });
      const p = g.player, d = p ? Math.hypot(p.x - x, p.z - z) : 0;
      g.flash = Math.max(g.flash || 0, d < 80 ? 0.9 : 0.4);
      if (p) setTimeout(() => CM.Audio.play('thunder', { pitch: d < 30 ? 1 : 0.7 }), Math.min(2500, d * 8));
      if (g.entities && d < 96) g.entities.burst(CM.Textures.layer.white, x, y + 0.2, z, 16, { speed: 4, grav: 3, life: 0.5, size: 0.08, emissive: true });
    },
    // Ciel plus sombre et plus gris, brume plus proche ; flash des éclairs.
    env(g, env) {
      const k = g.world.nether ? 0 : g.wLevel || 0;
      env.rain = k;
      if (k > 0.001 && !env.underwater && !env.flatSky) {
        const dark = 0.3 + 0.3 * (g.wDark || 0);
        const gray = [0.36, 0.38, 0.42].map((v) => v * (1 - 0.35 * (g.wDark || 0)) * (0.12 + 0.88 * (g.daylight || 0)));
        env.zenith = mix(env.zenith, gray, k * 0.95);
        env.horizon = mix(env.horizon, gray.map((v) => v * 1.12), k * 0.9);
        env.fogColor = mix(env.fogColor, gray, k * 0.8);
        env.day *= 1 - dark * k;
        env.sunset *= 1 - k;
        env.fog = [env.fog[0] * (1 - 0.55 * k), env.fog[1] * (1 - 0.3 * k)];
      }
      const f = g.flash || 0;
      if (f > 0.01 && !g.world.nether) {
        env.day = Math.min(1.2, env.day + f * 0.9);
        env.zenith = mix(env.zenith, [0.85, 0.88, 1], f * 0.7);
        env.horizon = mix(env.horizon, [0.85, 0.88, 1], f * 0.6);
      }
    },
    // Gouttes (ou flocons) autour de la caméra, arrêtées par ce qui les couvre ; éclairs.
    render(g, batch, cam) {
      const k = g.world.nether ? 0 : g.wLevel || 0;
      const L = CM.Textures.layer;
      if (k > 0.03) {
        const w = g.world, cx = Math.floor(cam[0]), cz = Math.floor(cam[2]), cy = cam[1], t = g.clock;
        // hauteur de ce qui arrête la pluie, par colonne (recalculée quatre fois par seconde)
        if (!g.wxTops || g.clock - g.wxTopsT > 0.25 || Math.abs(g.wxTopsY - cy) > 4) {
          g.wxTops = new Map();
          g.wxTopsT = g.clock;
          g.wxTopsY = cy;
        }
        const tops = g.wxTops, yHi = Math.floor(cy) + 16, yLo = Math.floor(cy) - 16;
        const topAt = (x, z) => {
          const key = x * 65536 + z;
          let v = tops.get(key);
          if (v === undefined) {
            v = yLo;
            if (!w.loaded(x, z)) v = yHi;
            else
              for (let y = yHi; y > yLo; y--) {
                const b = CM.blocks[w.get(x, y, z)];
                if (b.solid || b.fluid || b.render === 'leaves' || /LEAVES/.test(b.key)) {
                  v = y + 1;
                  break;
                }
              }
            tops.set(key, v);
          }
          return v;
        };
        const R = 11, snowHere = W.cold(g, cam[0], cam[2]);
        for (let dz = -R; dz <= R; dz++)
          for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dz * dz > R * R) continue;
            const x = cx + dx, z = cz + dz, h = hash(x, z, 1);
            if (h > k * 0.8) continue;
            const y0 = Math.max(topAt(x, z), cy - 10), y1 = cy + 14;
            if (y1 <= y0) continue;
            const snow = snowHere;
            const speed = snow ? 2.2 : 17, len = snow ? 0.1 : 1.1, half = snow ? 0.05 : 0.028;
            for (let j = 0; j < 3; j++) {
              const ph = hash(x, z, 2 + j * 7) * 30;
              const y = y1 - ((t * speed + ph) % 30);
              if (y < y0 || y + len > y1) continue;
              let px = x + hash(x, z, 5 + j), pz = z + hash(x, z, 8 + j);
              if (snow) {
                px += Math.sin(t * 1.3 + ph) * 0.3;
                pz += Math.cos(t * 1.1 + ph) * 0.3;
              }
              let rx = -(pz - cam[2]), rz = px - cam[0];
              const rl = Math.hypot(rx, rz) || 1;
              rx = (rx / rl) * half;
              rz = (rz / rl) * half;
              batch.quad(
                [[px - rx, y, pz - rz], [px + rx, y, pz + rz], [px + rx, y + len, pz + rz], [px - rx, y + len, pz - rz]],
                [[0, 1], [1, 1], [1, 0], [0, 0]],
                snow ? L.white : L.weather_rain, 1, 0, 1, 0,
              );
            }
          }
      }
      // éclairs : zigzag vu de face
      for (const b of g.bolts || []) {
        const pts = b.pts;
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i], c = pts[i + 1];
          const mx = (a[0] + c[0]) / 2, mz = (a[2] + c[2]) / 2;
          let rx = -(mz - cam[2]), rz = mx - cam[0];
          const rl = Math.hypot(rx, rz) || 1, wd = i < 3 ? 0.14 : 0.09;
          rx = (rx / rl) * wd;
          rz = (rz / rl) * wd;
          batch.quad(
            [[a[0] - rx, a[1], a[2] - rz], [a[0] + rx, a[1], a[2] + rz], [c[0] + rx, c[1], c[2] + rz], [c[0] - rx, c[1], c[2] - rz]],
            [[0, 1], [1, 1], [1, 0], [0, 0]],
            L.weather_bolt, 1, 0, 1, 1, // (émissif : toujours éclatant)
          );
        }
      }
    },
  });
})();
