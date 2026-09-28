'use strict';
// Biomes souterrains et marins des nouveaux mondes (générateur 7 et plus) :
// - grottes luxuriantes : mousse, argile, azalées, herbes, lianes à baies lumineuses ;
// - profondeurs sombres (sous y = 0) : sculk, capteurs et hurleurs ; les pas (sauf accroupi)
//   font hurler les hurleurs, et au quatrième avertissement le gardien aveugle sort de terre ;
// - récifs de corail plus riches : branches, gorgones, cornichons de mer lumineux.
(function () {
  const { MINY, SEA } = CM.WORLD;
  const lidx = (lx, y, lz) => ((y - MINY) << 8) | (lz << 4) | lx;
  const Wp = CM.World.prototype;
  let ROCK = null;
  const rockTable = () => {
    if (ROCK) return ROCK;
    ROCK = new Uint8Array(CM.BLOCK_COUNT);
    for (const k of ['STONE', 'DEEPSTONE', 'TUFF', 'GRANITE', 'DIORITE', 'ANDESITE', 'DRIPSTONE_BLOCK', 'CALCITE', 'DIRT', 'GRAVEL', 'SCULK', 'COBBLED_DEEPSLATE', 'SMOOTH_BASALT'])
      if (CM.B[k] !== undefined) ROCK[CM.B[k]] = 1;
    return ROCK;
  };
  Wp.lushAt = function (x, z) {
    return this.nA.noise2(x / 150 + 23, z / 150 - 41) > 0.32;
  };
  Wp.deepDarkAt = function (x, z) {
    return this.nD.noise2(x / 180 + 11, z / 180 - 7) > 0.2;
  };

  // ------------------------------------------------------- génération --
  Wp.caveBiomesFor = function (c, infos) {
    const B = CM.B, R = rockTable(), blocks = c.blocks, seed = this.seed;
    const x0 = c.x0, z0 = c.z0, h3 = CM.hash3;
    const BIO = CM.BIO;
    for (let lz = 0; lz < 16; lz++)
      for (let lx = 0; lx < 16; lx++) {
        const info = infos[(lz << 4) | lx], h = info.h, x = x0 + lx, z = z0 + lz;
        // récifs de corail : branches, gorgones et cornichons de mer
        if (info.bi === BIO.WARM_OCEAN && h < SEA - 3) {
          let y = h + 1;
          while (y < SEA - 1 && blocks[lidx(lx, y, lz)] !== B.WATER) y++;
          const top = lidx(lx, y, lz);
          if (blocks[top] === B.WATER && CM.blocks[blocks[top - 256]].solid) {
            const p = h3(x, 61, z, seed);
            if (p < 0.05) blocks[top] = B.SEA_PICKLE;
            else if (p < 0.09 && y < SEA - 3) {
              // branche de corail qui s'élève et se divise
              const k = Math.floor(h3(x, 62, z, seed) * 5), coral = B.TUBE_CORAL_BLOCK + k;
              let yy = y;
              for (let t = 0; t < 3 && yy < SEA - 2; t++, yy++) blocks[lidx(lx, yy, lz)] = coral;
              for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = lx + dx, nz = lz + dz;
                if (nx < 0 || nx > 15 || nz < 0 || nz > 15 || h3(x + dx, 63, z + dz, seed) > 0.5) continue;
                const j = lidx(nx, yy - 1, nz);
                if (blocks[j] === B.WATER) {
                  blocks[j] = coral;
                  if (blocks[j + 256] === B.WATER) blocks[j + 256] = B.TUBE_CORAL_FAN + k;
                }
              }
              if (blocks[lidx(lx, yy, lz)] === B.WATER) blocks[lidx(lx, yy, lz)] = B.TUBE_CORAL_FAN + k;
            }
          }
          continue;
        }
        const lush = this.lushAt(x, z), dark = !lush && this.deepDarkAt(x, z);
        if (!lush && !dark) continue;
        const yTop = Math.min(h - 8, lush ? 40 : -4);
        for (let y = MINY + 8; y < yTop; y++) {
          const i = lidx(lx, y, lz);
          if (blocks[i] !== 0) continue;
          const below = blocks[i - 256], above = blocks[i + 256];
          const r1 = h3(x, y, z, seed + 71), r2 = h3(x, y, z, seed + 72);
          if (lush) {
            if (R[below]) {
              blocks[i - 256] = r1 < 0.86 ? B.MOSS_BLOCK : B.CLAY;
              if (r1 < 0.86) {
                if (r2 < 0.2) blocks[i] = B.MOSS_CARPET;
                else if (r2 < 0.235) blocks[i] = r2 < 0.22 ? B.AZALEA : B.FLOWERING_AZALEA;
                else if (r2 < 0.34) blocks[i] = B.TALLGRASS;
              }
            } else if (R[above]) {
              if (r1 < 0.55) blocks[i + 256] = B.MOSS_BLOCK;
              // lianes qui pendent du plafond
              if (r2 < 0.12) {
                const len = 1 + Math.floor(h3(x, y, z, seed + 73) * 4);
                for (let k = 0; k < len && blocks[i - k * 256] === 0; k++) blocks[i - k * 256] = B.CAVE_VINES;
              }
            }
          } else if (y < 0) {
            if (R[below]) {
              if (r1 < 0.8) blocks[i - 256] = B.SCULK;
              if (r2 < 0.01) blocks[i] = B.SCULK_SHRIEKER;
              else if (r2 < 0.03 && B.SCULK_SENSOR !== undefined) blocks[i] = B.SCULK_SENSOR;
            } else if (R[above] && r1 < 0.35) blocks[i + 256] = B.SCULK;
          }
        }
      }
  };

  // ============================================= profondeurs sombres ===
  const C = (CM.Caves = { t: 0, cd: new Map(), warn: new Map(), last: new WeakMap() });
  const pidOf = (g, q) => (q === g.player ? 'local' : q.pid);
  // Effet d'obscurité sur un joueur (celui de cet écran ou un invité).
  C.darken = function (g, q, secs) {
    if (q === g.player) CM.Effects.add(q, 'darkness', secs, 1);
    else if (q.pid !== undefined) g.net.sendTo(q.pid, { t: 'act', a: { a: 'eff', k: 'darkness', t: secs, l: 1 } });
  };
  C.fx = function (g, m) {
    C.onFx(g, m);
    g.net.fx(m);
  };
  C.onFx = function (g, m) {
    const e = g.entities, L = CM.Textures.layer, p = g.player;
    const d = Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z);
    if (m.k === 'shriek') {
      for (let k = 0; k < 3; k++) e.burst(L.mob_warden_glow || L.white, m.x + 0.5, m.y + 1 + k * 0.5, m.z + 0.5, 10, { speed: 1.5 + k, grav: -1, life: 1, size: 0.07, emissive: true });
      if (d < 48) CM.Audio.play('shriek', { vol: Math.max(0.2, 1 - d / 48) });
    } else if (m.k === 'sonic' && Array.isArray(m.t)) {
      const tx = m.t[0], ty = m.t[1], tz = m.t[2], n = Math.ceil(Math.hypot(tx - m.x, ty - m.y, tz - m.z) / 0.7);
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        e.burst(L.mob_warden_glow || L.white, m.x + (tx - m.x) * f, m.y + (ty - m.y) * f, m.z + (tz - m.z) * f, 3, { speed: 0.8, grav: 0, life: 0.5, size: 0.1, emissive: true });
      }
      if (d < 40) CM.Audio.play('sonic');
    } else if (m.k === 'emerge') {
      e.burst(L.sculk || L.smoke, m.x, m.y + 0.2, m.z, 30, { speed: 3, grav: 8, life: 1, size: 0.12 });
      if (d < 40) CM.Audio.play('warden', { pitch: 0.6 });
    }
  };
  // Onde sonique du gardien : elle traverse les murs et ignore l'armure.
  C.sonic = function (g, m, q) {
    const d = Math.hypot(q.x - m.x, q.y - m.y, q.z - m.z);
    C.fx(g, { k: 'sonic', x: m.x, y: m.y + 2, z: m.z, t: [q.x, q.y + 1, q.z] });
    if (d > 20 || q.alive === false) return;
    const cause = 'L’onde sonique du gardien aveugle';
    if (q === g.player) {
      q.damage(10, m.x, m.z, cause, true, m);
      if (q.alive) q.vy = Math.max(q.vy, 7);
    } else q.damage(10, m.x, m.z, cause, true, 7, m);
  };

  // Hôte : les pas font hurler les hurleurs ; au 4e avertissement, le gardien sort de terre.
  C.tick = function (g, dt) {
    const w = g.world;
    if (!w.caveBiomes || w.nether) return;
    C.t -= dt;
    if (C.t > 0) return;
    const step = 0.4 - C.t;
    C.t = 0.4;
    // les avertissements s'oublient (1 toutes les 10 minutes)
    for (const [k, v] of C.warn) {
      if (g.clock - v.t < 600) continue;
      v.lv--;
      v.t = g.clock;
      if (v.lv <= 0) C.warn.delete(k);
    }
    const B = CM.B;
    for (const q of g.entities.plist) {
      if (q.alive === false) continue;
      const prev = C.last.get(q);
      C.last.set(q, [q.x, q.y, q.z]);
      if (!prev || q.y > 2 || !w.deepDarkAt(q.x, q.z)) continue;
      const sp = Math.hypot(q.x - prev[0], q.z - prev[2]) / step;
      const sneak = q === g.player ? q.sneaking : !!(q.flags & 1);
      if (sp < 1.2 || sneak || (q === g.player && q.flying)) continue;
      // un hurleur à 8 blocs ?
      const X = Math.floor(q.x), Y = Math.floor(q.y), Z = Math.floor(q.z);
      let hit = null;
      for (let dy = -4; dy <= 4 && !hit; dy++)
        for (let dz = -8; dz <= 8 && !hit; dz++)
          for (let dx = -8; dx <= 8; dx++) {
            if (w.get(X + dx, Y + dy, Z + dz) !== B.SCULK_SHRIEKER) continue;
            const k = X + dx + ',' + (Y + dy) + ',' + (Z + dz);
            if ((C.cd.get(k) || 0) > g.clock) continue;
            hit = [X + dx, Y + dy, Z + dz, k];
            break;
          }
      if (hit) C.shriek(g, hit, q);
    }
  };
  C.shriek = function (g, s, q) {
    const [x, y, z, k] = s, w = g.world, e = g.entities;
    C.cd.set(k, g.clock + 10);
    if (C.cd.size > 200) for (const [kk, t] of C.cd) if (t < g.clock) C.cd.delete(kk);
    C.fx(g, { k: 'shriek', x, y, z });
    for (const o of e.plist) if (o.alive !== false && Math.hypot(o.x - x, o.y - y, o.z - z) < 40) C.darken(g, o, 12);
    const id = pidOf(g, q), lv = Math.min(4, ((C.warn.get(id) || {}).lv || 0) + 1);
    C.warn.set(id, { lv, t: g.clock });
    const warden = e.mobs.find((m) => m.type === 'warden' && !m.dead && Math.hypot(m.x - x, m.z - z) < 48);
    if (warden) {
      warden.ai.ang.set(q, Math.min(150, (warden.ai.ang.get(q) || 0) + 40));
      warden.ai.go = [q.x, q.z];
      return;
    }
    const msg = ['', '🔊 Un hurleur de sculk hurle… quelque chose t’a entendu.', '🔊 Les hurlements se rapprochent…', '🔊 Il arrive…', ''][lv];
    if (msg) {
      if (q === g.player) g.ui.toast(msg, 'warn', 'shriek');
      else if (q.pid !== undefined) g.net.sendTo(q.pid, { t: 'rtoast', s: msg, k: 'warn' });
    }
    if (lv < 4) return;
    // le gardien aveugle sort de terre près du hurleur (ou près du joueur, s'il n'y a pas la place)
    for (let t = 0; t < 40; t++) {
      const cx = t < 20 ? x : Math.floor(q.x), cy = t < 20 ? y : Math.floor(q.y), cz = t < 20 ? z : Math.floor(q.z);
      const X = cx + Math.floor((Math.random() - 0.5) * 12), Z = cz + Math.floor((Math.random() - 0.5) * 12);
      for (let Y = cy + 4; Y > cy - 6; Y--) {
        if (!w.solidAt(X, Y - 1, Z) || w.solidAt(X, Y, Z) || w.solidAt(X, Y + 1, Z) || w.solidAt(X, Y + 2, Z)) continue;
        C.warn.set(id, { lv: 2, t: g.clock });
        const m = e.addMob('warden', X + 0.5, Y, Z + 0.5);
        m.ai.ang.set(q, 45);
        m.ai.go = [q.x, q.z];
        C.fx(g, { k: 'emerge', x: X + 0.5, y: Y, z: Z + 0.5 });
        const s2 = '⚠ Le gardien aveugle sort de terre ! Il est aveugle : accroupis-toi et éloigne-toi sans bruit…';
        if (q === g.player) g.ui.toast(s2, 'warn', 'shriek');
        else if (q.pid !== undefined) g.net.sendTo(q.pid, { t: 'rtoast', s: s2, k: 'warn' });
        return;
      }
    }
  };

  // Obscurité : le brouillard noir se referme par vagues.
  C.env = function (g, env) {
    const p = g.player;
    if (!CM.Effects.lv(p, 'darkness')) return;
    const left = p.effects.darkness.t, fade = Math.min(1, left / 2);
    const pulse = 0.5 + 0.5 * Math.sin(g.clock * 2.4);
    const far = 7 + 9 * pulse + (1 - fade) * 60;
    env.fog = [Math.min(env.fog[0], 1), Math.min(env.fog[1], far)];
    env.fogColor = env.fogColor.map((v) => v * (1 - fade) + 0.004 * fade);
    env.flatSky = env.fogColor;
  };
})();
