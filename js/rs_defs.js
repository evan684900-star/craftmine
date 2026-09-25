'use strict';
// Redstone (comme dans Minecraft) : blocs, états, modèles, recettes et textures.
// Chaque état est un bloc à part (familles d'états, voir family()). Ces définitions sont
// appelées par blocks.js (blocs, objets, recettes) et textures.js (images), dans cet ordre.
(function () {
  const M = (CM.MORE = CM.MORE || { blocks: [], items: [], recipes: [], textures: [] });

  // Directions : 0 +x (est), 1 -x (ouest), 2 +y (haut), 3 -y (bas), 4 +z (sud), 5 -z (nord).
  const DV = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const OPP = [1, 0, 3, 2, 5, 4];
  const HD = [0, 1, 4, 5];
  CM.DIRV = DV;
  CM.OPP = OPP;
  CM.HDIRS = HD;
  CM.dirOf = (x, y, z) => DV.findIndex((v) => v[0] === x && v[1] === y && v[2] === z);

  // ---- rotations des boîtes (en 1/16 de bloc) ----
  // rotY : modèle dessiné tourné vers -z (nord), tourné vers la direction horizontale d.
  const rotYp = (x, z, d) => (d === 5 ? [x, z] : d === 4 ? [16 - x, 16 - z] : d === 0 ? [16 - z, x] : [z, 16 - x]);
  const rotY = (b, d) => {
    const [ax, az] = rotYp(b[0], b[2], d), [cx, cz] = rotYp(b[3], b[5], d);
    return [Math.min(ax, cx), b[1], Math.min(az, cz), Math.max(ax, cx), b[4], Math.max(az, cz)];
  };
  // rot6 : modèle dessiné tourné vers le haut, tourné vers la direction d (6 directions).
  const rot6p = (x, y, z, d) =>
    d === 2 ? [x, y, z] : d === 3 ? [x, 16 - y, 16 - z] : d === 5 ? [x, z, 16 - y] : d === 4 ? [x, 16 - z, y] : d === 0 ? [y, 16 - x, z] : [16 - y, x, z];
  const rot6 = (b, d) => {
    const a = rot6p(b[0], b[1], b[2], d), c = rot6p(b[3], b[4], b[5], d);
    return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])];
  };
  // Directions tournées de la même façon (pour savoir quelle face devient laquelle).
  const vecIdx = (v) => DV.findIndex((q) => q[0] === v[0] && q[1] === v[1] && q[2] === v[2]);
  const rotYDir = (c, d) => {
    const [x, y, z] = DV[c];
    const v = d === 5 ? [x, y, z] : d === 4 ? [-x, y, -z] : d === 0 ? [-z, y, x] : [z, y, -x];
    return vecIdx(v);
  };
  const rot6Dir = (c, d) => {
    const [x, y, z] = DV[c];
    const v = d === 2 ? [x, y, z] : d === 3 ? [x, -y, -z] : d === 5 ? [x, z, -y] : d === 4 ? [x, -z, y] : d === 0 ? [y, -x, z] : [-y, x, z];
    return vecIdx(v);
  };
  // Textures d'une boîte dessinée dans le repère du modèle -> textures par face du monde.
  const turnFaces = (faces, fn, d) => {
    if (typeof faces === 'string') return faces;
    const out = [];
    for (let c = 0; c < 6; c++) out[fn(c, d)] = faces[c];
    return out;
  };
  const partY = (b, t, d) => ({ b: rotY(b, d), t: turnFaces(t, rotYDir, d) });
  const part6 = (b, t, d) => ({ b: rot6(b, d), t: turnFaces(t, rot6Dir, d) });
  const union = (parts) => [0, 1, 2].map((a) => Math.min(...parts.map((p) => p.b[a]))).concat([3, 4, 5].map((a) => Math.max(...parts.map((p) => p.b[a]))));
  CM.rotY = rotY;
  CM.rot6 = rot6;

  // ---- familles d'états ----
  // fields : [[nom, [valeurs…]], …] ; make(état) -> propriétés du bloc. Le premier état
  // (ou `base`) est l'objet que l'on tient ; les autres sont cachés et rendent celui-ci.
  const FAM = (CM.RSFAM = {});
  function family(K, name, kind, fields, make, opts) {
    opts = opts || {};
    const f = { name, fields, map: new Map(), ids: [] };
    FAM[name] = f;
    const keyOf = (st) => fields.map(([n]) => String(st[n])).join('|');
    f.key = keyOf;
    const combos = [{}];
    for (const [n, vals] of fields) {
      const next = [];
      for (const c of combos) for (const v of vals) next.push(Object.assign({}, c, { [n]: v }));
      combos.splice(0, combos.length, ...next);
    }
    const baseKey = keyOf(opts.base || combos[0]);
    let baseId = 0;
    for (const st of combos) {
      const k = keyOf(st);
      const isBase = k === baseKey;
      const props = make(st, isBase);
      const rs = Object.assign({ k: kind, fam: name }, st, props.rs || {});
      delete props.rs;
      props.rs = rs;
      if (props.hidden === undefined) props.hidden = !isBase;
      let id;
      const ex = opts.existing && opts.existing[k];
      if (ex !== undefined) {
        if (typeof props.tex === 'string') props.tex = { top: props.tex, bottom: props.tex, side: props.tex, front: props.tex };
        Object.assign(CM.blocks[ex], props);
        id = ex;
      } else id = K.nb(opts.key(st, isBase), props).id;
      if (props.model && !props.box) CM.blocks[id].box = union(props.model);
      f.map.set(k, id);
      f.ids.push(id);
      if (isBase) baseId = id;
    }
    f.base = baseId;
    for (const id of f.ids) if (!opts.keepDrop) CM.blocks[id].drop = baseId;
    return f;
  }
  // Même famille, autre état : CM.rsWith(id, { on: true }).
  CM.rsWith = function (id, changes) {
    const b = CM.blocks[id], rs = b && b.rs;
    if (!rs || !rs.fam) return id;
    const f = FAM[rs.fam];
    const st = {};
    for (const [n] of f.fields) st[n] = n in changes ? changes[n] : rs[n];
    const r = f.map.get(f.key(st));
    return r === undefined ? id : r;
  };
  CM.rsFam = (name) => FAM[name];
  CM.rsFamily = family;
  CM.partY = partY;
  CM.part6 = part6;

  // ---- logique partagée (moteur et maillage) ----
  const blk = (id) => CM.blocks[id] || CM.blocks[0];
  const RSX = (CM.RSX = {
    isWire: (id) => {
      const b = CM.blocks[id];
      return !!(b && b.rs && b.rs.k === 'wire');
    },
    conductor: (id) => !!(CM.blocks[id] && CM.blocks[id].conductor),
    // Peut-on poser de la redstone (ou un rail, une plaque…) sur ce bloc ?
    solidTop: (id) => {
      const b = CM.blocks[id];
      if (!b || !b.col) return false;
      const c = b.col;
      return c[4] >= 1 && c[0] <= 0 && c[2] <= 0 && c[3] >= 1 && c[5] >= 1;
    },
    // Face pleine (pour accrocher un levier, un bouton, une torche murale…).
    fullFace: (id) => {
      const b = CM.blocks[id];
      return !!(b && b.col && b.col[0] <= 0 && b.col[1] <= 0 && b.col[2] <= 0 && b.col[3] >= 1 && b.col[4] >= 1 && b.col[5] >= 1);
    },
    // La poudre se relie-t-elle à ce voisin (d : direction du fil vers lui) ?
    connectsTo(id, d) {
      const rs = blk(id).rs;
      if (!rs) return false;
      switch (rs.k) {
        case 'wire':
        case 'rblock':
        case 'torch':
        case 'lever':
        case 'button':
        case 'plate':
        case 'target':
        case 'daylight':
        case 'hook':
        case 'sculk':
        case 'comparator':
          return true;
        case 'repeater':
          return rs.facing === d || rs.facing === OPP[d];
        case 'observer':
          return rs.facing === d;
        case 'rail':
          return rs.type === 'detector';
        default:
          return false;
      }
    },
    // Côtés reliés d'un fil : get(dx, dy, dz) donne l'identifiant voisin.
    // sides : bits des directions HD (0 +x, 1 -x, 2 +z, 3 -z) ; up : le fil grimpe sur ce côté.
    wireConn(get) {
      let sides = 0, up = 0;
      const openAbove = !RSX.conductor(get(0, 1, 0));
      for (let k = 0; k < 4; k++) {
        const d = HD[k], dx = DV[d][0], dz = DV[d][2];
        const n = get(dx, 0, dz);
        if (RSX.connectsTo(n, d)) sides |= 1 << k;
        else {
          if (!RSX.conductor(n) && RSX.isWire(get(dx, -1, dz))) sides |= 1 << k;
          if (openAbove && RSX.isWire(get(dx, 1, dz))) {
            sides |= 1 << k;
            up |= 1 << k;
          }
        }
      }
      return { sides, up };
    },
    // Côtés reliés d'un fil de déclenchement (ficelle).
    tripConn(get) {
      let sides = 0;
      for (let k = 0; k < 4; k++) {
        const d = HD[k];
        const rs = blk(get(DV[d][0], 0, DV[d][2])).rs;
        if (rs && (rs.k === 'tripwire' || (rs.k === 'hook' && rs.facing === OPP[d]))) sides |= 1 << k;
      }
      return sides;
    },
  });

  // Direction du regard du joueur (6 directions et horizontale).
  CM.lookDir6 = (dx, dy, dz) => {
    const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
    if (ay > ax && ay > az) return dy > 0 ? 2 : 3;
    return ax > az ? (dx > 0 ? 0 : 1) : dz > 0 ? 4 : 5;
  };
  CM.lookDirH = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 1) : dz > 0 ? 4 : 5);

  // ------------------------------------------------------------ blocs ----
  M.blocks.push(function (K) {
    const B = CM.B;
    const post = (on) => (on ? 'rs_post_on' : 'rs_post_off');
    // Règles de pose communes. P : { w, x, y, z, t (bloc visé), look6, lookH, under }
    const needTop = (P) => RSX.solidTop(P.w.get(P.x, P.y - 1, P.z));
    const attachOf = (P) => (P.t ? CM.dirOf(-P.t.nx, -P.t.ny, -P.t.nz) : 3);
    const fam = (name, kind, fields, make, opts) => family(K, name, kind, fields, make, opts);
    const keyFn = (pre) => (st, base) => (base ? pre : pre + '_' + Object.values(st).map((v) => (v === true ? 1 : v === false ? 0 : v)).join('_'));

    // Poudre de redstone : puissance 0 à 15 (l'objet « Poudre de redstone » la pose)
    CM.RS_WIRE = fam('wire', 'wire', [['level', [...Array(16).keys()]]], (st) => ({
      name: 'Poudre de redstone', render: 'wire', tex: 'rs_dust_line', iconTex: 'redstone', solid: false, opaque: false, hardness: 0, sound: 'stone', box: [0, 0, 0, 16, 1, 16],
      pushDestroy: true, hidden: true, place: (P) => (needTop(P) ? CM.RSFAM.wire.base : 0),
    }), { key: (st) => (st.level ? 'REDSTONE_WIRE_' + st.level : 'REDSTONE_WIRE') }).ids;

    // Torches de redstone (au sol ou au mur), allumées ou éteintes
    const WALL = { 1: [1, 0], 0: [-1, 0], 5: [0, 1], 4: [0, -1] };
    const torches = fam('rtorch', 'torch', [['lit', [true, false]], ['attach', [3, 1, 0, 5, 4]]], (st) => ({
      name: 'Torche de redstone', render: 'torch', tex: st.lit ? 'rs_torch_on' : 'rs_torch_off', solid: false, opaque: false, light: st.lit ? 7 : 0, hardness: 0, sound: 'wood',
      wall: st.attach === 3 ? undefined : WALL[st.attach], pushDestroy: true, lightColor: 'redstone', flicker: true,
    }), { key: keyFn('REDSTONE_TORCH') });
    const tb = CM.blocks[torches.base];
    tb.wallSet = [1, 0, 5, 4].map((a) => CM.rsWith(torches.base, { attach: a }));

    // Lampe à redstone : l'ancienne lampe devient la lampe éteinte
    const lamp = CM.blocks[B.REDSTONE_LAMP];
    lamp.light = 0;
    lamp.tex = { top: 'redstone_lamp_off', bottom: 'redstone_lamp_off', side: 'redstone_lamp_off', front: 'redstone_lamp_off' };
    fam('lamp', 'lamp', [['on', [false, true]]], (st) => ({
      name: 'Lampe à redstone', tex: st.on ? 'redstone_lamp' : 'redstone_lamp_off', light: st.on ? 15 : 0, hardness: 0.3, sound: 'glass', lightColor: 'lamp', nc: true,
    }), { key: keyFn('REDSTONE_LAMP'), existing: { false: B.REDSTONE_LAMP } });
    Object.assign(CM.blocks[B.REDSTONE_BLOCK], { rs: { k: 'rblock' }, nc: true });
    Object.assign(CM.blocks[B.TARGET], { rs: { k: 'target' }, nc: true });
    Object.assign(CM.blocks[B.NOTE_BLOCK], { rs: { k: 'note' } });
    Object.assign(CM.blocks[B.TNT], { rs: { k: 'tnt' } });
    for (const set of Object.values(CM.DOORS)) for (const id of set) CM.blocks[id].rs = { k: 'door' };

    // Levier : attach = direction du bloc qui le porte
    const leverParts = (on) => [
      { b: [5, 0, 4, 11, 3, 12], t: 'cobble' },
      { b: [7, 3, 7, 9, 6, 9], t: 'lever_handle' },
      { b: on ? [7, 6, 8, 9, 10, 10] : [7, 6, 6, 9, 10, 8], t: 'lever_handle' },
    ];
    fam('lever', 'lever', [['attach', [3, 2, 0, 1, 4, 5]], ['on', [false, true]]], (st) => ({
      name: 'Levier', render: 'model', model: leverParts(st.on).map((p) => part6(p.b, p.t, OPP[st.attach])), tex: 'cobble', iconTex: 'lever_icon',
      solid: false, opaque: false, hardness: 0.5, sound: 'wood', pushDestroy: true, orient: OPP[st.attach],
      place: (P) => {
        const a = attachOf(P);
        if (!RSX.fullFace(P.w.get(P.x + DV[a][0], P.y + DV[a][1], P.z + DV[a][2]))) return 0;
        return CM.rsWith(CM.RSFAM.lever.base, { attach: a });
      },
      use: (g, t) => {
        const id = CM.rsWith(t.id, { on: !CM.blocks[t.id].rs.on });
        g.world.setBlock(t.x, t.y, t.z, id);
        CM.Audio.play('rsclick', { pitch: CM.blocks[id].rs.on ? 1.2 : 0.9 });
        return true;
      },
    }), { key: keyFn('LEVER') });

    // Boutons (pierre : 1 s ; bois : 1,5 s, aussi par une flèche)
    for (const [kk, nm, tex, wood] of [['STONE_BUTTON', 'Bouton en pierre', 'stone', false], ['OAK_BUTTON', 'Bouton en bois', 'planks', true]]) {
      const fname = wood ? 'button_oak' : 'button_stone';
      fam(fname, 'button', [['attach', [3, 2, 0, 1, 4, 5]], ['on', [false, true]]], (st) => ({
        name: nm, render: 'model', model: [part6(st.on ? [5, 0, 6, 11, 1, 10] : [5, 0, 6, 11, 2, 10], tex, OPP[st.attach])], tex, iconTex: wood ? 'button_oak_icon' : 'button_stone_icon',
        solid: false, opaque: false, hardness: 0.5, sound: wood ? 'wood' : 'stone', pushDestroy: true, rs: { wood },
        place: (P) => {
          const a = attachOf(P);
          if (!RSX.fullFace(P.w.get(P.x + DV[a][0], P.y + DV[a][1], P.z + DV[a][2]))) return 0;
          return CM.rsWith(CM.RSFAM[fname].base, { attach: a });
        },
        use: (g, t) => {
          if (CM.blocks[t.id].rs.on) return true;
          g.world.setBlock(t.x, t.y, t.z, CM.rsWith(t.id, { on: true }));
          CM.Audio.play('rsclick', { pitch: 1.1 });
          return true;
        },
      }), { key: keyFn(kk) });
    }

    // Plaques de pression : pierre (joueurs et créatures), bois (tout), or et fer (selon le nombre)
    for (const [kk, nm, tex, kind, snd] of [
      ['STONE_PRESSURE_PLATE', 'Plaque de pression en pierre', 'stone', 'stone', 'stone'],
      ['OAK_PRESSURE_PLATE', 'Plaque de pression en bois', 'planks', 'wood', 'wood'],
      ['LIGHT_PRESSURE_PLATE', 'Plaque de pression légère (or)', 'gold_block', 'light', 'metal'],
      ['HEAVY_PRESSURE_PLATE', 'Plaque de pression lourde (fer)', 'iron_block', 'heavy', 'metal'],
    ]) {
      const fname = 'plate_' + kind;
      fam(fname, 'plate', [['on', [false, true]]], (st) => ({
        name: nm, render: 'model', model: [{ b: st.on ? [1, 0, 1, 15, 1, 15] : [1, 0, 1, 15, 2, 15], t: tex }], tex, iconTex: 'plate_icon_' + kind,
        solid: false, opaque: false, hardness: 0.5, sound: snd, pushDestroy: true, rs: { plate: kind },
        place: (P) => (needTop(P) ? CM.RSFAM[fname].base : 0),
      }), { key: keyFn(kk) });
    }

    // Répéteur : facing = sortie ; délai 1 à 4 ticks de redstone ; verrouillé par le côté
    const diodeBase = (on, top) => ({ b: [0, 0, 0, 16, 2, 16], t: ['smooth_stone', 'smooth_stone', top, 'smooth_stone', 'smooth_stone', 'smooth_stone'] });
    fam('repeater', 'repeater', [['facing', [5, 4, 0, 1]], ['delay', [1, 2, 3, 4]], ['on', [false, true]]], (st) => {
      const z0 = 4 + 2 * st.delay;
      const parts = [diodeBase(st.on, st.on ? 'repeater_on' : 'repeater'), { b: [7, 2, 2, 9, 7, 4], t: post(st.on) }, { b: [7, 2, z0, 9, 7, z0 + 2], t: post(st.on) }];
      return {
        name: 'Répéteur', render: 'rsdiode', model: parts.map((p) => partY(p.b, p.t, st.facing)), lockPart: 2, lockBar: rotY([2, 2, z0, 14, 4, z0 + 2], st.facing),
        tex: { top: 'repeater', bottom: 'smooth_stone', side: 'smooth_stone' }, iconTex: 'repeater_icon', box: [0, 0, 0, 16, 2, 16],
        solid: true, opaque: false, hardness: 0, sound: 'stone', pushDestroy: true, orient: st.facing,
        place: (P) => (needTop(P) ? CM.rsWith(CM.RSFAM.repeater.base, { facing: P.lookH }) : 0),
        use: (g, t) => {
          const rs = CM.blocks[t.id].rs;
          g.world.setBlock(t.x, t.y, t.z, CM.rsWith(t.id, { delay: (rs.delay % 4) + 1 }));
          CM.Audio.play('rsclick', { pitch: 1.3 });
          return true;
        },
      };
    }, { key: keyFn('REPEATER') });

    // Comparateur : mode 0 comparer, 1 soustraire
    fam('comparator', 'comparator', [['facing', [5, 4, 0, 1]], ['mode', [0, 1]], ['on', [false, true]]], (st) => ({
      name: 'Comparateur', render: 'rsdiode',
      model: [diodeBase(st.on, st.on ? 'comparator_on' : 'comparator'), { b: [3, 2, 11, 5, 7, 13], t: post(st.on) }, { b: [11, 2, 11, 13, 7, 13], t: post(st.on) }, { b: [7, 2, 2, 9, 5, 4], t: post(st.mode === 1) }].map((p) =>
        partY(p.b, p.t, st.facing),
      ),
      tex: { top: 'comparator', bottom: 'smooth_stone', side: 'smooth_stone' }, iconTex: 'comparator_icon', box: [0, 0, 0, 16, 2, 16],
      solid: true, opaque: false, hardness: 0, sound: 'stone', pushDestroy: true, orient: st.facing,
      place: (P) => (needTop(P) ? CM.rsWith(CM.RSFAM.comparator.base, { facing: P.lookH }) : 0),
      use: (g, t) => {
        g.world.setBlock(t.x, t.y, t.z, CM.rsWith(t.id, { mode: 1 - CM.blocks[t.id].rs.mode }));
        CM.Audio.play('rsclick', { pitch: CM.blocks[t.id].rs.mode ? 1.4 : 1.1 });
        return true;
      },
    }), { key: keyFn('COMPARATOR') });

    // Observateur : regarde devant lui, émet une impulsion par l'arrière
    const cubeFaces = (f, front, back, side, top) => {
      const out = [];
      for (let fi = 0; fi < 6; fi++) out[fi] = fi === f ? front : fi === OPP[f] ? back : top && (fi === 2 || fi === 3) ? top : side;
      return out;
    };
    fam('observer', 'observer', [['facing', [4, 5, 0, 1, 2, 3]], ['on', [false, true]]], (st) => ({
      name: 'Observateur', faces: cubeFaces(st.facing, 'observer_front', st.on ? 'observer_back_on' : 'observer_back', 'observer_side'), orient: st.facing,
      tex: { top: 'observer_top', bottom: 'observer_top', side: 'observer_side', front: 'observer_front' }, hardness: 3, tool: 'pickaxe', tier: 1, nc: true,
      place: (P) => CM.rsWith(CM.RSFAM.observer.base, { facing: P.look6 }),
    }), { key: keyFn('OBSERVER'), existing: { '4|false': B.OBSERVER } });

    // Distributeur et dropper (9 cases), tournés vers le joueur
    for (const [kk, nm, front, ex] of [['DISPENSER', 'Distributeur', 'dispenser_front', B.DISPENSER], ['DROPPER', 'Dropper', 'dropper_front', B.DROPPER]]) {
      const fname = kk.toLowerCase();
      fam(fname, fname, [['facing', [4, 5, 0, 1, 2, 3]]], (st) => ({
        name: nm, faces: cubeFaces(st.facing, front, 'furnace_side', 'furnace_side', 'furnace_top'), orient: st.facing,
        tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front }, hardness: 3.5, tool: 'pickaxe', tier: 1, container: true, slots: 9,
        place: (P) => CM.rsWith(CM.RSFAM[fname].base, { facing: OPP[P.look6] }),
      }), { key: keyFn(kk), existing: { 4: ex } });
    }

    // Pistons : facing = direction de la tête ; ext = déployé
    for (const sticky of [false, true]) {
      const fname = sticky ? 'sticky_piston' : 'piston';
      const top = sticky ? 'piston_top_sticky' : 'piston_top';
      fam(fname, 'piston', [['facing', [2, 3, 0, 1, 4, 5]], ['ext', [false, true]]], (st) => {
        const common = {
          name: sticky ? 'Piston collant' : 'Piston', tex: { top, bottom: 'piston_bottom', side: 'piston_side', front: 'piston_side' }, hardness: 1.5, tool: 'pickaxe', sound: 'stone', orient: st.facing,
          nc: true, rs: { sticky }, place: (P) => CM.rsWith(CM.RSFAM[fname].base, { facing: OPP[P.look6] }),
        };
        if (!st.ext) return Object.assign(common, { faces: cubeFaces(st.facing, top, 'piston_bottom', 'piston_side') });
        return Object.assign(common, {
          render: 'model', opaque: false, immovable: true,
          model: [
            part6([0, 0, 0, 16, 12, 16], ['piston_side', 'piston_side', 'piston_inner', 'piston_bottom', 'piston_side', 'piston_side'], st.facing),
            part6([6, 12, 6, 10, 16, 10], 'piston_rod', st.facing),
          ],
          box: [0, 0, 0, 16, 16, 16],
        });
      }, { key: keyFn(sticky ? 'STICKY_PISTON' : 'PISTON') });
    }
    fam('piston_head', 'phead', [['facing', [2, 3, 0, 1, 4, 5]], ['sticky', [false, true]]], (st) => ({
      name: 'Tête de piston', render: 'model', opaque: false, hidden: true, immovable: true, hardness: 1.5, tool: 'pickaxe', orient: st.facing,
      model: [
        part6([0, 12, 0, 16, 16, 16], ['piston_side', 'piston_side', st.sticky ? 'piston_top_sticky' : 'piston_top', 'piston_top', 'piston_side', 'piston_side'], st.facing),
        part6([6, 0, 6, 10, 12, 10], 'piston_rod', st.facing),
      ],
      tex: { top: 'piston_top', bottom: 'piston_top', side: 'piston_side' },
    }), { key: keyFn('PISTON_HEAD') });
    for (const id of CM.RSFAM.piston_head.ids) CM.blocks[id].drop = 0;

    // Entonnoir : 5 cases, tourné vers le bloc visé (ou vers le bas)
    fam('hopper', 'hopper', [['facing', [3, 0, 1, 4, 5]]], (st) => {
      const spout = st.facing === 3 ? { b: [6, 0, 6, 10, 4, 10], t: 'hopper_outside' } : partY([6, 4, 0, 10, 8, 4], 'hopper_outside', st.facing);
      return {
        name: 'Entonnoir', render: 'model', opaque: false, box: [0, 0, 0, 16, 16, 16], container: true, slots: 5, immovable: true,
        model: [{ b: [0, 10, 0, 16, 16, 16], t: ['hopper_outside', 'hopper_outside', 'hopper_top', 'hopper_outside', 'hopper_outside', 'hopper_outside'] }, { b: [4, 4, 4, 12, 10, 12], t: 'hopper_outside' }, spout],
        tex: { top: 'hopper_top', bottom: 'hopper_outside', side: 'hopper_outside' }, iconTex: 'hopper_icon', hardness: 3, tool: 'pickaxe', tier: 1, sound: 'metal',
        place: (P) => {
          const f = P.t && P.t.ny === 0 ? CM.dirOf(-P.t.nx, 0, -P.t.nz) : 3;
          return CM.rsWith(CM.RSFAM.hopper.base, { facing: f });
        },
      };
    }, { key: keyFn('HOPPER') });

    // Capteur de lumière du jour (clic droit : inversé)
    fam('daylight', 'daylight', [['inv', [false, true]]], (st) => ({
      name: 'Capteur de lumière du jour', render: 'model', opaque: false, model: [{ b: [0, 0, 0, 16, 6, 16], t: ['daylight_side', 'daylight_side', st.inv ? 'daylight_inv_top' : 'daylight_top', 'planks', 'daylight_side', 'daylight_side'] }],
      tex: { top: 'daylight_top', bottom: 'planks', side: 'daylight_side' }, iconTex: 'daylight_top', hardness: 0.2, sound: 'wood',
      use: (g, t) => {
        g.world.setBlock(t.x, t.y, t.z, CM.rsWith(t.id, { inv: !CM.blocks[t.id].rs.inv }));
        CM.Audio.play('rsclick', { pitch: 1.2 });
        return true;
      },
    }), { key: keyFn('DAYLIGHT_DETECTOR') });

    // Crochet et fil de déclenchement : facing = côté où part la ficelle (crochet contre le mur opposé)
    fam('hook', 'hook', [['facing', [5, 4, 0, 1]], ['st', [0, 1, 2]]], (st) => {
      const ring = st.st === 0 ? [7, 4, 10, 9, 6, 14] : st.st === 1 ? [7, 2, 10, 9, 4, 14] : [7, 1, 10, 9, 3, 14];
      return {
        name: 'Crochet', render: 'model', model: [partY([6, 1, 14, 10, 10, 16], 'planks', st.facing), partY(ring, 'iron_block', st.facing)], tex: 'planks', iconTex: 'hook_icon',
        solid: false, opaque: false, hardness: 0, sound: 'wood', pushDestroy: true, rs: { attach: OPP[st.facing] },
        place: (P) => {
          if (!P.t || P.t.ny !== 0) return 0;
          const f = CM.dirOf(P.t.nx, 0, P.t.nz);
          return CM.rsWith(CM.RSFAM.hook.base, { facing: f });
        },
      };
    }, { key: keyFn('TRIPWIRE_HOOK') });
    fam('tripwire', 'tripwire', [['on', [false, true]]], () => ({
      name: 'Fil de déclenchement', render: 'tripwire', tex: 'tripwire', solid: false, opaque: false, hardness: 0, sound: 'grass', pushDestroy: true, box: [0, 0, 0, 16, 2, 16], hidden: true,
    }), { key: keyFn('TRIPWIRE') });

    // Coffre piégé
    nb2(K, 'TRAPPED_CHEST', {
      name: 'Coffre piégé', tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'trapped_chest_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', container: true, rs: { k: 'trapped' }, nc: true,
    });

    // Porte en fer (ne s'ouvre qu'avec la redstone)
    const doorBox = (axis, open) => (open ? (axis ? [0, 0, 0, 16, 16, 3] : [0, 0, 0, 3, 16, 16]) : axis ? [6.5, 0, 0, 9.5, 16, 16] : [0, 0, 6.5, 16, 16, 9.5]);
    const iset = [];
    for (const half of [0, 1])
      for (const axis of [0, 1])
        for (const open of [0, 1]) {
          const base = !half && !axis && !open;
          const face = K.tx(half ? 'door_iron_upper' : 'door_iron_lower', { type: 'door', c: [196, 196, 202], half });
          K.tx('door_iron_item', { type: 'door', c: [196, 196, 202], half: 2 });
          iset[half * 4 + axis * 2 + open] = nb2(K, 'IRON_DOOR' + (base ? '' : '_' + half + axis + open), {
            name: 'Porte en fer', render: 'door', tex: { side: face, front: face, back: face, top: 'iron_block', bottom: 'iron_block' }, iconTex: 'door_iron_item',
            solid: !open, opaque: false, hardness: 5, tool: 'pickaxe', sound: 'metal', hidden: !base, box: doorBox(axis, open), door: { half, axis, open, iron: true }, rs: { k: 'door' },
          }).id;
        }
    for (const id of iset) {
      CM.blocks[id].door.set = iset;
      CM.blocks[id].drop = iset[0];
    }
    CM.DOORS.IRON = iset;

    // Trappes (bois : à la main ou par redstone ; fer : redstone seulement)
    for (const [kk, nm, tex, iron] of [['OAK_TRAPDOOR', 'Trappe en bois', 'oak_trapdoor', false], ['IRON_TRAPDOOR', 'Trappe en fer', 'iron_trapdoor', true]]) {
      const fname = iron ? 'trapdoor_iron' : 'trapdoor_oak';
      fam(fname, 'trapdoor', [['facing', [5, 4, 0, 1]], ['half', [0, 1]], ['open', [false, true]]], (st) => ({
        name: nm, render: 'model', model: [st.open ? partY([0, 0, 13, 16, 16, 16], tex, st.facing) : { b: st.half ? [0, 13, 0, 16, 16, 16] : [0, 0, 0, 16, 3, 16], t: tex }],
        tex, iconTex: tex, solid: true, opaque: false, hardness: iron ? 5 : 3, tool: iron ? 'pickaxe' : 'axe', sound: iron ? 'metal' : 'wood', rs: { iron },
        place: (P) => {
          const top = P.t && (P.t.ny === -1 || (P.t.ny === 0 && P.hitY - Math.floor(P.hitY) > 0.5));
          return CM.rsWith(CM.RSFAM[fname].base, { facing: P.lookH, half: top ? 1 : 0 });
        },
        use: (g, t) => {
          if (iron) {
            g.ui.toast('Une trappe en fer ne s’ouvre qu’avec la redstone', 'info', 'irontrap');
            return true;
          }
          g.world.setBlock(t.x, t.y, t.z, CM.rsWith(t.id, { open: !CM.blocks[t.id].rs.open }));
          CM.Audio.play('door', { open: !CM.blocks[t.id].rs.open });
          return true;
        },
      }), { key: keyFn(kk) });
    }

    // Ampoule en cuivre : change d'état à chaque impulsion
    fam('bulb', 'bulb', [['lit', [false, true]]], (st) => ({
      name: 'Ampoule en cuivre', tex: st.lit ? 'copper_bulb_lit' : 'copper_bulb', light: st.lit ? 15 : 0, hardness: 3, tool: 'pickaxe', tier: 1, sound: 'metal', nc: true, lightColor: 'lamp',
    }), { key: keyFn('COPPER_BULB') });

    // Capteur de sculk : sent les vibrations à 8 blocs
    fam('sculk_sensor', 'sculk', [['active', [false, true]]], (st) => ({
      name: 'Capteur de sculk', render: 'model', opaque: false, light: st.active ? 3 : 1,
      model: [{ b: [0, 0, 0, 16, 8, 16], t: ['sculk_sensor_side', 'sculk_sensor_side', st.active ? 'sculk_sensor_top_on' : 'sculk_sensor_top', 'sculk', 'sculk_sensor_side', 'sculk_sensor_side'] }],
      tex: { top: 'sculk_sensor_top', bottom: 'sculk', side: 'sculk_sensor_side' }, iconTex: 'sculk_sensor_top', hardness: 1.5, tool: 'hoe', sound: 'grass', lightColor: 'sculk',
    }), { key: keyFn('SCULK_SENSOR') });

    // Rails : 10 formes (0 N-S, 1 E-O, 2-5 montées vers E, O, S, N, 6-9 virages SE, SO, NO, NE)
    const railPlace = (fname) => (P) => (needTop(P) ? CM.rsWith(CM.RSFAM[fname].base, { shape: CM.railShapeAt ? CM.railShapeAt(P.w, P.x, P.y, P.z, fname === 'rail') : 0 }) : 0);
    fam('rail', 'rail', [['shape', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]]], (st) => ({
      name: 'Rail', render: 'rail', tex: st.shape >= 6 ? 'rail_corner' : 'rail', iconTex: 'rail', solid: false, opaque: false, hardness: 0.7, tool: 'pickaxe', sound: 'metal',
      box: st.shape >= 2 && st.shape <= 5 ? [0, 0, 0, 16, 8, 16] : [0, 0, 0, 16, 2, 16], rs: { type: 'rail' }, place: railPlace('rail'),
    }), { key: keyFn('RAIL') });
    for (const [kk, nm, type, tex] of [['POWERED_RAIL', 'Rail de propulsion', 'powered', 'powered_rail'], ['DETECTOR_RAIL', 'Rail détecteur', 'detector', 'detector_rail'], ['ACTIVATOR_RAIL', 'Rail activateur', 'activator', 'activator_rail']]) {
      const fname = type + '_rail';
      fam(fname, 'rail', [['shape', [0, 1, 2, 3, 4, 5]], ['on', [false, true]]], (st) => ({
        name: nm, render: 'rail', tex: st.on ? tex + '_on' : tex, iconTex: tex, solid: false, opaque: false, hardness: 0.7, tool: 'pickaxe', sound: 'metal',
        box: st.shape >= 2 ? [0, 0, 0, 16, 8, 16] : [0, 0, 0, 16, 2, 16], rs: { type }, place: railPlace(fname), lightColor: null,
      }), { key: keyFn(kk) });
    }
  });

  // Nouveau bloc hors famille (même compteur que les autres).
  function nb2(K, key, d) {
    return K.nb(key, d);
  }

  // ----------------------------------------------------------- objets ----
  M.items.push(function (K) {
    const { defItem } = K;
    const I = CM.I, B = CM.B;
    defItem(1320, 'STRING', { name: 'Ficelle', tex: 'string', places: B.TRIPWIRE, desc: 'Se pose entre deux crochets : un fil de déclenchement.' });
    defItem(1321, 'BOW', { name: 'Arc', tex: 'bow', stack: 1, type: 'bow', desc: 'Maintiens le clic droit pour bander, relâche pour tirer une flèche.' });
    defItem(1322, 'ARROW', { name: 'Flèche', tex: 'arrow' });
    defItem(1323, 'MINECART', { name: 'Wagonnet', tex: 'minecart', stack: 1, type: 'cart', cart: 'cart', desc: 'Se pose sur un rail ; clic droit dessus pour monter, accroupi pour descendre.' });
    defItem(1324, 'CHEST_MINECART', { name: 'Wagonnet de stockage', tex: 'chest_minecart', stack: 1, type: 'cart', cart: 'chest' });
    defItem(1325, 'TNT_MINECART', { name: 'Wagonnet de TNT', tex: 'tnt_minecart', stack: 1, type: 'cart', cart: 'tnt', desc: 'Explose sur un rail activateur alimenté.' });
    defItem(1326, 'HOPPER_MINECART', { name: 'Wagonnet à entonnoir', tex: 'hopper_minecart', stack: 1, type: 'cart', cart: 'hopper', desc: 'Aspire les objets et vide les coffres au-dessus des rails.' });
    CM.items[I.REDSTONE].places = CM.RS_WIRE[0];
    CM.items[I.REDSTONE].desc = 'Se pose au sol : un fil qui transporte le courant (15 blocs au plus).';
    for (const id of CM.RS_WIRE) CM.blocks[id].drop = I.REDSTONE;
    for (const id of CM.RSFAM.tripwire.ids) CM.blocks[id].drop = CM.I.STRING;
    CM.CART_ITEMS = { cart: I.MINECART, chest: I.CHEST_MINECART, tnt: I.TNT_MINECART, hopper: I.HOPPER_MINECART };
  });

  // --------------------------------------------------------- recettes ----
  M.recipes.push(function (K) {
    const { r } = K;
    const I = CM.I, B = CM.B, F = CM.RSFAM;
    const R = CM.recipes;
    const disp = R.find((x) => x.out === B.DISPENSER);
    if (disp) disp.ing = [[B.COBBLE, 7], [I.BOW, 1], [I.REDSTONE, 1]];
    for (const x of R) if ([B.DISPENSER, B.DROPPER, B.OBSERVER, B.REDSTONE_LAMP, B.NOTE_BLOCK, B.TARGET, B.TNT].includes(x.out)) x.cat = 'redstone';
    R.push(
      r(F.rtorch.base, 1, [[I.STICK, 1], [I.REDSTONE, 1]], null, 'redstone'),
      r(F.lever.base, 1, [[I.STICK, 1], [B.COBBLE, 1]], null, 'redstone'),
      r(F.button_stone.base, 1, [[B.STONE, 1]], null, 'redstone'),
      r(F.button_oak.base, 1, [['planks', 1]], null, 'redstone'),
      r(F.plate_stone.base, 1, [[B.STONE, 2]], null, 'redstone'),
      r(F.plate_wood.base, 1, [['planks', 2]], null, 'redstone'),
      r(F.plate_light.base, 1, [[I.GOLD_INGOT, 2]], null, 'redstone'),
      r(F.plate_heavy.base, 1, [[I.IRON_INGOT, 2]], null, 'redstone'),
      r(F.repeater.base, 1, [[B.STONE, 3], [F.rtorch.base, 2], [I.REDSTONE, 1]], 'table', 'redstone'),
      r(F.comparator.base, 1, [[B.STONE, 3], [F.rtorch.base, 3], [I.QUARTZ, 1]], 'table', 'redstone'),
      r(F.piston.base, 1, [['planks', 3], [B.COBBLE, 4], [I.IRON_INGOT, 1], [I.REDSTONE, 1]], 'table', 'redstone'),
      r(F.sticky_piston.base, 1, [[F.piston.base, 1], [I.SLIMEBALL, 1]], null, 'redstone'),
      r(F.hopper.base, 1, [[I.IRON_INGOT, 5], [B.CHEST, 1]], 'table', 'redstone'),
      r(F.daylight.base, 1, [[B.GLASS, 3], [I.QUARTZ, 3], ['wood_slabs', 3]], 'table', 'redstone'),
      r(F.hook.base, 2, [[I.IRON_INGOT, 1], [I.STICK, 1], ['planks', 1]], 'table', 'redstone'),
      r(B.TRAPPED_CHEST, 1, [[B.CHEST, 1], [F.hook.base, 1]], 'table', 'redstone'),
      r(CM.DOORS.IRON[0], 3, [[I.IRON_INGOT, 6]], 'table', 'redstone'),
      r(F.trapdoor_oak.base, 2, [['planks', 6]], 'table', 'redstone'),
      r(F.trapdoor_iron.base, 1, [[I.IRON_INGOT, 4]], 'table', 'redstone'),
      r(F.bulb.base, 4, [[B.COPPER_BLOCK, 3], [I.REDSTONE, 1], [I.GLOWSTONE_DUST, 1]], 'table', 'redstone'),
      r(F.sculk_sensor.base, 1, [[B.SCULK, 4], [I.REDSTONE, 2]], 'table', 'redstone'),
      r(F.rail.base, 16, [[I.IRON_INGOT, 6], [I.STICK, 1]], 'table', 'redstone'),
      r(F.powered_rail.base, 6, [[I.GOLD_INGOT, 6], [I.STICK, 1], [I.REDSTONE, 1]], 'table', 'redstone'),
      r(F.detector_rail.base, 6, [[I.IRON_INGOT, 6], [F.plate_stone.base, 1], [I.REDSTONE, 1]], 'table', 'redstone'),
      r(F.activator_rail.base, 6, [[I.IRON_INGOT, 6], [I.STICK, 2], [F.rtorch.base, 1]], 'table', 'redstone'),
      r(I.MINECART, 1, [[I.IRON_INGOT, 5]], 'table', 'redstone'),
      r(I.CHEST_MINECART, 1, [[I.MINECART, 1], [B.CHEST, 1]], null, 'redstone'),
      r(I.TNT_MINECART, 1, [[I.MINECART, 1], [B.TNT, 1]], null, 'redstone'),
      r(I.HOPPER_MINECART, 1, [[I.MINECART, 1], [F.hopper.base, 1]], null, 'redstone'),
      r(I.STRING, 2, [[I.FIBER, 3]], null, 'objets'),
      r(I.BOW, 1, [[I.STICK, 3], [I.STRING, 3]], 'table', 'outils'),
      r(I.ARROW, 4, [[I.FLINT, 1], [I.STICK, 1], [I.FEATHER, 1]], 'table', 'outils'),
    );
  });

  // --------------------------------------------------------- textures ----
  M.textures.push(function (X) {
    const { make, put, fill, speckle, line, disc, copyFrom, art, vary, border } = X;
    const RED = [214, 22, 16], RED_HI = [255, 76, 52], RED_LO = [110, 12, 8];
    const clear = (d) => {
      for (let i = 0; i < 1024; i++) d[i] = 0;
    };
    make('rs_dust_dot', (d) => {
      clear(d);
      disc(d, 7.5, 7.5, 3.2, (x, y, r) => put(d, x, y, r < 1.6 ? RED_HI : RED));
    });
    make('rs_dust_line', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++)
        for (let x = 6; x <= 9; x++) put(d, x, y, x === 6 || x === 9 ? (r() < 0.5 ? RED : RED_LO) : r() < 0.25 ? RED_HI : RED);
    });
    make('rs_dust_cross', (d, r) => {
      clear(d);
      for (let a = 0; a < 16; a++)
        for (let b = 6; b <= 9; b++) {
          put(d, b, a, r() < 0.25 ? RED_HI : RED);
          put(d, a, b, r() < 0.25 ? RED_HI : RED);
        }
    });
    const rsTorch = (on) => (d) => {
      clear(d);
      for (let y = 8; y < 16; y++) {
        put(d, 7, y, [132, 94, 54]);
        put(d, 8, y, [98, 68, 40]);
      }
      const hi = on ? [255, 96, 70] : [120, 40, 32], mid = on ? [226, 24, 16] : [86, 20, 16], lo = on ? [170, 10, 6] : [60, 14, 10];
      put(d, 7, 5, hi); put(d, 8, 5, mid);
      put(d, 7, 6, mid); put(d, 8, 6, hi);
      put(d, 7, 7, lo); put(d, 8, 7, mid);
    };
    make('rs_torch_on', rsTorch(true));
    make('rs_torch_off', rsTorch(false));
    make('rs_post_on', (d, r) => fill(d, r, [236, 40, 26], 12));
    make('rs_post_off', (d, r) => fill(d, r, [104, 26, 20], 8));
    make('redstone_lamp_off', (d, r) => {
      copyFrom(d, 'redstone_lamp');
      for (let i = 0; i < 1024; i += 4) {
        d[i] = d[i] * 0.42 + 18;
        d[i + 1] = d[i + 1] * 0.3 + 10;
        d[i + 2] = d[i + 2] * 0.26 + 8;
      }
      border(d, [96, 62, 40], [58, 36, 24]);
      void r;
    });
    make('lever_handle', (d, r) => fill(d, r, [128, 92, 54], 10));
    make('lever_icon', (d, r) => {
      clear(d);
      for (let y = 11; y < 15; y++) for (let x = 4; x < 12; x++) put(d, x, y, vary([128, 128, 128], r, 10));
      line(d, 8, 11, 11, 3, [128, 92, 54]);
      line(d, 9, 11, 12, 3, [98, 68, 40]);
    });
    const icon = (name, fn) => make(name, (d, r) => {
      clear(d);
      fn(d, r);
    });
    icon('button_stone_icon', (d, r) => {
      for (let y = 6; y < 10; y++) for (let x = 4; x < 12; x++) put(d, x, y, vary([140, 140, 140], r, 8));
    });
    icon('button_oak_icon', (d, r) => {
      for (let y = 6; y < 10; y++) for (let x = 4; x < 12; x++) put(d, x, y, vary([176, 136, 84], r, 8));
    });
    for (const [k, c] of [['stone', [140, 140, 140]], ['wood', [176, 136, 84]], ['light', [236, 196, 60]], ['heavy', [210, 210, 214]]])
      icon('plate_icon_' + k, (d, r) => {
        for (let y = 9; y < 13; y++) for (let x = 2; x < 14; x++) put(d, x, y, vary(y === 9 ? c.map((v) => v * 1.1) : c, r, 6));
      });
    const diodeTop = (arrow, on, comp) => (d, r) => {
      copyFrom(d, 'smooth_stone');
      const red = on ? [236, 44, 30] : [120, 30, 24];
      for (let y = 2; y < 15; y++) put(d, 7, y, red), put(d, 8, y, red);
      if (comp) {
        line(d, 3, 12, 7, 3, red);
        line(d, 12, 12, 8, 3, red);
      }
      if (arrow) for (let k = 0; k < 3; k++) { put(d, 7 - k, 3 + k, red); put(d, 8 + k, 3 + k, red); }
      void r;
    };
    make('repeater', diodeTop(true, false));
    make('repeater_on', diodeTop(true, true));
    make('comparator', diodeTop(false, false, true));
    make('comparator_on', diodeTop(false, true, true));
    make('repeater_icon', (d, r) => {
      copyFrom(d, 'repeater');
      for (const [x, y] of [[7, 3], [8, 3], [7, 9], [8, 9]]) put(d, x, y, [236, 44, 30]);
      void r;
    });
    make('comparator_icon', (d, r) => {
      copyFrom(d, 'comparator');
      void r;
    });
    make('observer_back', (d, r) => {
      copyFrom(d, 'furnace_top');
      disc(d, 7.5, 7.5, 2, (x, y) => put(d, x, y, [90, 30, 26]));
      void r;
    });
    make('observer_back_on', (d, r) => {
      copyFrom(d, 'furnace_top');
      disc(d, 7.5, 7.5, 2, (x, y, q) => put(d, x, y, q < 1 ? [255, 120, 90] : [236, 40, 26]));
      void r;
    });
    make('piston_top', (d, r) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, vary(x % 4 === 0 ? [150, 114, 70] : [176, 136, 84], r, 8));
      for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) put(d, x, y, vary([176, 176, 180], r, 6));
      border(d, [120, 90, 56], [100, 72, 44]);
    });
    make('piston_top_sticky', (d, r) => {
      copyFrom(d, 'piston_top');
      for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) put(d, x, y, vary([110, 186, 86], r, 10));
    });
    make('piston_side', (d, r) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(d, x, y, y < 4 ? vary([176, 136, 84], r, 8) : vary([124, 124, 124], r, 10));
      for (let x = 0; x < 16; x++) put(d, x, 4, [80, 62, 40]);
      for (let y = 6; y < 12; y++) put(d, 7, y, [96, 96, 96]), put(d, 8, y, [96, 96, 96]);
    });
    make('piston_bottom', (d, r) => {
      fill(d, r, [124, 124, 124], 10);
      for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) put(d, x, y, [80, 80, 80]);
      border(d, [100, 100, 100], [90, 90, 90]);
    });
    make('piston_inner', (d, r) => {
      fill(d, r, [110, 110, 110], 8);
      for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) put(d, x, y, [176, 176, 180]);
    });
    make('piston_rod', (d, r) => fill(d, r, [176, 136, 84], 10));
    make('hopper_outside', (d, r) => {
      fill(d, r, [62, 62, 66], 6);
      border(d, [84, 84, 90], [40, 40, 44]);
    });
    make('hopper_top', (d, r) => {
      fill(d, r, [62, 62, 66], 6);
      for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) put(d, x, y, vary([30, 30, 34], r, 4));
      border(d, [84, 84, 90], [40, 40, 44]);
    });
    icon('hopper_icon', (d, r) => {
      for (let y = 1; y < 6; y++) for (let x = 1; x < 15; x++) put(d, x, y, vary([70, 70, 76], r, 6));
      for (let y = 6; y < 11; y++) for (let x = 4; x < 12; x++) put(d, x, y, vary([62, 62, 66], r, 6));
      for (let y = 11; y < 15; y++) for (let x = 6; x < 10; x++) put(d, x, y, vary([54, 54, 58], r, 6));
    });
    const dayTop = (inv) => (d, r) => {
      fill(d, r, inv ? [70, 78, 110] : [210, 204, 190], 6);
      for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) if (x % 5 !== 0 && y % 5 !== 0) put(d, x, y, vary(inv ? [40, 60, 130] : [150, 190, 220], r, 8));
      border(d, [150, 120, 80], [120, 90, 56]);
    };
    make('daylight_top', dayTop(false));
    make('daylight_inv_top', dayTop(true));
    make('daylight_side', (d, r) => {
      copyFrom(d, 'planks');
      for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) put(d, x, y, [0, 0, 0], 0);
      void r;
    });
    make('tripwire', (d, r) => {
      clear(d);
      for (let y = 0; y < 16; y++) put(d, 7, y, vary([214, 214, 214], r, 16)), put(d, 8, y, vary([190, 190, 190], r, 16));
    });
    icon('hook_icon', (d, r) => {
      for (let y = 2; y < 14; y++) for (let x = 6; x < 9; x++) put(d, x, y, vary([176, 136, 84], r, 8));
      disc(d, 10.5, 7.5, 2.5, (x, y, q) => q > 1.2 && put(d, x, y, [200, 200, 206]));
    });
    make('trapped_chest_front', (d, r) => {
      copyFrom(d, 'chest_front');
      for (let y = 5; y < 10; y++) for (let x = 6; x < 10; x++) put(d, x, y, [190, 40, 30]);
      void r;
    });
    const trap = (base, dark) => (d, r) => {
      fill(d, r, base, 8);
      for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if ((x === 5 || x === 10) || (y === 5 || y === 10)) put(d, x, y, dark);
      border(d, dark, dark);
    };
    make('oak_trapdoor', trap([176, 136, 84], [110, 80, 48]));
    make('iron_trapdoor', trap([206, 206, 212], [150, 150, 156]));
    const bulb = (lit) => (d, r) => {
      fill(d, r, [200, 110, 70], 10);
      border(d, [230, 140, 96], [150, 76, 46]);
      disc(d, 7.5, 7.5, 4.2, (x, y, q) => put(d, x, y, lit ? (q < 2.2 ? [255, 250, 210] : [255, 214, 120]) : q < 2.2 ? [90, 60, 44] : [120, 74, 50]));
    };
    make('copper_bulb', bulb(false));
    make('copper_bulb_lit', bulb(true));
    const sculkTop = (on) => (d, r) => {
      copyFrom(d, 'sculk');
      disc(d, 7.5, 7.5, 3.5, (x, y, q) => put(d, x, y, on ? (q < 2 ? [120, 255, 255] : [40, 190, 200]) : q < 2 ? [30, 90, 100] : [20, 60, 70]));
      void r;
    };
    make('sculk_sensor_top', sculkTop(false));
    make('sculk_sensor_top_on', sculkTop(true));
    make('sculk_sensor_side', (d, r) => {
      copyFrom(d, 'sculk');
      for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) put(d, x, y, [0, 0, 0], 0);
      void r;
    });
    // rails : traverses en bois, rails de métal selon le type
    const railTex = (metal, core, corner) => (d, r) => {
      clear(d);
      if (!corner) {
        for (let y = 1; y < 16; y += 4) for (let x = 2; x < 14; x++) put(d, x, y, vary([110, 80, 50], r, 8)), put(d, x, y + 1, vary([92, 66, 40], r, 8));
        for (let y = 0; y < 16; y++) for (const x of [2, 3, 12, 13]) put(d, x, y, vary(metal, r, 10));
        if (core) for (let y = 0; y < 16; y++) put(d, 7, y, core), put(d, 8, y, core);
      } else {
        // virage : relie le bas (sud) et la droite (est)
        for (let a = 0; a < 16; a++)
          for (let b = 0; b < 16; b++) {
            const q = Math.hypot(a - 16, b - 16);
            if ((q > 11.5 && q < 13.5) || (q > 1.5 && q < 3.5)) put(d, a, b, vary(metal, r, 10));
            else if (q > 3.5 && q < 11.5 && (a + b) % 4 === 0) put(d, a, b, vary([110, 80, 50], r, 8));
          }
      }
    };
    make('rail', railTex([168, 168, 172]));
    make('rail_corner', railTex([168, 168, 172], null, true));
    make('powered_rail', railTex([230, 190, 60], [100, 20, 14]));
    make('powered_rail_on', railTex([240, 200, 70], [255, 50, 30]));
    make('detector_rail', railTex([150, 150, 156], [110, 24, 18]));
    make('detector_rail_on', railTex([160, 160, 166], [255, 50, 30]));
    make('activator_rail', railTex([150, 110, 100], [110, 24, 18]));
    make('activator_rail_on', railTex([160, 120, 110], [255, 50, 30]));
    // objets
    icon('string', (d, r) => {
      line(d, 3, 13, 8, 6, [230, 230, 230]);
      line(d, 8, 6, 12, 9, [220, 220, 220]);
      line(d, 12, 9, 13, 3, [236, 236, 236]);
      void r;
    });
    icon('bow', (d, r) => {
      const w = [128, 92, 54];
      for (const [x, y] of [[3, 12], [4, 11], [5, 10], [6, 9], [6, 8], [7, 7], [8, 6], [9, 6], [10, 5], [11, 4], [12, 3]]) put(d, x, y, w);
      for (const [x, y] of [[4, 12], [5, 11], [7, 8], [9, 7], [11, 5], [12, 4]]) put(d, x, y, [98, 68, 40]);
      line(d, 3, 12, 12, 3, [228, 228, 228]);
      put(d, 3, 12, w);
      put(d, 12, 3, w);
      void r;
    });
    icon('arrow', (d, r) => {
      line(d, 3, 12, 11, 4, [128, 92, 54]);
      put(d, 12, 3, [200, 200, 206]); put(d, 11, 3, [170, 170, 176]); put(d, 12, 4, [170, 170, 176]); put(d, 13, 2, [220, 220, 226]);
      for (const [x, y] of [[2, 12], [3, 13], [2, 13], [4, 13], [2, 11]]) put(d, x, y, [236, 236, 236]);
      void r;
    });
    const cartIcon = (fillc) => (d, r) => {
      for (let y = 6; y < 12; y++) for (let x = 2; x < 14; x++) put(d, x, y, vary([150, 150, 156], r, 8));
      for (let x = 3; x < 13; x++) put(d, x, 6, [110, 110, 116]);
      for (const cx of [4.5, 10.5]) disc(d, cx, 12.5, 1.6, (x, y) => put(d, x, y, [50, 50, 54]));
      if (fillc) for (let y = 2; y < 6; y++) for (let x = 4; x < 12; x++) put(d, x, y, vary(fillc, r, 10));
    };
    icon('minecart', cartIcon(null));
    icon('chest_minecart', cartIcon([176, 124, 60]));
    icon('tnt_minecart', cartIcon([210, 50, 36]));
    icon('hopper_minecart', cartIcon([66, 66, 70]));
    make('cart_body', (d, r) => {
      fill(d, r, [150, 150, 156], 8);
      border(d, [178, 178, 184], [110, 110, 116]);
    });
    make('cart_inner', (d, r) => fill(d, r, [96, 96, 102], 6));
    make('arrow_ent', (d, r) => fill(d, r, [128, 92, 54], 8));
    void speckle;
    void art;
  });
})();
