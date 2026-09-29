'use strict';
// Extension « Armes à feu » : pistolets, fusils, fusil à pompe, fusil de précision, mitrailleuse,
// lance-roquettes, lance-grenades, lance-flammes, grenades et munitions ; l'établi d'armurier et
// le bandit (armé d'un pistolet). La logique (tir, visée, recul, rechargement, réseau) est dans guns.js.
// Les objets existent dans tous les mondes (identifiants fixes) mais recettes, butin et bandits
// n'apparaissent que si l'extension a été cochée à la création du monde.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const MOBS = (M.mobs = M.mobs || {});
  const EXT = 'guns';
  const T = (o) => Object.assign({ ext: EXT }, o);

  // Caractéristiques des armes (guns.js) :
  // ammo : munition · mag : chargeur · dmg : dégâts par balle (pellets : plombs par tir)
  // rate : secondes entre deux tirs · auto : tir continu · spread / aim : dispersion (hanche / visée)
  // range : portée · reload : rechargement (perShell : cartouche par cartouche) · zoom : grossissement
  // scope : lunette · recoil : recul · kb : recul infligé · pierce : créatures traversées
  // proj : projectile (roquette, grenade, flamme) · heavy : ralentit · spin : temps de lancement
  const GUNS = (CM.GUNS = {
    PISTOL: { id: 1519, name: 'Pistolet', ammo: 'AMMO_PISTOL', mag: 12, dmg: 5, rate: 0.16, spread: 0.02, aim: 0.006, range: 70, reload: 1.3, zoom: 1.25, recoil: 0.035, snd: 'pistol',
      desc: 'Semi-automatique, 12 balles. Précis et léger.' },
    REVOLVER: { id: 1520, name: 'Revolver', ammo: 'AMMO_PISTOL', mag: 6, dmg: 9, rate: 0.42, spread: 0.02, aim: 0.004, range: 80, reload: 2.1, zoom: 1.3, recoil: 0.08, kb: 1, snd: 'magnum',
      desc: '6 coups qui frappent fort.' },
    SMG: { id: 1521, name: 'Pistolet-mitrailleur', ammo: 'AMMO_PISTOL', mag: 30, dmg: 3.5, rate: 0.075, auto: true, spread: 0.035, aim: 0.018, range: 55, reload: 1.7, zoom: 1.2, recoil: 0.018, snd: 'smg',
      desc: 'Automatique : maintiens le clic. 30 balles, cadence très rapide.' },
    RIFLE: { id: 1522, name: 'Fusil d’assaut', ammo: 'AMMO_RIFLE', mag: 30, dmg: 6, rate: 0.1, auto: true, spread: 0.03, aim: 0.008, range: 100, reload: 2.1, zoom: 1.6, recoil: 0.025, snd: 'rifle',
      desc: 'Automatique, 30 balles de fusil. Polyvalent.' },
    SHOTGUN: { id: 1523, name: 'Fusil à pompe', ammo: 'AMMO_SHELL', mag: 6, dmg: 3.2, pellets: 8, rate: 0.85, spread: 0.09, aim: 0.07, range: 28, reload: 0.5, perShell: true, zoom: 1.15, recoil: 0.12, kb: 2, snd: 'shotgun',
      desc: '8 plombs par tir : dévastateur de près. Se recharge cartouche par cartouche.' },
    DOUBLE_BARREL: { id: 1524, name: 'Fusil à double canon', ammo: 'AMMO_SHELL', mag: 2, dmg: 3.6, pellets: 10, rate: 0.28, spread: 0.11, aim: 0.09, range: 24, reload: 1.8, zoom: 1.1, recoil: 0.16, kb: 2, snd: 'shotgun',
      desc: 'Deux tirs très rapprochés, puis il faut recharger.' },
    HUNTING_RIFLE: { id: 1525, name: 'Carabine de chasse', ammo: 'AMMO_RIFLE', mag: 5, dmg: 14, rate: 0.9, spread: 0.03, aim: 0.003, range: 140, reload: 2.4, zoom: 2.2, recoil: 0.07, pierce: 1, snd: 'hunting',
      desc: '5 balles puissantes, lunette ×2 (clic droit).' },
    SNIPER: { id: 1526, name: 'Fusil de précision', ammo: 'AMMO_RIFLE', mag: 5, dmg: 26, rate: 1.4, spread: 0.07, aim: 0.0008, range: 240, reload: 2.8, zoom: 5, scope: true, recoil: 0.1, pierce: 2, kb: 1, snd: 'sniper',
      desc: 'Lunette ×5 (clic droit) : touche de très loin et traverse deux créatures. Imprécis sans viser.' },
    MINIGUN: { id: 1527, name: 'Mitrailleuse', ammo: 'AMMO_RIFLE', mag: 100, dmg: 4.5, rate: 0.055, auto: true, spread: 0.045, aim: 0.03, range: 80, reload: 4, zoom: 1.1, recoil: 0.012, heavy: 0.55, spin: 0.45, snd: 'minigun',
      desc: '100 balles, cadence infernale après une courte mise en route. Lourde : on avance lentement.' },
    ROCKET_LAUNCHER: { id: 1528, name: 'Lance-roquettes', ammo: 'ROCKET', mag: 1, dmg: 0, rate: 0.6, spread: 0.01, aim: 0.004, range: 160, reload: 2.6, zoom: 1.3, recoil: 0.12, proj: 'missile', power: 3.6, heavy: 0.8, snd: 'rocket',
      desc: 'Tire une roquette qui explose à l’impact. Recule-toi !' },
    GRENADE_LAUNCHER: { id: 1529, name: 'Lance-grenades', ammo: 'GRENADE', mag: 6, dmg: 0, rate: 0.65, spread: 0.02, aim: 0.01, range: 120, reload: 3, zoom: 1.2, recoil: 0.08, proj: 'grenade', power: 2.6, snd: 'thump',
      desc: 'Lance des grenades en cloche, qui explosent à l’impact.' },
    FLAMETHROWER: { id: 1530, name: 'Lance-flammes', ammo: 'GAS_CAN', per: 60, mag: 120, dmg: 1.4, rate: 0.05, auto: true, spread: 0.1, aim: 0.08, range: 8, reload: 2, zoom: 1, recoil: 0, proj: 'flame', snd: 'flame',
      desc: 'Un jet de flammes qui enflamme les créatures et le bois. Une cartouche de gaz = 60 jets.' },
  });
  // munitions : [identifiant, nom, pile, description]
  const AMMO = {
    AMMO_PISTOL: [1531, 'Balles de pistolet', 64, 'Pour le pistolet, le revolver et le pistolet-mitrailleur.'],
    AMMO_RIFLE: [1532, 'Balles de fusil', 64, 'Pour le fusil d’assaut, la carabine, le fusil de précision et la mitrailleuse.'],
    AMMO_SHELL: [1533, 'Cartouches de chasse', 32, 'Pour le fusil à pompe et le fusil à double canon.'],
    ROCKET: [1534, 'Roquette', 8, 'Munition du lance-roquettes.'],
    GAS_CAN: [1536, 'Cartouche de gaz', 16, 'Carburant du lance-flammes (60 jets).'],
  };
  CM.GUN_OF = {}; // identifiant d'objet -> clé de l'arme

  // ------------------------------------------------------------- bloc --
  M.blocks.push(function (K) {
    const { nb } = K;
    nb('ARMORY_TABLE', T({ name: 'Établi d’armurier', tex: { top: 'armory_top', bottom: 'armory_bottom', side: 'armory_side', front: 'armory_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', station: 'armurerie' }));
  });

  // ----------------------------------------------------------- objets --
  M.items.push(function (K) {
    const { defItem } = K;
    for (const [key, g] of Object.entries(GUNS)) {
      defItem(g.id, key, T({ name: g.name, tex: 'gun_' + key.toLowerCase(), stack: 1, type: 'gun', gun: key,
        desc: g.desc + (g.proj === 'flame' ? '' : ' Clic gauche : tirer · clic droit : viser · R : recharger.') }));
      CM.GUN_OF[g.id] = key;
    }
    for (const [key, [id, name, stack, desc]] of Object.entries(AMMO)) defItem(id, key, T({ name, tex: 'ammo_' + key.toLowerCase(), stack, type: 'ammo', desc }));
    defItem(1535, 'GRENADE', T({ name: 'Grenade', tex: 'grenade', stack: 16, type: 'grenade', desc: 'Maintiens le clic droit puis relâche pour la lancer : elle explose au bout de 3 secondes. Sert aussi de munition au lance-grenades.' }));
    defItem(1537, 'GUN_PARTS', T({ name: 'Pièces d’arme', tex: 'gun_parts', stack: 64, desc: 'Ressorts, culasse et détente : pour fabriquer les armes à feu à l’établi d’armurier.' }));
  });

  // --------------------------------------------------------- recettes --
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.STATION_NAMES.armurerie = 'Établi d’armurier';
    CM.STATION_NEAR.armurerie = 'un établi d’armurier';
    const E = (x) => ((x.ext = EXT), x);
    const A = (id, n, ing) => E(r(id, n, ing, 'armurerie', 'armes'));
    CM.recipes.push(
      E(r(B.ARMORY_TABLE, 1, [[I.IRON_INGOT, 4], ['planks', 4], [I.GUNPOWDER, 2]], 'table', 'armes')),
      A(I.GUN_PARTS, 2, [[I.IRON_INGOT, 2], [I.REDSTONE, 1]]),
      A(I.AMMO_PISTOL, 16, [[I.IRON_INGOT, 1], [I.GUNPOWDER, 1]]),
      A(I.AMMO_RIFLE, 16, [[I.IRON_INGOT, 1], [I.COPPER_INGOT, 1], [I.GUNPOWDER, 2]]),
      A(I.AMMO_SHELL, 8, [[I.IRON_INGOT, 1], [I.PAPER, 1], [I.GUNPOWDER, 1]]),
      A(I.ROCKET, 2, [[I.IRON_INGOT, 2], [I.GUNPOWDER, 3], [B.TNT, 1]]),
      A(I.GRENADE, 4, [[I.IRON_INGOT, 3], [I.GUNPOWDER, 3]]),
      A(I.GAS_CAN, 1, [[I.IRON_INGOT, 2], [I.COAL, 4]]),
      A(I.PISTOL, 1, [[I.IRON_INGOT, 3], [I.GUN_PARTS, 1]]),
      A(I.REVOLVER, 1, [[I.IRON_INGOT, 4], [I.GUN_PARTS, 1], ['planks', 1]]),
      A(I.SMG, 1, [[I.IRON_INGOT, 5], [I.GUN_PARTS, 2]]),
      A(I.RIFLE, 1, [[I.IRON_INGOT, 7], [I.GUN_PARTS, 3]]),
      A(I.SHOTGUN, 1, [[I.IRON_INGOT, 5], [I.GUN_PARTS, 2], ['planks', 2]]),
      A(I.DOUBLE_BARREL, 1, [[I.IRON_INGOT, 4], [I.GUN_PARTS, 1], ['planks', 3]]),
      A(I.HUNTING_RIFLE, 1, [[I.IRON_INGOT, 4], [I.GUN_PARTS, 2], ['planks', 3], [B.GLASS, 1]]),
      A(I.SNIPER, 1, [[I.IRON_INGOT, 8], [I.GUN_PARTS, 4], [B.GLASS, 2], [I.DIAMOND, 1]]),
      A(I.MINIGUN, 1, [[I.IRON_INGOT, 12], [I.GUN_PARTS, 6], [I.REDSTONE, 4], [I.DIAMOND, 1]]),
      A(I.ROCKET_LAUNCHER, 1, [[I.IRON_INGOT, 10], [I.GUN_PARTS, 4], [I.GOLD_INGOT, 2], [I.DIAMOND, 1]]),
      A(I.GRENADE_LAUNCHER, 1, [[I.IRON_INGOT, 8], [I.GUN_PARTS, 4], [I.GOLD_INGOT, 1]]),
      A(I.FLAMETHROWER, 1, [[I.IRON_INGOT, 8], [I.GUN_PARTS, 3], [I.FLINT_AND_STEEL, 1], [I.MAGMA_CREAM, 1]]),
    );
  });

  // --------------------------------------------------------- textures --
  M.textures.push(function (X) {
    const { make, put, fill, vary } = X;
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    const rect = (d, r, x0, y0, x1, y1, c, v) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(d, x, y, vary(c, r, v || 0));
    };
    // couleurs
    const K = [34, 35, 40], D = [58, 60, 67], MT = [96, 99, 108], HI = [150, 154, 164], WD = [124, 80, 42], WDD = [90, 56, 28];
    const OL = [84, 96, 58], OLD = [60, 70, 40], OR = [226, 120, 40], RD = [196, 44, 40], GL = [120, 190, 230];
    // Icônes vues de profil : [x0, y0, x1, y1, couleur], canon vers la droite.
    const ICONS = {
      PISTOL: [[3, 5, 14, 8, D], [3, 5, 14, 6, HI], [13, 6, 15, 7, K], [4, 8, 7, 13, K], [7, 8, 9, 9, MT], [8, 9, 9, 10, K]],
      REVOLVER: [[6, 5, 15, 7, MT], [6, 5, 15, 6, HI], [4, 5, 8, 9, D], [5, 6, 7, 8, HI], [2, 8, 5, 13, WD], [2, 12, 4, 13, WDD], [5, 9, 7, 10, K]],
      SMG: [[3, 5, 13, 8, D], [3, 5, 13, 6, MT], [13, 6, 15, 7, K], [4, 8, 6, 12, K], [8, 8, 10, 14, K], [1, 6, 3, 7, MT], [1, 6, 2, 10, MT]],
      RIFLE: [[4, 5, 11, 8, D], [11, 6, 16, 7, K], [10, 5, 14, 8, OL], [0, 6, 4, 9, OLD], [0, 8, 2, 10, OLD], [6, 8, 8, 13, K], [9, 8, 11, 11, K], [6, 4, 8, 5, K]],
      SHOTGUN: [[4, 5, 16, 7, D], [4, 5, 16, 6, MT], [8, 7, 13, 9, WD], [0, 6, 5, 9, WD], [0, 8, 3, 11, WDD], [5, 7, 7, 9, K]],
      DOUBLE_BARREL: [[4, 4, 16, 6, D], [4, 6, 16, 7, MT], [4, 4, 16, 5, HI], [0, 6, 6, 9, WD], [0, 8, 3, 11, WDD], [6, 7, 8, 9, K]],
      HUNTING_RIFLE: [[3, 6, 16, 7, K], [2, 7, 12, 9, WD], [0, 7, 3, 11, WD], [0, 10, 2, 11, WDD], [5, 4, 11, 6, D], [5, 4, 6, 6, GL], [7, 9, 8, 10, K]],
      SNIPER: [[4, 6, 16, 7, K], [3, 6, 11, 9, D], [0, 7, 4, 10, D], [0, 9, 2, 11, K], [4, 3, 11, 5, K], [4, 3, 5, 5, GL], [10, 3, 11, 5, GL], [6, 9, 8, 12, K], [12, 7, 13, 11, MT]],
      MINIGUN: [[6, 4, 16, 5, MT], [6, 6, 16, 7, D], [6, 8, 16, 9, MT], [2, 3, 7, 10, K], [2, 3, 7, 4, D], [3, 10, 6, 13, K], [14, 3, 15, 10, D]],
      ROCKET_LAUNCHER: [[1, 5, 16, 9, OL], [1, 5, 16, 6, [110, 124, 78]], [0, 4, 2, 10, OLD], [14, 4, 16, 10, OLD], [6, 9, 8, 13, K], [10, 9, 12, 12, K], [7, 3, 9, 5, K], [15, 6, 16, 8, OR]],
      GRENADE_LAUNCHER: [[7, 4, 16, 8, D], [7, 4, 16, 5, MT], [3, 4, 8, 10, K], [4, 5, 7, 9, MT], [0, 6, 4, 9, OLD], [5, 10, 7, 13, K]],
      FLAMETHROWER: [[4, 6, 14, 8, D], [13, 5, 16, 9, MT], [1, 8, 6, 13, RD], [1, 8, 6, 9, [230, 90, 80]], [6, 8, 8, 12, K], [15, 6, 16, 8, OR]],
    };
    for (const [key, parts] of Object.entries(ICONS))
      make('gun_' + key.toLowerCase(), (d, r) => {
        clear(d);
        for (const [x0, y0, x1, y1, c] of parts) rect(d, r, x0, y0, x1, y1, c, 6);
      });
    // munitions
    const bullets = (d, r, n, body, tip, len) => {
      clear(d);
      for (let i = 0; i < n; i++) {
        const x = 3 + i * 4;
        rect(d, r, x, 14 - len, x + 2, 14, body, 8);
        rect(d, r, x, 14 - len - 2, x + 2, 14 - len, tip, 6);
      }
    };
    make('ammo_ammo_pistol', (d, r) => bullets(d, r, 3, [214, 170, 70], [150, 110, 60], 5));
    make('ammo_ammo_rifle', (d, r) => bullets(d, r, 3, [206, 160, 64], [180, 120, 70], 9));
    make('ammo_ammo_shell', (d, r) => {
      clear(d);
      for (let i = 0; i < 2; i++) {
        const x = 3 + i * 6;
        rect(d, r, x, 4, x + 4, 11, RD, 10);
        rect(d, r, x, 11, x + 4, 14, [212, 170, 70], 8);
      }
    });
    make('ammo_rocket', (d, r) => {
      clear(d);
      rect(d, r, 2, 7, 12, 10, OL, 8);
      rect(d, r, 12, 7, 15, 10, OR, 6);
      put(d, 15, 8, OR);
      rect(d, r, 1, 5, 3, 7, OLD, 4);
      rect(d, r, 1, 10, 3, 12, OLD, 4);
    });
    make('ammo_gas_can', (d, r) => {
      clear(d);
      rect(d, r, 4, 4, 12, 15, RD, 10);
      rect(d, r, 4, 4, 12, 5, [230, 90, 80]);
      rect(d, r, 7, 1, 10, 4, MT, 4);
      rect(d, r, 5, 8, 11, 11, [240, 210, 60], 6);
    });
    make('grenade', (d, r) => {
      clear(d);
      for (let y = 4; y < 15; y++)
        for (let x = 3; x < 13; x++) {
          const q = (x - 7.5) ** 2 / 20 + (y - 9.5) ** 2 / 28;
          if (q < 1) put(d, x, y, vary((x + y) % 3 === 0 ? OLD : OL, r, 8));
        }
      rect(d, r, 6, 1, 10, 4, MT, 4);
      rect(d, r, 10, 2, 12, 3, HI);
      put(d, 12, 3, HI);
      put(d, 12, 4, HI);
    });
    make('gun_parts', (d, r) => {
      clear(d);
      rect(d, r, 2, 3, 9, 6, D, 8);
      rect(d, r, 2, 3, 9, 4, HI);
      for (let x = 9; x < 14; x += 2) rect(d, r, x, 8, x + 1, 13, MT); // ressort
      rect(d, r, 9, 8, 14, 9, MT);
      rect(d, r, 3, 9, 6, 14, K, 6);
      put(d, 7, 11, HI);
    });
    // établi d'armurier
    make('armory_top', (d, r) => {
      fill(d, r, [104, 72, 44], 10);
      for (let x = 0; x < 16; x++) put(d, x, 0, [70, 46, 26]), put(d, x, 15, [70, 46, 26]);
      rect(d, r, 3, 5, 13, 8, D, 6); // arme posée
      rect(d, r, 3, 5, 13, 6, HI);
      rect(d, r, 4, 8, 6, 11, K);
      rect(d, r, 10, 10, 13, 13, [200, 160, 70], 10); // douilles
    });
    make('armory_side', (d, r) => {
      fill(d, r, [96, 66, 40], 10);
      for (let x = 0; x < 16; x++) put(d, x, 0, [140, 100, 60]), put(d, x, 1, [120, 84, 50]);
      rect(d, r, 2, 4, 14, 14, [60, 62, 68], 8);
      rect(d, r, 3, 6, 13, 7, MT);
      rect(d, r, 3, 10, 13, 11, MT);
    });
    make('armory_front', (d, r) => {
      fill(d, r, [96, 66, 40], 10);
      for (let x = 0; x < 16; x++) put(d, x, 0, [140, 100, 60]), put(d, x, 1, [120, 84, 50]);
      rect(d, r, 2, 4, 14, 14, [60, 62, 68], 8);
      rect(d, r, 4, 6, 12, 8, D);
      rect(d, r, 4, 6, 12, 7, HI);
      rect(d, r, 5, 8, 7, 11, K);
      rect(d, r, 7, 12, 9, 13, [200, 160, 70]);
    });
    make('armory_bottom', (d, r) => fill(d, r, [80, 54, 32], 8));
    // modèles 3D des armes
    make('gunm_black', (d, r) => fill(d, r, K, 4));
    make('gunm_dark', (d, r) => fill(d, r, D, 5));
    make('gunm_metal', (d, r) => {
      fill(d, r, MT, 6);
      for (let x = 0; x < 16; x++) put(d, x, 1, vary(HI, r, 6));
    });
    make('gunm_chrome', (d, r) => {
      fill(d, r, [176, 180, 188], 8);
      for (let x = 0; x < 16; x++) put(d, x, 2, [230, 232, 238]);
    });
    make('gunm_wood', (d, r) => {
      fill(d, r, WD, 8);
      for (let y = 2; y < 16; y += 5) for (let x = 0; x < 16; x++) put(d, x, y, vary(WDD, r, 6));
    });
    make('gunm_olive', (d, r) => fill(d, r, OL, 7));
    make('gunm_red', (d, r) => fill(d, r, RD, 8));
    make('gunm_orange', (d, r) => fill(d, r, OR, 8));
    make('gunm_lens', (d, r) => {
      fill(d, r, [40, 80, 110], 6);
      for (let k = 0; k < 5; k++) put(d, 4 + k, 4 + k, [170, 220, 250]);
    });
    make('muzzle', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const q = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5), ray = 5 + 2.5 * Math.cos(a * 5);
          if (q < ray) put(d, x, y, q < 2.5 ? [255, 255, 230] : q < 4 ? [255, 220, 110] : [255, 150, 40]);
        }
    });
    make('tracer', (d, r) => fill(d, r, [255, 236, 150], 10));
    make('flame', (d, r) => {
      fill(d, r, [255, 150, 40], 30);
      for (let k = 0; k < 30; k++) put(d, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? [255, 230, 120] : [230, 70, 20]);
    });
    // bandit
    make('mob_bandit_cloth', (d, r) => {
      fill(d, r, [44, 46, 54], 6);
      for (let x = 0; x < 16; x++) put(d, x, 12, [30, 30, 36]);
    });
    make('mob_bandit_pants', (d, r) => fill(d, r, [58, 70, 96], 8));
    make('mob_bandit_face', (d, r) => {
      fill(d, r, [30, 30, 34], 5); // cagoule
      for (let x = 3; x < 13; x++) for (let y = 6; y < 9; y++) put(d, x, y, [196, 150, 120]);
      put(d, 5, 7, [30, 20, 20]), put(d, 10, 7, [30, 20, 20]);
    });
    make('mob_bandit_head', (d, r) => fill(d, r, [30, 30, 34], 5));
    make('mob_bandit_skin', (d, r) => fill(d, r, [196, 150, 120], 6));
  });

  // ------------------------------------------------------------ bandit --
  // Humain cagoulé armé d'un pistolet : garde ses distances et tire (balles, pas de flèches).
  MOBS.bandit = {
    name: 'Bandit', aliases: ['bandit', 'voyou'], hw: 0.3, h: 1.85, hp: 22, speed: 2.6, hostile: true, xp: 7, sound: 'huh',
    update(e, m, dt, c) {
      m.ai.attackCd = Math.max(0, (m.ai.attackCd || 0) - dt);
      m.ai.flash = Math.max(0, (m.ai.flash || 0) - dt);
      const p = c.p;
      const see = p && p.alive && c.distP < 26 && Math.abs(c.dyp) < 10;
      m.ai.chasing = !!see;
      if (!see) {
        m.ai.timer = (m.ai.timer || 0) - dt;
        if (m.ai.timer <= 0) {
          m.ai.timer = 2 + e.rand() * 3;
          m.ai.dir = e.rand() < 0.6 ? e.rand() * Math.PI * 2 : null;
        }
        return m.ai.dir !== null && m.ai.dir !== undefined ? { tvx: -Math.sin(m.ai.dir) * 1.2, tvz: -Math.cos(m.ai.dir) * 1.2, jump: (m.hitX || m.hitZ) && m.onGround } : {};
      }
      const dx = p.x - m.x, dz = p.z - m.z, d = c.distP, dir = Math.atan2(-dx, -dz);
      // tire s'il voit sa cible (rien de solide entre les deux)
      if (m.ai.attackCd <= 0 && d < 24 && CM.Guns && CM.Guns.clearShot(e.game.world, m.x, m.y + 1.5, m.z, p.x, p.y + 1.4, p.z)) {
        m.ai.attackCd = { easy: 1.6, normal: 1.1, hard: 0.75 }[e.game.difficulty] || 1.1;
        m.ai.flash = 0.08;
        CM.Guns.mobShot(e, m, p, { easy: 0.3, normal: 0.45, hard: 0.6 }[e.game.difficulty] || 0.45, 3, 'Un bandit');
      }
      const sp = d > 12 ? 2.6 : d < 6 ? -1.6 : 0.6 * Math.sin(e.game.clock + m.uid);
      return { tvx: -Math.sin(dir) * sp, tvz: -Math.cos(dir) * sp, face: dir, jump: (m.hitX || m.hitZ) && m.onGround };
    },
    loot(e, m, meat, more) {
      const I = CM.I;
      e.addDrop(I.AMMO_PISTOL, 2 + Math.floor(e.rand() * 5) + (more || 0) * 2, m.x, m.y + 0.5, m.z);
      if (e.rand() < 0.1 + 0.03 * (more || 0)) e.addDrop(I.PISTOL, 1, m.x, m.y + 0.5, m.z, { xp: 0 });
      if (e.rand() < 0.25) e.addDrop(I.GUN_PARTS, 1, m.x, m.y + 0.5, m.z);
      if (e.rand() < 0.3) e.addDrop(I.GOLD_INGOT, 1, m.x, m.y + 0.5, m.z);
    },
    render(e, batch, m, l, f, sw) {
      const L = CM.Textures.layer, C = L.mob_bandit_cloth, P = L.mob_bandit_pants, S = L.mob_bandit_skin, H = L.mob_bandit_head;
      const aim = m.ai.chasing ? -1.5 : sw * 0.5;
      e.part(batch, e.M, -0.12, 0.72, 0, sw * 0.7, [-0.12, -0.72, -0.12, 0.12, 0, 0.12], P, l, f);
      e.part(batch, e.M, 0.12, 0.72, 0, -sw * 0.7, [-0.12, -0.72, -0.12, 0.12, 0, 0.12], P, l, f);
      e.part(batch, e.M, 0, 0.72, 0, 0, [-0.25, 0, -0.13, 0.25, 0.68, 0.13], C, l, f);
      e.part(batch, e.M, -0.36, 1.36, 0, m.ai.chasing ? -1.2 : -sw * 0.5, [-0.1, -0.64, -0.1, 0.1, 0.04, 0.1], C, l, f);
      e.part(batch, e.M, 0.36, 1.36, 0, aim, [-0.1, -0.64, -0.1, 0.1, 0.04, 0.1], C, l, f);
      e.part(batch, e.M, 0.36, 1.36, 0, aim, [-0.09, -0.72, -0.09, 0.09, -0.62, 0.09], S, l, f);
      e.part(batch, e.M, 0, 1.4, 0, 0, [-0.22, 0, -0.22, 0.22, 0.44, 0.22], [H, H, H, H, H, L.mob_bandit_face], l, f);
      if (m.ai.chasing) {
        // pistolet tenu à bout de bras, éclair au bout du canon quand il tire
        // (bras tendu : le canon prolonge le bras, la crosse pend en dessous)
        e.part(batch, e.M, 0.36, 1.36, 0, aim, [-0.03, -0.98, -0.02, 0.03, -0.66, 0.05], L.gunm_dark, l, f);
        e.part(batch, e.M, 0.36, 1.36, 0, aim, [-0.025, -0.76, -0.14, 0.025, -0.68, -0.02], L.gunm_black, l, f);
        if (m.ai.flash > 0) e.part(batch, e.M, 0.36, 1.36, 0, aim, [-0.09, -1.14, -0.07, 0.09, -0.98, 0.1], L.muzzle, [1, 1], 1);
      }
    },
  };
})();
