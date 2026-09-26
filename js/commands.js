'use strict';
// Commandes du tchat : tape « / » dans le tchat (T, Entrée ou /). /aide donne la liste.
// - Solo : toutes les commandes.
// - Multijoueur : l'hôte a tout ; les invités ont les commandes d'information et de discussion,
//   et les « triches » si l'hôte les autorise (/triche on).
// - Ce qui touche au monde s'exécute chez l'hôte (l'invité lui envoie la commande) ; ce qui touche
//   un joueur (objets, soins, téléportation…) s'exécute chez ce joueur (l'hôte relaie).
(function () {
  const norm = (s) =>
    String(s === undefined || s === null ? '' : s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[’'`\s-]+/g, '_');
  const G = () => CM.game;
  const r1 = (v) => Math.round(v * 10) / 10;
  const plural = (n, s, p) => n + ' ' + (n > 1 ? p || s + 's' : s);
  class Bad extends Error {}
  const bad = (m) => {
    throw new Bad(m);
  };

  // --------------------------------------------------------- registre --
  const CMDS = [];
  const BY = new Map();
  // noms : « nom alias1 alias2 » ; o : { usage, desc, cat, cheat, local, args, run }
  function def(names, o) {
    o.names = names.split(' ');
    o.name = o.names[0];
    CMDS.push(o);
    for (const n of o.names) BY.set(norm(n), o);
  }

  // ------------------------------------------------ sortie dans le tchat --
  function print(s, kind) {
    const net = G().net;
    const d = document.createElement('div');
    d.className = 'cl cmd ' + (kind || 'info');
    d.textContent = String(s).slice(0, 600);
    net.pushLine(d);
  }

  // ------------------------------------------------------ arguments --
  // Découpe en respectant les guillemets : /msg "Le Roi" salut
  function split(s) {
    const out = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]);
    return out;
  }
  const number = (s, what) => {
    const n = Number(String(s).replace(',', '.'));
    if (s === undefined || s === '' || !Number.isFinite(n)) bad((what || 'Nombre') + ' attendu' + (s !== undefined ? ' (« ' + s + ' »)' : ''));
    return n;
  };
  const int = (s, lo, hi, what) => Math.max(lo, Math.min(hi, Math.round(number(s, what))));
  const isNum = (s) => s !== undefined && Number.isFinite(Number(String(s).replace(',', '.')));
  const isCoord = (s) => s !== undefined && (/^~(-?\d+([.,]\d+)?)?$/.test(s) || isNum(s));
  // coordonnée : nombre, ~ (ici), ~5 (ici + 5)
  function coord(s, base, what) {
    s = String(s === undefined ? '' : s);
    if (s[0] === '~') return base + (s.length > 1 ? number(s.slice(1), 'Décalage ' + what) : 0);
    return number(s, 'Coordonnée ' + what);
  }
  const ON = new Set(['on', 'oui', 'vrai', 'true', '1', 'active', 'activer', 'marche', 'yes']);
  const OFF = new Set(['off', 'non', 'faux', 'false', '0', 'desactive', 'desactiver', 'arret', 'no']);
  const onOff = (s, cur) => {
    if (s === undefined) return !cur;
    const n = norm(s);
    if (ON.has(n)) return true;
    if (OFF.has(n)) return false;
    bad('« on » ou « off » attendu');
  };

  // ------------------------------------------------ objets et blocs --
  let IDX = null;
  function index() {
    if (IDX) return IDX;
    const map = new Map(), names = [];
    const keyOf = (id) => {
      const i = CM.itemInfo(id);
      return i ? i.key || (i.block && i.block.key) || '' : '';
    };
    const add = (id, list) => {
      const info = CM.itemInfo(id);
      if (!info) return;
      const n = norm(info.name);
      if (!map.has(n)) {
        map.set(n, id);
        if (list) names.push(n);
      }
      // (aussi sans l'apostrophe : « bloc_dor » comme « bloc_d_or »)
      const n2 = norm(info.name.replace(/['’]/g, ''));
      if (!map.has(n2)) map.set(n2, id);
      const k = norm(keyOf(id));
      if (k && !map.has(k)) map.set(k, id);
    };
    for (const b of CM.blocks) if (b && b.id && b.id !== CM.B.WATER && b.tex && !b.hidden) add(b.id, true);
    for (const it of CM.items) if (it) add(it.id, true);
    // blocs spéciaux (seulement pour /poser, /remplir…)
    for (const [n, id] of [['air', 0], ['vide', 0], ['eau', CM.B.WATER], ['water', CM.B.WATER], ['lave', CM.B.LAVA], ['lava', CM.B.LAVA], ['feu', CM.B.FIRE], ['fire', CM.B.FIRE]]) if (id !== undefined && !map.has(n)) map.set(n, id);
    for (const b of CM.blocks) if (b && !map.has(norm(b.key))) map.set(norm(b.key), b.id);
    names.sort();
    return (IDX = { map, names });
  }
  function findItem(s) {
    if (s === undefined) bad('Objet attendu');
    const { map, names } = index();
    const n = norm(s);
    if (map.has(n)) return map.get(n);
    if (/^\d+$/.test(n) && CM.itemInfo(+n)) return +n;
    if (n.endsWith('s') && map.has(n.slice(0, -1))) return map.get(n.slice(0, -1));
    const pre = names.filter((x) => x.startsWith(n));
    if (pre.length === 1) return map.get(pre[0]);
    // « laine » : la blanche ; « planches » : le chêne…
    const def = pre.find((x) => x === n + '_blanche' || x === n + '_blanc' || x === n + '_de_chene' || x === n + '_en_chene');
    if (def) return map.get(def);
    const has = names.filter((x) => x.includes(n));
    if (has.length === 1) return map.get(has[0]);
    const hint = (pre.length ? pre : has).slice(0, 5);
    bad('Objet inconnu : « ' + s + ' »' + (hint.length ? ' — peut-être : ' + hint.join(', ') : ''));
  }
  function findBlock(s) {
    const id = findItem(s);
    if (id >= CM.ITEM_BASE) bad('« ' + CM.itemName(id) + ' » n’est pas un bloc');
    return id;
  }
  const idOf = (key) => (CM.I[key] !== undefined ? CM.I[key] : CM.B[key]);
  const nameOf = (id) => (id === 0 ? 'Air' : CM.itemName(id));
  const extOk = (id) => {
    const i = CM.itemInfo(id);
    return !i || !i.ext || CM.extOn(i.ext);
  };

  // ------------------------------------------------------ créatures --
  const MOB_ALIASES = {
    mouflon: 'mouflon', mouton: 'mouflon', sheep: 'mouflon',
    sanglier: 'boar', cochon: 'boar', boar: 'boar', pig: 'boar',
    manchot: 'penguin', pingouin: 'penguin', penguin: 'penguin',
    ombre: 'ombre', ombres: 'ombre', zombie: 'ombre', shadow: 'ombre',
    villageois: 'villager', villager: 'villager', pnj: 'villager',
    golem: 'golem', golem_de_fer: 'golem', iron_golem: 'golem',
    ardent: 'ardent', ombre_ardente: 'ardent', blaze: 'ardent',
  };
  const MOB_NAMES = { mouflon: 'Mouflon', boar: 'Sanglier', penguin: 'Manchot', ombre: 'Ombre', villager: 'Villageois', golem: 'Golem de fer', ardent: 'Ombre ardente' };
  // (plus les créatures de mob_defs.js : poule, vache, araignée, squelette…)
  const mobType = (k) => {
    if (MOB_ALIASES[k]) return MOB_ALIASES[k];
    const M = CM.MOBS || {};
    return Object.keys(M).find((t) => t === k || norm(M[t].name || '') === k || (M[t].aliases || []).some((x) => norm(x) === k)) || null;
  };
  const mobName = (t) => MOB_NAMES[t] || (CM.MOBS && CM.MOBS[t] && CM.MOBS[t].name) || t;
  const summonList = () => ['mouflon', 'sanglier', 'manchot', 'ombre', 'villageois', 'golem', 'ombre_ardente'].concat(Object.values((CM.MORE && CM.MORE.mobs) || {}).map((d) => d.aliases[0])).concat(['tnt', 'eclair', 'wagonnet']);

  // -------------------------------------------------------- joueurs --
  const myPid = () => (G().net.isClient ? G().net.pid : 0);
  function players() {
    const g = G(), net = g.net, p = g.player;
    const out = [{ name: net.active ? net.name : 'Toi', pid: myPid(), self: true, x: p.x, y: p.y, z: p.z, dim: g.playerDim, alive: p.alive }];
    for (const [pid, rp] of net.remotes) out.push({ name: rp.name, pid, self: false, x: rp.x, y: rp.y, z: rp.z, dim: rp.dim, rp, alive: rp.alive });
    return out;
  }
  const isAll = (s) => ['@a', 'tous', 'all', 'everyone', 'tout_le_monde'].includes(norm(s));
  const isMe = (s) => ['@s', 'moi', 'me', 'self'].includes(norm(s));
  function findPlayer(ctx, s) {
    const all = players();
    if (s === undefined || isMe(s)) return all.find((q) => q.pid === ctx.pid) || bad('Joueur introuvable');
    const n = norm(s);
    const exact = all.find((q) => norm(q.name) === n);
    if (exact) return exact;
    const pre = all.filter((q) => norm(q.name).startsWith(n));
    if (pre.length === 1) return pre[0];
    bad('Joueur introuvable : « ' + s + ' »' + (all.length > 1 ? ' (en ligne : ' + all.map((q) => q.name).join(', ') + ')' : ''));
  }
  const isPlayer = (s) => s !== undefined && (isAll(s) || isMe(s) || players().some((q) => norm(q.name) === norm(s) || (norm(s).length >= 2 && norm(q.name).startsWith(norm(s)))));
  const targets = (ctx, s) => (s !== undefined && isAll(s) ? players() : [findPlayer(ctx, s)]);
  const who = (ctx, q) => (q.pid === ctx.pid ? 'toi' : q.name);

  // ---------------------------------------- actions sur un joueur --
  // Appliquée chez le joueur visé : ici si c'est nous, sinon envoyée (l'hôte relaie).
  function act(q, a) {
    const g = G(), net = g.net;
    if (q.self && !(net.isClient && a.a === 'tp' && a.dim && a.dim !== g.playerDim)) return apply(a);
    if (net.isHost) return hostAct(q.pid, a);
    net.send({ t: 'act', to: q.pid, a });
  }
  function hostAct(pid, a) {
    const g = G(), net = g.net;
    if (pid === 0) return apply(a);
    const e = net.links.get(pid);
    if (!e) return;
    if (a.a === 'tp' && a.dim && a.dim !== e.rp.dim) {
      const at = { x: a.x, y: a.y !== undefined ? a.y : surfaceIn(a.dim, a.x, a.z), z: a.z };
      net.travelGuest(e, a.dim, { at });
      return;
    }
    e.link.send({ t: 'act', a });
  }
  // Hauteur où se poser (dimension quelconque ; l'hôte charge ce qu'il faut).
  function surfaceIn(dim, x, z) {
    const g = G();
    return g.withDim(dim, () => {
      g.world.loadAround(x, z, 1);
      return surfaceY(g.world, x, z);
    });
  }
  function surfaceY(w, x, z, from) {
    const bx = Math.floor(x), bz = Math.floor(z), { MINY, H } = CM.WORLD;
    if (!w.nether) return w.groundBelow(bx, H - 1, bz) + 1;
    // Nether : première poche d'air (2 blocs) au-dessus d'un sol, en partant d'en bas
    for (let y = Math.max(MINY + 1, from !== undefined ? Math.floor(from) : 32); y < 120; y++)
      if (CM.blocks[w.get(bx, y - 1, bz)].solid && !w.solidAt(bx, y, bz) && !w.solidAt(bx, y + 1, bz) && !CM.isLava(w.get(bx, y, bz))) return y;
    return 64;
  }
  function addLevels(p, k) {
    const { level, frac } = p.levelInfo();
    const L = Math.max(0, Math.min(1000, level + k));
    let total = 0;
    for (let i = 0; i < L; i++) total += CM.xpNeed(i);
    p.xpTotal = total + Math.floor(frac * CM.xpNeed(L));
  }
  // Effet d'une action sur le joueur de cet écran.
  function apply(a) {
    const g = G(), p = g.player, inv = g.inventory;
    if (!a || typeof a !== 'object') return;
    const note = a.note ? String(a.note).slice(0, 200) : '';
    switch (a.a) {
      case 'give': {
        const id = a.id | 0, n = Math.max(1, Math.min(6400, a.n | 0));
        if (!CM.itemInfo(id)) return;
        const ex = CM.freshExtra(id) || {};
        const en = CM.cleanEnch(a.en);
        if (en) ex.ench = en;
        const extra = ex.xp !== undefined || ex.ench ? ex : null;
        let left = n;
        const max = inv.maxStack(id);
        // objets non empilables : une pile chacun (enchantements copiés)
        while (left > 0) {
          const k = Math.min(left, max);
          const rest = inv.add(id, k, extra ? JSON.parse(JSON.stringify(extra)) : null);
          if (rest > 0) g.dropNearPlayer(id, rest, extra);
          left -= k;
        }
        CM.Audio.play('pop');
        break;
      }
      case 'heal':
        if (!p.alive) return;
        p.health = p.maxHealth;
        p.burning = 0;
        p.air = Math.max(p.air || 0, 300);
        p.hurtFlash = 0;
        CM.Audio.play('xp');
        break;
      case 'feed':
        p.food = 20;
        p.sat = 20;
        CM.Audio.play('eat');
        break;
      case 'kill':
        if (!p.alive) return;
        p.health = 0;
        p.die(a.c ? String(a.c).slice(0, 60) : 'Une commande');
        break;
      case 'tp':
        tpLocal(a);
        break;
      case 'clear':
        for (let i = 0; i < 36; i++) inv.slots[i] = null;
        if (a.all) {
          inv.armor = [null, null, null, null];
          inv.offhand = null;
        }
        inv.changed();
        break;
      case 'fly':
        p.cmdFly = !!a.on;
        if (!a.on && !p.creative) p.flying = false;
        break;
      case 'god':
        p.cmdGod = !!a.on;
        break;
      case 'speed':
        p.cmdSpeed = Math.max(0.1, Math.min(10, +a.v || 1));
        break;
      case 'jump':
        p.cmdJump = Math.max(0, Math.min(10, a.v | 0));
        break;
      case 'nv':
        p.nightVision = !!a.on;
        break;
      case 'xp':
        if (a.lv) addLevels(p, a.n | 0);
        else p.xpTotal = Math.max(0, p.xpTotal + (a.n | 0));
        if (a.set !== undefined) {
          p.xpTotal = 0;
          addLevels(p, a.set | 0);
        }
        CM.Audio.play('level');
        break;
      case 'repair': {
        let n = 0;
        const fix = (s) => {
          const i = s && CM.itemInfo(s.id);
          if (!i || !(i.type === 'armor' || i.type === 'shield' || i.charge)) return;
          if (s.xp) n++;
          s.xp = 0;
        };
        if (a.all) {
          inv.slots.forEach(fix);
          inv.armor.forEach(fix);
          fix(inv.offhand);
        } else fix(inv.held());
        inv.changed();
        if (a.all || n) CM.Audio.play('anvil');
        break;
      }
      case 'ench': {
        const s = inv.held();
        if (!s) return;
        if (a.k === null) delete s.ench;
        else if (CM.ENCHANTS[a.k]) {
          s.ench = s.ench || {};
          if ((a.l | 0) <= 0) delete s.ench[a.k];
          else s.ench[a.k] = Math.min(CM.ENCHANTS[a.k].max, a.l | 0);
          if (!Object.keys(s.ench).length) delete s.ench;
        }
        inv.changed();
        CM.Audio.play('enchant');
        break;
      }
      case 'more': {
        const s = inv.held();
        if (s) s.count = inv.maxStack(s.id);
        inv.changed();
        break;
      }
      case 'msg':
        print('✉ ' + String(a.from || '?').slice(0, 24) + ' te chuchote : ' + String(a.s || '').slice(0, 200), 'msg');
        CM.Audio.play('click');
        break;
      case 'fire':
        p.burning = Math.max(p.burning || 0, Math.min(20, +a.t || 5));
        break;
      case 'launch':
        p.vy = Math.min(40, +a.v || 20);
        p.onGround = false;
        break;
    }
    if (note) print(note, 'info');
  }
  // Téléportation du joueur de cet écran.
  function tpLocal(a) {
    const g = G(), p = g.player, net = g.net;
    if (!p.alive || !Number.isFinite(+a.x) || !Number.isFinite(+a.z)) return;
    const back = { x: p.x, y: p.y, z: p.z, dim: g.playerDim };
    if (a.dim && a.dim !== g.playerDim) {
      if (net.isClient) return; // (l'hôte s'en charge : voyage entre dimensions)
      g.cmdBack = back;
      const y = a.y !== undefined ? +a.y : surfaceIn(a.dim, +a.x, +a.z);
      g.changeDim(a.dim, { at: { x: +a.x, y, z: +a.z } });
      return;
    }
    g.cmdBack = back;
    const w = g.world;
    w.loadAround(+a.x, +a.z, 1);
    if (p.riding !== null && p.riding !== undefined) {
      const c = (g.entities.carts || []).find((o) => o.uid === p.riding);
      p.leaveCart(c);
    }
    if (p.sleeping) g.wake('tp');
    p.x = +a.x;
    p.z = +a.z;
    p.y = a.y !== undefined && Number.isFinite(+a.y) ? +a.y : surfaceY(w, p.x, p.z, p.y);
    if (a.yaw !== undefined) p.yaw = +a.yaw;
    p.vx = p.vy = p.vz = 0;
    p.fallStart = p.y;
    p.hook = null;
    CM.Audio.play('portal');
    g.entities.burst(CM.Textures.layer.white, p.x, p.y + 1, p.z, 14, { speed: 2, grav: 0, life: 0.5, size: 0.06 });
    if (net.isClient) net.sendMyState(true);
  }

  // ------------------------------------------------ modifications --
  // Toutes les modifications d'une commande sont notées pour /annuler.
  function editor(ctx, label) {
    const g = G(), w = g.world, undo = [];
    let n = 0, skipped = 0;
    const { MINY, H } = CM.WORLD;
    return {
      set(x, y, z, id) {
        if (y < MINY || y >= H) return;
        if (!w.loaded(x, z)) {
          skipped++;
          return;
        }
        const old = w.get(x, y, z);
        if (old === id || CM.blocks[old].unbreakable) return;
        if (w.setBlock(x, y, z, id)) {
          undo.push(x, y, z, old);
          n++;
        }
      },
      get: (x, y, z) => w.get(x, y, z),
      done() {
        if (undo.length) {
          const u = (g.cmdUndo = g.cmdUndo || {});
          const list = (u[ctx.name] = u[ctx.name] || []);
          list.push({ dim: g.dim, cells: undo, label });
          if (list.length > 8) list.shift();
        }
        return n + (skipped ? ' (' + skipped + ' hors de la zone chargée)' : '');
      },
      get count() {
        return n;
      },
    };
  }
  const MAX_EDIT = 20000;
  // Bloc visé (au-delà de la portée normale) : { x, y, z, nx, ny, nz }.
  function lookHit(g) {
    const p = g.player, e = p.eye(), d = p.aim();
    const h = g.world.raycast(e[0], e[1], e[2], d[0], d[1], d[2], 120, (id) => !CM.isFluid(id) && !CM.blocks[id].portal);
    return h ? { x: h.x, y: h.y, z: h.z, nx: h.nx | 0, ny: h.ny | 0, nz: h.nz | 0 } : null;
  }
  const needLook = (ctx) => ctx.look || bad('Vise un bloc (ou donne des coordonnées)');
  // Position de départ d'une construction : coordonnées données, sinon le bloc visé.
  function posArg(ctx, a, i, place) {
    if (isCoord(a[i]) && isCoord(a[i + 1]) && isCoord(a[i + 2])) {
      return { x: Math.floor(coord(a[i], ctx.x, 'x')), y: Math.floor(coord(a[i + 1], ctx.y, 'y')), z: Math.floor(coord(a[i + 2], ctx.z, 'z')), used: 3 };
    }
    const h = needLook(ctx);
    return place ? { x: h.x + h.nx, y: h.y + h.ny, z: h.z + h.nz, used: 0 } : { x: h.x, y: h.y, z: h.z, used: 0 };
  }

  // ---------------------------------------------------------- contexte --
  // ctx : qui lance la commande et d'où. self : lancée sur cet écran.
  function selfCtx(line) {
    const g = G(), p = g.player, net = g.net;
    return {
      line,
      self: true,
      name: net.active ? net.name : 'Toi',
      pid: myPid(),
      x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, dim: g.playerDim,
      look: lookHit(g),
      cheats: !net.isClient || !!net.rules.cmds,
      out: print,
    };
  }
  function guestCtx(e, m) {
    const g = G(), rp = e.rp, net = g.net;
    const pos = Array.isArray(m.pos) ? m.pos.map((v) => (Number.isFinite(+v) ? +v : 0)) : [rp.x, rp.y, rp.z, rp.yaw, rp.pitch];
    const lk = Array.isArray(m.lk) && m.lk.length === 6 && m.lk.every((v) => Number.isFinite(+v)) ? { x: m.lk[0] | 0, y: m.lk[1] | 0, z: m.lk[2] | 0, nx: m.lk[3] | 0, ny: m.lk[4] | 0, nz: m.lk[5] | 0 } : null;
    return {
      line: String(m.s || '').slice(0, 300),
      self: false,
      name: e.name,
      pid: e.pid,
      x: pos[0], y: pos[1], z: pos[2], yaw: pos[3], pitch: pos[4], dim: rp.dim,
      look: lk,
      cheats: !!net.rules.cmds,
      out: (s, k) => net.sendTo(e.pid, { t: 'cr', s: String(s).slice(0, 600), k: k || 'info' }),
    };
  }
  const say = (ctx) => ({
    ok: (s) => ctx.out(s, 'ok'),
    err: (s) => ctx.out(s, 'err'),
    info: (s) => ctx.out(s, 'info'),
  });

  // ---------------------------------------------------------- exécution --
  function exec(ctx) {
    const g = G(), net = g.net;
    const line = ctx.line.trim();
    const parts = split(line.replace(/^\//, ''));
    const name = norm(parts.shift() || '');
    const c = BY.get(name);
    const o = say(ctx);
    if (!name) return o.info('Tape /aide pour la liste des commandes');
    if (!c) {
      const near = CMDS.filter((k) => k.names.some((n) => norm(n).startsWith(name.slice(0, 3)))).map((k) => '/' + k.name).slice(0, 4);
      return o.err('Commande inconnue : /' + name + (near.length ? ' — peut-être ' + near.join(', ') : '') + ' · /aide');
    }
    if (c.cheat && !ctx.cheats) return o.err('/' + c.name + ' : les triches sont désactivées par l’hôte (il peut taper /triche on)');
    if (c.hostOnly && ctx.self && net.isClient) return o.err('/' + c.name + ' : réservé à l’hôte');
    // invité : ce qui touche au monde part chez l'hôte
    if (!c.local && forward(ctx)) return;
    try {
      c.run(ctx, parts, o, c);
    } catch (e) {
      if (e instanceof Bad) o.err(e.message);
      else {
        console.error(e);
        o.err('Erreur : ' + e.message);
      }
    }
  }
  const usage = (c) => bad('Usage : /' + c.name + (c.usage ? ' ' + c.usage : ''));
  // Invité : cette partie de la commande se fait chez l'hôte.
  function forward(ctx) {
    const net = G().net;
    if (!(ctx.self && net.isClient)) return false;
    const lk = ctx.look ? [ctx.look.x, ctx.look.y, ctx.look.z, ctx.look.nx, ctx.look.ny, ctx.look.nz] : null;
    net.send({ t: 'cmd', s: ctx.line, pos: [r1(ctx.x), r1(ctx.y), r1(ctx.z), Math.round(ctx.yaw * 100) / 100, Math.round(ctx.pitch * 100) / 100], lk });
    return true;
  }

  // ================================================================ COMMANDES ==
  // -------------------------------------------------------------- infos --
  def('aide help ? commandes cmd', {
    cat: 'Infos', local: true, usage: '[commande | catégorie]', desc: 'liste des commandes, ou le détail de l’une d’elles',
    args: [() => CMDS.map((c) => c.name).concat(CATS.map(norm))],
    run(ctx, a, o) {
      if (a[0]) {
        const c = BY.get(norm(a[0]).replace(/^\//, ''));
        if (c) {
          o.info('/' + c.name + (c.usage ? ' ' + c.usage : '') + ' — ' + c.desc + (c.names.length > 1 ? ' (aussi : ' + c.names.slice(1).map((n) => '/' + n).join(' ') + ')' : '') + (c.cheat ? ' [triche]' : ''));
          if (c.more) o.info(c.more);
          return;
        }
        const cat = CATS.find((k) => norm(k) === norm(a[0]) || norm(k).startsWith(norm(a[0])));
        if (!cat) bad('Ni commande ni catégorie : « ' + a[0] + ' »');
        o.info('— ' + cat + ' —');
        for (const c of CMDS.filter((k) => k.cat === cat)) o.info('/' + c.name + (c.usage ? ' ' + c.usage : '') + ' : ' + c.desc);
        return;
      }
      o.info(CMDS.length + ' commandes. /aide <catégorie> pour les détailler, /aide <commande> pour une commande. Tab complète, ↑ reprend la précédente.');
      for (const cat of CATS) o.info(cat + ' : ' + CMDS.filter((k) => k.cat === cat).map((k) => '/' + k.name).join(' '));
    },
  });
  const CATS = ['Infos', 'Tchat', 'Joueur', 'Déplacement', 'Monde', 'Construction', 'Créatures', 'Amusant', 'Partie'];
  const DIRS = ['Nord', 'Nord-Ouest', 'Ouest', 'Sud-Ouest', 'Sud', 'Sud-Est', 'Est', 'Nord-Est'];
  const facing = (yaw) => DIRS[((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8];
  const vers = (d) => (/^[EO]/.test(d) ? 'vers l’' : 'vers le ') + d;
  const face = (d) => (/^[EO]/.test(d) ? 'face à l’' : 'face au ') + d;
  // « (Bob) » après une annonce, seulement en multijoueur
  const by = (ctx) => (G().net.active ? ' (' + ctx.name + ')' : '');
  def('coords pos position ou where', {
    cat: 'Infos', local: true, usage: '', desc: 'ta position, ta direction, le biome et la dimension',
    run(ctx, a, o) {
      const g = G(), w = g.world;
      o.info('📍 X ' + r1(ctx.x) + ' · Y ' + r1(ctx.y) + ' · Z ' + r1(ctx.z) + ' — ' + face(facing(ctx.yaw)) + ' — ' + w.biomeName(ctx.x, ctx.z) + ' — ' + (ctx.dim === 'nether' ? 'Nether' : 'monde normal') + ' — tronçon ' + Math.floor(ctx.x / 16) + ', ' + Math.floor(ctx.z / 16));
    },
  });
  def('graine seed', {
    cat: 'Infos', local: true, usage: '', desc: 'la graine du monde',
    run(ctx, a, o) {
      o.info('🌱 Graine du monde : ' + G().worlds.overworld.seed);
    },
  });
  def('biome', {
    cat: 'Infos', local: true, usage: '', desc: 'le biome où tu te trouves',
    run(ctx, a, o) {
      const w = G().world;
      o.info('🌳 Biome : ' + w.biomeName(ctx.x, ctx.z) + (w.villageNear && w.villageNear(ctx.x, ctx.z, 0) ? ' (dans un village)' : ''));
    },
  });
  const hourOf = (t) => ((t + 0.25) % 1) * 24;
  def('heure time? quelle_heure', {
    cat: 'Infos', local: true, usage: '', desc: 'le jour et l’heure du monde',
    run(ctx, a, o) {
      const g = G(), h = hourOf(g.time), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
      o.info('🕒 Jour ' + (g.dayCount + 1) + ', ' + String(hh).padStart(2, '0') + 'h' + String(mm).padStart(2, '0') + (g.daylight < 0.35 ? ' (nuit)' : '') + ' — météo : ' + CM.Weather.NAMES[CM.Weather.state(g).type] + (g.settings.dayCycle === false ? ' — cycle jour/nuit arrêté' : ''));
    },
  });
  def('liste list joueurs online', {
    cat: 'Infos', local: true, usage: '', desc: 'les joueurs connectés',
    run(ctx, a, o) {
      const ps = players();
      o.info('👥 ' + plural(ps.length, 'joueur') + ' : ' + ps.map((q) => q.name + (q.dim === 'nether' ? ' (Nether)' : '') + (q.alive === false ? ' 💀' : '')).join(', '));
    },
  });
  def('stats statistiques', {
    cat: 'Infos', local: true, usage: '', desc: 'tes statistiques de partie',
    run(ctx, a, o) {
      const g = G(), s = g.stats, sum = (m) => Object.values(m || {}).reduce((x, y) => x + y, 0);
      const t = Math.floor(s.playTime || 0);
      o.info('📊 Blocs cassés ' + sum(s.mined) + ' · posés ' + sum(s.placed) + ' · objets fabriqués ' + sum(s.crafted) + ' · créatures vaincues ' + sum(s.kills) + ' · morts ' + (s.deaths || 0) + ' · temps de jeu ' + Math.floor(t / 3600) + 'h' + String(Math.floor((t % 3600) / 60)).padStart(2, '0') + ' · niveau ' + g.player.level);
    },
  });
  def('version', {
    cat: 'Infos', local: true, usage: '', desc: 'version du jeu et extensions actives',
    run(ctx, a, o) {
      const g = G(), ext = g.settings.ext || {};
      const on = [ext.tech && 'Électricité', ext.light && 'Lumière réaliste', ext.gravity && 'Gravité réaliste'].filter(Boolean);
      o.info('CraftMine — L’Aube des Éclats · ' + CM.blocks.filter(Boolean).length + ' blocs · ' + CM.items.filter(Boolean).length + ' objets · ' + CMDS.length + ' commandes · extensions : ' + (on.length ? on.join(', ') : 'aucune'));
    },
  });
  def('localiser locate trouver', {
    cat: 'Infos', local: true, cheat: true, usage: '<village | biome>', desc: 'direction et distance du village ou du biome le plus proche',
    args: [() => ['village'].concat(CM.BIOME_NAMES.map(norm))],
    run(ctx, a, o, c) {
      if (!a[0]) usage(c);
      const g = G(), w = g.world, what = norm(a.join('_'));
      let tx, tz, label;
      if (what === 'village') {
        if (w.nether) bad('Pas de village dans le Nether');
        const v = w.nearestVillage(ctx.x, ctx.z, 4000);
        if (!v) bad('Aucun village à moins de 4000 blocs');
        tx = v.x;
        tz = v.z;
        label = 'Village';
      } else {
        const bi = CM.BIOME_NAMES.findIndex((n) => norm(n) === what || norm(n).startsWith(what));
        if (bi < 0) bad('Biome inconnu : « ' + a.join(' ') + ' »');
        label = CM.BIOME_NAMES[bi];
        let found = null;
        for (let r = 0; r <= 3000 && !found; r += 48) {
          const steps = Math.max(1, Math.round((2 * Math.PI * r) / 48));
          for (let k = 0; k < steps && !found; k++) {
            const x = ctx.x + Math.cos((k / steps) * Math.PI * 2) * r, z = ctx.z + Math.sin((k / steps) * Math.PI * 2) * r;
            if (w.column(Math.floor(x), Math.floor(z)).bi === bi) found = [x, z];
          }
        }
        if (!found) bad(label + ' : introuvable à moins de 3000 blocs');
        [tx, tz] = found;
      }
      const dx = tx - ctx.x, dz = tz - ctx.z, d = Math.round(Math.hypot(dx, dz));
      o.ok('🧭 ' + label + ' : X ' + Math.round(tx) + ', Z ' + Math.round(tz) + ' — à ' + d + ' blocs ' + vers(facing(Math.atan2(-dx, -dz))) + ' (/tp ' + Math.round(tx) + ' ~ ' + Math.round(tz) + ')');
    },
  });
  def('calcul calc calculer', {
    cat: 'Infos', local: true, usage: '<expression>', desc: 'calculatrice (+ − × ÷ ^ %, parenthèses, sqrt, pi…)',
    run(ctx, a, o, c) {
      const ex = a.join(' ').replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/\^/g, '**');
      if (!ex) usage(c);
      if (!/^[\d\s+\-*/().%a-z_]*$/i.test(ex)) bad('Expression invalide');
      const ok = ex.replace(/[a-z_]+/gi, (w) => {
        const k = w.toLowerCase();
        if (['sqrt', 'abs', 'floor', 'ceil', 'round', 'sin', 'cos', 'tan', 'log', 'min', 'max', 'pow'].includes(k)) return 'Math.' + k;
        if (k === 'pi') return 'Math.PI';
        if (k === 'e') return 'Math.E';
        bad('Inconnu dans le calcul : ' + w);
      });
      const v = Function('"use strict";return (' + ok + ')')();
      if (typeof v !== 'number' || !Number.isFinite(v)) bad('Résultat impossible');
      o.ok('🧮 ' + a.join(' ') + ' = ' + Math.round(v * 1e6) / 1e6);
    },
  });

  // ------------------------------------------------------------- tchat --
  def('msg tell w mp chuchoter', {
    local: true,
    cat: 'Tchat', usage: '<joueur> <message>', desc: 'message privé à un joueur',
    args: [() => players().map((q) => q.name)],
    run(ctx, a, o, c) {
      if (a.length < 2) usage(c);
      const q = findPlayer(ctx, a[0]);
      const s = a.slice(1).join(' ').slice(0, 200);
      if (q.pid === ctx.pid) bad('Tu te parles à toi-même ?');
      act(q, { a: 'msg', from: ctx.name, s });
      o.info('✉ à ' + q.name + ' : ' + s);
    },
  });
  def('moi me action', {
    cat: 'Tchat', usage: '<action>', desc: 'raconte ce que tu fais (« * Bob danse »)',
    run(ctx, a, o, c) {
      if (!a.length) usage(c);
      broadcastLine('* ' + ctx.name + ' ' + a.join(' ').slice(0, 200), 'me');
    },
  });
  def('annonce say dire broadcast', {
    cat: 'Tchat', cheat: true, usage: '<message>', desc: 'grande annonce à l’écran de tous',
    run(ctx, a, o, c) {
      if (!a.length) usage(c);
      const s = a.join(' ').slice(0, 160);
      broadcastLine('📢 [' + ctx.name + '] ' + s, 'ann');
      announce(s);
      if (G().net.isHost) G().net.broadcast({ t: 'ann', s });
    },
  });
  def('effacer clear_chat cls vider_tchat', {
    cat: 'Tchat', local: true, usage: '', desc: 'efface le tchat de ton écran',
    run() {
      const el = G().net.chatEl;
      while (el.firstChild) el.removeChild(el.firstChild);
    },
  });
  def('de roll des lancer', {
    cat: 'Amusant', usage: '[faces]', desc: 'lance un dé (6 faces par défaut), résultat pour tout le monde',
    run(ctx, a) {
      const f = a[0] ? int(a[0], 2, 1000, 'Faces') : 6;
      broadcastLine('🎲 ' + ctx.name + ' lance un dé à ' + f + ' faces : ' + (1 + Math.floor(Math.random() * f)), 'me');
    },
  });
  def('pileouface coinflip pile face piece', {
    cat: 'Amusant', usage: '', desc: 'pile ou face, pour tout le monde',
    run(ctx) {
      broadcastLine('🪙 ' + ctx.name + ' lance une pièce : ' + (Math.random() < 0.5 ? 'pile' : 'face') + ' !', 'me');
    },
  });
  // Ligne vue par tous (hôte : diffusée ; solo : ici).
  function broadcastLine(s, kind) {
    const net = G().net;
    print(s, kind);
    if (net.isHost) net.broadcast({ t: 'cr', s, k: kind });
  }
  function announce(s) {
    G().ui.toast('📢 ' + String(s).slice(0, 160), 'gold', 'ann');
  }

  // ------------------------------------------------------------ joueur --
  def('donner give g', {
    local: true,
    cat: 'Joueur', cheat: true, usage: '<objet> [nombre] [joueur]', desc: 'donne un objet (nom français ou anglais : diamant, lingot_de_fer, torch…)',
    more: 'Exemples : /donner diamant 64 · /donner épée_en_diamant · /donner Bob pomme_dorée 5 · /donner torche 64 @a',
    args: [() => [...index().names, ...players().map((q) => q.name)], () => ['1', '16', '32', '64'], () => players().map((q) => q.name).concat(['@a'])],
    run(ctx, a, o, c) {
      if (!a.length) usage(c);
      a = a.slice();
      let tg;
      if (a.length >= 2 && isPlayer(a[0]) && !isNum(a[1])) {
        let ok = true;
        try {
          findItem(a[1]);
        } catch (e) {
          ok = false;
        }
        if (ok) tg = a.shift();
      }
      const id = findItem(a[0]);
      if (!extOk(id)) bad('« ' + CM.itemName(id) + ' » vient d’une extension désactivée dans ce monde');
      let n = 1;
      if (isNum(a[1])) n = int(a[1], 1, 6400, 'Nombre');
      else if (a[1] !== undefined && tg === undefined) tg = a[1];
      if (a[2] !== undefined && tg === undefined) tg = a[2];
      const list = targets(ctx, tg);
      for (const q of list) act(q, { a: 'give', id, n, note: q.pid !== ctx.pid ? ctx.name + ' t’a donné ' + n + ' × ' + CM.itemName(id) : '' });
      o.ok('🎁 ' + n + ' × ' + CM.itemName(id) + ' → ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  const KITS = {
    depart: ['Départ', [['PICKAXE_STONE', 1], ['AXE_STONE', 1], ['SHOVEL_STONE', 1], ['SWORD_STONE', 1], ['BREAD', 16], ['TORCH', 32], ['TABLE', 1], ['CHEST', 2], ['LOG', 16], ['FURNACE', 1]]],
    outils: ['Outils en diamant', [['PICKAXE_DIAMOND', 1], ['AXE_DIAMOND', 1], ['SHOVEL_DIAMOND', 1], ['SWORD_DIAMOND', 1], ['HOE_DIAMOND', 1], ['SHIELD', 1], ['BOW', 1], ['ARROW', 64]]],
    armure: ['Armure en diamant', [['HELMET_DIAMOND', 1], ['CHESTPLATE_DIAMOND', 1], ['LEGGINGS_DIAMOND', 1], ['BOOTS_DIAMOND', 1]]],
    netherite: ['Tout en netherite', [['PICKAXE_NETHERITE', 1], ['AXE_NETHERITE', 1], ['SHOVEL_NETHERITE', 1], ['SWORD_NETHERITE', 1], ['HELMET_NETHERITE', 1], ['CHESTPLATE_NETHERITE', 1], ['LEGGINGS_NETHERITE', 1], ['BOOTS_NETHERITE', 1]]],
    nourriture: ['Nourriture', [['COOKED_MEAT', 32], ['BREAD', 32], ['GOLDEN_CARROT', 16], ['GOLDEN_APPLE', 4], ['APPLE', 16]]],
    construction: ['Construction', [['STONEBRICK', 64], ['PLANKS', 64], ['GLASS', 64], ['COBBLE', 64], ['BRICKS', 64], ['LOG', 32], ['TORCH', 64], ['LANTERN', 16]]],
    redstone: ['Redstone', [['REDSTONE', 64], ['REDSTONE_TORCH', 16], ['REPEATER', 8], ['COMPARATOR', 4], ['PISTON', 8], ['STICKY_PISTON', 8], ['LEVER', 4], ['STONE_BUTTON', 4], ['OBSERVER', 4], ['REDSTONE_LAMP', 8], ['HOPPER', 4], ['DISPENSER', 2], ['TNT', 8], ['RAIL', 32], ['POWERED_RAIL', 16], ['MINECART', 2], ['REDSTONE_BLOCK', 4]]],
    electricite: ['Électricité', [['ENGINEER_TABLE', 1], ['CABLE', 64], ['SOLAR_PANEL', 4], ['WIND_TURBINE', 2], ['WATER_WHEEL', 2], ['COAL_GENERATOR', 1], ['HAND_CRANK', 1], ['BATTERY', 2], ['ELECTRIC_LAMP', 8], ['ELECTRIC_FURNACE', 1], ['CRUSHER', 1], ['DRILL', 1], ['CONVEYOR', 16], ['CHARGER', 1], ['MULTIMETER', 1], ['WRENCH', 1], ['ELECTRIC_DRILL', 1], ['FLASHLIGHT', 1]]],
  };
  def('kit', {
    local: true,
    cat: 'Joueur', cheat: true, usage: '<' + Object.keys(KITS).join(' | ') + '> [joueur]', desc: 'un lot d’objets tout prêt',
    args: [() => Object.keys(KITS), () => players().map((q) => q.name).concat(['@a'])],
    run(ctx, a, o, c) {
      const k = KITS[norm(a[0])];
      if (!k) {
        o.info('Kits : ' + Object.entries(KITS).map(([n, v]) => n + ' (' + v[0] + ')').join(', '));
        if (a[0]) bad('Kit inconnu : « ' + a[0] + ' »');
        return;
      }
      const list = targets(ctx, a[1]);
      let n = 0;
      for (const [key, cnt] of k[1]) {
        const id = idOf(key);
        if (id === undefined || !CM.itemInfo(id) || !extOk(id)) continue;
        n++;
        for (const q of list) act(q, { a: 'give', id, n: cnt, note: n === 1 && q.pid !== ctx.pid ? ctx.name + ' t’a donné le kit ' + k[0] : '' });
      }
      if (!n) bad('Ce kit est vide ici (extension désactivée ?)');
      o.ok('🎒 Kit ' + k[0] + ' (' + plural(n, 'sorte') + ' d’objets) → ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  const MODES = { survie: 'survival', survival: 'survival', s: 'survival', '0': 'survival', creatif: 'creative', creative: 'creative', c: 'creative', '1': 'creative' };
  def('mode gamemode gm', {
    cat: 'Partie', cheat: true, usage: '<survie | créatif>', desc: 'change le mode de jeu (pour tout le monde en multijoueur)',
    args: [() => ['survie', 'creatif']],
    run(ctx, a, o, c) {
      const g = G();
      const m = MODES[norm(a[0])] || (a[0] === undefined ? (g.mode === 'creative' ? 'survival' : 'creative') : null);
      if (!m) usage(c);
      if (m !== g.mode) {
        g.setMode(m);
        g.ui.worldStarted();
      }
      broadcastLine('🎮 Mode ' + (m === 'creative' ? 'créatif' : 'survie') + by(ctx), 'ok');
    },
  });
  def('creatif gmc', {
    cat: 'Partie', cheat: true, usage: '', desc: 'passe en mode créatif',
    run(ctx) {
      exec(Object.assign({}, ctx, { line: '/mode creatif' }));
    },
  });
  def('survie gms', {
    cat: 'Partie', cheat: true, usage: '', desc: 'passe en mode survie',
    run(ctx) {
      exec(Object.assign({}, ctx, { line: '/mode survie' }));
    },
  });
  // (commandes qui ne visent que des joueurs : exécutées ici, l'hôte relaie vers les autres)
  const playerCmd = (names, o) =>
    def(names, Object.assign({ cheat: true, local: true, args: [() => players().map((q) => q.name).concat(['@a'])] }, o));
  playerCmd('soigner heal soin', {
    cat: 'Joueur', usage: '[joueur | @a]', desc: 'rend toute la vie, éteint le feu',
    run(ctx, a, o) {
      const list = targets(ctx, a[0]);
      for (const q of list) act(q, { a: 'heal', note: q.pid !== ctx.pid ? '❤ ' + ctx.name + ' t’a soigné' : '' });
      o.ok('❤ Soigné : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  playerCmd('nourrir feed manger', {
    cat: 'Joueur', usage: '[joueur | @a]', desc: 'remplit la barre de faim',
    run(ctx, a, o) {
      const list = targets(ctx, a[0]);
      for (const q of list) act(q, { a: 'feed' });
      o.ok('🍗 Rassasié : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  playerCmd('guerir soins_complets full', {
    cat: 'Joueur', usage: '[joueur | @a]', desc: 'vie + faim au maximum',
    run(ctx, a, o) {
      const list = targets(ctx, a[0]);
      for (const q of list) {
        act(q, { a: 'heal' });
        act(q, { a: 'feed' });
      }
      o.ok('✨ En pleine forme : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  const KILL_CATS = {
    creatures: (m) => true, mobs: (m) => true, tout: (m) => true,
    animaux: (m) => CM.MOBS[m.type].passive && m.type !== 'villager',
    ombres: (m) => m.type === 'ombre' || m.type === 'ardent', monstres: (m) => CM.MOBS[m.type].hostile, hostiles: (m) => CM.MOBS[m.type].hostile,
    villageois: (m) => m.type === 'villager', golems: (m) => m.type === 'golem',
  };
  def('tuer kill', {
    cat: 'Créatures', cheat: true, usage: '[joueur | @a | créatures | animaux | monstres | ombres | villageois | golems | objets | <créature>]', desc: 'tue un joueur (toi par défaut) ou des créatures proches',
    args: [() => players().map((q) => q.name).concat(['@a', 'creatures', 'animaux', 'monstres', 'ombres', 'villageois', 'golems', 'objets'])],
    local: true,
    run(ctx, a, o) {
      const g = G(), k = norm(a[0]);
      if (a[0] !== undefined && (KILL_CATS[k] || k === 'objets' || k === 'items' || mobType(k))) {
        if (forward(ctx)) return;
        const R = a[1] !== undefined ? int(a[1], 1, 500, 'Rayon') : 128;
        const ents = g.entities;
        if (k === 'objets' || k === 'items') {
          let n = 0;
          for (const d of ents.drops) if (!d.dead && Math.hypot(d.x - ctx.x, d.z - ctx.z) <= R) (d.dead = true), n++;
          return o.ok('🧹 ' + plural(n, 'objet') + ' au sol retiré' + (n > 1 ? 's' : ''));
        }
        const mt = mobType(k), f = KILL_CATS[k] || ((m) => m.type === mt);
        let n = 0;
        for (const m of ents.mobs) {
          if (m.dead || !f(m) || Math.hypot(m.x - ctx.x, m.z - ctx.z) > R) continue;
          ents.killMob(m, null);
          n++;
        }
        return o.ok('⚔ ' + plural(n, 'créature') + ' vaincue' + (n > 1 ? 's' : ''));
      }
      const list = targets(ctx, a[0]);
      for (const q of list) act(q, { a: 'kill', c: q.pid === ctx.pid ? 'S’est éliminé' : 'Éliminé par ' + ctx.name });
      o.ok('💀 ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  playerCmd('vider clear clearinv', {
    cat: 'Joueur', usage: '[joueur | @a] [tout]', desc: 'vide l’inventaire (« tout » : armure et main secondaire aussi)',
    run(ctx, a, o) {
      const all = a.some((x) => norm(x) === 'tout');
      const b = a.filter((x) => norm(x) !== 'tout');
      const list = targets(ctx, b[0]);
      for (const q of list) act(q, { a: 'clear', all, note: q.pid !== ctx.pid ? ctx.name + ' a vidé ton inventaire' : '' });
      o.ok('🗑 Inventaire vidé : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  const toggleCmd = (names, key, flag, label, desc, cat, fem) =>
    playerCmd(names, {
      cat: cat || 'Joueur', usage: '[on | off] [joueur | @a]', desc,
      run(ctx, a, o) {
        let st, tg;
        for (const x of a) {
          if (ON.has(norm(x)) || OFF.has(norm(x))) st = ON.has(norm(x));
          else tg = x;
        }
        const list = targets(ctx, tg);
        const cur = list.length === 1 && list[0].self ? !!G().player[flag] : false;
        const on = st === undefined ? !cur : st;
        const st2 = (on ? ' activé' : ' désactivé') + (fem ? 'e' : '');
        for (const q of list) act(q, { a: key, on, note: q.pid !== ctx.pid ? label + st2 + ' par ' + ctx.name : '' });
        o.ok(label + st2 + ' : ' + list.map((q) => who(ctx, q)).join(', ') + (key === 'fly' && on ? ' (double saut pour voler)' : ''));
      },
    });
  toggleCmd('vol fly voler', 'fly', 'cmdFly', '🕊 Vol', 'permet de voler, même en survie (double appui sur saut)', 'Déplacement');
  toggleCmd('invincible god dieu', 'god', 'cmdGod', '🛡 Invincibilité', 'plus aucun dégât (sauf le vide)', 'Joueur', true);
  toggleCmd('vision nightvision nv vision_nocturne', 'nv', 'nightVision', '👁 Vision nocturne', 'on voit clair la nuit et dans les grottes', 'Joueur', true);
  playerCmd('vitesse speed', {
    cat: 'Déplacement', usage: '<0.1 à 10> [joueur | @a]', desc: 'vitesse de déplacement (1 = normale)',
    args: [() => ['1', '1.5', '2', '3', '5'], () => players().map((q) => q.name).concat(['@a'])],
    run(ctx, a, o) {
      const v = a[0] === undefined ? 1 : Math.max(0.1, Math.min(10, number(a[0], 'Vitesse')));
      const list = targets(ctx, a[1]);
      for (const q of list) act(q, { a: 'speed', v });
      o.ok('🏃 Vitesse × ' + v + ' : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  playerCmd('saut jump jumpboost', {
    cat: 'Déplacement', usage: '<0 à 10> [joueur | @a]', desc: 'sauts plus hauts (0 = normal) ; amortit aussi les chutes',
    args: [() => ['0', '1', '2', '3', '5'], () => players().map((q) => q.name).concat(['@a'])],
    run(ctx, a, o) {
      const v = a[0] === undefined ? 0 : int(a[0], 0, 10, 'Niveau');
      const list = targets(ctx, a[1]);
      for (const q of list) act(q, { a: 'jump', v });
      o.ok('🦘 Saut niveau ' + v + ' : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  def('xp experience exp', {
    local: true,
    cat: 'Joueur', cheat: true, usage: '<nombre>[L] [joueur | @a]', desc: 'donne de l’expérience (points, ou niveaux avec L : /xp 10L)',
    args: [() => ['10', '100', '5L', '30L'], () => players().map((q) => q.name).concat(['@a'])],
    run(ctx, a, o, c) {
      if (!a[0]) return o.info('✨ Niveau ' + G().player.level + ' (' + G().player.xpTotal + ' points)');
      const lv = /l$/i.test(a[0]) || /^niv/.test(norm(a[1] || ''));
      const n = int(String(a[0]).replace(/l$/i, ''), -100000, 100000, 'Nombre');
      const rest = a.slice(1).filter((x) => !/^niv/.test(norm(x)) && norm(x) !== 'points');
      const list = targets(ctx, rest[0]);
      for (const q of list) act(q, { a: 'xp', n, lv });
      o.ok('✨ ' + (n >= 0 ? '+' : '') + n + (lv ? ' niveau' + (Math.abs(n) > 1 ? 'x' : '') : ' point' + (Math.abs(n) > 1 ? 's' : '')) + ' : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  playerCmd('niveau level setlevel', {
    cat: 'Joueur', usage: '<niveau> [joueur | @a]', desc: 'fixe ton niveau d’expérience',
    args: [() => ['0', '10', '30', '50'], () => players().map((q) => q.name).concat(['@a'])],
    run(ctx, a, o, c) {
      if (a[0] === undefined) usage(c);
      const v = int(a[0], 0, 1000, 'Niveau');
      const list = targets(ctx, a[1]);
      for (const q of list) act(q, { a: 'xp', n: 0, set: v });
      o.ok('✨ Niveau ' + v + ' : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  playerCmd('reparer repair fix', {
    cat: 'Joueur', usage: '[tout] [joueur]', desc: 'répare l’objet en main (armure, bouclier) ou recharge un outil électrique ; « tout » : tout l’inventaire',
    args: [() => ['tout'], () => players().map((q) => q.name).concat(['@a'])],
    run(ctx, a, o) {
      const all = a.some((x) => norm(x) === 'tout');
      const list = targets(ctx, a.filter((x) => norm(x) !== 'tout')[0]);
      for (const q of list) act(q, { a: 'repair', all });
      o.ok('🔧 ' + (all ? 'Tout réparé' : 'Objet en main réparé') + ' : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  const findEnch = (s) => {
    const n = norm(s);
    const k = Object.keys(CM.ENCHANTS).find((key) => key === n || norm(CM.ENCHANTS[key].name) === n) || Object.keys(CM.ENCHANTS).find((key) => norm(CM.ENCHANTS[key].name).startsWith(n) || key.startsWith(n));
    return k || bad('Enchantement inconnu : « ' + s + ' » (' + Object.values(CM.ENCHANTS).map((e) => norm(e.name)).join(', ') + ')');
  };
  def('enchanter enchant', {
    local: true,
    cat: 'Joueur', cheat: true, usage: '<enchantement> [niveau]', desc: 'enchante l’objet en main (sans table ni niveaux)',
    args: [() => Object.values(CM.ENCHANTS).map((e) => norm(e.name)), () => ['1', '2', '3', '4', '5']],
    run(ctx, a, o, c) {
      if (!a[0]) {
        o.info('Enchantements : ' + Object.values(CM.ENCHANTS).map((e) => norm(e.name) + ' (max ' + e.max + ')').join(', '));
        return;
      }
      const k = findEnch(a[0]);
      const e = CM.ENCHANTS[k];
      const l = a[1] === undefined ? e.max : int(a[1], 0, e.max, 'Niveau');
      if (ctx.self) {
        const s = G().inventory.held();
        if (!s) bad('Prends un objet en main');
        const ok = CM.enchantsFor(s.id);
        if (!ok.includes(k)) bad(e.name + ' ne va pas sur « ' + CM.itemName(s.id) + ' »' + (ok.length ? ' (possibles : ' + ok.map((x) => norm(CM.ENCHANTS[x].name)).join(', ') + ')' : ''));
      }
      act(findPlayer(ctx), { a: 'ench', k, l });
      o.ok('✨ ' + (l ? CM.enchName(k, l) : e.name + ' retiré'));
    },
  });
  def('desenchanter disenchant', {
    local: true,
    cat: 'Joueur', cheat: true, usage: '', desc: 'retire tous les enchantements de l’objet en main',
    run(ctx, a, o) {
      act(findPlayer(ctx), { a: 'ench', k: null });
      o.ok('Enchantements retirés');
    },
  });
  def('plein more stack', {
    local: true,
    cat: 'Joueur', cheat: true, usage: '', desc: 'complète la pile en main (64)',
    run(ctx, a, o) {
      act(findPlayer(ctx), { a: 'more' });
      o.ok('📦 Pile complétée');
    },
  });
  playerCmd('enflammer ignite burn', {
    cat: 'Amusant', usage: '[joueur | @a] [secondes]', desc: 'met le feu à un joueur (l’eau l’éteint)',
    run(ctx, a, o) {
      const t = isNum(a[a.length - 1]) ? int(a[a.length - 1], 1, 20, 'Secondes') : 5;
      const list = targets(ctx, a.find((x) => !isNum(x)));
      for (const q of list) act(q, { a: 'fire', t });
      o.ok('🔥 En feu : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  playerCmd('propulser launch fusee catapulte', {
    cat: 'Amusant', usage: '[joueur | @a] [force]', desc: 'envoie un joueur en l’air',
    run(ctx, a, o) {
      const v = isNum(a[a.length - 1]) ? int(a[a.length - 1], 5, 40, 'Force') : 22;
      const list = targets(ctx, a.find((x) => !isNum(x)));
      for (const q of list) act(q, { a: 'launch', v });
      o.ok('🚀 Propulsé : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });

  // -------------------------------------------------------- déplacement --
  def('tp teleport teleporter', {
    local: true,
    cat: 'Déplacement', cheat: true, usage: '<x y z> | <joueur> | <joueur> <x y z> | <joueur> <joueur>', desc: 'téléportation (~ = position actuelle : /tp ~ ~10 ~)',
    more: 'Exemples : /tp 100 70 -250 · /tp ~ ~20 ~ · /tp Bob · /tp Bob moi · /tp @a moi · /tp 500 ~ 500 (~ en Y : à la surface)',
    args: [() => players().map((q) => q.name).concat(['~', '@a']), () => players().map((q) => q.name).concat(['~'])],
    run(ctx, a, o, c) {
      if (!a.length) usage(c);
      let who2 = [findPlayer(ctx)], rest = a;
      // /tp <qui> …
      if (!isCoord(a[0]) && a.length >= 2) {
        who2 = targets(ctx, a[0]);
        rest = a.slice(1);
      }
      let dest;
      const cc = (s, base, what) => {
        const v = coord(s, base, what);
        return /^-?\d+$/.test(s) ? v + 0.5 : v;
      };
      if (rest.length === 1 && !isCoord(rest[0])) {
        const q = findPlayer(ctx, rest[0]);
        dest = { x: q.x, y: q.y, z: q.z, dim: q.dim, pid: q.pid, label: q.name };
      } else if (rest.length === 2 && isCoord(rest[0]) && isCoord(rest[1])) {
        // /tp x z : à la surface
        const x = cc(rest[0], ctx.x, 'x'), z = cc(rest[1], ctx.z, 'z');
        dest = { x, z, dim: ctx.dim, label: Math.floor(x) + ' (surface) ' + Math.floor(z) };
      } else if (rest.length === 3) {
        const x = cc(rest[0], ctx.x, 'x'), z = cc(rest[2], ctx.z, 'z');
        // « ~ » seul en Y avec un grand déplacement : à la surface
        const far = Math.hypot(x - ctx.x, z - ctx.z) > 24;
        const y = rest[1] === '~' && far ? undefined : coord(rest[1], ctx.y, 'y');
        dest = { x, y, z, dim: ctx.dim, label: Math.floor(x) + ' ' + (y === undefined ? '(surface)' : Math.floor(y)) + ' ' + Math.floor(z) };
      } else usage(c);
      if (Math.abs(dest.x) > 470000 || Math.abs(dest.z) > 470000) bad('Trop loin : la limite du monde est à ±470 000');
      who2 = who2.filter((q) => q.pid !== dest.pid);
      if (!who2.length) bad('Personne à téléporter');
      for (const q of who2) act(q, { a: 'tp', x: dest.x, y: dest.y, z: dest.z, dim: dest.dim, note: q.pid !== ctx.pid ? ctx.name + ' t’a téléporté' : '' });
      o.ok('✨ ' + who2.map((q) => who(ctx, q)).join(', ') + ' → ' + dest.label);
    },
  });
  def('haut top surface', {
    local: true,
    cat: 'Déplacement', cheat: true, usage: '', desc: 'remonte à la surface (au-dessus de toi)',
    run(ctx, a, o) {
      const w = G().world;
      if (w.nether) bad('Pas de surface dans le Nether');
      act(findPlayer(ctx), { a: 'tp', x: ctx.x, z: ctx.z });
      o.ok('⬆ À la surface');
    },
  });
  def('sauter jumpto j regard', {
    local: true,
    cat: 'Déplacement', cheat: true, usage: '', desc: 'téléporte sur le bloc que tu vises (jusqu’à 120 blocs)',
    run(ctx, a, o) {
      const h = needLook(ctx), w = G().world;
      let y = h.y + 1;
      while (y < h.y + 40 && (w.solidAt(h.x, y, h.z) || w.solidAt(h.x, y + 1, h.z))) y++;
      act(findPlayer(ctx), { a: 'tp', x: h.x + 0.5, y, z: h.z + 0.5 });
      o.ok('✨ Hop !');
    },
  });
  def('spawn apparition depart', {
    local: true,
    cat: 'Déplacement', cheat: true, usage: '[joueur | @a]', desc: 'retour au point de départ du monde',
    args: [() => players().map((q) => q.name).concat(['@a'])],
    run(ctx, a, o) {
      const g = G(), sp = g.worlds.overworld.spawn;
      const list = targets(ctx, a[0]);
      for (const q of list) act(q, { a: 'tp', x: sp.x, y: sp.y, z: sp.z, dim: 'overworld' });
      o.ok('🏠 Point de départ : ' + list.map((q) => who(ctx, q)).join(', '));
    },
  });
  def('lit bed', {
    cat: 'Déplacement', cheat: true, local: true, usage: '', desc: 'retourne à ton lit',
    run(ctx, a, o) {
      const b = G().player.bed;
      if (!b) bad('Tu n’as pas encore dormi dans un lit');
      act(findPlayer(ctx), { a: 'tp', x: b[0] + 0.5, y: b[1] + 0.6, z: b[2] + 0.5, dim: 'overworld' });
      o.ok('🛏 Retour au lit');
    },
  });
  def('retour back', {
    cat: 'Déplacement', cheat: true, local: true, usage: '', desc: 'revient où tu étais avant ta dernière téléportation (ou ta mort)',
    run(ctx, a, o) {
      const b = G().cmdBack;
      if (!b) bad('Rien où revenir');
      act(findPlayer(ctx), { a: 'tp', x: b.x, y: b.y, z: b.z, dim: b.dim });
      o.ok('↩ Retour');
    },
  });
  def('aleatoire rtp wild hasard', {
    cat: 'Déplacement', cheat: true, local: true, usage: '[distance]', desc: 'téléportation au hasard (1000 blocs par défaut)',
    run(ctx, a, o) {
      const d = a[0] ? int(a[0], 50, 100000, 'Distance') : 1000;
      const ang = Math.random() * Math.PI * 2, r = d * (0.5 + Math.random() * 0.5);
      const x = Math.floor(ctx.x + Math.cos(ang) * r) + 0.5, z = Math.floor(ctx.z + Math.sin(ang) * r) + 0.5;
      act(findPlayer(ctx), { a: 'tp', x, z });
      o.ok('🎲 Direction X ' + Math.floor(x) + ', Z ' + Math.floor(z));
    },
  });
  // maisons : dans la sauvegarde (solo, hôte) ou sur cet appareil (invité)
  function homes() {
    const g = G();
    if (!g.net.isClient) return (g.homes = g.homes || {});
    const k = 'cm-homes-' + g.worlds.overworld.seed + '-' + g.net.name;
    try {
      return JSON.parse(localStorage.getItem(k) || '{}');
    } catch (e) {
      return {};
    }
  }
  function saveHomes(h) {
    const g = G();
    if (!g.net.isClient) g.homes = h;
    else
      try {
        localStorage.setItem('cm-homes-' + g.worlds.overworld.seed + '-' + g.net.name, JSON.stringify(h));
      } catch (e) {
        /* stockage indisponible */
      }
  }
  def('maison home', {
    cat: 'Déplacement', cheat: true, local: true, usage: '[nom]', desc: 'va à une maison enregistrée (/defmaison)',
    args: [() => Object.keys(homes())],
    run(ctx, a, o) {
      const h = homes(), n = norm(a[0] || 'maison');
      const v = h[n];
      if (!v) bad(Object.keys(h).length ? 'Pas de maison « ' + n + ' » (' + Object.keys(h).join(', ') + ')' : 'Aucune maison : tape /defmaison [nom] là où tu veux revenir');
      act(findPlayer(ctx), { a: 'tp', x: v[0], y: v[1], z: v[2], dim: v[3] || 'overworld' });
      o.ok('🏡 ' + n);
    },
  });
  def('defmaison sethome', {
    cat: 'Déplacement', local: true, usage: '[nom]', desc: 'enregistre ta position comme maison (10 au plus)',
    run(ctx, a, o) {
      const h = homes(), n = norm(a[0] || 'maison');
      if (!h[n] && Object.keys(h).length >= 10) bad('10 maisons au plus (/suppmaison)');
      h[n] = [r1(ctx.x), r1(ctx.y), r1(ctx.z), ctx.dim];
      saveHomes(h);
      o.ok('🏡 Maison « ' + n + ' » enregistrée ici');
    },
  });
  def('maisons homes', {
    cat: 'Déplacement', local: true, usage: '', desc: 'liste tes maisons',
    run(ctx, a, o) {
      const h = homes(), k = Object.keys(h);
      o.info(k.length ? '🏡 ' + k.map((n) => n + ' (' + Math.floor(h[n][0]) + ' ' + Math.floor(h[n][1]) + ' ' + Math.floor(h[n][2]) + (h[n][3] === 'nether' ? ', Nether' : '') + ')').join(', ') : 'Aucune maison');
    },
  });
  def('suppmaison delhome', {
    cat: 'Déplacement', local: true, usage: '<nom>', desc: 'supprime une maison',
    args: [() => Object.keys(homes())],
    run(ctx, a, o, c) {
      const h = homes(), n = norm(a[0] || '');
      if (!h[n]) bad('Pas de maison « ' + (a[0] || '') + ' »');
      delete h[n];
      saveHomes(h);
      o.ok('Maison « ' + n + ' » supprimée');
    },
  });
  def('nether', {
    cat: 'Déplacement', cheat: true, usage: '', desc: 'voyage dans le Nether (un portail t’attend à l’arrivée)',
    run(ctx, a, o) {
      travel(ctx, 'nether');
      o.ok('🌀 Direction le Nether');
    },
  });
  def('monde overworld surface_normale', {
    cat: 'Déplacement', cheat: true, usage: '', desc: 'retour au monde normal',
    run(ctx, a, o) {
      travel(ctx, 'overworld');
      o.ok('🌀 Retour au monde normal');
    },
  });
  function travel(ctx, to) {
    const g = G(), net = g.net;
    if (ctx.dim === to) bad(to === 'nether' ? 'Tu es déjà dans le Nether' : 'Tu es déjà dans le monde normal');
    if (ctx.self) g.changeDim(to, { from: [Math.floor(ctx.x), Math.floor(ctx.y), Math.floor(ctx.z)] });
    else {
      const e = net.links.get(ctx.pid);
      if (e) net.travelGuest(e, to, { from: [Math.floor(ctx.x), Math.floor(ctx.y), Math.floor(ctx.z)] });
    }
  }

  // --------------------------------------------------------------- monde --
  const TIMES = { aube: 0.0, matin: 0.04, jour: 0.1, midi: 0.25, apres_midi: 0.35, soir: 0.45, crepuscule: 0.5, nuit: 0.58, minuit: 0.75 };
  function setTime(t, ctx, add) {
    const g = G();
    let v = add ? g.time + t : t;
    while (v >= 1) {
      v -= 1;
      g.dayCount++;
    }
    while (v < 0) v += 1;
    g.time = v;
    if (g.net.isHost) g.net.broadcast({ t: 'time', ti: g.time, d: g.dayCount, l: g.dayLen });
  }
  def('temps time', {
    cat: 'Monde', cheat: true, usage: '<jour | midi | nuit | minuit | aube | soir | 14h | ajouter 2h>', desc: 'change l’heure du monde',
    args: [() => Object.keys(TIMES).concat(['ajouter', '6h', '12h', '18h'])],
    run(ctx, a, o, c) {
      if (!a[0]) usage(c);
      const k = norm(a[0]);
      const hours = (s) => {
        const m = /^(\d{1,2})(?:h(\d{0,2}))?$/.exec(norm(s));
        if (!m) bad('Heure attendue (ex. 14h ou 14h30)');
        return (+m[1] % 24) + (+(m[2] || 0)) / 60;
      };
      if (k === 'ajouter' || k === 'add' || k === '+') {
        const s = a[1] || '';
        const hrs = /h/i.test(s) ? hours(s) : number(s, 'Heures');
        setTime(hrs / 24, ctx, true);
      } else if (TIMES[k] !== undefined) setTime(TIMES[k], ctx);
      else setTime((((hours(a[0]) / 24 - 0.25) % 1) + 1) % 1, ctx);
      const h = hourOf(G().time);
      broadcastLine('🕒 Il est ' + String(Math.floor(h)).padStart(2, '0') + 'h' + String(Math.floor((h % 1) * 60)).padStart(2, '0') + by(ctx), 'ok');
    },
  });
  def('jour day', {
    cat: 'Monde', cheat: true, usage: '', desc: 'le matin tout de suite',
    run(ctx) {
      exec(Object.assign({}, ctx, { line: '/temps jour' }));
    },
  });
  def('nuit night', {
    cat: 'Monde', cheat: true, usage: '', desc: 'la nuit tout de suite',
    run(ctx) {
      exec(Object.assign({}, ctx, { line: '/temps nuit' }));
    },
  });
  def('cycle daylight cyclejour', {
    cat: 'Monde', cheat: true, usage: '[on | off]', desc: 'arrête ou relance le cycle jour/nuit',
    args: [() => ['on', 'off']],
    run(ctx, a, o) {
      const g = G(), on = onOff(a[0], g.settings.dayCycle !== false);
      g.settings.dayCycle = on;
      if (g.net.isHost) g.net.sendCfg();
      broadcastLine('☀ Cycle jour/nuit ' + (on ? 'relancé' : 'arrêté'), 'ok');
    },
  });
  const WX = { clair: 'clear', beau: 'clear', soleil: 'clear', clear: 'clear', sun: 'clear', pluie: 'rain', rain: 'rain', neige: 'rain', snow: 'rain', orage: 'thunder', thunder: 'thunder', tempete: 'thunder' };
  def('meteo weather', {
    cat: 'Monde', cheat: true, usage: '<clair | pluie | orage> [durée en minutes]', desc: 'change la météo (neige dans les biomes froids) ; elle change aussi toute seule (/regle meteo_auto off pour la figer)',
    args: [() => ['clair', 'pluie', 'orage', 'neige'], () => ['2', '5', '10']],
    run(ctx, a, o, c) {
      const t = WX[norm(a[0])];
      if (!t) {
        o.info('Météo : ' + CM.Weather.NAMES[CM.Weather.state(G()).type]);
        if (a[0]) usage(c);
        return;
      }
      const d = a[1] !== undefined ? number(a[1], 'Durée') * 60 : 0;
      CM.Weather.set(G(), t, d);
      broadcastLine('🌦 ' + CM.Weather.NAMES[t] + (d ? ' pendant ' + Math.round(d / 60) + ' min' : '') + by(ctx), 'ok');
    },
  });
  const DIFFS = { paisible: 'peaceful', peaceful: 'peaceful', facile: 'easy', easy: 'easy', normal: 'normal', normale: 'normal', difficile: 'hard', hard: 'hard', dur: 'hard' };
  const DIFF_FR = { peaceful: 'Paisible', easy: 'Facile', normal: 'Normale', hard: 'Difficile' };
  def('difficulte difficulty diff', {
    cat: 'Partie', cheat: true, usage: '<paisible | facile | normal | difficile>', desc: 'change la difficulté',
    args: [() => ['paisible', 'facile', 'normal', 'difficile']],
    run(ctx, a, o, c) {
      const d = DIFFS[norm(a[0])];
      if (!d) return o.info('Difficulté : ' + DIFF_FR[G().difficulty]);
      G().setDifficulty(d);
      broadcastLine('⚔ Difficulté : ' + DIFF_FR[d] + by(ctx), 'ok');
    },
  });
  const RULES = {
    garder_inventaire: ['keepInventory', 'option', 'on garde son inventaire en mourant'],
    propagation_feu: ['fireSpread', 'option', 'le feu se propage'],
    cycle_jour: ['dayCycle', 'setting', 'le temps passe'],
    meteo_auto: ['weatherCycle', 'setting', 'la météo change toute seule'],
    apparition_creatures: ['mobSpawn', 'setting', 'les créatures apparaissent'],
    degats_chute: ['fallDamage', 'setting', 'les chutes font mal'],
    faim: ['hunger', 'setting', 'la faim baisse'],
    pvp: ['pvp', 'net', 'combats entre joueurs'],
    triches_invites: ['cmds', 'net', 'les invités peuvent utiliser les triches'],
  };
  CM.gameRule = function (g, k) {
    if (g.net && g.net.isClient) return g.net.rules[k] !== false;
    return !g.settings || g.settings[k] !== false;
  };
  def('regle gamerule regles', {
    cat: 'Partie', cheat: true, usage: '[règle] [on | off]', desc: 'règles de la partie (sans rien : la liste)',
    args: [() => Object.keys(RULES), () => ['on', 'off']],
    run(ctx, a, o) {
      const g = G(), net = g.net;
      const cur = (r) => (r[1] === 'option' ? !!g.options[r[0]] : r[1] === 'net' ? !!net.rules[r[0]] : g.settings[r[0]] !== false);
      if (!a[0]) {
        for (const [k, r] of Object.entries(RULES)) o.info(k + ' : ' + (cur(r) ? 'on' : 'off') + ' — ' + r[2]);
        return;
      }
      const n = norm(a[0]), key = Object.keys(RULES).find((k) => k === n || k.startsWith(n) || norm(RULES[k][0]) === n);
      if (!key) bad('Règle inconnue : « ' + a[0] + ' » (' + Object.keys(RULES).join(', ') + ')');
      const r = RULES[key];
      if (a[1] === undefined) return o.info(key + ' : ' + (cur(r) ? 'on' : 'off') + ' — ' + r[2]);
      const v = onOff(a[1]);
      if (r[1] === 'option') {
        g.options[r[0]] = v;
        g.applyOptions();
      } else if (r[1] === 'net') {
        net.rules[r[0]] = v;
        if (r[0] === 'cmds') g.settings.guestCheats = v;
        net.sendCfg();
      } else {
        g.settings[r[0]] = v;
        net.sendCfg();
      }
      broadcastLine('📜 ' + key + ' : ' + (v ? 'on' : 'off') + by(ctx), 'ok');
    },
  });
  def('triche cheats triches', {
    cat: 'Partie', cheat: true, hostOnly: true, usage: '[on | off]', desc: 'hôte : autorise (ou non) les triches aux invités',
    args: [() => ['on', 'off']],
    run(ctx, a, o) {
      exec(Object.assign({}, ctx, { line: '/regle triches_invites ' + (onOff(a[0], !!G().net.rules.cmds) ? 'on' : 'off') }));
    },
  });
  def('defspawn setspawn setworldspawn', {
    cat: 'Partie', cheat: true, usage: '', desc: 'le point de départ du monde devient ta position',
    run(ctx, a, o) {
      const g = G();
      if (ctx.dim !== 'overworld') bad('Seulement dans le monde normal');
      g.worlds.overworld.spawn = { x: Math.floor(ctx.x) + 0.5, y: Math.floor(ctx.y), z: Math.floor(ctx.z) + 0.5 };
      o.ok('🏁 Nouveau point de départ : ' + Math.floor(ctx.x) + ' ' + Math.floor(ctx.y) + ' ' + Math.floor(ctx.z));
    },
  });
  def('sauver save sauvegarder', {
    cat: 'Partie', usage: '', desc: 'sauvegarde la partie maintenant',
    run(ctx, a, o) {
      G().save(false);
      o.ok('💾 Partie sauvegardée');
    },
  });

  // ----------------------------------------------------------- créatures --
  def('invoquer summon spawnmob', {
    cat: 'Créatures', cheat: true, usage: '<créature> [nombre] [x y z]', desc: 'fait apparaître des créatures, de la TNT, un éclair… (là où tu vises)',
    args: [() => summonList(), () => ['1', '5', '10']],
    run(ctx, a, o, c) {
      if (!a[0]) return o.info('Créatures : ' + summonList().join(', '));
      const g = G(), w = g.world, k = norm(a[0]);
      const n = isNum(a[1]) ? int(a[1], 1, 50, 'Nombre') : 1;
      const pi = isNum(a[1]) ? 2 : 1;
      let p;
      if (isCoord(a[pi]) && isCoord(a[pi + 1]) && isCoord(a[pi + 2])) p = { x: coord(a[pi], ctx.x, 'x'), y: coord(a[pi + 1], ctx.y, 'y'), z: coord(a[pi + 2], ctx.z, 'z') };
      else if (ctx.look && Math.hypot(ctx.look.x - ctx.x, ctx.look.z - ctx.z) < 64) p = { x: ctx.look.x + 0.5, y: ctx.look.y + 1, z: ctx.look.z + 0.5 };
      else p = { x: ctx.x - Math.sin(ctx.yaw) * 3, y: ctx.y + 0.5, z: ctx.z - Math.cos(ctx.yaw) * 3 };
      const jit = (i) => (n > 1 ? (Math.random() - 0.5) * Math.min(6, 1 + n * 0.3) : 0);
      if (k === 'tnt') {
        for (let i = 0; i < n; i++) g.entities.addTnt(Math.floor(p.x + jit()) + 0.5, p.y, Math.floor(p.z + jit()) + 0.5, 4);
        return o.ok('💣 ' + plural(n, 'TNT') + ' allumée' + (n > 1 ? 's' : ''));
      }
      if (k === 'eclair' || k === 'foudre' || k === 'lightning') {
        for (let i = 0; i < n; i++) CM.Weather.strike(g, p.x + jit() * 2, p.z + jit() * 2, { fire: true });
        return o.ok('⚡ Éclair');
      }
      if (k === 'wagonnet' || k === 'minecart') {
        for (let i = 0; i < n; i++) g.entities.addCart('cart', Math.floor(p.x) + 0.5, p.y, Math.floor(p.z) + 0.5);
        return o.ok('🛒 ' + plural(n, 'wagonnet'));
      }
      const type = mobType(k);
      if (!type) bad('Créature inconnue : « ' + a[0] + ' » (' + summonList().join(', ') + ')');
      let made = 0;
      for (let i = 0; i < n; i++) {
        const x = p.x + jit(), z = p.z + jit();
        if (!w.loaded(x, z)) continue;
        const m = g.entities.addMob(type, x, p.y, z);
        if (m && type === 'golem') m.home = [Math.floor(x), Math.floor(z)];
        made++;
      }
      o.ok('🐾 ' + made + ' × ' + mobName(type));
    },
  });
  def('foudre lightning eclair smite', {
    cat: 'Monde', cheat: true, usage: '[joueur]', desc: 'la foudre tombe là où tu vises (ou sur un joueur)',
    args: [() => players().map((q) => q.name)],
    run(ctx, a, o) {
      const g = G();
      let x, z;
      if (a[0]) {
        const q = findPlayer(ctx, a[0]);
        if (q.dim !== g.dim) bad(q.name + ' est dans une autre dimension');
        x = q.x;
        z = q.z;
      } else {
        const h = needLook(ctx);
        x = h.x + 0.5;
        z = h.z + 0.5;
      }
      CM.Weather.strike(g, x, z, { fire: true });
      o.ok('⚡ Zeus est content');
    },
  });
  def('explosion boom explode', {
    cat: 'Monde', cheat: true, usage: '[puissance 1-10]', desc: 'explosion là où tu vises',
    args: [() => ['2', '4', '6', '8']],
    run(ctx, a, o) {
      const p = a[0] ? int(a[0], 1, 10, 'Puissance') : 4;
      const h = needLook(ctx);
      G().explode(h.x + 0.5, h.y + 0.5, h.z + 0.5, p);
      o.ok('💥 Boum (' + p + ')');
    },
  });
  def('nettoyer clearlag ramasser', {
    cat: 'Créatures', cheat: true, usage: '', desc: 'retire tous les objets posés au sol',
    run(ctx, a, o) {
      let n = 0;
      for (const d of G().entities.drops)
        if (!d.dead) {
          d.dead = true;
          n++;
        }
      o.ok('🧹 ' + plural(n, 'objet') + ' retiré' + (n > 1 ? 's' : ''));
    },
  });
  def('creatures mobs compter', {
    cat: 'Créatures', usage: '', desc: 'compte les créatures chargées autour',
    run(ctx, a, o) {
      const c = {};
      for (const m of G().entities.mobs) if (!m.dead) c[m.type] = (c[m.type] || 0) + 1;
      const k = Object.keys(c);
      o.info(k.length ? '🐾 ' + k.map((t) => mobName(t) + ' ' + c[t]).join(' · ') : 'Aucune créature chargée');
    },
  });

  // -------------------------------------------------------- construction --
  def('poser setblock', {
    cat: 'Construction', cheat: true, usage: '[x y z] <bloc>', desc: 'pose un bloc (sans coordonnées : contre le bloc visé)',
    args: [() => index().names],
    run(ctx, a, o, c) {
      if (!a.length) usage(c);
      const p = posArg(ctx, a, 0, true);
      const id = findBlock(a[p.used]);
      const ed = editor(ctx, '/poser');
      ed.set(p.x, p.y, p.z, id);
      ed.done();
      o.ok('🧱 ' + nameOf(id) + ' en ' + p.x + ' ' + p.y + ' ' + p.z);
    },
  });
  def('remplir fill', {
    cat: 'Construction', cheat: true, usage: '<x1 y1 z1> <x2 y2 z2> <bloc> [creux | contour | garder | remplacer <bloc>]', desc: 'remplit une boîte (20 000 blocs au plus)',
    more: 'creux : murs, sol et plafond, vide dedans · contour : seulement les bords · garder : ne remplit que le vide · remplacer <bloc> : ne change que ce bloc',
    args: [null, null, null, null, null, null, () => index().names, () => ['creux', 'contour', 'garder', 'remplacer'], () => index().names],
    run(ctx, a, o, c) {
      if (a.length < 7) usage(c);
      const x1 = Math.floor(coord(a[0], ctx.x, 'x')), y1 = Math.floor(coord(a[1], ctx.y, 'y')), z1 = Math.floor(coord(a[2], ctx.z, 'z'));
      const x2 = Math.floor(coord(a[3], ctx.x, 'x')), y2 = Math.floor(coord(a[4], ctx.y, 'y')), z2 = Math.floor(coord(a[5], ctx.z, 'z'));
      const id = findBlock(a[6]);
      const mode = norm(a[7] || '');
      const only = mode === 'remplacer' || mode === 'replace' ? findBlock(a[8]) : null;
      fillBox(ctx, o, [x1, y1, z1], [x2, y2, z2], id, mode, only, '/remplir');
    },
  });
  function fillBox(ctx, o, p1, p2, id, mode, only, label) {
    const [ax, bx] = [Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])];
    const [ay, by] = [Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])];
    const [az, bz] = [Math.min(p1[2], p2[2]), Math.max(p1[2], p2[2])];
    const vol = (bx - ax + 1) * (by - ay + 1) * (bz - az + 1);
    if (vol > MAX_EDIT) bad('Trop grand : ' + vol + ' blocs (' + MAX_EDIT + ' au plus)');
    const ed = editor(ctx, label);
    for (let y = ay; y <= by; y++)
      for (let z = az; z <= bz; z++)
        for (let x = ax; x <= bx; x++) {
          const edge = x === ax || x === bx || y === ay || y === by || z === az || z === bz;
          let v = id;
          if (mode === 'creux' || mode === 'hollow') v = edge ? id : 0;
          else if (mode === 'contour' || mode === 'outline') {
            if (!edge) continue;
          } else if (mode === 'garder' || mode === 'keep') {
            if (ed.get(x, y, z) !== 0) continue;
          } else if (only !== null && only !== undefined && ed.get(x, y, z) !== only) continue;
          ed.set(x, y, z, v);
        }
    o.ok('🧱 ' + ed.done() + ' bloc(s) → ' + nameOf(id) + ' (/annuler pour revenir en arrière)');
  }
  def('remplacer replace', {
    cat: 'Construction', cheat: true, usage: '<rayon> <bloc à remplacer> <nouveau bloc>', desc: 'remplace un bloc par un autre autour de toi',
    args: [() => ['5', '10', '16'], () => index().names, () => index().names],
    run(ctx, a, o, c) {
      if (a.length < 3) usage(c);
      const r = int(a[0], 1, 16, 'Rayon');
      const from = findBlock(a[1]), to = findBlock(a[2]);
      const cx = Math.floor(ctx.x), cy = Math.floor(ctx.y), cz = Math.floor(ctx.z);
      fillBox(ctx, o, [cx - r, cy - r, cz - r], [cx + r, cy + r, cz + r], to, 'remplacer', from, '/remplacer');
    },
  });
  function ball(ctx, o, c, a, label, hollow, dome) {
    const r = a[0] !== undefined ? number(a[0], 'Rayon') : 4;
    if (r < 1 || r > 16) bad('Rayon de 1 à 16');
    const id = a[1] !== undefined ? findBlock(a[1]) : 0;
    const h = needLook(ctx);
    const cx = h.x, cy = h.y, cz = h.z, R = Math.ceil(r);
    const ed = editor(ctx, label);
    for (let dy = dome ? 0 : -R; dy <= R; dy++)
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.hypot(dx, dy, dz);
          if (d > r + 0.3) continue;
          if (hollow && d < r - 0.7) continue;
          ed.set(cx + dx, cy + dy, cz + dz, id);
        }
    o.ok('⚪ ' + ed.done() + ' bloc(s) (' + nameOf(id) + ') · /annuler pour revenir en arrière');
  }
  def('sphere boule', {
    cat: 'Construction', cheat: true, usage: '<rayon> <bloc> [creuse]', desc: 'une boule autour du bloc visé',
    args: [() => ['3', '5', '8'], () => index().names, () => ['creuse']],
    run(ctx, a, o, c) {
      if (a.length < 2) usage(c);
      ball(ctx, o, c, a, '/sphere', norm(a[2]).startsWith('creu') || norm(a[2]) === 'hollow');
    },
  });
  def('dome', {
    cat: 'Construction', cheat: true, usage: '<rayon> <bloc>', desc: 'un dôme creux posé sur le bloc visé',
    args: [() => ['4', '6', '10'], () => index().names],
    run(ctx, a, o, c) {
      if (a.length < 2) usage(c);
      ball(ctx, o, c, a, '/dome', true, true);
    },
  });
  def('creuser dig trou cratere', {
    cat: 'Construction', cheat: true, usage: '[rayon]', desc: 'creuse une boule de vide autour du bloc visé',
    args: [() => ['2', '4', '8']],
    run(ctx, a, o) {
      ball(ctx, o, null, [a[0] !== undefined ? a[0] : 3], '/creuser', false);
    },
  });
  def('mur wall', {
    cat: 'Construction', cheat: true, usage: '<longueur> <hauteur> <bloc>', desc: 'un mur devant toi, à partir du bloc visé',
    args: [() => ['5', '10'], () => ['3', '5'], () => index().names],
    run(ctx, a, o, c) {
      if (a.length < 3) usage(c);
      const L = int(a[0], 1, 64, 'Longueur'), Hh = int(a[1], 1, 64, 'Hauteur'), id = findBlock(a[2]);
      const h = needLook(ctx);
      // le long de l'axe perpendiculaire au regard
      const sx = Math.abs(Math.cos(ctx.yaw)) > Math.abs(Math.sin(ctx.yaw)) ? 1 : 0, sz = 1 - sx;
      const x0 = h.x + h.nx, y0 = h.y + (h.ny > 0 ? 1 : 0), z0 = h.z + h.nz, half = Math.floor(L / 2);
      const ed = editor(ctx, '/mur');
      for (let i = -half; i < L - half; i++) for (let k = 0; k < Hh; k++) ed.set(x0 + sx * i, y0 + k, z0 + sz * i, id);
      o.ok('🧱 Mur de ' + ed.done() + ' bloc(s)');
    },
  });
  def('colonne pilier pillar tour', {
    cat: 'Construction', cheat: true, usage: '<hauteur> <bloc>', desc: 'une colonne sur le bloc visé',
    args: [() => ['5', '10', '30'], () => index().names],
    run(ctx, a, o, c) {
      if (a.length < 2) usage(c);
      const Hh = int(a[0], 1, 256, 'Hauteur'), id = findBlock(a[1]);
      const h = needLook(ctx);
      const ed = editor(ctx, '/colonne');
      for (let k = 1; k <= Hh; k++) ed.set(h.x, h.y + k, h.z, id);
      o.ok('🏛 Colonne de ' + ed.done() + ' bloc(s)');
    },
  });
  def('plateforme platform sol', {
    cat: 'Construction', cheat: true, usage: '[rayon] [bloc]', desc: 'une plateforme sous tes pieds (verre par défaut)',
    args: [() => ['2', '5', '10'], () => index().names],
    run(ctx, a, o) {
      const r = a[0] !== undefined ? int(a[0], 0, 32, 'Rayon') : 2;
      const id = a[1] !== undefined ? findBlock(a[1]) : CM.B.GLASS;
      const y = Math.floor(ctx.y) - 1, cx = Math.floor(ctx.x), cz = Math.floor(ctx.z);
      const ed = editor(ctx, '/plateforme');
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (ed.get(cx + dx, y, cz + dz) === 0 || CM.blocks[ed.get(cx + dx, y, cz + dz)].replaceable) ed.set(cx + dx, y, cz + dz, id);
      o.ok('▦ Plateforme de ' + ed.done() + ' bloc(s)');
    },
  });
  def('annuler undo', {
    cat: 'Construction', cheat: true, usage: '', desc: 'annule ta dernière construction par commande (8 au plus)',
    run(ctx, a, o) {
      const g = G(), list = g.cmdUndo && g.cmdUndo[ctx.name];
      const u = list && list.pop();
      if (!u) bad('Rien à annuler');
      if (u.dim !== g.dim) {
        list.push(u);
        bad('Cette construction est dans une autre dimension');
      }
      const w = g.world, c = u.cells;
      let n = 0;
      for (let i = c.length - 4; i >= 0; i -= 4) if (w.setBlock(c[i], c[i + 1], c[i + 2], c[i + 3])) n++;
      o.ok('↶ ' + u.label + ' annulé (' + n + ' bloc(s))');
    },
  });
  def('eteindre extinguish', {
    cat: 'Monde', cheat: true, usage: '[rayon]', desc: 'éteint les feux autour de toi',
    args: [() => ['8', '16', '32']],
    run(ctx, a, o) {
      const r = a[0] ? int(a[0], 1, 32, 'Rayon') : 16;
      const g = G(), w = g.world, cx = Math.floor(ctx.x), cy = Math.floor(ctx.y), cz = Math.floor(ctx.z);
      let n = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            const id = w.get(cx + dx, cy + dy, cz + dz);
            if (id && CM.blocks[id].fire && w.setBlock(cx + dx, cy + dy, cz + dz, 0)) n++;
          }
      o.ok('🧯 ' + plural(n, 'feu') + ' éteint' + (n > 1 ? 's' : ''));
    },
  });
  const TREE_TYPES = () => (CM.WOODS || []).filter((v) => !v.nether).map((v) => norm(v.key));
  def('arbre tree', {
    cat: 'Construction', cheat: true, usage: '[essence]', desc: 'fait pousser un arbre sur le bloc visé',
    args: [() => TREE_TYPES()],
    run(ctx, a, o) {
      const g = G(), w = g.world, h = needLook(ctx);
      const woods = (CM.WOODS || []).filter((v) => !v.nether || w.nether);
      let t = woods.find((v) => norm(v.key) === norm(a[0] || '') || norm(v.name) === norm(a[0] || ''));
      if (a[0] && !t) bad('Essence inconnue (' + woods.map((v) => norm(v.key)).join(', ') + ')');
      if (!t) t = woods[Math.floor(Math.random() * woods.length)];
      if (!w.growTree(h.x, h.y + 1, h.z, t.key)) bad('Pas assez de place ici');
      o.ok('🌳 Un ' + (t.name || t.key) + ' a poussé');
    },
  });
  def('pousser grow engrais', {
    cat: 'Construction', cheat: true, usage: '[rayon]', desc: 'fait pousser cultures et pousses autour de toi',
    args: [() => ['5', '10']],
    run(ctx, a, o) {
      const r = a[0] ? int(a[0], 1, 16, 'Rayon') : 6;
      const g = G(), cx = Math.floor(ctx.x), cy = Math.floor(ctx.y), cz = Math.floor(ctx.z);
      let n = 0;
      for (let k = 0; k < 4; k++)
        for (let dy = -3; dy <= 3; dy++)
          for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++) {
              const id = g.world.get(cx + dx, cy + dy, cz + dz), b = CM.blocks[id];
              if (!(b.crop !== undefined || CM.TAGS.saplings.includes(id))) continue;
              if (g.growAt(cx + dx, cy + dy, cz + dz, false)) n++;
            }
      o.ok('🌱 ' + n + ' pousse(s)');
    },
  });

  // ============================================== câblage (réseau, tchat) ==
  CM.Commands = {
    list: CMDS,
    norm,
    // Ligne tapée sur cet écran.
    run(line) {
      exec(selfCtx(String(line).slice(0, 300)));
    },
    print,
    // Hôte : commande envoyée par un invité.
    fromGuest(e, m) {
      if (typeof m.s !== 'string') return;
      exec(guestCtx(e, m));
    },
    // Hôte : action d'un invité sur un joueur (déjà vérifiée chez lui, revérifiée ici).
    guestAct(e, m) {
      const g = G(), net = g.net, a = m.a;
      if (!a || typeof a !== 'object' || typeof a.a !== 'string') return;
      if (a.a !== 'msg' && !net.rules.cmds) {
        net.sendTo(e.pid, { t: 'cr', s: 'Les triches sont désactivées par l’hôte', k: 'err' });
        return;
      }
      if (a.a === 'msg') a.from = e.name;
      const to = m.to | 0;
      if (to === 0) apply(a);
      else hostAct(to, a);
    },
    // Invité : action reçue de l'hôte.
    apply,
    ann: announce,
    // Suggestions pour la saisie en cours : { items: [{ text, label, desc }], usage }
    complete(text) {
      if (!text || text[0] !== '/') return null;
      const parts = text.slice(1).split(/\s+/);
      if (parts.length === 1) {
        const n = norm(parts[0]);
        const seen = new Set(), items = [];
        for (const c of CMDS) {
          if (seen.has(c)) continue;
          const hit = c.names.find((x) => norm(x).startsWith(n));
          if (!hit) continue;
          seen.add(c);
          items.push({ text: '/' + c.name + ' ', label: '/' + c.name + (c.usage ? ' ' + c.usage : ''), desc: c.desc + (c.cheat ? ' · triche' : '') });
        }
        items.sort((x, y) => (norm(x.text).startsWith('/' + n) ? 0 : 1) - (norm(y.text).startsWith('/' + n) ? 0 : 1));
        return { items: items.slice(0, 8), more: Math.max(0, items.length - 8) };
      }
      const c = BY.get(norm(parts[0]));
      if (!c) return null;
      const i = parts.length - 2, part = norm(parts[parts.length - 1]);
      const head = text.slice(0, text.length - parts[parts.length - 1].length);
      const src = c.args && c.args[i];
      let items = [];
      if (src) {
        let list = [];
        try {
          list = src() || [];
        } catch (e) {
          list = [];
        }
        const uniq = [...new Set(list.map(String))];
        const a1 = uniq.filter((x) => norm(x).startsWith(part)), a2 = part.length >= 2 ? uniq.filter((x) => !norm(x).startsWith(part) && norm(x).includes(part)) : [];
        items = a1.concat(a2).map((x) => ({ text: head + (/\s/.test(x) ? '"' + x + '"' : x) + ' ', label: x, desc: '' }));
      }
      return { items: items.slice(0, 8), more: Math.max(0, items.length - 8), usage: '/' + c.name + (c.usage ? ' ' + c.usage : '') + ' — ' + c.desc };
    },
  };
})();
