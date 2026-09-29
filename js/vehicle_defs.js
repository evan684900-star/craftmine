'use strict';
// Extension « Véhicules » : voiture, voiture de sport, 4x4, camion, moto, quad, voiture de police,
// hélicoptère, avion et bateau à moteur ; roues, moteur, bidon d'essence et établi de mécanicien.
// La logique (conduite, vol, carburant, dégâts, caméra, réseau) est dans vehicles.js.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });
  const EXT = 'vehicles';
  const T = (o) => Object.assign({ ext: EXT }, o);

  // Caractéristiques : maxV vitesse (blocs/s), acc accélération, turn virage, grip adhérence,
  // hw demi-largeur de la boîte de collision, h hauteur, step marche franchie, hp solidité,
  // seats places [x, y, z] (la 1re : conducteur), color teinte par défaut (teintures),
  // fly : 'heli' ou 'plane', water : sur l'eau, offroad : sable et neige sans ralentir.
  const VEH = (CM.VEH = {
    car: { item: 'CAR', id: 1541, name: 'Voiture', maxV: 17, acc: 9, turn: 1.9, grip: 0.9, hw: 0.9, h: 1.8, step: 1, hp: 60, color: 'RED', seats: [[-0.34, 0.24, 0.05], [0.34, 0.24, 0.05], [-0.34, 0.24, 0.72], [0.34, 0.24, 0.72]], desc: 'Quatre places, polyvalente.' },
    sport: { item: 'SPORTS_CAR', id: 1542, name: 'Voiture de sport', maxV: 28, acc: 16, turn: 2.1, grip: 0.93, hw: 0.9, h: 1.05, step: 0.6, hp: 50, color: 'YELLOW', seats: [[-0.32, 0.18, 0.2], [0.32, 0.18, 0.2]], desc: 'Très rapide, mais ne franchit pas les marches.' },
    jeep: { item: 'JEEP', id: 1543, name: '4x4', maxV: 15, acc: 10, turn: 1.8, grip: 0.95, hw: 0.95, h: 1.7, step: 1.1, hp: 90, color: 'GREEN', offroad: true, seats: [[-0.36, 0.55, 0], [0.36, 0.55, 0], [-0.36, 0.55, 0.75], [0.36, 0.55, 0.75]], desc: 'Tout-terrain : sable, neige et pentes sans ralentir.' },
    truck: { item: 'TRUCK', id: 1544, name: 'Camion', maxV: 12, acc: 6, turn: 1.35, grip: 0.95, hw: 1.05, h: 2.4, step: 1.1, hp: 130, color: 'WHITE', chest: 27, seats: [[-0.4, 0.95, -0.95], [0.4, 0.95, -0.95]], desc: 'Lent mais costaud, avec une benne de 27 cases (accroupi + clic droit pour l’ouvrir).' },
    moto: { item: 'MOTORBIKE', id: 1545, name: 'Moto', maxV: 23, acc: 14, turn: 2.6, grip: 0.86, hw: 0.4, h: 1.2, step: 1, hp: 30, color: 'BLACK', seats: [[0, 0.5, 0.1], [0, 0.6, 0.55]], desc: 'Étroite et nerveuse : passe partout.' },
    quad: { item: 'QUAD', id: 1546, name: 'Quad', maxV: 14, acc: 11, turn: 2.4, grip: 0.9, hw: 0.65, h: 1.15, step: 1.1, hp: 40, color: 'ORANGE', offroad: true, seats: [[0, 0.55, 0.15]], desc: 'Petit tout-terrain qui grimpe partout.' },
    police: { item: 'POLICE_CAR', id: 1547, name: 'Voiture de police', maxV: 21, acc: 11, turn: 2, grip: 0.92, hw: 0.9, h: 1.9, step: 1, hp: 80, color: 'WHITE', siren: true, fixed: true, seats: [[-0.34, 0.24, 0.05], [0.34, 0.24, 0.05], [-0.34, 0.24, 0.72], [0.34, 0.24, 0.72]], desc: 'Gyrophares et sirène (touche H).' },
    heli: { item: 'HELICOPTER', id: 1548, name: 'Hélicoptère', fly: 'heli', maxV: 20, climb: 8, acc: 7, turn: 1.6, hw: 1, h: 2.3, hp: 80, color: 'BLUE', seats: [[-0.32, 0.55, -0.35], [0.32, 0.55, -0.35], [0, 0.55, 0.45]], desc: 'Saut : monter · course : descendre · avancer, reculer, tourner comme en voiture.' },
    plane: { item: 'PLANE', id: 1549, name: 'Avion', fly: 'plane', maxV: 42, minV: 13, acc: 8, turn: 1.3, hw: 1, h: 2.1, hp: 60, color: 'WHITE', seats: [[0, 0.75, -0.2], [0, 0.75, 0.6]], desc: 'Accélère sur une piste pour décoller (13 blocs/s) ; il suit ton regard. Ralentis pour atterrir.' },
    speedboat: { item: 'SPEEDBOAT', id: 1550, name: 'Bateau à moteur', water: true, maxV: 20, acc: 10, turn: 2, grip: 0.6, hw: 0.95, h: 1, hp: 60, color: 'WHITE', seats: [[-0.3, 0.3, 0.1], [0.3, 0.3, 0.1], [0, 0.3, 0.8]], desc: 'File sur l’eau (inutile sur terre).' },
  });
  CM.VEH_OF = {}; // identifiant d'objet -> type de véhicule

  // ------------------------------------------------------------- bloc --
  M.blocks.push(function (K) {
    const { nb } = K;
    nb('MECHANIC_BENCH', T({ name: 'Établi de mécanicien', tex: { top: 'mech_top', bottom: 'mech_bottom', side: 'mech_side', front: 'mech_front' }, hardness: 3, tool: 'pickaxe', sound: 'metal', station: 'garage' }));
  });

  // ----------------------------------------------------------- objets --
  M.items.push(function (K) {
    const { defItem } = K;
    defItem(1538, 'WHEEL', T({ name: 'Roue', tex: 'veh_wheel_icon', stack: 16, desc: 'Pour fabriquer les véhicules (établi de mécanicien).' }));
    defItem(1539, 'ENGINE', T({ name: 'Moteur', tex: 'veh_engine_icon', stack: 8, desc: 'Le cœur des véhicules.' }));
    defItem(1540, 'FUEL_CAN', T({ name: 'Bidon d’essence', tex: 'veh_fuel_icon', stack: 16, type: 'fuel', desc: 'Clic droit sur un véhicule pour faire le plein (+40 %). Le charbon marche aussi (+8 %).' }));
    for (const [type, v] of Object.entries(VEH)) {
      defItem(v.id, v.item, T({ name: v.name, tex: 'veh_icon_' + type, stack: 1, type: 'vehicle', vehicle: type, desc: v.desc + ' Clic droit pour le poser, clic droit dessus pour monter, accroupi pour descendre.' }));
      CM.VEH_OF[v.id] = type;
    }
  });

  // --------------------------------------------------------- recettes --
  M.recipes.push(function (K) {
    const { r } = K;
    const B = CM.B, I = CM.I;
    CM.STATION_NAMES.garage = 'Établi de mécanicien';
    CM.STATION_NEAR.garage = 'un établi de mécanicien';
    for (const [type, v] of Object.entries(VEH)) CM.CART_ITEMS[type] = I[v.item];
    const E = (x) => ((x.ext = EXT), x);
    const G = (id, n, ing) => E(r(id, n, ing, 'garage', 'vehicules'));
    CM.recipes.push(
      E(r(B.MECHANIC_BENCH, 1, [[I.IRON_INGOT, 6], ['planks', 2], [I.REDSTONE, 2]], 'table', 'vehicules')),
      G(I.WHEEL, 2, [[I.IRON_INGOT, 1], [I.LEATHER, 2]]),
      G(I.ENGINE, 1, [[I.IRON_INGOT, 4], [I.COPPER_INGOT, 2], [I.REDSTONE, 2]]),
      G(I.FUEL_CAN, 1, [[I.IRON_INGOT, 1], [I.COAL, 3]]),
      G(I.CAR, 1, [[I.IRON_INGOT, 6], [I.WHEEL, 4], [I.ENGINE, 1], [B.GLASS, 2]]),
      G(I.SPORTS_CAR, 1, [[I.IRON_INGOT, 8], [I.WHEEL, 4], [I.ENGINE, 2], [B.GLASS, 2], [I.DIAMOND, 1]]),
      G(I.JEEP, 1, [[I.IRON_INGOT, 8], [I.WHEEL, 5], [I.ENGINE, 1], [B.GLASS, 1]]),
      G(I.TRUCK, 1, [[I.IRON_INGOT, 12], [I.WHEEL, 6], [I.ENGINE, 2], [B.CHEST, 1], [B.GLASS, 2]]),
      G(I.MOTORBIKE, 1, [[I.IRON_INGOT, 4], [I.WHEEL, 2], [I.ENGINE, 1]]),
      G(I.QUAD, 1, [[I.IRON_INGOT, 5], [I.WHEEL, 4], [I.ENGINE, 1]]),
      G(I.POLICE_CAR, 1, [[I.IRON_INGOT, 6], [I.WHEEL, 4], [I.ENGINE, 1], [B.GLASS, 2], [B.REDSTONE_LAMP, 2]]),
      G(I.HELICOPTER, 1, [[I.IRON_INGOT, 14], [I.ENGINE, 2], [B.GLASS, 4], [I.DIAMOND, 2]]),
      G(I.PLANE, 1, [[I.IRON_INGOT, 12], [I.ENGINE, 2], [I.WHEEL, 3], [B.GLASS, 2], [I.FEATHER, 4]]),
      G(I.SPEEDBOAT, 1, [[I.BOAT, 1], [I.ENGINE, 1], [I.IRON_INGOT, 4]]),
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
    const K = [26, 27, 30], D = [52, 54, 60], MT = [150, 154, 164], GL = [120, 180, 220], TY = [30, 30, 32];
    // peintures (une par teinture) : reflet clair en haut
    for (const dy of CM.DYES) {
      const c = dy.c, hi = c.map((v) => Math.min(255, v + 45));
      make('veh_paint_' + dy.key.toLowerCase(), (d, r) => {
        fill(d, r, c, 5);
        for (let x = 0; x < 16; x++) put(d, x, 1, hi);
      });
    }
    make('veh_glass', (d, r) => {
      fill(d, r, [70, 110, 140], 6);
      for (let k = 0; k < 6; k++) put(d, 3 + k, 2 + k, [190, 225, 245]);
      for (let x = 0; x < 16; x++) put(d, x, 0, K), put(d, x, 15, K);
    });
    make('veh_dark', (d, r) => fill(d, r, D, 4));
    make('veh_black', (d, r) => fill(d, r, K, 3));
    make('veh_tire', (d, r) => {
      fill(d, r, TY, 4);
      for (let y = 0; y < 16; y += 3) for (let x = 0; x < 16; x++) put(d, x, y, [18, 18, 20]);
    });
    make('veh_hub', (d, r) => {
      fill(d, r, TY, 3);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) put(d, x, y, (x + y) % 4 ? MT : [200, 204, 212]);
    });
    make('veh_chrome', (d, r) => {
      fill(d, r, [186, 190, 198], 6);
      for (let x = 0; x < 16; x++) put(d, x, 3, [240, 242, 248]);
    });
    make('veh_head', (d, r) => fill(d, r, [255, 246, 200], 4));
    make('veh_tail', (d, r) => fill(d, r, [220, 30, 30], 6));
    make('veh_siren_red', (d, r) => fill(d, r, [255, 40, 40], 8));
    make('veh_siren_blue', (d, r) => fill(d, r, [50, 90, 255], 8));
    make('veh_seat', (d, r) => fill(d, r, [60, 44, 36], 8));
    make('veh_police', (d, r) => {
      fill(d, r, [236, 238, 240], 4);
      for (let x = 0; x < 16; x++) for (let y = 9; y < 13; y++) put(d, x, y, [24, 36, 90]);
    });
    make('veh_cargo', (d, r) => {
      fill(d, r, [200, 204, 210], 6);
      for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) put(d, x, y, [160, 164, 170]);
    });
    make('veh_rotor', (d, r) => fill(d, r, [40, 42, 46], 4));
    // établi de mécanicien
    make('mech_top', (d, r) => {
      fill(d, r, [70, 74, 82], 8);
      for (let x = 0; x < 16; x++) put(d, x, 0, [40, 42, 48]), put(d, x, 15, [40, 42, 48]);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) if ((x - 7.5) ** 2 + (y - 7.5) ** 2 < 14) put(d, x, y, (x - 7.5) ** 2 + (y - 7.5) ** 2 < 4 ? MT : TY);
      rect(d, r, 11, 2, 15, 4, [200, 60, 50]);
    });
    make('mech_side', (d, r) => {
      fill(d, r, [60, 64, 72], 8);
      rect(d, r, 1, 3, 15, 14, [180, 60, 40], 8);
      for (let y = 5; y < 13; y += 3) rect(d, r, 2, y, 14, y + 1, [120, 40, 30]);
    });
    make('mech_front', (d, r) => {
      fill(d, r, [60, 64, 72], 8);
      rect(d, r, 1, 3, 15, 14, [180, 60, 40], 8);
      rect(d, r, 3, 6, 13, 8, MT); // clé
      rect(d, r, 2, 5, 4, 9, MT);
      rect(d, r, 12, 5, 14, 9, MT);
    });
    make('mech_bottom', (d, r) => fill(d, r, [50, 52, 58], 6));
    // icônes des pièces
    make('veh_wheel_icon', (d, r) => {
      clear(d);
      for (let y = 1; y < 15; y++)
        for (let x = 1; x < 15; x++) {
          const q = Math.hypot(x - 7.5, y - 7.5);
          if (q < 6.8) put(d, x, y, q < 3 ? (q < 1.5 ? [90, 92, 98] : MT) : vary(TY, r, 6));
        }
    });
    make('veh_engine_icon', (d, r) => {
      clear(d);
      rect(d, r, 2, 5, 14, 13, D, 6);
      for (let x = 3; x < 13; x += 2) rect(d, r, x, 2, x + 1, 5, MT);
      rect(d, r, 5, 7, 11, 11, [140, 60, 40], 6);
      rect(d, r, 0, 8, 2, 10, MT);
      rect(d, r, 14, 8, 16, 10, MT);
    });
    make('veh_fuel_icon', (d, r) => {
      clear(d);
      rect(d, r, 3, 4, 13, 15, [200, 40, 36], 8);
      rect(d, r, 3, 4, 13, 5, [236, 90, 80]);
      rect(d, r, 9, 1, 12, 4, K);
      rect(d, r, 4, 2, 8, 3, K);
      rect(d, r, 5, 8, 11, 12, [240, 210, 70], 4);
    });
    // icônes des véhicules (de profil, vers la droite) : [x0, y0, x1, y1, couleur ou 'p' (peinture)]
    const ICONS = {
      car: [[1, 7, 15, 11, 'p'], [4, 4, 11, 7, 'p'], [5, 5, 7, 7, GL], [8, 5, 10, 7, GL], [14, 8, 15, 9, [255, 240, 180]], [2, 10, 5, 13, TY], [11, 10, 14, 13, TY]],
      sport: [[0, 8, 16, 11, 'p'], [5, 6, 11, 8, 'p'], [6, 6, 10, 8, GL], [0, 6, 2, 8, K], [2, 10, 5, 13, TY], [11, 10, 14, 13, TY]],
      jeep: [[1, 6, 15, 11, 'p'], [3, 3, 10, 6, K], [4, 3, 9, 4, K], [9, 3, 10, 6, GL], [0, 6, 1, 10, TY], [1, 10, 5, 14, TY], [11, 10, 15, 14, TY]],
      truck: [[0, 3, 10, 11, [200, 204, 210]], [10, 5, 16, 11, 'p'], [12, 6, 15, 8, GL], [1, 10, 4, 13, TY], [5, 10, 8, 13, TY], [12, 10, 15, 13, TY]],
      moto: [[4, 7, 12, 9, 'p'], [5, 6, 9, 7, K], [11, 4, 12, 8, MT], [1, 9, 5, 13, TY], [11, 9, 15, 13, TY]],
      quad: [[3, 7, 13, 10, 'p'], [6, 6, 10, 7, K], [11, 5, 12, 8, MT], [1, 9, 6, 14, TY], [10, 9, 15, 14, TY]],
      police: [[1, 7, 15, 11, [236, 238, 240]], [1, 9, 15, 10, [24, 36, 90]], [4, 4, 11, 7, [236, 238, 240]], [5, 5, 7, 7, GL], [8, 5, 10, 7, GL], [5, 3, 7, 4, [255, 40, 40]], [8, 3, 10, 4, [50, 90, 255]], [2, 10, 5, 13, TY], [11, 10, 14, 13, TY]],
      heli: [[7, 5, 15, 11, 'p'], [11, 6, 15, 9, GL], [0, 6, 8, 8, 'p'], [0, 4, 2, 8, 'p'], [1, 2, 16, 3, K], [10, 3, 11, 5, K], [7, 12, 16, 13, K]],
      plane: [[1, 7, 15, 10, 'p'], [5, 6, 12, 7, 'p'], [10, 6, 12, 7, GL], [1, 4, 3, 7, 'p'], [15, 5, 16, 12, K], [6, 10, 7, 13, K], [12, 10, 13, 13, K]],
      speedboat: [[1, 8, 15, 12, 'p'], [2, 11, 14, 13, 'p'], [8, 6, 11, 8, GL], [0, 7, 2, 11, K]],
    };
    for (const [type, parts] of Object.entries(ICONS)) {
      const paint = CM.DYES.find((dy) => dy.key === VEH[type].color).c;
      make('veh_icon_' + type, (d, r) => {
        clear(d);
        for (const [x0, y0, x1, y1, c] of parts) rect(d, r, x0, y0, x1, y1, c === 'p' ? paint : c, 6);
      });
    }
  });
})();
