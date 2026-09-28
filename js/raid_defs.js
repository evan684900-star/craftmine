'use strict';
// Pillards et raids, boss : géant des Ombres (une nuit sur dix), gardien du Nether (forteresses).
// Objets : totem d'immortalité, étoile du Nether. Effets : mauvais présage, héros du village.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});
  const TAU = Math.PI * 2;

  if (CM.EFFECTS) {
    CM.EFFECTS.bad_omen = { key: 'bad_omen', name: 'Mauvais présage', de: 'de mauvais présage', color: [60, 80, 70], icon: '🏴' };
    CM.EFFECTS.hero = { key: 'hero', name: 'Héros du village', de: 'de héros du village', color: [90, 220, 90], icon: '🏅' };
  }

  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1512, 'TOTEM', { name: 'Totem d’immortalité', tex: 'totem', stack: 1, type: 'totem', desc: 'Tenu en main (ou en main secondaire), il te sauve de la mort une fois : il se brise et te soigne. Récompense des raids repoussés.' });
    defItem(1513, 'NETHER_STAR', { name: 'Étoile du Nether', tex: 'nether_star', stack: 16, desc: 'Laissée par le gardien du Nether. Fabrique une balise.' });
  });
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.recipes.push(r(B.BEACON, 1, [[B.GLASS, 5], [B.OBSIDIAN, 3], [I.NETHER_STAR, 1]], 'table', 'objets'));
  });

  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    make('totem', (d, r) => {
      clear(d);
      for (let y = 2; y < 15; y++) for (let x = 5; x < 11; x++) put(d, x, y, vary(y < 6 ? [250, 220, 90] : [226, 186, 60], r, 12));
      for (let x = 2; x < 14; x++) put(d, x, 7, [226, 186, 60]);
      put(d, 6, 4, [40, 160, 80]); put(d, 9, 4, [40, 160, 80]);
      for (let x = 6; x < 10; x++) put(d, x, 11, [200, 150, 40]);
    });
    make('nether_star', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
          if (dx * dy < 3.2 && dx + dy < 8) put(d, x, y, dx + dy < 3 ? [255, 255, 255] : [236, 236, 200]);
        }
    });
    // illageois : peau grise, gros nez, vêtements sombres
    make('mob_illager_skin', (d, r) => fill(d, r, [150, 156, 150], 8));
    make('mob_illager_face', (d, r) => {
      fill(d, r, [150, 156, 150], 8);
      for (let x = 2; x < 14; x++) put(d, x, 5, [50, 54, 56]);
      put(d, 4, 7, [30, 110, 60]); put(d, 11, 7, [30, 110, 60]);
      for (let x = 6; x < 10; x++) put(d, x, 13, [80, 70, 70]);
    });
    make('mob_pillager_cloth', (d, r) => {
      fill(d, r, [70, 66, 60], 10);
      for (let y = 0; y < 16; y++) put(d, 7, y, [110, 90, 60]);
    });
    make('mob_vindicator_cloth', (d, r) => {
      fill(d, r, [40, 44, 50], 8);
      for (let x = 0; x < 16; x++) put(d, x, 9, [90, 90, 96]);
    });
    make('mob_banner', (d, r) => {
      fill(d, r, [236, 236, 230], 4);
      for (let y = 3; y < 13; y++) for (let x = 5; x < 11; x++) if (Math.abs(x - 7.5) + Math.abs(y - 8) < 5) put(d, x, y, [30, 30, 36]);
      for (let x = 0; x < 16; x++) put(d, x, 15, [90, 90, 96]);
    });
    make('mob_ravager', (d, r) => {
      fill(d, r, [86, 84, 80], 12);
      for (let k = 0; k < 20; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [60, 58, 56]);
    });
    make('mob_ravager_face', (d, r) => {
      fill(d, r, [80, 78, 74], 10);
      put(d, 3, 6, [200, 40, 30]); put(d, 12, 6, [200, 40, 30]);
      for (let x = 3; x < 13; x++) put(d, x, 12, [40, 38, 36]);
      for (const x of [4, 7, 10]) put(d, x, 13, [230, 230, 220]);
    });
    make('mob_horn_dark', (d, r) => fill(d, r, [60, 56, 50], 8));
    // géant des Ombres
    make('mob_giant', (d, r) => {
      fill(d, r, [22, 14, 30], 10);
      for (let k = 0; k < 24; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [60, 30, 90]);
    });
    make('mob_giant_face', (d, r) => {
      fill(d, r, [18, 10, 26], 8);
      for (const x0 of [2, 10]) for (let x = x0; x < x0 + 4; x++) { put(d, x, 6, [220, 120, 255]); put(d, x, 7, [180, 80, 240]); }
      for (let x = 4; x < 12; x++) put(d, x, 12, [120, 40, 160]);
    });
    make('mob_giant_spike', (d, r) => fill(d, r, [120, 60, 180], 10));
    // gardien du Nether
    make('mob_guardian', (d, r) => {
      fill(d, r, [180, 90, 20], 14);
      for (let k = 0; k < 20; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [250, 200, 60]);
    });
    make('mob_guardian_face', (d, r) => {
      fill(d, r, [120, 50, 10], 10);
      for (const x0 of [3, 10]) for (let x = x0; x < x0 + 3; x++) put(d, x, 7, [255, 250, 180]);
      for (let x = 5; x < 11; x++) put(d, x, 12, [255, 140, 30]);
    });
    make('mob_guardian_rod', (d, r) => fill(d, r, [250, 200, 60], 12));
    make('fireball', (d, r) => {
      fill(d, r, [250, 140, 30], 20);
      for (let k = 0; k < 20; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [255, 230, 120]);
    });
    make('shadow_orb', (d, r) => fill(d, r, [110, 40, 170], 20));
  });

  // ------------------------------------------------ outils communs --
  const Lr = () => CM.Textures.layer;
  const six = (side, face) => [side, side, side, side, side, face];
  // Illageois (pillard, vindicateur) : corps, jambes, bras, tête au gros nez.
  function illager(e, batch, m, l, f, sw, cloth, armA, armB) {
    const L = Lr(), S = L.mob_illager_skin;
    e.part(batch, e.M, -0.12, 0.72, 0, sw * 0.7, [-0.12, -0.72, -0.12, 0.12, 0, 0.12], cloth, l, f);
    e.part(batch, e.M, 0.12, 0.72, 0, -sw * 0.7, [-0.12, -0.72, -0.12, 0.12, 0, 0.12], cloth, l, f);
    e.part(batch, e.M, 0, 0.72, 0, 0, [-0.26, 0, -0.14, 0.26, 0.7, 0.14], cloth, l, f);
    e.part(batch, e.M, -0.36, 1.38, 0, armA, [-0.1, -0.66, -0.1, 0.1, 0.04, 0.1], cloth, l, f);
    e.part(batch, e.M, 0.36, 1.38, 0, armB, [-0.1, -0.66, -0.1, 0.1, 0.04, 0.1], cloth, l, f);
    e.part(batch, e.M, 0, 1.42, 0, 0, [-0.23, 0, -0.23, 0.23, 0.5, 0.23], six(S, L.mob_illager_face), l, f);
    e.part(batch, e.M, 0, 1.52, -0.23, 0, [-0.05, -0.12, -0.12, 0.05, 0.12, 0], S, l, f);
  }
  // Cible d'un pillard : le joueur ou le villageois le plus proche (golems compris en raid).
  function target(e, m, c, range) {
    let best = null, bd = range;
    if (c.p.alive && c.distP < bd && Math.abs(c.dyp) < 8) {
      best = c.p;
      bd = c.distP;
    }
    for (const o of e.mobs) {
      if (o.dead || (o.type !== 'villager' && !(m.raid && o.type === 'golem'))) continue;
      const d = Math.hypot(o.x - m.x, o.z - m.z);
      if (d < bd && Math.abs(o.y - m.y) < 6) {
        bd = d;
        best = o;
      }
    }
    return best ? { t: best, d: bd } : null;
  }
  const strike = (e, m, t, dmg, cause) => {
    if (t.alive !== undefined) e.hitPlayer(t, dmg, m, cause);
    else e.hurtMob(t, dmg, [m.x, m.z], false, null);
  };
  // Projette une cible (joueur de cet écran, invité ou créature) loin de m.
  function shove(e, t, m, dmg, cause, push, up) {
    const g = e.game, dx = t.x - m.x, dz = t.z - m.z, d = Math.hypot(dx, dz) || 1;
    if (t === g.player) {
      e.hitPlayer(t, dmg, m, cause);
      if (t.alive) {
        t.vx += (dx / d) * push;
        t.vz += (dz / d) * push;
        t.vy = Math.max(t.vy, up);
        t.onGround = false;
      }
    } else if (t.alive !== undefined) t.damage(dmg, m.x, m.z, cause, false, up, m);
    else {
      e.hurtMob(t, dmg, [m.x, m.z], false, null);
      t.vx += (dx / d) * push * 0.6;
      t.vz += (dz / d) * push * 0.6;
      t.vy = up * 0.8;
    }
  }
  // En raid, sans cible : vers le centre du village.
  const toVillage = (m) => (m.raid && CM.Raids && CM.Raids.center ? CM.Raids.center() : null);
  function wander(e, m, dt, sp) {
    const v = toVillage(m);
    if (v) {
      const dx = v[0] - m.x, dz = v[1] - m.z, d = Math.hypot(dx, dz);
      if (d > 6) return { tvx: (dx / d) * sp, tvz: (dz / d) * sp, jump: (m.hitX || m.hitZ) && m.onGround };
    }
    m.ai.timer -= dt;
    if (m.ai.timer <= 0) {
      m.ai.timer = 2 + e.rand() * 3;
      m.ai.dir = e.rand() < 0.5 ? e.rand() * TAU : null;
    }
    return m.ai.dir !== null && m.ai.dir !== undefined ? { tvx: -Math.sin(m.ai.dir) * sp * 0.5, tvz: -Math.cos(m.ai.dir) * sp * 0.5, jump: (m.hitX || m.hitZ) && m.onGround } : {};
  }
  // Mauvais présage pour qui a tué le capitaine.
  function omenTo(e, m, q) {
    const g = e.game;
    if (!m.captain || !q || q.alive === false) return;
    if (q === g.player) {
      CM.Effects.add(q, 'bad_omen', 3600, 1);
      g.ui.toast('🏴 Mauvais présage : entre dans un village et un raid commencera…', 'warn', 'omen');
    } else if (q.pid !== undefined) {
      g.net.sendTo(q.pid, { t: 'act', a: { a: 'eff', k: 'bad_omen', t: 3600, l: 1, note: '🏴 Mauvais présage : entre dans un village et un raid commencera…' } });
      if (CM.Raids) CM.Raids.omens.set(q.pid, g.clock + 3600);
    }
  }

  // ================================================== PILLARD ========
  MOBS.pillager = {
    name: 'Pillard', aliases: ['pillard', 'pillager'], hw: 0.3, h: 1.95, hp: 24, speed: 2.4, hostile: true, xp: 6, sound: 'huh', raider: true,
    // garde ses distances et tire à l'arbalète ; le capitaine porte une bannière
    update(e, m, dt, c) {
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      const tg = target(e, m, c, 20);
      m.ai.chasing = !!tg;
      if (!tg) return wander(e, m, dt, 2.2);
      const t = tg.t, dx = t.x - m.x, dz = t.z - m.z, d = tg.d, dir = Math.atan2(-dx, -dz);
      const sp = d > 10 ? 2.4 : d < 5 ? -1.8 : 0;
      if (m.ai.attackCd <= 0 && d < 18) {
        m.ai.attackCd = { easy: 2.8, normal: 2.2, hard: 1.6 }[e.game.difficulty] || 2.2;
        // tir en cloche (comme le squelette), plus rapide : l'arbalète
        const sx = m.x - Math.sin(dir) * 0.4, sy = m.y + 1.5, sz = m.z - Math.cos(dir) * 0.4;
        const ax = t.x - sx, ay = t.y + (t.h || 1.8) * 0.6 - sy, az = t.z - sz, hd = Math.hypot(ax, az) || 1;
        const sp = 32, tt = hd / sp, err = { easy: 0.1, normal: 0.05, hard: 0.025 }[e.game.difficulty] || 0.05;
        e.shootArrow(sx, sy, sz, (ax / hd) * sp + (e.rand() - 0.5) * sp * err, ay / Math.max(tt, 0.05) + 10 * tt, (az / hd) * sp + (e.rand() - 0.5) * sp * err, m);
        m.ai.special = true;
        m.ai.aimT = 0.4;
      }
      if (m.ai.aimT > 0) m.ai.aimT -= dt;
      else m.ai.special = false;
      return { tvx: -Math.sin(dir) * sp, tvz: -Math.cos(dir) * sp, face: dir, jump: (m.hitX || m.hitZ) && m.onGround };
    },
    onDeath: omenTo,
    loot(e, m, meat, more) {
      const I = CM.I;
      e.addDrop(I.ARROW, Math.floor(e.rand() * 3) + (more || 0), m.x, m.y + 0.5, m.z);
      if (e.rand() < 0.085 + 0.02 * (more || 0)) e.addDrop(I.CROSSBOW, 1, m.x, m.y + 0.5, m.z);
      if (m.raid && e.rand() < 0.6) e.addDrop(I.EMERALD, 1, m.x, m.y + 0.5, m.z);
    },
    render(e, batch, m, l, f, sw) {
      const L = Lr(), C = L.mob_pillager_cloth, aim = m.ai.chasing ? -1.45 : sw * 0.5;
      illager(e, batch, m, l, f, sw, C, aim, m.ai.chasing ? -1.3 : -sw * 0.5);
      if (m.ai.chasing) {
        // arbalète tenue devant
        const cb = L.crossbow_ent || L.stand_wood || C;
        e.part(batch, e.M, 0, 1.3, -0.62, 0, [-0.3, -0.04, -0.05, 0.3, 0.04, 0.05], cb, l, f);
        e.part(batch, e.M, 0, 1.3, -0.55, 0, [-0.03, -0.03, -0.3, 0.03, 0.03, 0.2], cb, l, f);
      }
      if (m.captain || m.variant === 1) {
        e.part(batch, e.M, 0, 1.4, 0.18, -0.1, [-0.02, 0, -0.02, 0.02, 1.1, 0.02], L.stand_wood || C, l, f);
        e.part(batch, e.M, 0, 2.5, 0.2, 0, [0, -0.9, -0.01, 0.02, 0, 0.5], L.mob_banner, l, f, null, Math.PI / 2);
      }
    },
  };
  // ================================================ VINDICATEUR ======
  MOBS.vindicator = {
    name: 'Vindicateur', aliases: ['vindicateur', 'vindicator'], hw: 0.3, h: 1.95, hp: 24, speed: 3.2, hostile: true, xp: 6, sound: 'huh', raider: true,
    update(e, m, dt, c) {
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      if (m.ai.swing > 0) m.ai.swing -= dt;
      const tg = target(e, m, c, 22);
      m.ai.chasing = !!tg;
      if (!tg) return wander(e, m, dt, 2.6);
      const t = tg.t, dx = t.x - m.x, dz = t.z - m.z, dir = Math.atan2(-dx, -dz);
      if (tg.d < 1.5 + m.hw && Math.abs(t.y - m.y) < 1.8 && m.ai.attackCd <= 0) {
        m.ai.attackCd = 1;
        m.ai.swing = 0.4;
        strike(e, m, t, 7, 'Un vindicateur');
      }
      return { tvx: -Math.sin(dir) * 3.2, tvz: -Math.cos(dir) * 3.2, face: dir, jump: (m.hitX || m.hitZ) && m.onGround };
    },
    onDeath: omenTo,
    loot(e, m, meat, more) {
      const I = CM.I;
      if (m.raid && e.rand() < 0.6) e.addDrop(I.EMERALD, 1 + (more || 0), m.x, m.y + 0.5, m.z);
      if (e.rand() < 0.085) e.addDrop(I.AXE_IRON, 1, m.x, m.y + 0.5, m.z, { xp: 0 });
    },
    render(e, batch, m, l, f, sw) {
      const L = Lr(), C = L.mob_vindicator_cloth;
      const hit = m.ai.swing > 0 ? -2.2 + (0.4 - m.ai.swing) * 5 : m.ai.chasing ? -1.2 : sw * 0.5;
      illager(e, batch, m, l, f, sw, C, m.ai.chasing ? -0.3 : -sw * 0.5, hit);
      // hache de fer
      const iron = (CM.blockLayers[CM.B.IRON_BLOCK] || [])[0] || C;
      e.part(batch, e.M, 0.36, 1.38, 0, hit, [-0.025, -0.9, -0.025, 0.025, -0.3, 0.025], L.stand_wood || C, l, f);
      e.part(batch, e.M, 0.36, 1.38, 0, hit, [-0.03, -0.95, -0.2, 0.03, -0.72, 0.02], iron, l, f);
    },
  };
  // ================================================== RAVAGEUR =======
  MOBS.ravager = {
    name: 'Ravageur', aliases: ['ravageur', 'ravager'], hw: 0.8, h: 2.1, hp: 100, speed: 2.6, hostile: true, xp: 20, sound: 'growl', raider: true,
    update(e, m, dt, c) {
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      if (m.ai.swing > 0) m.ai.swing -= dt;
      const tg = target(e, m, c, 24);
      m.ai.chasing = !!tg;
      if (!tg) return wander(e, m, dt, 2.4);
      const t = tg.t, dx = t.x - m.x, dz = t.z - m.z, dir = Math.atan2(-dx, -dz);
      if (tg.d < 2.2 + m.hw && Math.abs(t.y - m.y) < 2.2 && m.ai.attackCd <= 0) {
        m.ai.attackCd = 1.6;
        m.ai.swing = 0.5;
        // gros coup de tête : la cible vole
        shove(e, t, m, 12, 'Un ravageur', 12, 6);
        CM.Audio.play('growl', { pitch: 0.7 });
      }
      return { tvx: -Math.sin(dir) * 3, tvz: -Math.cos(dir) * 3, face: dir, jump: (m.hitX || m.hitZ) && m.onGround };
    },
    loot(e, m) {
      e.addDrop(CM.I.SADDLE, 1, m.x, m.y + 1, m.z);
      e.addDrop(CM.I.LEATHER, 2 + Math.floor(e.rand() * 3), m.x, m.y + 1, m.z);
    },
    render(e, batch, m, l, f, sw) {
      const L = Lr(), R = L.mob_ravager, bite = m.ai.swing > 0 ? 0.4 : 0;
      for (const [x, z, s] of [[-0.5, -0.5, 1], [0.5, -0.5, -1], [-0.5, 0.6, -1], [0.5, 0.6, 1]]) e.part(batch, e.M, x, 1.0, z, sw * 0.5 * s, [-0.2, -1.0, -0.2, 0.2, 0, 0.2], R, l, f);
      e.part(batch, e.M, 0, 0.9, 0, 0, [-0.75, 0, -0.9, 0.75, 1.1, 1.0], R, l, f);
      e.part(batch, e.M, 0, 1.3, -0.9, bite, [-0.45, -0.5, -0.9, 0.45, 0.4, 0], six(R, L.mob_ravager_face), l, f);
      e.part(batch, e.M, -0.4, 1.7, -1.1, -0.6, [-0.06, 0, -0.06, 0.06, 0.5, 0.06], L.mob_horn_dark, l, f);
      e.part(batch, e.M, 0.4, 1.7, -1.1, -0.6, [-0.06, 0, -0.06, 0.06, 0.5, 0.06], L.mob_horn_dark, l, f);
    },
  };

  // ============================================= GÉANT DES OMBRES ====
  MOBS.shadow_giant = {
    name: 'Géant des Ombres', aliases: ['geant', 'géant', 'geant_des_ombres', 'giant'], hw: 1.1, h: 5.2, hp: 320, speed: 2, hostile: true, boss: true, xp: 150, sound: 'shadow',
    // marche vers le joueur ; coup au sol (onde de choc), orbes d'ombre de loin,
    // appelle des Ombres ; se dissipe au lever du jour
    update(e, m, dt, c) {
      const g = e.game, { p, distP, dxp, dzp, dyp } = c, r = e.rand;
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      m.ai.orbCd = (m.ai.orbCd === undefined ? 4 : m.ai.orbCd) - dt;
      m.ai.callCd = (m.ai.callCd === undefined ? 15 : m.ai.callCd) - dt;
      if (m.ai.swing > 0) m.ai.swing -= dt;
      if (g.daylight > 0.55 && !g.world.nether) {
        m.dead = true;
        e.killFx('ombre', m.x, m.y + 2, m.z);
        for (let k = 0; k < 4; k++) e.burst(CM.Textures.layer.smoke || CM.Textures.layer.white, m.x, m.y + k, m.z, 20, { speed: 3, grav: -1, life: 1.6, size: 0.4 });
        if (CM.Raids) CM.Raids.announce(g, '🌅 Le Géant des Ombres se dissipe dans la lumière de l’aube…');
        return {};
      }
      const see = p.alive && distP < 48;
      m.ai.chasing = see;
      if (!see) return {};
      const dir = Math.atan2(-dxp, -dzp);
      if (distP < 4.5 && Math.abs(dyp) < 4 && m.ai.attackCd <= 0) {
        // coup au sol : tous les joueurs proches sont projetés
        m.ai.attackCd = 2.8;
        m.ai.swing = 0.6;
        for (const q of e.plist) {
          if (q.alive === false || Math.hypot(q.x - m.x, q.z - m.z) > 5.5 || Math.abs(q.y - m.y) > 4) continue;
          shove(e, q, m, 10, 'Le Géant des Ombres', 14, 8);
        }
        if (CM.Raids) CM.Raids.slamFx(g, m.x, m.y, m.z);
        if (g.net) g.net.fx({ k: 'slam', x: m.x, y: m.y, z: m.z });
      } else if (distP > 7 && m.ai.orbCd <= 0) {
        m.ai.orbCd = 3.5 + r() * 2;
        const d = Math.hypot(dxp, dyp - 2.5, dzp) || 1, s = 16;
        e.shootArrow(m.x, m.y + 4.2, m.z, (dxp / d) * s, ((dyp - 2.5) / d) * s, (dzp / d) * s, m, 'orb', 0);
        CM.Audio.play('shadow', { pitch: 0.6 });
      }
      if (m.ai.callCd <= 0) {
        m.ai.callCd = 22;
        for (let k = 0; k < 2; k++) {
          const a = r() * TAU, X = m.x + Math.cos(a) * 4, Z = m.z + Math.sin(a) * 4, w = g.world;
          const Y = w.groundBelow(Math.floor(X), Math.floor(m.y + 4), Math.floor(Z)) + 1;
          if (Y > CM.WORLD.MINY && Math.abs(Y - m.y) < 6) e.addMob('ombre', X, Y, Z);
        }
      }
      return { tvx: distP > 3.5 ? -Math.sin(dir) * 2 : 0, tvz: distP > 3.5 ? -Math.cos(dir) * 2 : 0, face: dir, jump: (m.hitX || m.hitZ) && m.onGround };
    },
    loot(e, m) {
      const I = CM.I;
      e.addDrop(I.SHADOW_ESSENCE, 16 + Math.floor(e.rand() * 8), m.x, m.y + 1, m.z);
      e.addDrop(I.DIAMOND, 3 + Math.floor(e.rand() * 3), m.x, m.y + 1, m.z);
      e.addDrop(I.GOLDEN_APPLE, 2, m.x, m.y + 1, m.z);
      e.addDrop(I.NETHERITE_SCRAP, 2, m.x, m.y + 1, m.z);
    },
    onDeath(e, m) {
      if (CM.Raids) CM.Raids.announce(e.game, '⚔ Le Géant des Ombres est vaincu !');
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), G = L.mob_giant, S = L.mob_giant_spike, ff = f | 1;
      const slam = m.ai.swing > 0 ? -2.6 + (0.6 - m.ai.swing) * 5 : m.ai.chasing ? -0.5 + Math.sin(t * 2) * 0.1 : sw * 0.4;
      e.part(batch, e.M, -0.5, 2.4, 0, sw * 0.5, [-0.4, -2.4, -0.4, 0.4, 0, 0.4], G, l, f);
      e.part(batch, e.M, 0.5, 2.4, 0, -sw * 0.5, [-0.4, -2.4, -0.4, 0.4, 0, 0.4], G, l, f);
      e.part(batch, e.M, 0, 2.4, 0, 0, [-1.0, 0, -0.55, 1.0, 1.9, 0.55], G, l, f);
      e.part(batch, e.M, -1.3, 4.1, 0, slam, [-0.32, -2.6, -0.32, 0.32, 0.2, 0.32], G, l, f);
      e.part(batch, e.M, 1.3, 4.1, 0, slam, [-0.32, -2.6, -0.32, 0.32, 0.2, 0.32], G, l, f);
      e.part(batch, e.M, 0, 4.3, 0, 0, [-0.62, 0, -0.62, 0.62, 1.1, 0.62], [G, G, G, G, G, L.mob_giant_face], l, [f, f, f, f, f, ff]);
      for (const [x, y, z] of [[-0.6, 3.9, 0.5], [0.6, 3.9, 0.5], [0, 4.1, 0.55], [-0.3, 5.4, 0], [0.3, 5.4, 0]]) e.part(batch, e.M, x, y, z, -0.5, [-0.1, 0, -0.1, 0.1, 0.5, 0.1], S, l, ff);
    },
  };

  // ============================================ GARDIEN DU NETHER ====
  MOBS.nether_guardian = {
    name: 'Gardien du Nether', aliases: ['gardien', 'gardien_du_nether', 'guardian'], hw: 0.8, h: 2.6, hp: 260, speed: 3, hostile: true, boss: true, fly: true, fireproof: true, xp: 120, sound: 'shadow',
    // plane autour du joueur, lance des boules de feu (des salves sous la moitié de sa vie),
    // appelle des Ombres ardentes
    update(e, m, dt, c) {
      const g = e.game, { p, distP, dxp, dzp, dyp } = c, r = e.rand, w = g.world;
      m.ai.fireCd = (m.ai.fireCd === undefined ? 2 : m.ai.fireCd) - dt;
      m.ai.callCd = (m.ai.callCd === undefined ? 12 : m.ai.callCd) - dt;
      m.ai.ang = (m.ai.ang || r() * TAU) + dt * 0.5;
      const see = p.alive && distP < 40;
      m.ai.chasing = see;
      const rage = m.hp < MOBS.nether_guardian.hp * 0.5;
      if (!see) return { tvy: 0 };
      // cercle autour du joueur, 3 à 5 blocs au-dessus
      const gx = p.x + Math.cos(m.ai.ang) * 8, gz = p.z + Math.sin(m.ai.ang) * 8;
      let gy = p.y + 4 - m.y;
      if (w.solidAt(Math.floor(m.x), Math.floor(m.y + m.h + 0.5), Math.floor(m.z))) gy = Math.min(gy, -1);
      const tx = gx - m.x, tz = gz - m.z, td = Math.hypot(tx, tz) || 1;
      if (m.ai.fireCd <= 0) {
        m.ai.fireCd = rage ? 1.4 : 2.6;
        const n = rage ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const d = Math.hypot(dxp, dyp - 1, dzp) || 1, s = 18, sp = (k - (n - 1) / 2) * 0.12;
          const vx = (dxp / d) * s, vz = (dzp / d) * s;
          e.shootArrow(m.x, m.y + 1.4, m.z, vx * Math.cos(sp) - vz * Math.sin(sp), ((dyp - 1) / d) * s, vx * Math.sin(sp) + vz * Math.cos(sp), m, 'fireball', 0);
        }
        CM.Audio.play('ignite');
      }
      if (m.ai.callCd <= 0) {
        m.ai.callCd = rage ? 14 : 20;
        for (let k = 0; k < 2; k++) {
          const X = m.x + (r() - 0.5) * 6, Z = m.z + (r() - 0.5) * 6;
          const Y = w.groundBelow(Math.floor(X), Math.floor(m.y), Math.floor(Z)) + 1;
          if (Y > CM.WORLD.MINY && Math.abs(Y - m.y) < 10) e.addMob(rage && r() < 0.5 ? 'magma' : 'ardent', X, Y, Z);
        }
      }
      if (r() < dt * 12) e.burst(CM.Textures.layer.fireball || CM.Textures.layer.white, m.x + (r() - 0.5), m.y + 0.5, m.z + (r() - 0.5), 1, { speed: 0.5, grav: 1, life: 0.6, size: 0.1, emissive: true });
      return { tvx: (tx / td) * (td > 1 ? 4 : 0), tvz: (tz / td) * (td > 1 ? 4 : 0), tvy: Math.max(-3, Math.min(3, gy)), face: Math.atan2(-dxp, -dzp) };
    },
    loot(e, m) {
      const I = CM.I;
      e.addDrop(I.NETHER_STAR, 1, m.x, m.y + 1, m.z);
      e.addDrop(I.NETHERITE_INGOT, 1, m.x, m.y + 1, m.z);
      e.addDrop(I.GOLD_INGOT, 8 + Math.floor(e.rand() * 8), m.x, m.y + 1, m.z);
    },
    onDeath(e, m) {
      if (CM.Raids) CM.Raids.guardianDown(e.game, m);
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), G = L.mob_guardian, Rd = L.mob_guardian_rod, ff = f | 1;
      e.part(batch, e.M, 0, 1.4, 0, 0, [-0.45, 0, -0.45, 0.45, 0.9, 0.45], [G, G, G, G, G, L.mob_guardian_face], l, [f, f, f, f, f, ff]);
      e.part(batch, e.M, 0, 0.6, 0, 0, [-0.3, 0, -0.3, 0.3, 0.8, 0.3], G, l, f);
      // bâtons de feu qui tournent
      for (let k = 0; k < 8; k++) {
        const a = t * (k < 4 ? 1.6 : -1.2) + (k * TAU) / 4, rr = k < 4 ? 1.1 : 0.8, y = k < 4 ? 1.2 : 0.2;
        e.part(batch, e.M, Math.cos(a) * rr, y, Math.sin(a) * rr, 0, [-0.08, 0, -0.08, 0.08, 0.7, 0.08], Rd, l, ff);
      }
    },
  };
})();
