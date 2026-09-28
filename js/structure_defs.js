'use strict';
// Structures : générateur de monstres (cage), toile d'araignée, sorcière (cabanes des marais).
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});

  M.blocks.push(function (K) {
    const { nb } = K;
    nb('SPAWNER', {
      name: 'Générateur de monstres', render: 'glass', tex: 'spawner', opaque: false, solid: true, hardness: 5, tool: 'pickaxe', tier: 1, sound: 'metal', drop: 0,
      track: 'spawner', light: 3,
    });
    nb('COBWEB', {
      name: 'Toile d’araignée', render: 'cross', tex: 'cobweb', solid: false, opaque: false, hardness: 1.2, sound: 'wool', web: true,
    });
  });
  M.recipes.push(function () {
    const B = CM.B, I = CM.I;
    CM.blocks[B.COBWEB].drop = I.STRING;
  });

  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    make('spawner', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const bar = x % 5 === 0 || y % 5 === 0 || x === 15 || y === 15;
          if (bar) put(d, x, y, vary([46, 50, 66], r, 12));
        }
      for (let k = 0; k < 10; k++) put(d, 1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14), [30, 32, 44]);
    });
    make('cobweb', (d, r) => {
      clear(d);
      const c = [236, 236, 240];
      for (let k = 0; k < 16; k++) {
        put(d, k, k, c);
        put(d, 15 - k, k, c);
        if (k % 2 === 0) { put(d, 7, k, c); put(d, k, 8, c); }
      }
      for (const rr of [3, 6]) for (let a = 0; a < 24; a++) put(d, Math.round(7.5 + Math.cos((a / 24) * 6.283) * rr), Math.round(7.5 + Math.sin((a / 24) * 6.283) * rr), [220, 220, 228]);
    });
    // sorcière
    make('mob_witch_robe', (d, r) => {
      fill(d, r, [70, 40, 86], 12);
      for (let k = 0; k < 18; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [54, 30, 68]);
      for (let x = 0; x < 16; x++) put(d, x, 12, [90, 130, 60]);
    });
    make('mob_witch_skin', (d, r) => fill(d, r, [176, 170, 130], 8));
    make('mob_witch_face', (d, r) => {
      fill(d, r, [176, 170, 130], 8);
      put(d, 4, 6, [40, 150, 60]); put(d, 11, 6, [40, 150, 60]);
      put(d, 3, 6, [240, 240, 230]); put(d, 12, 6, [240, 240, 230]);
      for (let x = 3; x < 13; x++) put(d, x, 5, [90, 80, 60]);
      for (let x = 6; x < 10; x++) put(d, x, 12, [100, 70, 60]);
    });
    make('mob_witch_nose', (d, r) => {
      fill(d, r, [160, 150, 110], 8);
      put(d, 5, 10, [80, 140, 60]);
    });
    make('mob_witch_hat', (d, r) => {
      fill(d, r, [34, 30, 38], 8);
      for (let x = 0; x < 16; x++) put(d, x, 14, [90, 130, 60]);
    });
  });

  // ================================================== SORCIÈRE =========
  const potion = (k) => CM.I[k];
  MOBS.witch = {
    name: 'Sorcière', aliases: ['sorciere', 'sorcière', 'witch'], hw: 0.3, h: 1.95, hp: 26, speed: 2.2, hostile: true, xp: 5, sound: 'cackle',
    // garde ses distances et lance des potions (lenteur, poison, dégâts, faiblesse) ;
    // blessée, elle boit une potion de soin ; en feu, une potion de résistance au feu
    update(e, m, dt, c) {
      const { p, distP, dxp, dzp, dyp } = c, r = e.rand;
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      if (m.ai.drink > 0) {
        m.ai.drink -= dt;
        m.ai.special = true;
        if (m.ai.drink <= 0) {
          m.ai.special = false;
          if (m.ai.drinkK === 'fire') m.fire = 0;
          else m.hp = Math.min(CM.MOBS.witch.hp, m.hp + 8);
          CM.Audio.play('eat', { pitch: 1.3 });
        }
        return { face: Math.atan2(-dxp, -dzp) };
      }
      if (m.fire > 0 && !m.ai.fireproof) {
        m.ai.drink = 1.6;
        m.ai.drinkK = 'fire';
        m.ai.fireproof = 8;
      }
      if (m.ai.fireproof > 0) {
        m.ai.fireproof -= dt;
        m.fire = 0;
      }
      if (m.hp < CM.MOBS.witch.hp * 0.5 && !(m.ai.healCd > 0)) {
        m.ai.drink = 1.6;
        m.ai.drinkK = 'heal';
        m.ai.healCd = 12;
      }
      if (m.ai.healCd > 0) m.ai.healCd -= dt;
      const see = p.alive && distP < 16 && Math.abs(dyp) < 8;
      m.ai.chasing = see;
      if (!see) {
        m.ai.timer -= dt;
        if (m.ai.timer <= 0) {
          m.ai.timer = 2 + r() * 3;
          m.ai.dir = r() < 0.5 ? r() * Math.PI * 2 : null;
        }
        return m.ai.dir !== null && m.ai.dir !== undefined ? { tvx: -Math.sin(m.ai.dir) * 1.2, tvz: -Math.cos(m.ai.dir) * 1.2, jump: (m.hitX || m.hitZ) && m.onGround } : {};
      }
      const dir = Math.atan2(-dxp, -dzp);
      let sp = 0;
      if (distP > 8) sp = 2.2;
      else if (distP < 4) sp = -1.8;
      if (m.ai.attackCd <= 0 && distP < 12) {
        m.ai.attackCd = 2.6 + r();
        const slowed = p === e.game.player ? CM.Effects.lv(p, 'slowness') : 0;
        const k = distP > 7 && !slowed ? 'SPLASH_SLOWNESS' : p.health > 8 && r() < 0.6 ? 'SPLASH_POISON' : r() < 0.2 ? 'SPLASH_WEAKNESS' : 'SPLASH_HARMING';
        const d = Math.hypot(dxp, dyp + 1, dzp) || 1, s = 11;
        e.shootArrow(m.x, m.y + 1.7, m.z, (dxp / d) * s, ((dyp + 0.8) / d) * s + d * 0.55, (dzp / d) * s, m, 'potion', potion(k));
        m.ai.throwT = 0.4;
      }
      return { tvx: -Math.sin(dir) * sp, tvz: -Math.cos(dir) * sp, face: dir, jump: (m.hitX || m.hitZ) && m.onGround };
    },
    loot(e, m, meat, more) {
      const I = CM.I, pool = [I.GLOWSTONE_DUST, I.REDSTONE, I.SUGAR, I.SPIDER_EYE, I.GLASS_BOTTLE, I.GUNPOWDER, I.STICK, I.STICK];
      const n = 1 + Math.floor(e.rand() * 3) + (more || 0);
      for (let k = 0; k < n; k++) {
        const id = pool[Math.floor(e.rand() * pool.length)];
        if (id !== undefined) e.addDrop(id, 1 + Math.floor(e.rand() * 2), m.x, m.y + 0.6, m.z);
      }
      if (e.rand() < 0.08) e.addDrop(potion('POTION_HEALING'), 1, m.x, m.y + 0.6, m.z);
    },
    render(e, batch, m, l, f, sw) {
      const L = CM.Textures.layer, R = L.mob_witch_robe, S = L.mob_witch_skin, H = L.mob_witch_hat;
      // robe jusqu'au sol
      e.part(batch, e.M, -0.12, 0.72, 0, sw * 0.5, [-0.12, -0.72, -0.12, 0.12, 0, 0.12], R, l, f);
      e.part(batch, e.M, 0.12, 0.72, 0, -sw * 0.5, [-0.12, -0.72, -0.12, 0.12, 0, 0.12], R, l, f);
      e.part(batch, e.M, 0, 0.72, 0, 0, [-0.26, 0, -0.14, 0.26, 0.7, 0.14], R, l, f);
      // bras croisés (ou qui lancent / boivent)
      const act = m.ai.special ? -1.6 : m.ai.chasing ? -0.9 : -0.6;
      e.part(batch, e.M, 0, 1.25, -0.05, act, [-0.34, -0.14, -0.14, 0.34, 0.1, 0.14], R, l, f);
      if (m.ai.special) e.part(batch, e.M, 0.2, 1.25, -0.05, act, [-0.06, -0.5, -0.06, 0.06, -0.24, 0.06], L.bottle_empty || L.white, l, f);
      // tête, nez crochu, chapeau pointu
      e.part(batch, e.M, 0, 1.42, 0, 0, [-0.24, 0, -0.24, 0.24, 0.48, 0.24], [S, S, S, S, S, L.mob_witch_face], l, f);
      e.part(batch, e.M, 0, 1.58, -0.24, 0.3, [-0.05, -0.16, -0.12, 0.05, 0.02, 0], L.mob_witch_nose, l, f);
      e.part(batch, e.M, 0, 1.88, 0, 0, [-0.36, 0, -0.36, 0.36, 0.04, 0.36], H, l, f);
      e.part(batch, e.M, 0, 1.92, 0, 0, [-0.22, 0, -0.22, 0.22, 0.2, 0.22], H, l, f);
      e.part(batch, e.M, 0, 2.12, 0.04, -0.12, [-0.13, 0, -0.13, 0.13, 0.18, 0.13], H, l, f);
      e.part(batch, e.M, 0, 2.28, 0.08, -0.3, [-0.06, 0, -0.06, 0.06, 0.16, 0.06], H, l, f);
    },
  };
})();
