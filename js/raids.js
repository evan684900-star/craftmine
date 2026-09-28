'use strict';
// Villageois qui progressent, patrouilles et raids de pillards, boss (Géant des Ombres une nuit
// sur dix, gardien du Nether dans les forteresses), totem d'immortalité, barres de vie des boss.
// L'hôte (ou la partie solo) simule tout ; les invités reçoivent les annonces et les barres.
// - Tuer le capitaine d'une patrouille (il porte une bannière) donne « Mauvais présage » ;
//   entrer dans un village avec cet effet déclenche un raid : 3 à 5 vagues selon la difficulté.
// - Raid repoussé : « Héros du village » (prix réduits chez les villageois), totem et émeraudes.
(function () {
  const E = CM.Entities.prototype, mat4 = CM.mat4;
  const TAU = Math.PI * 2;
  const MOBS = () => CM.MOBS;
  const clean = (s) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 200);

  // ================================================== villageois ======
  CM.Villagers = {
    // Échanges faits avec un villageois (hôte) : il gagne de l'expérience et des niveaux.
    gain(g, m, n) {
      if (m.dead) return;
      if (m.profIdx === undefined) m.profIdx = Math.floor(CM.hash3(m.uid, 5, 7, 0) * CM.PROF_COUNT);
      const lv0 = m.vlv || 1;
      m.vxp = Math.min(1023, (m.vxp || 0) + n);
      m.vlv = CM.villagerLevel(m.vxp);
      if (m.vid) (g.vilXp = g.vilXp || {})[m.vid] = m.vxp;
      if (m.vlv > lv0) {
        m.prof = null;
        if (m.vlv >= 5) g.stats.vmaster = (g.stats.vmaster || 0) + 1;
        const fx = { k: 'lvup', x: m.x, y: m.y, z: m.z, id: m.uid, lv: m.vlv };
        R.onFx(g, fx);
        g.net.fx(fx);
      }
      const ui = g.ui;
      if (ui.trade && ui.tradeMob === m) ui.renderTrade();
    },
  };

  const R = (CM.Raids = {
    raid: null, // raid en cours (hôte)
    remote: null, // barre du raid reçue de l'hôte (invité)
    omens: new Map(), // invités qui ont « Mauvais présage » (numéro → fin)
    acc: {},
    patrolT: 90,
    barT: 0,
    hudT: 0,
    hudKey: '',
  });

  // ---------------------------------------------------- annonces --
  R.announce = function (g, s, kind, snd) {
    g.ui.toast(s, kind || 'warn', 'raid');
    g.net.sys(s);
    if (snd) CM.Audio.play(snd);
    if (g.net.isHost) g.net.broadcast({ t: 'rtoast', s, k: kind || 'warn' });
  };
  // Effets visuels (joués aussi chez les invités proches).
  R.onFx = function (g, m) {
    const e = g.entities, L = CM.Textures.layer;
    if (m.k === 'slam') {
      e.burst(L.ombre_face || L.white, m.x, m.y + 0.3, m.z, 40, { speed: 7, grav: 2, life: 0.8, size: 0.14, emissive: true });
      e.burst(L.smoke, m.x, m.y + 0.4, m.z, 20, { speed: 4, grav: -0.5, life: 1, size: 0.3 });
      CM.Audio.play('explode', { pitch: 0.55 });
    } else if (m.k === 'lvup') {
      e.burst(L.emerald || L.white, m.x, m.y + 1.6, m.z, 16, { speed: 1.5, grav: -1, life: 1.2, size: 0.08, emissive: true, full: true });
      CM.Audio.play('vlevel');
      const ui = g.ui;
      if (ui.tradeMob && ui.tradeMob.uid === m.id && ui.trade) {
        ui.toast('⭐ Le villageois passe « ' + CM.VILLAGER_LEVELS[Math.max(0, Math.min(4, (m.lv | 0) - 1))] + ' » : nouveaux échanges !', 'good', 'vlv');
      }
    } else if (m.k === 'totem') {
      // gerbe dorée et verte autour du joueur sauvé (et le totem qui surgit à l'écran)
      const p = g.player, me = Math.hypot(p.x - m.x, p.z - m.z) < 0.6 && Math.abs(p.y - m.y) < 1.2;
      const cols = [L.gold_block, L.emerald_block || L.emerald, L.white].filter(Boolean), rr = me ? 1.3 : 0.5;
      for (let i = 0; i < 48; i++) {
        const a = Math.random() * TAU;
        e.burst(cols[i % cols.length], m.x + Math.cos(a) * rr, m.y + 0.3 + Math.random() * 1.6, m.z + Math.sin(a) * rr, 1, { speed: 2.5, grav: 1.2, life: 1.3, size: 0.045, emissive: true });
      }
      CM.Audio.play('totem');
      if (me) R.totemPop();
    }
  };
  R.slamFx = (g, x, y, z) => R.onFx(g, { k: 'slam', x, y, z });
  // Le totem surgit au milieu de l'écran puis s'efface.
  R.totemPop = function () {
    const hud = document.getElementById('hud');
    if (!hud || CM.I.TOTEM === undefined) return;
    const d = document.createElement('div');
    d.className = 'totem-pop';
    d.style.backgroundImage = 'url(' + CM.Textures.icons[CM.I.TOTEM] + ')';
    hud.appendChild(d);
    setTimeout(() => d.remove(), 1700);
  };

  // ------------------------------------------------------ totem --
  // Le joueur de cet écran va mourir : un totem en main (ou en main secondaire) le sauve.
  R.useTotem = function (p, cause) {
    const g = p.game, inv = g.inventory, T = CM.I.TOTEM;
    if (cause === 'Le vide' || T === undefined) return false;
    const h = inv.held();
    let s = null;
    if (h && h.id === T) s = 'main';
    else if (inv.offhand && inv.offhand.id === T) s = 'off';
    if (!s) return false;
    if (s === 'main') inv.slots[inv.selected] = h.count > 1 ? Object.assign({}, h, { count: h.count - 1 }) : null;
    else inv.offhand = inv.offhand.count > 1 ? Object.assign({}, inv.offhand, { count: inv.offhand.count - 1 }) : null;
    inv.changed();
    p.health = 2;
    CM.Effects.clear(p);
    CM.Effects.add(p, 'regeneration', 45, 2);
    CM.Effects.add(p, 'fire_resistance', 40, 1);
    CM.Effects.add(p, 'resistance', 5, 2);
    p.invul = 1;
    g.stats.totems = (g.stats.totems || 0) + 1;
    const fx = { k: 'totem', x: p.x, y: p.y, z: p.z };
    R.onFx(g, fx);
    g.net.fx(fx);
    g.ui.toast('🗿 Le totem d’immortalité t’a sauvé !', 'good', 'totem');
    return true;
  };

  // ---------------------------------------------- projectiles des boss --
  // 'orb' : orbe d'ombre (Géant) ; 'fireball' : boule de feu (gardien du Nether).
  const upd0 = E.updateSpecialArrow, ren0 = E.renderSpecialArrow;
  E.updateSpecialArrow = function (a, dt) {
    if (a.kind !== 'orb' && a.kind !== 'fireball') return upd0.call(this, a, dt);
    const g = this.game, w = g.world, L = CM.Textures.layer, orb = a.kind === 'orb';
    if (a.age > 6) {
      a.dead = true;
      return true;
    }
    const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt, nz = a.z + a.vz * dt;
    // un joueur touché
    for (const q of this.plist) {
      if (q.alive === false || q === a.shooter) continue;
      if (Math.abs(q.x - nx) < 0.7 && ny > q.y - 0.3 && ny < q.y + 2 && Math.abs(q.z - nz) < 0.7) {
        const cause = orb ? 'Un orbe d’ombre' : 'Une boule de feu';
        const sh = a.shooter && a.shooter.type ? a.shooter : null;
        if (q === g.player) {
          q.damage(orb ? 6 : 5, a.x, a.z, cause, false, sh);
          if (orb) CM.Effects.add(q, 'slowness', 4, 1);
          else if (!CM.Effects.lv(q, 'fire_resistance')) q.burning = Math.max(q.burning || 0, 4);
        } else {
          q.damage(orb ? 6 : 5, a.x, a.z, cause, false, 0, sh);
          if (q.pid !== undefined) g.net.sendTo(q.pid, { t: 'act', a: orb ? { a: 'eff', k: 'slowness', t: 4, l: 1 } : { a: 'fire', t: 4 } });
        }
        a.dead = true;
        break;
      }
    }
    if (!a.dead && w.solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
      a.dead = true;
      // boule de feu : un peu de feu là où elle s'écrase (si le feu se propage)
      if (!orb && Math.random() < 0.5 && (!CM.gameRule || CM.gameRule(g, 'fireSpread'))) {
        const fx = Math.floor(a.x), fy = Math.floor(a.y), fz = Math.floor(a.z);
        if (!w.get(fx, fy, fz) && w.solidAt(fx, fy - 1, fz)) w.setBlock(fx, fy, fz, CM.B.FIRE);
      }
    }
    if (a.dead) {
      this.burst(orb ? L.shadow_orb || L.white : L.fireball || L.flame, a.x, a.y, a.z, 14, { speed: 3, grav: 1, life: 0.6, size: 0.1, emissive: true });
      if (Math.hypot(g.player.x - a.x, g.player.z - a.z) < 32) CM.Audio.play(orb ? 'shadow_hurt' : 'burn');
      return true;
    }
    a.x = nx;
    a.y = ny;
    a.z = nz;
    if (Math.random() < dt * 30) this.burst(orb ? L.shadow_orb || L.white : L.flame, a.x, a.y, a.z, 1, { speed: 0.3, grav: -0.5, life: 0.5, size: 0.08, emissive: true });
    return true;
  };
  E.renderSpecialArrow = function (batch, a, l) {
    if (a.kind !== 'orb' && a.kind !== 'fireball') return ren0.call(this, batch, a, l);
    const L = CM.Textures.layer, t = (a.age || 0) + a.uid;
    mat4.compose(this.M, a.x, a.y, a.z, t * 5, t * 3, 0, 1);
    const s = a.kind === 'orb' ? 0.22 : 0.2;
    batch.box(this.M, -s, -s, -s, s, s, s, a.kind === 'orb' ? L.shadow_orb : L.fireball, 1, 1, 1);
    return true;
  };
  // (invité : l'âge sert à faire tourner l'orbe)
  const remote0 = E.updateExtraRemote;
  if (remote0)
    E.updateExtraRemote = function (dt) {
      remote0.call(this, dt);
      for (const a of this.arrows || []) if (a.kind === 'orb' || a.kind === 'fireball') a.age = (a.age || 0) + dt;
    };

  // ---------------------------------------------------- utilitaires --
  const alivePlayers = (g) => g.entities.plist.filter((q) => q.alive !== false);
  // Case libre au sol près de (x, z) dans un rayon [r0, r1] ; null si rien trouvé.
  function groundSpot(w, x, z, r0, r1, tries, sky) {
    for (let t = 0; t < (tries || 12); t++) {
      const a = Math.random() * TAU, d = r0 + Math.random() * (r1 - r0);
      const X = Math.floor(x + Math.cos(a) * d), Z = Math.floor(z + Math.sin(a) * d);
      if (!w.loaded(X, Z)) continue;
      const Y = w.groundBelow(X, CM.WORLD.H - 1, Z) + 1;
      if (Y <= CM.WORLD.MINY + 1 || w.solidAt(X, Y, Z) || w.solidAt(X, Y + 1, Z) || CM.isFluid(w.get(X, Y, Z)) || CM.isFluid(w.get(X, Y - 1, Z))) continue;
      if (sky && w.skyAt(X, Y + 1, Z) < 12) continue;
      return [X + 0.5, Y, Z + 0.5];
    }
    return null;
  }
  const spawnRules = (g) => g.difficulty !== 'peaceful' && (!CM.gameRule || CM.gameRule(g, 'mobSpawn'));
  // Mauvais présage : le joueur de cet écran (effet) ou un invité (suivi par l'hôte).
  const hasOmen = (g, q) => (q === g.player ? CM.Effects.lv(q, 'bad_omen') > 0 : q.pid !== undefined && (R.omens.get(q.pid) || 0) > g.clock);
  function clearOmen(g, q) {
    if (q === g.player) {
      if (q.effects && q.effects.bad_omen) {
        delete q.effects.bad_omen;
        g.ui.effDirty = true;
      }
    } else if (q.pid !== undefined) {
      R.omens.delete(q.pid);
      g.net.sendTo(q.pid, { t: 'act', a: { a: 'effrm', k: 'bad_omen' } });
    }
  }

  // ========================================================= tick ======
  // Hôte / solo, pour la dimension en cours de simulation.
  R.tick = function (g, dt) {
    const dim = g.dim;
    R.acc[dim] = (R.acc[dim] || 0) + dt;
    if (R.acc[dim] < 0.25) return;
    const step = R.acc[dim];
    R.acc[dim] = 0;
    if (g.world.nether) return R.netherTick(g, step);
    if (dim !== 'overworld') return;
    R.giantTick(g, step);
    R.patrolTick(g, step);
    R.raidTick(g, step);
  };

  // ------------------------------------------ Géant des Ombres --
  // Une nuit sur dix (jours 10, 20, 30…), un géant surgit près d'un joueur.
  R.giantTick = function (g) {
    if (g.daylight > 0.3 || (g.dayCount + 1) % 10 !== 0 || g.giantDay === g.dayCount || !spawnRules(g)) return;
    const pls = alivePlayers(g);
    if (!pls.length) return;
    const q = pls[Math.floor(Math.random() * pls.length)];
    const spot = groundSpot(g.world, q.x, q.z, 18, 28, 20, true);
    if (!spot) return;
    g.giantDay = g.dayCount;
    const m = g.entities.addMob('shadow_giant', spot[0], spot[1], spot[2]);
    m.ai.orbCd = 5;
    R.announce(g, '🌑 Nuit des Ombres : un Géant des Ombres approche !', 'warn', 'horn');
  };

  // ---------------------------------------------------- patrouilles --
  // De temps en temps (à partir du 3e jour), 2 à 4 pillards menés par un capitaine.
  R.patrolTick = function (g, step) {
    R.patrolT -= step;
    if (R.patrolT > 0) return;
    R.patrolT = 60 + Math.random() * 60;
    if (!spawnRules(g) || g.dayCount < 2 || R.raid || Math.random() > 0.2) return;
    const pls = alivePlayers(g);
    if (!pls.length) return;
    const q = pls[Math.floor(Math.random() * pls.length)];
    if (!g.world.villageNear(q.x, q.z, 24)) R.spawnPatrol(g, q); // (pas au milieu d'un village)
  };
  R.spawnPatrol = function (g, q) {
    const w = g.world, out = [];
    const spot = groundSpot(w, q.x, q.z, 30, 44, 16, true);
    if (!spot) return out;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const X = spot[0] + (Math.random() - 0.5) * 4, Z = spot[2] + (Math.random() - 0.5) * 4;
      if (!w.loaded(X, Z)) continue;
      const Y = w.groundBelow(Math.floor(X), spot[1] + 3, Math.floor(Z)) + 1;
      const m = g.entities.addMob(i === n - 1 && Math.random() < 0.35 ? 'vindicator' : 'pillager', X, Y, Z);
      if (!out.length) R.makeCaptain(m);
      out.push(m);
    }
    return out;
  };
  R.makeCaptain = function (m) {
    if (m.type !== 'pillager') return;
    m.captain = true;
    m.variant = 1;
    m.hp = m.maxHp = 32;
  };

  // ----------------------------------------------------------- raids --
  R.busy = (g, v) => !!(R.raid && R.raid.x === v.x && R.raid.z === v.z);
  R.center = () => (R.raid ? [R.raid.x, R.raid.z] : null);
  R.start = function (g, v, q) {
    const waves = g.difficulty === 'hard' ? 5 : g.difficulty === 'easy' ? 3 : 4;
    R.raid = { x: v.x, z: v.z, y: v.y, r: v.r, wave: 0, waves, state: 'pause', pause: 6, mobs: [], hp0: 1, t: 0, away: 0 };
    if (q) clearOmen(g, q);
    R.announce(g, '⚔ Un raid de pillards attaque le village ! (' + waves + ' vagues)', 'warn', 'horn');
    R.sendBar(g);
  };
  R.stop = function (g) {
    if (!R.raid) return false;
    for (const m of R.raid.mobs) if (!m.dead) m.dead = true;
    R.raid = null;
    R.sendBar(g);
    return true;
  };
  // Une vague : pillards, vindicateurs, puis ravageur et sorcière dans les dernières.
  R.spawnWave = function (g) {
    const rd = R.raid, w = g.world, e = g.entities, k = ++rd.wave;
    const hard = g.difficulty === 'hard' ? 1 : 0;
    const list = [];
    for (let i = 0; i < 2 + Math.floor(k / 2) + hard; i++) list.push('pillager');
    for (let i = 0; i < (k >= 2 ? Math.floor(k / 2) + (k >= 4 ? 1 : 0) : 0); i++) list.push('vindicator');
    if (k === rd.waves || (hard && k >= 3)) list.push('ravager');
    if (k >= 3 && MOBS().witch) list.push('witch');
    let spot = groundSpot(w, rd.x, rd.z, rd.r + 18, rd.r + 28, 24);
    if (!spot) {
      const q = alivePlayers(g)[0];
      spot = q ? groundSpot(w, q.x, q.z, 14, 24, 24) : null;
    }
    if (!spot) {
      rd.wave--;
      rd.pause = 2;
      return;
    }
    rd.mobs = [];
    for (const type of list) {
      const X = spot[0] + (Math.random() - 0.5) * 5, Z = spot[2] + (Math.random() - 0.5) * 5;
      const Y = w.loaded(X, Z) ? w.groundBelow(Math.floor(X), spot[1] + 4, Math.floor(Z)) + 1 : spot[1];
      const m = e.addMob(type, X, Y, Z);
      m.raid = true;
      rd.mobs.push(m);
    }
    rd.hp0 = rd.mobs.reduce((s, m) => s + m.maxHp, 0) || 1;
    rd.state = 'fight';
    rd.t = 0;
    R.announce(g, '🏴 Vague ' + k + ' / ' + rd.waves + ' : ' + rd.mobs.length + ' assaillants !', 'warn', k === 1 ? null : 'horn');
  };
  R.raidTick = function (g, step) {
    const w = g.world, e = g.entities;
    // un joueur avec « Mauvais présage » entre dans un village : raid !
    if (!R.raid && spawnRules(g)) {
      for (const q of alivePlayers(g)) {
        if (!hasOmen(g, q)) continue;
        const v = w.villageNear(q.x, q.z, 2);
        if (v) {
          R.start(g, v, q);
          break;
        }
      }
    }
    // (invités morts ou partis : leur présage s'efface)
    for (const [pid, t] of R.omens) {
      const rp = g.net.remotes.get(pid);
      if (!rp || rp.alive === false || t < g.clock) R.omens.delete(pid);
    }
    const rd = R.raid;
    if (!rd) return;
    // les villageois fuient les pillards proches
    for (const m of e.mobs) {
      if (m.type !== 'villager' || m.dead) continue;
      for (const o of rd.mobs) {
        if (o.dead || Math.abs(o.x - m.x) > 8 || Math.abs(o.z - m.z) > 8) continue;
        m.ai.flee = 1.2;
        m.ai.fleeFrom = [o.x, o.z];
        break;
      }
    }
    // plus personne autour : le raid s'arrête
    const near = alivePlayers(g).some((q) => Math.hypot(q.x - rd.x, q.z - rd.z) < 110);
    rd.away = near ? 0 : rd.away + step;
    if (rd.away > 40) {
      R.announce(g, '🏳 Les pillards abandonnent le raid.', 'warn');
      R.stop(g);
      return;
    }
    if (rd.state === 'pause') {
      rd.pause -= step;
      if (rd.pause <= 0) R.spawnWave(g);
    } else {
      rd.t += step;
      const left = rd.mobs.filter((m) => !m.dead && e.mobs.includes(m));
      rd.mobs = left;
      // tous les villageois sont morts : défaite
      const vils = e.mobs.filter((m) => m.type === 'villager' && !m.dead && m.home && m.home[0] === rd.x && m.home[1] === rd.z).length;
      if (!vils && rd.wave >= 1 && rd.t > 15) {
        R.announce(g, '💀 Le village est tombé… les pillards ont gagné.', 'warn', 'horn');
        R.raid = null;
        R.sendBar(g);
        return;
      }
      if (!left.length) {
        if (rd.wave >= rd.waves) return R.victory(g);
        rd.state = 'pause';
        rd.pause = 10;
        R.announce(g, '✔ Vague ' + rd.wave + ' repoussée ! La suivante arrive…', 'good');
      }
      // les derniers assaillants traînent loin : ils reviennent vers le village
      if (left.length <= 2 && rd.t > 60)
        for (const m of left) {
          if (Math.hypot(m.x - rd.x, m.z - rd.z) > 60 && w.loaded(rd.x, rd.z)) {
            const s = groundSpot(w, rd.x, rd.z, rd.r + 4, rd.r + 10, 8);
            if (s) [m.x, m.y, m.z] = s;
          }
        }
    }
    R.barT -= step;
    if (R.barT <= 0) {
      R.barT = 1;
      R.sendBar(g);
    }
  };
  R.victory = function (g) {
    const rd = R.raid, e = g.entities, I = CM.I;
    R.raid = null;
    R.announce(g, '🏆 Raid repoussé ! Le village vous acclame : vous êtes les héros du village.', 'good', 'victory');
    for (const q of alivePlayers(g)) {
      if (Math.hypot(q.x - rd.x, q.z - rd.z) > 96) continue;
      if (q === g.player) {
        CM.Effects.add(q, 'hero', 2400, g.difficulty === 'hard' ? 2 : 1);
        g.stats.raidsWon = (g.stats.raidsWon || 0) + 1;
      } else if (q.pid !== undefined) g.net.sendTo(q.pid, { t: 'act', a: { a: 'eff', k: 'hero', t: 2400, l: g.difficulty === 'hard' ? 2 : 1 } });
      e.giveTo(q, I.TOTEM, 1);
      e.giveTo(q, I.EMERALD, 6 + Math.floor(Math.random() * 6));
    }
    // feux d'artifice au-dessus du village
    for (let i = 0; i < 6; i++) {
      const fx = { k: 'firework', x: rd.x + (Math.random() - 0.5) * 16, y: rd.y + 14 + Math.random() * 8, z: rd.z + (Math.random() - 0.5) * 16 };
      setTimeout(() => {
        if (g.net.onFx) g.net.onFx(fx);
        g.net.fx(fx);
      }, i * 450);
    }
    R.sendBar(g);
  };
  // Barre du raid pour les invités du monde normal.
  R.barData = function () {
    const rd = R.raid;
    if (!rd) return null;
    if (rd.state === 'pause') return ['Raid — vague ' + Math.min(rd.waves, rd.wave + 1) + ' / ' + rd.waves + ' en approche', 1, rd.x, rd.z];
    const hp = rd.mobs.reduce((s, m) => s + Math.max(0, m.hp), 0);
    return ['Raid — vague ' + rd.wave + ' / ' + rd.waves + ' · ' + rd.mobs.length + ' restant' + (rd.mobs.length > 1 ? 's' : ''), Math.max(0, Math.min(1, hp / rd.hp0)), rd.x, rd.z];
  };
  R.sendBar = function (g) {
    if (g.net.isHost) g.net.broadcast({ t: 'raid', r: R.barData() });
  };

  // ---------------------------------------------- gardien du Nether --
  // Il garde chaque forteresse : il se réveille quand un joueur approche de son donjon.
  R.netherTick = function (g) {
    const w = g.world, e = g.entities;
    if (!spawnRules(g) || !w.fortressAt) return;
    g.guardians = g.guardians || {};
    for (const q of alivePlayers(g)) {
      const rx0 = Math.floor(q.x / 160), rz0 = Math.floor(q.z / 160);
      for (let rx = rx0 - 1; rx <= rx0 + 1; rx++)
        for (let rz = rz0 - 1; rz <= rz0 + 1; rz++) {
          const f = w.fortressAt(rx, rz), key = rx + ',' + rz;
          if (!f || g.guardians[key] === 'done' || Math.hypot(q.x - f.x, q.z - f.z) > 26 || Math.abs(q.y - f.y) > 16 || !w.loaded(f.x, f.z)) continue;
          if (e.mobs.some((m) => m.type === 'nether_guardian' && !m.dead && m.fort === key)) continue;
          // au-dessus du donjon s'il y a de la place, sinon dedans
          let y = f.y + 1;
          for (let Y = f.y + 9; Y < f.y + 20; Y++)
            if (!w.solidAt(f.x, Y, f.z) && !w.solidAt(f.x, Y + 1, f.z) && !w.solidAt(f.x, Y + 2, f.z)) {
              y = Y;
              break;
            }
          const m = e.addMob('nether_guardian', f.x + 0.5, y, f.z + 0.5);
          m.fort = key;
          g.guardians[key] = 'awake';
          R.announce(g, '🔥 Le gardien du Nether se réveille : il protège cette forteresse !', 'warn', 'horn');
        }
    }
  };
  R.guardianDown = function (g, m) {
    g.guardians = g.guardians || {};
    if (m.fort) g.guardians[m.fort] = 'done';
    R.announce(g, '⭐ Le gardien du Nether est vaincu ! Il laisse une étoile du Nether.', 'good', 'victory');
  };

  // ====================================================== HUD (tous) ===
  // Barres : raid en cours, boss proches (points de vie).
  R.hud = function (g, dt) {
    R.hudT -= dt;
    if (R.hudT > 0) return;
    R.hudT = 0.2;
    // (le villageois dont on regarde les échanges a changé de niveau chez l'hôte)
    const ui = g.ui, tm = ui.tradeMob;
    if (ui.trade && tm && (ui.trade.lv !== (tm.vlv || 1) || ui.tradeXp !== tm.vxp)) {
      ui.tradeXp = tm.vxp;
      ui.renderTrade();
    }
    const el = document.getElementById('bossbars');
    if (!el) return;
    const p = g.player, bars = [];
    if (g.state === 'playing' && g.dim === 'overworld') {
      const r = g.net.isClient ? R.remote : R.barData();
      if (r && Math.hypot(p.x - r[2], p.z - r[3]) < 128) bars.push([r[0], r[1], 'raid']);
    }
    if (g.state === 'playing')
      for (const m of g.entities.mobs) {
        const def = CM.MOBS[m.type];
        if (!def.boss || m.dead || Math.hypot(m.x - p.x, m.z - p.z) > 64) continue;
        const f = g.net.isClient ? (m.hpPct !== undefined ? m.hpPct / 100 : 1) : Math.max(0, m.hp / m.maxHp);
        bars.push([def.name, f, m.type === 'nether_guardian' ? 'fire' : 'shadow']);
        if (bars.length >= 3) break;
      }
    const key = bars.map((b) => b[0] + Math.round(b[1] * 200)).join('|');
    if (key === R.hudKey) return;
    R.hudKey = key;
    el.innerHTML = bars.map((b) => '<div class="bb ' + b[2] + '"><span>' + clean(b[0]).replace(/</g, '&lt;') + '</span><div class="bbar"><i style="width:' + (b[1] * 100).toFixed(1) + '%"></i></div></div>').join('');
  };

  // ========================================================= succès =====
  if (CM.Comfort && CM.Comfort.ACH) {
    const add = [
      ['maitre', '🎓', 'Maître marchand', 'Faire progresser un villageois jusqu’au niveau Maître', (g) => (g.stats.vmaster || 0) > 0],
      ['raid', '🏅', 'Héros du village', 'Repousser un raid de pillards', (g) => (g.stats.raidsWon || 0) > 0],
      ['totem', '🗿', 'Pas encore !', 'Être sauvé par un totem d’immortalité', (g) => (g.stats.totems || 0) > 0],
      ['geant', '👊', 'Tombeur de géant', 'Vaincre le Géant des Ombres', (g) => (g.stats.kills.shadow_giant || 0) > 0],
      ['gardien', '⭐', 'Étoile du Nether', 'Vaincre le gardien du Nether', (g) => (g.stats.kills.nether_guardian || 0) > 0],
    ].map(([k, icon, name, desc, test]) => ({ k, icon, name, desc, test }));
    const A = CM.Comfort.ACH, at = A.findIndex((a) => a.k === 'aube');
    A.splice(at < 0 ? A.length : at, 0, ...add);
  }
})();
