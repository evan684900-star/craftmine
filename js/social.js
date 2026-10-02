'use strict';
// Vie du serveur (multijoueur). L'hôte garde tout et le sauvegarde avec le monde ; les invités
// reçoivent ce qui les concerne. Tout se gère depuis le menu du joueur (touche G) ou les commandes.
// - Comptes : un pseudo appartient au premier appareil qui l'utilise (clé secrète gardée par le
//   navigateur). Un mot de passe (menu G → Compte) permet de le reprendre depuis un autre appareil.
// - Terrains : un joueur protège des tronçons (16 × 16 blocs, du fond jusqu'au ciel) ; seuls lui,
//   son équipe et ses amis autorisés y cassent, posent, ouvrent les portes et les coffres.
// - Coffres verrouillés : un conteneur appartient à celui qui l'a posé (il peut le rendre public).
// - Équipes : [TAG] devant le pseudo, tchat d'équipe (/e), pas de dégâts entre coéquipiers.
// - Pièces : gagnées en battant des créatures hostiles ou en vendant à la boutique du serveur ;
//   hôtel des ventes entre joueurs, /payer ; classements.
(function () {
  const G = () => CM.game;
  const low = (s) => String(s === undefined || s === null ? '' : s).toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const CH = 16; // un tronçon : 16 × 16 blocs
  const LIM = 16; // tronçons protégés par joueur (par défaut)
  const TEAM_MAX = 12;
  const LIST_MAX = 8; // objets en vente par joueur à l'hôtel des ventes
  const PRICE_MAX = 1000000;
  const COIN = '🪙';

  // ------------------------------------------------------------ hachage --
  // (cyrb53) l'hôte ne garde jamais la clé d'un appareil ni un mot de passe, seulement leur empreinte
  function h53(str, seed) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const hash = (s) => h53(s, 3).toString(36) + h53(s, 11).toString(36);
  const keyHash = (k) => hash('cm-cle|' + k);
  const pwHash = (name, pw) => hash('cm-mdp|' + low(name) + '|' + pw);

  // --------------------------------------------------------- boutique --
  // [objet, prix d'achat, prix de revente] (0 : pas vendu / pas racheté par le serveur)
  const SHOP_DEF = [
    ['COAL', 6, 2], ['IRON_INGOT', 24, 8], ['COPPER_INGOT', 12, 4], ['GOLD_INGOT', 36, 12], ['REDSTONE', 6, 2], ['LAPIS', 9, 3],
    ['QUARTZ', 12, 4], ['AMETHYST_SHARD', 15, 5], ['EMERALD', 120, 40], ['DIAMOND', 180, 60], ['NETHERITE_INGOT', 0, 300],
    ['SHADOW_ESSENCE', 10, 3], ['STRING', 4, 1], ['BONE', 4, 1], ['GUNPOWDER', 8, 2], ['SPIDER_EYE', 6, 2], ['LEATHER', 6, 2],
    ['FEATHER', 3, 1], ['SLIMEBALL', 12, 4], ['ENDER_PEARL', 45, 15], ['MAGMA_CREAM', 15, 5],
    ['BREAD', 6, 2], ['COOKED_MEAT', 8, 3], ['APPLE', 4, 1], ['CARROT', 3, 1], ['POTATO', 3, 1], ['WHEAT', 3, 1], ['COOKED_COD', 6, 2],
    ['GOLDEN_APPLE', 150, 40],
    ['COBBLE', 1, 0], ['STONE', 2, 0], ['LOG', 4, 1], ['PLANKS', 1, 0], ['SAND', 2, 0], ['GLASS', 3, 0], ['BRICKS', 6, 1],
    ['WOOL', 6, 1], ['OBSIDIAN', 40, 10], ['TORCH', 2, 0],
    ['ARROW', 2, 0], ['BOOK', 15, 3], ['SADDLE', 80, 20], ['NAME_TAG', 60, 15], ['TOTEM', 0, 200],
  ];
  let SHOP = null;
  function shop() {
    if (SHOP) return SHOP;
    SHOP = [];
    for (const [k, buy, sell] of SHOP_DEF) {
      const id = CM.I && CM.I[k] !== undefined ? CM.I[k] : CM.B && CM.B[k] !== undefined ? CM.B[k] : undefined;
      if (id !== undefined && CM.itemInfo(id)) SHOP.push({ id, buy, sell });
    }
    return SHOP;
  }
  const shopOf = (id) => shop().find((s) => s.id === id) || null;

  // ------------------------------------------------------------- état --
  const fresh = () => ({ acc: {}, teams: {}, claims: {}, trust: {}, own: {}, hdv: [], hid: 1, lim: LIM });
  const EMPTY = { claims: {}, trust: {}, teams: {}, own: {}, names: {}, lim: LIM };
  const S = {
    D: fresh(), // hôte : tout
    V: null, // invité : ce que l'hôte a envoyé (terrains, équipes, coffres)
    me: null, // invité : son compte { c: pièces, pw: mot de passe choisi }
    R: null, // réponse pour le menu (classements, hôtel des ventes)
    dirty: false,
    meDirty: new Set(),
    sendT: 0,
    tick: 0,
    COIN,
  };
  const net = () => G().net;
  S.on = () => {
    const g = G();
    return !!(g && g.net && g.net.active);
  };
  S.pub = () => (net().isClient ? S.V || EMPTY : S.D);
  S.myName = () => {
    const g = G();
    return g.net.active ? g.net.name : g.options.netName || 'Toi';
  };
  S.amAdmin = () => !net().isClient || !!net().admin;
  const ck = (dim, x, z) => CM.dimId(dim) + ':' + Math.floor(x / CH) + ',' + Math.floor(z / CH);
  S.ck = ck;
  const nameOf = (P, k) => (P.names && P.names[k]) || (P.acc && P.acc[k] && P.acc[k].n) || k;

  // ------------------------------------------------------------ comptes --
  function acc(name, make) {
    const k = low(name);
    if (!k) return null;
    let a = S.D.acc[k];
    if (!a && make) a = S.D.acc[k] = { n: String(name), c: 0, st: {} };
    if (a && !a.st) a.st = {};
    return a || null;
  }
  S.acc = acc;
  function stat(name, f, n) {
    const a = acc(name, true);
    if (a) a.st[f] = (a.st[f] || 0) + (n === undefined ? 1 : n);
  }
  function addCoins(name, n) {
    const a = acc(name, true);
    a.c = Math.max(0, Math.round((a.c || 0) + n));
    S.meDirty.add(low(name));
    return a.c;
  }
  S.coins = (name) => {
    if (!net().isClient || low(name) !== low(S.myName())) return (acc(name) || {}).c || 0;
    return (S.me && S.me.c) || 0;
  };
  const meOf = (name) => {
    const a = acc(name) || {};
    return { c: a.c || 0, pw: !!a.pw, k: !!(a.k && a.k.length) };
  };

  // Clé secrète de cet appareil (gardée par le navigateur) : elle prouve que le pseudo est à lui.
  const KEY = 'craftmine-cle';
  S.deviceKey = function () {
    if (S.key) return S.key;
    let k = null;
    try {
      k = localStorage.getItem(KEY);
    } catch (e) {
      k = null;
    }
    if (!k || !/^[0-9a-f]{32}$/.test(k)) {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      k = [...a].map((v) => v.toString(16).padStart(2, '0')).join('');
      try {
        localStorage.setItem(KEY, k);
      } catch (e) {
        /* navigation privée : la clé ne vaut que pour cette visite */
      }
    }
    return (S.key = k);
  };

  // Hôte : un invité se présente. Renvoie null si c'est bon, sinon { r: raison, c: code }.
  S.checkJoin = function (name, m) {
    const a = acc(name);
    if (!a || !a.k || !a.k.length) return null; // pseudo libre (ou jamais protégé) : il sera à cet appareil
    const kh = typeof m.key === 'string' && m.key.length >= 16 && m.key.length <= 64 ? keyHash(m.key) : null;
    if (kh && a.k.includes(kh)) return null;
    const other = 'Ce pseudo est déjà utilisé par un autre appareil. ';
    if (!a.pw) return { r: other + 'Choisis-en un autre. Si c’est le tien : sur ton appareil habituel, ouvre le menu G → Compte et choisis un mot de passe, puis tape-le ici. Sinon, un administrateur peut libérer ton pseudo.', c: 'taken' };
    if (typeof m.pw !== 'string' || !m.pw) return { r: other + 'Tape son mot de passe pour jouer avec depuis cet appareil.', c: 'pw' };
    if (pwHash(name, m.pw) !== a.pw) return { r: 'Mot de passe incorrect.', c: 'pw' };
    return null;
  };
  // Hôte : l'invité est entré. Son appareil est retenu ; ses droits d'administrateur reviennent.
  S.joined = function (e, m) {
    const a = acc(e.name, true);
    a.n = e.name;
    const kh = typeof m.key === 'string' && m.key.length >= 16 && m.key.length <= 64 ? keyHash(m.key) : null;
    if (kh) {
      a.k = (a.k || []).filter((x) => x !== kh);
      a.k.push(kh);
      if (a.k.length > 6) a.k.shift(); // (6 appareils au plus)
    }
    a.last = Date.now();
    if (a.adm) e.admin = true;
    e.link.send({ t: 'soc', p: publicState(), me: meOf(e.name) });
  };
  // Hôte : partie ouverte (ou serveur démarré).
  S.hostStarted = function () {
    const g = G();
    if (!CM.Dedicated.on) acc(g.net.name, true);
    S.dirty = true;
  };

  // ---------------------------------------------------------- équipes --
  function teamOf(name, P) {
    P = P || S.pub();
    const k = low(name);
    for (const id in P.teams) if (P.teams[id].m.includes(k)) return P.teams[id];
    return null;
  }
  S.teamOf = (name) => teamOf(name);
  // Coéquipiers (pas de dégâts entre eux).
  S.mates = (a, b) => {
    if (!S.on() || low(a) === low(b)) return false;
    const t = teamOf(a);
    return !!t && t.m.includes(low(b));
  };
  // Pseudo affiché au-dessus des têtes et dans la liste (Tab).
  S.label = (name) => {
    const t = S.on() ? teamOf(name) : null;
    return t ? '[' + t.tag + '] ' + name : name;
  };

  // -------------------------------------------------- terrains, coffres --
  function friendOf(P, owner, name) {
    const k = low(name);
    if (owner === k) return true;
    if ((P.trust[owner] || []).includes(k)) return true;
    const t = teamOf(owner, P);
    return !!t && t.m.includes(k);
  }
  function mayBuild(P, name, admin, dim, x, z) {
    const o = P.claims[ck(dim, x, z)];
    return !o || !!admin || friendOf(P, o, name);
  }
  function mayOpen(P, name, admin, dim, x, z, key) {
    if (!mayBuild(P, name, admin, dim, x, z)) return false;
    const o = P.own[key];
    return !o || !!admin || !!o[1] || friendOf(P, o[0], name);
  }
  S.ownerAt = (dim, x, z) => {
    const P = S.pub(), o = P.claims[ck(dim, x, z)];
    return o ? nameOf(P, o) : null;
  };
  // Ce joueur (cet écran) peut-il modifier ce bloc ? Sinon un message, et non.
  S.blocked = function (g, x, z) {
    if (!S.on() || mayBuild(S.pub(), S.myName(), S.amAdmin(), g.playerDim, x, z)) return false;
    g.ui.toast('🔒 Terrain de ' + S.ownerAt(g.playerDim, x, z) + ' : tu ne peux rien y modifier', 'warn', 'claim');
    return true;
  };
  // … et ouvrir ce conteneur ?
  S.lockedChest = function (g, x, y, z) {
    if (!S.on()) return false;
    if (S.blocked(g, x, z)) return true;
    const P = S.pub(), k = g.bkey(x, y, z);
    if (mayOpen(P, S.myName(), S.amAdmin(), g.playerDim, x, z, k)) return false;
    g.ui.toast('🔒 Coffre verrouillé de ' + nameOf(P, P.own[k][0]), 'warn', 'claim');
    return true;
  };
  // … et casser ce bloc ? (t : bloc visé)
  S.blockedAt = (g, t) => S.blocked(g, t.x, t.z) || (CM.blocks[t.id].container && S.lockedChest(g, t.x, t.y, t.z));
  // Objets qu'on peut utiliser n'importe où (ils ne touchent pas aux blocs).
  const FREE = new Set(['food', 'armor', 'grapple', 'rocket', 'pearl', 'eye', 'rod', 'splash', 'egg', 'laser', 'bow', 'crossbow', 'trident', 'shield', 'compass', 'map', 'totem', 'charm', 'potion', 'bottle']);
  S.freeUse = (info) => !!info && FREE.has(info.type) && !info.isBlock;

  // Hôte : bloc changé par un invité. false : refusé (l'hôte le remet comme avant).
  S.guestSet = function (g, e, x, y, z, old, id) {
    const D = S.D, dim = e.rp.dim;
    if (!mayBuild(D, e.name, e.admin, dim, x, z)) return false;
    const k = g.bkey(x, y, z), ob = CM.blocks[old], nb = CM.blocks[id];
    const o = D.own[k];
    if (old !== id && ob && ob.container && o && !e.admin && !friendOf(D, o[0], e.name)) return false;
    if (old !== id) {
      if (nb && nb.container) setOwner(k, e.name);
      else if (o && ob && ob.container) {
        delete D.own[k];
        S.dirty = true;
      }
      if ((!old || CM.isFluid(old)) && id && !CM.isFluid(id)) stat(e.name, 'bp');
      else if (old && !CM.isFluid(old) && !id) stat(e.name, 'bm');
    }
    return true;
  };
  function setOwner(k, name) {
    S.D.own[k] = [low(name), 0];
    S.dirty = true;
  }
  // Hôte : conteneur ouvert par un invité.
  S.guestOpen = function (g, e, x, y, z) {
    const ok = mayOpen(S.D, e.name, e.admin, e.rp.dim, x, z, g.bkey(x, y, z));
    if (!ok) S.tell(e.pid, '🔒 Ce conteneur est verrouillé (il n’est pas à toi)');
    return ok;
  };
  // Hôte : un invité agit à cet endroit (TNT, décoration, bloc musical…).
  S.guestMay = function (e, x, z) {
    if (!S.on() || mayBuild(S.D, e.name, e.admin, e.rp.dim, x, z)) return true;
    S.tell(e.pid, '🔒 Terrain de ' + nameOf(S.D, S.D.claims[ck(e.rp.dim, x, z)]) + ' : tu ne peux rien y modifier');
    return false;
  };
  // Hôte : un invité frappe ou utilise une créature (les animaux d'un terrain sont protégés).
  S.guestMob = function (e, mob) {
    if (!mob || (CM.MOBS[mob.type] && CM.MOBS[mob.type].hostile)) return true;
    return S.guestMay(e, mob.x, mob.z);
  };
  // Position d'une décoration (panneau, tableau, cadre, porte-armure, juke-box).
  S.decoXZ = function (g, o) {
    if (!o || typeof o !== 'object') return null;
    if (typeof o.b === 'string') {
      const p = CM.keyXYZ(o.b);
      return [p[0], p[2]];
    }
    if (o.e && typeof o.e === 'object') return [o.e.x | 0, o.e.z | 0];
    const it = g.deco && g.deco.items.find((q) => q.u === o.u);
    return it ? [it.x, it.z] : null;
  };
  // Cet écran : décoration dans un terrain protégé d'un autre ?
  S.decoBlocked = function (g, o) {
    const p = S.on() ? S.decoXZ(g, o) : null;
    return !!p && S.blocked(g, p[0], p[1]);
  };
  // Hôte : décoration d'un invité.
  S.guestDeco = function (g, e, o) {
    const p = S.decoXZ(g, o);
    return !p || S.guestMay(e, p[0], p[1]);
  };
  // Hôte : l'explosion épargne les terrains protégés.
  S.claimedFn = function (g) {
    const c = S.D.claims;
    if (!S.on() || !Object.keys(c).length) return null;
    const d = CM.dimId(g.dim) + ':';
    return (x, z) => !!c[d + Math.floor(x / CH) + ',' + Math.floor(z / CH)];
  };
  // Hôte (son propre joueur) : conteneur posé, bloc posé ou cassé.
  S.hostPlaced = function (g, x, y, z, id) {
    if (!S.on() || net().isClient || CM.Dedicated.on) return;
    const b = CM.blocks[id];
    if (b && b.container) setOwner(g.bkey(x, y, z), net().name);
    stat(net().name, 'bp');
  };
  S.hostBroke = function () {
    if (S.on() && !net().isClient && !CM.Dedicated.on) stat(net().name, 'bm');
  };

  // ------------------------------------------- créatures, morts, temps --
  S.onKill = function (g, by, type) {
    if (!S.on() || net().isClient) return;
    const def = CM.MOBS[type];
    if (!def || !def.hostile) return;
    const n = net();
    let name = null, pid = 0;
    if (by && by.pid) {
      const e = n.links.get(by.pid);
      if (e) {
        name = e.name;
        pid = e.pid;
      }
    } else if (by === g.player && !CM.Dedicated.on) name = n.name;
    if (!name) return;
    const gain = Math.max(1, Math.min(150, Math.round((def.hp || 10) / 5)));
    addCoins(name, gain);
    stat(name, 'mk');
    S.toast(pid, '+' + gain + ' ' + COIN, 'good');
  };
  S.onDeath = function (name, cause) {
    if (!S.on() || net().isClient || !name) return;
    stat(name, 'd');
    const n = net();
    const killer = [n.name, ...[...n.links.values()].map((e) => e.name)].find((x) => x && low(x) === low(cause) && low(x) !== low(name));
    if (killer) stat(killer, 'pk');
  };

  // ----------------------------------------------- messages de l'hôte --
  // (pid 0 : le joueur de l'hôte, sur cet écran)
  S.tell = function (pid, s, k) {
    if (!pid) CM.Commands.print(s, k || 'err');
    else net().sendTo(pid, { t: 'soc', msg: s, k: k || 'err' });
  };
  S.toast = function (pid, s, k) {
    if (!pid) {
      if (!CM.Dedicated.on) G().ui.toast(s, k || 'info', 'soc');
    } else net().sendTo(pid, { t: 'soc', toast: s, k: k || 'info' });
  };
  function publicState() {
    const D = S.D, names = {};
    const add = (k) => {
      if (k && !names[k]) names[k] = (D.acc[k] && D.acc[k].n) || k;
    };
    for (const k of Object.values(D.claims)) add(k);
    for (const o of Object.values(D.own)) add(o[0]);
    for (const t of Object.values(D.teams)) t.m.forEach(add);
    for (const [k, l] of Object.entries(D.trust)) {
      add(k);
      l.forEach(add);
    }
    return { claims: D.claims, trust: D.trust, teams: D.teams, own: D.own, names, lim: D.lim };
  }
  S.publicState = publicState;
  S.update = function (g, dt) {
    const n = g.net;
    if (!n.active) return;
    if (n.isClient) return;
    // temps de jeu de chacun
    S.tick += dt;
    if (S.tick >= 5) {
      const s = Math.round(S.tick);
      S.tick = 0;
      for (const e of n.links.values()) if (!e.spec) stat(e.name, 'pt', s);
      if (!CM.Dedicated.on) stat(n.name, 'pt', s);
    }
    S.sendT -= dt;
    if (S.sendT > 0) return;
    S.sendT = 0.4;
    if (S.dirty) {
      S.dirty = false;
      const p = publicState();
      n.broadcast({ t: 'soc', p });
      n.toSpecs({ t: 'soc', p }); // (carte du site : terrains)
      if (CM.Teleport && CM.Teleport.open) CM.Teleport.render(g);
      if (g.ui.chest) CM.SocialUI.chest(g);
    }
    if (S.meDirty.size) {
      for (const e of n.links.values()) if (S.meDirty.has(low(e.name))) e.link.send({ t: 'soc', me: meOf(e.name) });
      S.meDirty.clear();
      if (CM.Teleport && CM.Teleport.open) CM.Teleport.render(g);
    }
  };

  // Invité : message de l'hôte.
  S.fromHost = function (g, m) {
    if (m.p && typeof m.p === 'object') {
      const p = m.p;
      S.V = { claims: obj(p.claims), trust: obj(p.trust), teams: obj(p.teams), own: obj(p.own), names: obj(p.names), lim: p.lim | 0 || LIM };
    }
    if (m.me && typeof m.me === 'object') S.me = { c: Math.max(0, +m.me.c || 0), pw: !!m.me.pw };
    if (m.r && typeof m.r === 'object') S.R = m.r;
    if (typeof m.toast === 'string') g.ui.toast(m.toast.slice(0, 200), m.k === 'good' ? 'good' : m.k === 'warn' ? 'warn' : 'info', 'soc');
    if (typeof m.msg === 'string') CM.Commands.print(m.msg.slice(0, 400), ['ok', 'err', 'info'].includes(m.k) ? m.k : 'info');
    if (CM.Teleport && CM.Teleport.open) CM.Teleport.render(g);
    if (g.ui.chest) CM.SocialUI.chest(g);
  };
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  S.reset = function () {
    S.V = null;
    S.me = null;
    S.R = null;
  };

  // ------------------------------------------- demandes (menu du joueur) --
  // Invité : envoyée à l'hôte ; hôte : traitée ici.
  S.req = function (a, m) {
    const g = G(), n = g.net;
    m = Object.assign({ a }, m || {});
    if (n.isClient) n.send(Object.assign({ t: 'soc' }, m));
    else if (n.active) handle(g, { name: n.name, pid: 0, admin: true }, m);
  };
  // Hôte : demande d'un invité.
  S.fromGuest = function (g, e, m) {
    if (typeof m.a !== 'string') return;
    handle(g, { name: e.name, pid: e.pid, admin: !!e.admin, e }, m);
  };
  function reply(who, o) {
    if (!who.pid) {
      S.fromHost(G(), o);
      return;
    }
    net().sendTo(who.pid, Object.assign({ t: 'soc' }, o));
  }
  function giveTo(g, who, it) {
    if (!it || !CM.itemInfo(it.id) || !(it.count > 0)) return;
    if (!who.pid) {
      const left = g.inventory.add(it.id, it.count, CM.stackExtra(it));
      if (left > 0) g.dropNearPlayer(it.id, left, it);
      return;
    }
    net().give({ pid: who.pid }, { id: it.id, count: it.count, extra: CM.stackExtra(it) });
  }
  const cleanItem = (it) => {
    if (!it || typeof it !== 'object') return null;
    const id = it.id | 0, info = CM.itemInfo(id), n = it.count | 0;
    if (!info || n <= 0 || n > 64 * 36) return null;
    const out = { id, count: n };
    if (it.xp !== undefined && Number.isFinite(+it.xp)) out.xp = +it.xp;
    const en = CM.cleanEnch(it.ench);
    if (en) out.ench = en;
    return out;
  };
  const itemLabel = (it) => (it.count > 1 ? it.count + ' × ' : '') + CM.itemName(it.id) + (it.ench ? ' ✨' : '');
  function tops() {
    const out = {};
    const list = Object.values(S.D.acc);
    for (const [f] of TOPS) {
      out[f] = list
        .map((a) => [a.n, f === 'c' ? a.c || 0 : (a.st && a.st[f]) || 0])
        .filter((r) => r[1] > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    }
    return out;
  }
  const listings = () => S.D.hdv.map((l) => ({ i: l.i, s: nameOf(S.D, l.s), it: l.it, p: l.p }));
  function handle(g, who, m) {
    const D = S.D, a = acc(who.name, true), creative = g.mode === 'creative';
    const say = (s, k) => reply(who, { msg: s, k: k || 'err' });
    switch (m.a) {
      case 'q':
        reply(who, { r: { top: tops(), hdv: listings() }, me: meOf(who.name) });
        return;
      case 'pw': {
        if (!who.pid) return say('Tu es l’hôte : ton pseudo n’a pas besoin de mot de passe ici');
        const pw = typeof m.pw === 'string' ? m.pw : '';
        if (pw.length < 4 || pw.length > 64) return say('Mot de passe : 4 caractères au moins');
        a.pw = pwHash(who.name, pw);
        reply(who, { msg: '🔑 Mot de passe enregistré : tu peux maintenant jouer avec « ' + who.name + ' » depuis un autre appareil', k: 'ok', me: meOf(who.name) });
        return;
      }
      case 'sell': {
        const it = cleanItem({ id: m.id, count: m.n });
        if (!it) return;
        const s = shopOf(it.id);
        if (!s || !s.sell || creative) {
          if (who.pid) giveTo(g, who, it); // (l'invité les avait déjà retirés : on les rend)
          return say(creative ? 'Pas de boutique en mode créatif' : 'La boutique ne rachète pas cet objet');
        }
        const gain = s.sell * it.count;
        addCoins(who.name, gain);
        reply(who, { msg: '💰 Vendu ' + itemLabel(it) + ' pour ' + gain + ' ' + COIN, k: 'ok', me: meOf(who.name) });
        return;
      }
      case 'buy': {
        const s = shopOf(m.id | 0), n = Math.max(1, Math.min(64, m.n | 0));
        if (!s || !s.buy) return say('La boutique ne vend pas cet objet');
        if (creative) return say('Pas de boutique en mode créatif');
        const cost = s.buy * n;
        if ((a.c || 0) < cost) return say('Pas assez de pièces : il faut ' + cost + ' ' + COIN + ' (tu en as ' + (a.c || 0) + ')');
        addCoins(who.name, -cost);
        giveTo(g, who, { id: s.id, count: n });
        reply(who, { msg: '🛒 Acheté ' + itemLabel({ id: s.id, count: n }) + ' pour ' + cost + ' ' + COIN, k: 'ok', me: meOf(who.name) });
        return;
      }
      case 'list': {
        const it = cleanItem(m.it), p = Math.round(+m.p);
        if (!it) return;
        const back = (s) => {
          if (who.pid) giveTo(g, who, it);
          say(s);
        };
        if (creative) return back('Pas d’hôtel des ventes en mode créatif');
        if (!(p >= 1 && p <= PRICE_MAX)) return back('Prix : de 1 à ' + PRICE_MAX + ' ' + COIN);
        if (D.hdv.filter((l) => l.s === low(who.name)).length >= LIST_MAX) return back('Tu as déjà ' + LIST_MAX + ' objets en vente : retires-en un d’abord');
        if (D.hdv.length >= 300) return back('L’hôtel des ventes est plein');
        D.hdv.push({ i: D.hid++, s: low(who.name), it, p, t: Date.now() });
        reply(who, { msg: '🏷 ' + itemLabel(it) + ' mis en vente pour ' + p + ' ' + COIN, k: 'ok', r: { top: tops(), hdv: listings() } });
        return;
      }
      case 'hbuy': {
        const l = D.hdv.find((x) => x.i === (m.i | 0));
        if (!l) return say('Cet objet n’est plus en vente');
        if (l.s === low(who.name)) return say('C’est ton propre objet : retire-le plutôt');
        if (creative) return say('Pas d’hôtel des ventes en mode créatif');
        if ((a.c || 0) < l.p) return say('Pas assez de pièces : il faut ' + l.p + ' ' + COIN + ' (tu en as ' + (a.c || 0) + ')');
        D.hdv = D.hdv.filter((x) => x !== l);
        addCoins(who.name, -l.p);
        addCoins(l.s, l.p);
        giveTo(g, who, l.it);
        const seller = nameOf(D, l.s);
        reply(who, { msg: '🛒 Acheté ' + itemLabel(l.it) + ' à ' + seller + ' pour ' + l.p + ' ' + COIN, k: 'ok', me: meOf(who.name), r: { top: tops(), hdv: listings() } });
        const sp = sellerPid(l.s);
        if (sp !== null) S.toast(sp, '💰 ' + who.name + ' a acheté ' + itemLabel(l.it) + ' : +' + l.p + ' ' + COIN, 'good');
        return;
      }
      case 'unlist': {
        const l = D.hdv.find((x) => x.i === (m.i | 0));
        if (!l || l.s !== low(who.name)) return say('Cet objet n’est plus en vente');
        D.hdv = D.hdv.filter((x) => x !== l);
        giveTo(g, who, l.it);
        reply(who, { msg: '↩ ' + itemLabel(l.it) + ' retiré de la vente', k: 'ok', r: { top: tops(), hdv: listings() } });
        return;
      }
      case 'pub': {
        // coffre public / privé (seulement son propriétaire)
        const k = typeof m.k === 'string' ? m.k.slice(0, 40) : '';
        const o = D.own[k];
        if (!o) return say('Ce conteneur n’a pas de propriétaire : tout le monde peut l’ouvrir');
        if (o[0] !== low(who.name) && !who.admin) return say('Ce n’est pas ton conteneur');
        o[1] = m.v ? 1 : 0;
        S.dirty = true;
        reply(who, { msg: m.v ? '🔓 Conteneur public : tout le monde peut l’ouvrir' : '🔒 Conteneur verrouillé : toi, ton équipe et tes amis autorisés seulement', k: 'ok', p: publicState() });
        return;
      }
    }
  }
  function sellerPid(k) {
    const n = net();
    if (!CM.Dedicated.on && low(n.name) === k) return 0;
    for (const e of n.links.values()) if (low(e.name) === k) return e.pid;
    return null;
  }

  // Ventes depuis cet écran (l'invité retire les objets, l'hôte paie).
  S.sell = function (g, id, n) {
    if (g.mode === 'creative') return CM.Commands.print('Pas de boutique en mode créatif', 'err');
    const s = shopOf(id);
    if (!s || !s.sell) return;
    n = Math.min(n, g.inventory.count(id));
    if (n <= 0) return CM.Commands.print('Tu n’as pas de ' + CM.itemName(id), 'err');
    g.inventory.remove(id, n);
    S.req('sell', { id, n });
  };
  S.listHeld = function (g, price) {
    const inv = g.inventory, s = inv.held();
    if (g.mode === 'creative') return CM.Commands.print('Pas d’hôtel des ventes en mode créatif', 'err');
    if (!s) return CM.Commands.print('Prends en main l’objet à vendre', 'err');
    const p = Math.round(+price);
    if (!(p >= 1 && p <= PRICE_MAX)) return CM.Commands.print('Choisis un prix (de 1 à ' + PRICE_MAX + ' ' + COIN + ')', 'err');
    const it = Object.assign({ id: s.id, count: s.count }, CM.stackExtra(s) || {});
    inv.slots[inv.selected] = null;
    inv.changed();
    S.req('list', { it, p });
  };

  // --------------------------------------------------------- sauvegarde --
  S.save = () => S.D;
  S.load = function (d) {
    const D = fresh();
    if (d && typeof d === 'object') {
      for (const [k, a] of Object.entries(obj(d.acc))) if (a && typeof a === 'object') D.acc[k] = { n: String(a.n || k), c: Math.max(0, +a.c || 0), st: obj(a.st), k: Array.isArray(a.k) ? a.k.filter((x) => typeof x === 'string').slice(-6) : undefined, pw: typeof a.pw === 'string' ? a.pw : undefined, adm: a.adm ? 1 : undefined, last: a.last };
      for (const [k, t] of Object.entries(obj(d.teams))) if (t && Array.isArray(t.m)) D.teams[k] = { n: String(t.n), tag: String(t.tag || '').slice(0, 4), o: String(t.o), m: t.m.map(String), inv: Array.isArray(t.inv) ? t.inv.map(String) : [], col: t.col | 0 };
      for (const [k, o] of Object.entries(obj(d.claims))) if (typeof o === 'string') D.claims[k] = o;
      for (const [k, l] of Object.entries(obj(d.trust))) if (Array.isArray(l)) D.trust[k] = l.map(String);
      for (const [k, o] of Object.entries(obj(d.own))) if (Array.isArray(o)) D.own[k] = [String(o[0]), o[1] ? 1 : 0];
      if (Array.isArray(d.hdv)) D.hdv = d.hdv.filter((l) => l && cleanItem(l.it)).map((l) => ({ i: l.i | 0, s: String(l.s), it: cleanItem(l.it), p: l.p | 0, t: l.t }));
      D.hid = Math.max(d.hid | 0, ...D.hdv.map((l) => l.i + 1), 1);
      D.lim = d.lim > 0 ? d.lim | 0 : LIM;
    }
    S.D = D;
    S.dirty = true;
  };

  // ------------------------------------------------------- classements --
  const fmtTime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? h + ' h ' + String(m).padStart(2, '0') : m + ' min';
  };
  const TOPS = [
    ['c', COIN + ' Les plus riches', (v) => v + ' ' + COIN],
    ['mk', '⚔ Créatures vaincues', (v) => v],
    ['pk', '🗡 Joueurs vaincus', (v) => v],
    ['bp', '🧱 Blocs posés', (v) => v],
    ['bm', '⛏ Blocs cassés', (v) => v],
    ['pt', '⏱ Temps de jeu', fmtTime],
  ];
  S.TOPS = TOPS;
  S.shop = shop;
  S.listingsOf = () => (S.R && S.R.hdv) || [];
  S.esc = esc;

  // =========================================================== COMMANDES ==
  const C = CM.Commands, def = C.def, bad = C.bad;
  const need = () => {
    if (!S.on()) bad('Seulement en multijoueur (serveur, ou partie ouverte aux amis)');
  };
  // Pseudo d'un joueur connecté, ou d'un compte connu (joueur hors ligne).
  function anyPlayer(ctx, s) {
    if (s === undefined) bad('Pseudo attendu');
    try {
      return C.findPlayer(ctx, s).name;
    } catch (e) {
      const a = S.D.acc[low(s)];
      if (a) return a.n;
      throw e;
    }
  }
  const chunkTxt = (x, z) => Math.floor(x / CH) + ', ' + Math.floor(z / CH);
  const isAdm = (ctx) => !!ctx.admin || !ctx.pid; // (l'hôte, ou un administrateur)

  def('terrain claim parcelle', {
    cat: 'Partie', usage: '[prendre | rendre | tout_rendre | ami <joueur> | retirer <joueur> | liste]', desc: 'protéger le tronçon où tu es (16 × 16 blocs) : seuls toi, ton équipe et tes amis y touchent',
    args: [() => ['prendre', 'rendre', 'tout_rendre', 'ami', 'retirer', 'liste', 'limite']],
    run(ctx, a, o) {
      need();
      const D = S.D, me = low(ctx.name), k = ck(ctx.dim, ctx.x, ctx.z), cur = D.claims[k];
      const mine = () => Object.keys(D.claims).filter((x) => D.claims[x] === me);
      const what = C.norm(a[0] || 'info');
      if (['prendre', 'proteger', 'claim', 'p'].includes(what)) {
        if (cur === me) return o.info('🏡 Ce tronçon est déjà à toi');
        if (cur) bad('Ce tronçon est déjà protégé par ' + nameOf(D, cur));
        if (!isAdm(ctx) && mine().length >= D.lim) bad('Tu as déjà ' + D.lim + ' tronçons protégés (le maximum) : rends-en un d’abord');
        D.claims[k] = me;
        S.dirty = true;
        return o.ok('🏡 Tronçon ' + chunkTxt(ctx.x, ctx.z) + ' protégé (' + mine().length + ' / ' + D.lim + ')');
      }
      if (['rendre', 'liberer', 'unclaim', 'r'].includes(what)) {
        // (un autre de ses tronçons : « 0:3,-2 », dimension:x,z, depuis le menu G)
        const kk = /^[0-2]:-?\d+,-?\d+$/.test(a[1] || '') ? a[1] : k, cc = kk === k ? cur : D.claims[kk];
        const txt = kk.slice(2).replace(',', ', ');
        if (!cc) bad('Ce tronçon n’est protégé par personne');
        if (cc !== me && !isAdm(ctx)) bad('Ce tronçon est à ' + nameOf(D, cc));
        delete D.claims[kk];
        S.dirty = true;
        return o.ok('Tronçon ' + txt + ' rendu' + (cc !== me ? ' (il était à ' + nameOf(D, cc) + ')' : ''));
      }
      if (what === 'tout_rendre' || what === 'tout') {
        const l = mine();
        for (const x of l) delete D.claims[x];
        S.dirty = true;
        return o.ok(l.length + ' tronçon' + (l.length > 1 ? 's rendus' : ' rendu'));
      }
      if (what === 'ami' || what === 'autoriser' || what === 'trust') {
        const n = anyPlayer(ctx, a[1]);
        if (low(n) === me) bad('C’est toi !');
        const l = (D.trust[me] = D.trust[me] || []);
        if (!l.includes(low(n))) l.push(low(n));
        if (l.length > 30) l.shift();
        acc(n, true);
        S.dirty = true;
        return o.ok('🤝 ' + n + ' peut maintenant construire sur tes terrains et ouvrir tes coffres');
      }
      if (what === 'retirer' || what === 'untrust') {
        const n = a[1] === undefined ? bad('Pseudo attendu') : a[1];
        const l = D.trust[me] || [];
        const i = l.findIndex((x) => x === low(n) || low(nameOf(D, x)) === low(n));
        if (i < 0) bad('« ' + n + ' » n’est pas dans tes amis autorisés');
        const was = nameOf(D, l[i]);
        l.splice(i, 1);
        S.dirty = true;
        return o.ok(was + ' ne peut plus toucher à tes terrains');
      }
      if (what === 'liste' || what === 'list') {
        const l = mine();
        if (!l.length) return o.info('Tu n’as aucun terrain protégé (/terrain prendre, là où tu es)');
        return o.info('🏡 Tes tronçons (' + l.length + ' / ' + D.lim + ') : ' + l.map((x) => x.replace(/^\d:/, '').replace(',', ', ') + (x[0] === '1' ? ' (Nether)' : x[0] === '2' ? ' (End)' : '')).join(' · '));
      }
      if (what === 'limite') {
        if (!isAdm(ctx)) bad('Réservé à l’hôte et aux administrateurs');
        D.lim = C.int(a[1], 1, 10000, 'Nombre de tronçons');
        S.dirty = true;
        return o.ok('Chaque joueur peut protéger ' + D.lim + ' tronçons');
      }
      o.info(cur ? '🏡 Tronçon ' + chunkTxt(ctx.x, ctx.z) + ' : terrain de ' + nameOf(D, cur) : 'Tronçon ' + chunkTxt(ctx.x, ctx.z) + ' : libre (/terrain prendre pour le protéger)');
    },
  });

  def('coffre chest_lock verrou', {
    cat: 'Partie', usage: 'public | prive', desc: 'rend public (ou verrouille) le conteneur que tu vises, s’il est à toi',
    args: [() => ['public', 'prive']],
    run(ctx, a, o) {
      need();
      const h = ctx.look || bad('Vise le conteneur');
      const g = G();
      if (!CM.blocks[g.world.get(h.x, h.y, h.z)].container) bad('Vise un coffre (ou un tonneau, un four…)');
      const v = C.norm(a[0] || '');
      if (v !== 'public' && v !== 'prive') bad('/coffre public ou /coffre prive');
      handle(g, { name: ctx.name, pid: ctx.pid, admin: isAdm(ctx) }, { a: 'pub', k: g.bkey(h.x, h.y, h.z), v: v === 'public' ? 1 : 0 });
    },
  });

  def('equipe team clan', {
    cat: 'Partie', usage: '[creer <nom> [TAG] | inviter <joueur> | rejoindre <équipe> | quitter | exclure <joueur> | dissoudre]', desc: 'ton équipe : [TAG] devant ton pseudo, tchat d’équipe (/e), pas de dégâts entre vous',
    args: [() => ['creer', 'inviter', 'rejoindre', 'quitter', 'exclure', 'dissoudre']],
    run(ctx, a, o) {
      need();
      const D = S.D, me = low(ctx.name), t = teamOf(me, D), what = C.norm(a[0] || '');
      const tell = (team, s) => {
        for (const k of team.m) {
          const pid = sellerPid(k);
          if (pid !== null && pid !== ctx.pid) S.tell(pid, s, 'info');
        }
      };
      if (what === 'creer' || what === 'create') {
        if (t) bad('Tu es déjà dans l’équipe ' + t.n + ' (/equipe quitter d’abord)');
        const n = String(a[1] || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 20);
        if (n.length < 2) bad('Nom de l’équipe : 2 lettres au moins');
        if (D.teams[low(n)]) bad('L’équipe « ' + n + ' » existe déjà');
        const tag = String(a[2] || n).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 4).toUpperCase() || 'EQ';
        D.teams[low(n)] = { n, tag, o: me, m: [me], inv: [], col: Object.keys(D.teams).length % 8 };
        S.dirty = true;
        return o.ok('🛡 Équipe « ' + n + ' » [' + tag + '] créée : invite tes amis (/equipe inviter <joueur>)');
      }
      if (what === 'rejoindre' || what === 'join') {
        if (t) bad('Tu es déjà dans l’équipe ' + t.n);
        const want = a[1] === undefined ? null : low(a[1]);
        const team = Object.values(D.teams).find((x) => x.inv.includes(me) && (!want || low(x.n) === want || low(x.tag) === want));
        if (!team) bad(want ? 'Pas d’invitation de l’équipe « ' + a[1] + ' »' : 'Personne ne t’a invité dans une équipe');
        if (team.m.length >= TEAM_MAX) bad('L’équipe est complète (' + TEAM_MAX + ' joueurs)');
        team.inv = team.inv.filter((x) => x !== me);
        team.m.push(me);
        S.dirty = true;
        tell(team, '🛡 ' + ctx.name + ' a rejoint l’équipe');
        return o.ok('🛡 Tu as rejoint l’équipe « ' + team.n + ' » [' + team.tag + ']');
      }
      if (what === 'refuser') {
        for (const x of Object.values(D.teams)) x.inv = x.inv.filter((y) => y !== me);
        S.dirty = true;
        return o.ok('Invitations refusées');
      }
      if (!t) {
        if (what) bad('Tu n’as pas d’équipe (/equipe creer <nom>)');
        const inv = Object.values(D.teams).filter((x) => x.inv.includes(me));
        return o.info('Tu n’as pas d’équipe. /equipe creer <nom> [TAG]' + (inv.length ? ' · invitations : ' + inv.map((x) => x.n).join(', ') + ' (/equipe rejoindre <nom>)' : ''));
      }
      const boss = t.o === me;
      if (what === 'inviter' || what === 'invite') {
        const n = C.findPlayer(ctx, a[1]).name;
        if (low(n) === me) bad('C’est toi !');
        if (t.m.includes(low(n))) bad(n + ' est déjà dans ton équipe');
        if (teamOf(n, D)) bad(n + ' est déjà dans une autre équipe');
        if (!t.inv.includes(low(n))) t.inv.push(low(n));
        if (t.inv.length > 20) t.inv.shift();
        acc(n, true);
        S.dirty = true;
        const pid = sellerPid(low(n));
        if (pid !== null) S.tell(pid, '🛡 ' + ctx.name + ' t’invite dans l’équipe « ' + t.n + ' » : menu G → Équipe, ou /equipe rejoindre ' + t.n, 'ok');
        return o.ok('Invitation envoyée à ' + n);
      }
      if (what === 'quitter' || what === 'leave') {
        t.m = t.m.filter((x) => x !== me);
        if (!t.m.length) delete D.teams[low(t.n)];
        else if (boss) t.o = t.m[0];
        S.dirty = true;
        if (t.m.length) tell(t, '🛡 ' + ctx.name + ' a quitté l’équipe');
        return o.ok('Tu as quitté l’équipe « ' + t.n + ' »');
      }
      if (what === 'exclure' || what === 'kick') {
        if (!boss) bad('Seul le chef de l’équipe (' + nameOf(D, t.o) + ') peut exclure');
        const n = String(a[1] || '');
        const k = t.m.find((x) => x === low(n) || low(nameOf(D, x)).startsWith(low(n)));
        if (!n || !k || k === me) bad('Pas dans ton équipe : « ' + n + ' »');
        t.m = t.m.filter((x) => x !== k);
        S.dirty = true;
        const pid = sellerPid(k);
        if (pid !== null) S.tell(pid, '🛡 Tu as été exclu de l’équipe « ' + t.n + ' »', 'info');
        return o.ok(nameOf(D, k) + ' ne fait plus partie de l’équipe');
      }
      if (what === 'dissoudre' || what === 'disband') {
        if (!boss) bad('Seul le chef de l’équipe peut la dissoudre');
        tell(t, '🛡 L’équipe « ' + t.n + ' » a été dissoute');
        delete D.teams[low(t.n)];
        S.dirty = true;
        return o.ok('Équipe « ' + t.n + ' » dissoute');
      }
      o.info('🛡 Équipe « ' + t.n + ' » [' + t.tag + '] · chef : ' + nameOf(D, t.o) + ' · ' + t.m.map((k) => nameOf(D, k)).join(', '));
    },
  });

  def('e ec tchat_equipe teamchat', {
    cat: 'Tchat', usage: '<message>', desc: 'message à ton équipe seulement',
    run(ctx, a, o) {
      need();
      const t = teamOf(ctx.name, S.D);
      if (!t) bad('Tu n’as pas d’équipe');
      const s = ctx.line.replace(/^\/\S+\s*/, '').trim().slice(0, 200);
      if (!s) bad('Message attendu');
      const line = '🛡 [' + t.tag + '] ' + ctx.name + ' : ' + s;
      for (const k of t.m) {
        const pid = sellerPid(k);
        if (pid !== null) S.tell(pid, line, 'msg');
      }
      if (CM.Dedicated.on) CM.Dedicated.log(line);
    },
  });

  def('pieces argent solde money balance', {
    cat: 'Partie', usage: '[joueur]', desc: 'tes pièces (gagnées en battant des créatures ou à la boutique)',
    run(ctx, a, o) {
      need();
      const n = a[0] !== undefined ? anyPlayer(ctx, a[0]) : ctx.name;
      o.info(COIN + ' ' + (low(n) === low(ctx.name) ? 'Tu as ' : n + ' a ') + ((acc(n) || {}).c || 0) + ' pièces');
    },
  });
  def('payer pay', {
    cat: 'Partie', usage: '<joueur> <montant>', desc: 'donne des pièces à un joueur (même absent)',
    run(ctx, a, o) {
      need();
      const n = anyPlayer(ctx, a[0]);
      if (low(n) === low(ctx.name)) bad('C’est toi !');
      const v = C.int(a[1], 1, PRICE_MAX, 'Montant');
      const me = acc(ctx.name, true);
      if ((me.c || 0) < v) bad('Pas assez de pièces (tu en as ' + (me.c || 0) + ')');
      addCoins(ctx.name, -v);
      addCoins(n, v);
      const pid = sellerPid(low(n));
      if (pid !== null) S.toast(pid, '💰 ' + ctx.name + ' t’a donné ' + v + ' ' + COIN, 'good');
      o.ok('💰 Tu as donné ' + v + ' ' + COIN + ' à ' + n + ' (il te reste ' + me.c + ')');
    },
  });
  def('donnerpieces givemoney addmoney', {
    cat: 'Partie', hostOnly: true, usage: '<joueur> <montant (négatif pour retirer)>', desc: 'hôte ou administrateur : donne (ou retire) des pièces',
    run(ctx, a, o) {
      need();
      const n = anyPlayer(ctx, a[0]);
      const v = C.int(a[1], -PRICE_MAX, PRICE_MAX, 'Montant');
      const left = addCoins(n, v);
      o.ok(COIN + ' ' + n + ' a maintenant ' + left + ' pièces');
    },
  });
  def('classement classements leaderboard', {
    cat: 'Infos', usage: '[richesse | creatures | joueurs | poses | casses | temps]', desc: 'les meilleurs joueurs de la partie',
    args: [() => ['richesse', 'creatures', 'joueurs', 'poses', 'casses', 'temps']],
    run(ctx, a, o) {
      need();
      const keys = { richesse: 'c', riches: 'c', creatures: 'mk', joueurs: 'pk', poses: 'bp', casses: 'bm', temps: 'pt' };
      const f = keys[C.norm(a[0] || 'richesse')] || 'c';
      const [, title, fmt] = TOPS.find((x) => x[0] === f);
      const l = tops()[f];
      o.info('🏆 ' + title + ' : ' + (l.length ? l.slice(0, 5).map((r, i) => i + 1 + '. ' + r[0] + ' (' + fmt(r[1]) + ')').join(' · ') : 'personne encore'));
    },
  });
  def('liberer resetpseudo', {
    cat: 'Partie', hostOnly: true, usage: '<pseudo>', desc: 'hôte ou administrateur : libère un pseudo protégé (le joueur a changé d’appareil et oublié son mot de passe)',
    run(ctx, a, o) {
      need();
      if (a[0] === undefined) bad('Pseudo attendu');
      const x = S.D.acc[low(a[0])];
      if (!x || !(x.k && x.k.length)) bad('« ' + a[0] + ' » n’est pas protégé');
      delete x.k;
      delete x.pw;
      if (CM.Dedicated.on) CM.Dedicated.log('🔓 Pseudo « ' + x.n + ' » libéré par ' + ctx.name);
      o.ok('🔓 « ' + x.n + ' » est libéré : le prochain appareil qui l’utilise le garde (ses pièces et ses terrains restent)');
    },
  });
  def('boutique shop hdv', {
    cat: 'Partie', local: true, usage: '', desc: 'ouvre la boutique et l’hôtel des ventes (menu G → Argent)',
    run() {
      need();
      CM.Teleport.show(G(), 'argent');
    },
  });

  CM.Social = S;
})();
