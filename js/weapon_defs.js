'use strict';
// Arbalète, trident, élytres et fusées ; enchantements de l'arc, de l'arbalète et du trident ;
// le Noyé (créature des eaux, parfois armé d'un trident).
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});

  // ------------------------------------------------------- objets --
  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1493, 'CROSSBOW', { name: 'Arbalète', tex: 'crossbow', stack: 1, type: 'crossbow', enchKind: 'crossbow', desc: 'Maintiens le clic droit pour la charger (une flèche), puis clic droit pour tirer : bien plus fort et plus loin qu’un arc.' });
    defItem(1494, 'CROSSBOW_LOADED', { name: 'Arbalète chargée', tex: 'crossbow_loaded', stack: 1, type: 'crossbow', enchKind: 'crossbow', loaded: true, hidden: true, desc: 'Clic droit pour tirer.' });
    defItem(1495, 'TRIDENT', { name: 'Trident', tex: 'trident', stack: 1, type: 'trident', melee: 9, enchKind: 'trident', desc: 'Arme de mêlée (9 dégâts). Maintiens le clic droit puis relâche pour le lancer ; va le ramasser (ou enchante-le avec Loyauté). Laissé parfois par les Noyés.' });
    defItem(1496, 'ELYTRA', { name: 'Élytres', tex: 'elytra', stack: 1, type: 'armor', slot: 1, mat: 'LEATHER', armor: 0, tough: 0, maxDur: 432, elytra: true, enchKind: 'elytra', desc: 'À porter à la place du plastron. En tombant, appuie sur saut pour planer ; vise vers le bas pour prendre de la vitesse, vers le haut pour remonter. Les fusées te propulsent. Se répare avec du cuir à l’enclume.' });
    defItem(1497, 'FIREWORK', { name: 'Fusée', tex: 'firework', stack: 64, type: 'rocket', desc: 'Clic droit en planant avec des élytres : propulsion ! Au sol : un feu d’artifice.' });
  });

  // ----------------------------------------------------- recettes --
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.recipes.push(
      r(I.CROSSBOW, 1, [[I.STICK, 3], [I.STRING, 2], [I.IRON_INGOT, 1], [CM.RSFAM.hook.base, 1]], 'table', 'outils'),
      r(I.FIREWORK, 3, [[I.PAPER, 1], [I.GUNPOWDER, 1]], null, 'objets'),
      r(I.ELYTRA, 1, [[I.FEATHER, 8], [I.SKY_SHARD, 4], [I.LEATHER, 2], [I.DIAMOND, 1]], 'smithing', 'outils'),
    );
    // l'arc s'enchante aussi
    CM.items[I.BOW].enchKind = 'bow';
    // enchantements (mêmes règles que Minecraft)
    Object.assign(CM.ENCHANTS, {
      power: { name: 'Puissance', max: 5, a: 1, b: 10, w: 10, on: ['bow'], desc: 'flèches plus fortes' },
      punch: { name: 'Frappe', max: 2, a: 12, b: 20, w: 2, on: ['bow'], desc: 'flèches qui repoussent' },
      flame: { name: 'Flamme', max: 1, a: 20, b: 0, w: 2, on: ['bow'], desc: 'flèches enflammées' },
      infinity: { name: 'Infinité', max: 1, a: 20, b: 0, w: 1, on: ['bow'], desc: 'une seule flèche suffit' },
      quick_charge: { name: 'Charge rapide', max: 3, a: 12, b: 20, w: 5, on: ['crossbow'], desc: 'se charge plus vite' },
      multishot: { name: 'Tir multiple', max: 1, a: 20, b: 0, w: 2, on: ['crossbow'], excl: ['piercing'], desc: 'trois flèches d’un coup' },
      piercing: { name: 'Perforation', max: 4, a: 1, b: 10, w: 10, on: ['crossbow'], excl: ['multishot'], desc: 'la flèche traverse les créatures' },
      loyalty: { name: 'Loyauté', max: 3, a: 12, b: 7, w: 5, on: ['trident'], excl: ['riptide'], desc: 'revient après le lancer' },
      impaling: { name: 'Empalement', max: 5, a: 1, b: 8, w: 2, on: ['trident'], desc: 'plus de dégâts aux créatures aquatiques' },
      riptide: { name: 'Impulsion', max: 3, a: 17, b: 7, w: 2, on: ['trident'], excl: ['loyalty', 'channeling'], desc: 'dans l’eau ou sous la pluie : il te propulse' },
      channeling: { name: 'Canalisation', max: 1, a: 25, b: 0, w: 1, on: ['trident'], excl: ['riptide'], desc: 'pendant un orage : appelle la foudre' },
    });
    CM.ENCHANTS.unbreaking.on = CM.ENCHANTS.unbreaking.on.concat(['elytra']);
    const kindOf = CM.enchantKind;
    CM.enchantKind = (id) => {
      const i = CM.itemInfo(id);
      return i && i.enchKind ? i.enchKind : kindOf(id);
    };
  });

  // ----------------------------------------------------- textures --
  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    const line = (d, x0, y0, x1, y1, c, r) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) put(d, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), r ? vary(c, r, 10) : c);
    };
    const crossbow = (d, r, loaded) => {
      clear(d);
      line(d, 3, 12, 12, 3, [120, 84, 44], r); // fût
      line(d, 4, 12, 12, 4, [98, 68, 36], r);
      line(d, 1, 8, 8, 1, [150, 150, 160]); // arc
      line(d, 8, 1, 9, 2, [150, 150, 160]);
      line(d, 1, 8, 2, 9, [150, 150, 160]);
      if (loaded) {
        line(d, 2, 8, 9, 1, [230, 230, 230]);
        line(d, 5, 10, 11, 4, [200, 200, 205]); // flèche
        put(d, 11, 3, [230, 230, 240]); put(d, 12, 3, [230, 230, 240]);
      } else {
        line(d, 2, 9, 5, 9, [230, 230, 230]);
        line(d, 9, 2, 9, 5, [230, 230, 230]);
        line(d, 5, 9, 9, 5, [230, 230, 230]);
      }
      put(d, 3, 13, [70, 50, 30]); put(d, 2, 13, [70, 50, 30]);
    };
    make('crossbow', (d, r) => crossbow(d, r, false));
    make('crossbow_loaded', (d, r) => crossbow(d, r, true));
    make('trident', (d, r) => {
      clear(d);
      line(d, 2, 13, 11, 4, [70, 150, 140], r);
      line(d, 3, 13, 12, 4, [60, 130, 124], r);
      line(d, 10, 3, 14, 3, [120, 200, 190]); // pointes
      line(d, 12, 5, 12, 1, [120, 200, 190]);
      line(d, 12, 3, 14, 1, [150, 230, 220]);
      put(d, 10, 2, [150, 230, 220]); put(d, 13, 6, [150, 230, 220]);
    });
    make('trident_ent', (d, r) => fill(d, r, [80, 170, 158], 10));
    make('trident_tip', (d, r) => fill(d, r, [150, 226, 214], 8));
    make('elytra', (d, r) => {
      clear(d);
      for (let y = 1; y < 15; y++)
        for (let x = 1; x < 15; x++) {
          const side = x < 8 ? 7.5 - x : x - 7.5, k = y / 14;
          if (side > 0.5 && side < 1.5 + k * 6 && !(y > 12 && side > 5)) put(d, x, y, vary(y < 4 ? [170, 170, 190] : [120, 120, 150], r, 10));
        }
      for (let y = 3; y < 14; y += 3) for (let x = 2; x < 14; x++) if (x < 7 || x > 8) put(d, x, y, [100, 100, 130]);
    });
    make('elytra_wing', (d, r) => {
      fill(d, r, [124, 124, 156], 10);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) put(d, x, y, [100, 100, 132]);
    });
    make('firework', (d, r) => {
      clear(d);
      for (let y = 5; y < 15; y++) for (let x = 6; x < 10; x++) put(d, x, y, vary(y < 7 ? [230, 230, 230] : [200, 40, 40], r, 10));
      for (let y = 1; y < 5; y++) for (let x = 7 - (4 - y) / 2; x < 9 + (4 - y) / 2; x++) put(d, Math.floor(x), y, [180, 180, 190]);
      put(d, 8, 15, [90, 90, 90]);
    });
    make('rocket_ent', (d, r) => fill(d, r, [200, 40, 40], 10));
    // Noyé
    make('mob_drowned', (d, r) => {
      fill(d, r, [66, 124, 118], 10);
      for (let k = 0; k < 20; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [44, 96, 90]);
    });
    make('mob_drowned_face', (d, r) => {
      fill(d, r, [80, 146, 136], 8);
      for (const x0 of [3, 10]) for (let x = x0; x < x0 + 3; x++) put(d, x, 6, x === x0 + 1 ? [60, 230, 220] : [30, 60, 60]);
      for (let x = 5; x < 11; x++) put(d, x, 11, [36, 70, 66]);
      for (let k = 0; k < 6; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 4), [40, 110, 50]);
    });
    make('mob_drowned_cloth', (d, r) => {
      fill(d, r, [50, 90, 110], 12);
      for (let k = 0; k < 24; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), [40, 120, 60]);
    });
  });

  // ================================================== NOYÉ ============
  const water = (w, x, y, z) => CM.isWater(w.get(Math.floor(x), Math.floor(y), Math.floor(z)));
  const Lr = () => CM.Textures.layer;
  MOBS.drowned = {
    name: 'Noyé', aliases: ['noye', 'noyé', 'drowned'], hw: 0.3, h: 1.9, hp: 20, speed: 2.4, hostile: true, water: true,
    sound: 'grunt', xp: 5,
    init(m, e) {
      m.variant = e.rand() < 0.15 ? 1 : 0; // armé d'un trident
    },
    // nage vers le joueur dans l'eau, marche sur le fond ; au soleil (hors de l'eau) il brûle ;
    // celui qui a un trident le lance de loin
    update(e, m, dt, c) {
      const g = e.game, w = g.world, p = c.p, r = e.rand;
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      const wet = water(w, m.x, m.y + 1, m.z);
      if (!wet && g.daylight > 0.45 && !w.nether && !w.end && w.skyAt(Math.floor(m.x), Math.floor(m.y + 1.6), Math.floor(m.z)) >= 12) m.fire = Math.max(m.fire || 0, 1.5);
      const see = p.alive && c.distP < 24 && Math.abs(c.dyp) < 10;
      m.ai.chasing = see;
      let tvx = 0, tvz = 0, tvy = 0, jump = false;
      if (see) {
        const dir = Math.atan2(-c.dxp, -c.dzp), sp = wet ? 2.2 : 2.4;
        // trident : lancé de 4 à 16 blocs
        if (m.variant === 1 && c.distP > 4 && c.distP < 16 && m.ai.attackCd <= 0) {
          m.ai.attackCd = 3.5;
          const d = Math.hypot(c.dxp, c.dyp + 1, c.dzp) || 1, s = 22;
          e.shootArrow(m.x, m.y + 1.6, m.z, (c.dxp / d) * s, ((c.dyp + 0.6) / d) * s + d * 0.25, (c.dzp / d) * s, m, 'trident', CM.I.TRIDENT);
          m.ai.special = true;
          m.ai.throwT = 0.5;
        }
        if (m.ai.throwT > 0) m.ai.throwT -= dt;
        else m.ai.special = false;
        tvx = -Math.sin(dir) * sp;
        tvz = -Math.cos(dir) * sp;
        if (wet) tvy = Math.max(-2, Math.min(2, c.dyp * 1.2));
        if ((m.hitX || m.hitZ) && (m.onGround || wet)) jump = true;
        if (p.alive && c.distP < 1.3 + m.hw && Math.abs(c.dyp) < 1.8 && m.ai.attackCd <= 0) {
          m.ai.attackCd = 1;
          e.hitPlayer(p, 3, m, 'Un Noyé');
        }
        return { tvx, tvz, tvy, jump, face: dir };
      }
      // erre au fond de l'eau
      m.ai.timer -= dt;
      if (m.ai.timer <= 0) {
        m.ai.timer = 2 + r() * 3;
        m.ai.dir = r() < 0.6 ? r() * Math.PI * 2 : null;
      }
      if (m.ai.dir !== null && m.ai.dir !== undefined) {
        tvx = -Math.sin(m.ai.dir) * 1.2;
        tvz = -Math.cos(m.ai.dir) * 1.2;
      }
      return { tvx, tvz, tvy: wet ? -0.5 : 0, jump: (m.hitX || m.hitZ) && m.onGround };
    },
    loot(e, m, meat, more) {
      const I = CM.I, lv = more || 0;
      if (e.rand() < 0.11 + 0.02 * lv) e.addDrop(I.COPPER_INGOT, 1, m.x, m.y + 0.5, m.z);
      if (m.variant === 1 && e.rand() < 0.085 + 0.03 * lv) e.addDrop(I.TRIDENT, 1, m.x, m.y + 0.5, m.z, { xp: 0 });
      if (e.rand() < 0.3) e.addDrop(I.ROPE, 1, m.x, m.y + 0.5, m.z);
    },
    render(e, batch, m, l, f, sw, t) {
      const L = Lr(), S = L.mob_drowned, C = L.mob_drowned_cloth;
      const reach = m.ai.chasing ? -1.4 : sw * 0.6;
      e.part(batch, e.M, -0.12, 0.75, 0, sw * 0.7, [-0.12, -0.75, -0.12, 0.12, 0, 0.12], C, l, f);
      e.part(batch, e.M, 0.12, 0.75, 0, -sw * 0.7, [-0.12, -0.75, -0.12, 0.12, 0, 0.12], C, l, f);
      e.part(batch, e.M, 0, 0.75, 0, 0, [-0.25, 0, -0.13, 0.25, 0.7, 0.13], C, l, f);
      e.part(batch, e.M, 0, 1.45, 0, 0, [-0.24, 0, -0.24, 0.24, 0.46, 0.24], [S, S, S, S, S, L.mob_drowned_face], l, f);
      const armR = m.ai.special ? -2.6 : reach;
      e.part(batch, e.M, -0.36, 1.4, 0, reach, [-0.1, -0.68, -0.1, 0.1, 0.04, 0.1], S, l, f);
      e.part(batch, e.M, 0.36, 1.4, 0, armR, [-0.1, -0.68, -0.1, 0.1, 0.04, 0.1], S, l, f);
      if (m.variant === 1) {
        // trident tenu (pointes vers l'avant)
        e.part(batch, e.M, 0.36, 1.4, 0, armR, [-0.025, -1.75, -0.025, 0.025, -0.2, 0.025], L.trident_ent, l, f);
        e.part(batch, e.M, 0.36, 1.4, 0, armR, [-0.13, -1.8, -0.025, 0.13, -1.74, 0.025], L.trident_tip, l, f);
        for (const x of [-0.12, 0, 0.12]) e.part(batch, e.M, 0.36, 1.4, 0, armR, [x - 0.02, -2.0, -0.02, x + 0.02, -1.78, 0.02], L.trident_tip, l, f);
      }
    },
  };
})();
