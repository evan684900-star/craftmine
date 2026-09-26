'use strict';
// Multijoueur en pair à pair. Un joueur « ouvre sa partie aux amis » et reçoit un code ;
// les autres rejoignent avec ce code. Les navigateurs se parlent directement (WebRTC) :
// PeerJS et son serveur public gratuit servent seulement à les mettre en relation.
// L'hôte fait autorité : il garde le monde, les créatures, les objets au sol et les coffres.
// Chaque invité gère lui-même ses déplacements, son inventaire, sa faim et sa santé.
(function () {
  const $ = (id) => document.getElementById(id);
  const PROTO = 4; // 3 : chacun dans sa dimension (Nether) ; 4 : redstone, wagonnets, électricité
  const PREFIX = 'craftmine16-';
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const MAX_PLAYERS = 8;
  const PART = 15000; // découpe des gros messages (limite des canaux WebRTC)
  const TIMEOUT = 45000; // ms sans nouvelles : joueur considéré comme parti
  const VIEW = 80; // distance d'envoi des créatures et objets au sol
  const SIM = 4; // rayon (tronçons) simulé par l'hôte autour de chaque invité
  const SHIRTS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink', 'lime', 'magenta'];

  const r2 = (v) => Math.round(v * 100) / 100;
  const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const cleanText = (s) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
  const num = (v) => (Number.isFinite(+v) ? +v : 0);
  // Données d'une pile reçues du réseau (usure/expérience, enchantements), vérifiées.
  const netExtra = (m) => {
    const e = {};
    if (m.xp !== undefined) e.xp = num(m.xp);
    const en = CM.cleanEnch(m.en);
    if (en) e.ench = en;
    return e.xp !== undefined || e.ench ? e : null;
  };

  function randomCode() {
    const a = new Uint32Array(5);
    try {
      crypto.getRandomValues(a);
    } catch (e) {
      for (let i = 0; i < 5; i++) a[i] = Math.floor(Math.random() * 1e9);
    }
    let s = '';
    for (let i = 0; i < 5; i++) s += CODE_CHARS[a[i] % CODE_CHARS.length];
    return s;
  }
  CM.randomPlayerName = () => 'Joueur' + (100 + Math.floor(Math.random() * 900));
  CM.cleanName = cleanName;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('impossible de charger ' + src));
      document.head.appendChild(s);
    });
  }

  // Texte d'erreur compréhensible.
  CM.netErrorText = function (e) {
    const t = e && e.type;
    if (t === 'deny' || t === 'input') return e.message;
    if (t === 'peer-unavailable') return 'Aucune partie ouverte avec ce code. Vérifie le code, et que l’hôte a bien le jeu ouvert.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' || t === 'server') return 'Impossible de joindre le serveur de mise en relation. Vérifie ta connexion Internet, puis réessaie.';
    if (t === 'browser-incompatible') return 'Ce navigateur ne permet pas le multijoueur (WebRTC). Essaie Chrome, Firefox, Edge ou Safari à jour.';
    if (t === 'timeout') return 'La connexion n’aboutit pas : un des réseaux bloque peut-être les connexions directes (essaie un autre Wi-Fi ou la 4G).';
    return 'Erreur réseau : ' + ((e && e.message) || t || 'inconnue') + '.';
  };

  // ------------------------------------------------------ liaison -----
  // Connexion vers un autre joueur : messages JSON numérotés (un message reçu deux fois
  // est ignoré), découpés s'ils sont trop gros.
  class Link {
    constructor(conn, onMsg, onClose) {
      this.conn = conn;
      this.parts = null;
      this.last = performance.now();
      this.closed = false;
      this.seq = 0;
      this.lastIn = 0;
      conn.on('data', (d) => {
        this.last = performance.now();
        if (typeof d !== 'string') return;
        if (d.charCodeAt(0) === 1) {
          const bar = d.indexOf('|');
          const [i, n] = d.slice(1, bar).split('/').map(Number);
          if (i === 0) this.parts = [];
          if (!this.parts) return;
          this.parts.push(d.slice(bar + 1));
          if (this.parts.length < n) return;
          d = this.parts.join('');
          this.parts = null;
        }
        let m;
        try {
          m = JSON.parse(d);
        } catch (e) {
          return;
        }
        if (!m || typeof m.t !== 'string') return;
        if (m.q) {
          if (m.q <= this.lastIn) return;
          this.lastIn = m.q;
        }
        onMsg(m);
      });
      const end = () => {
        if (this.closed) return;
        this.closed = true;
        onClose();
      };
      conn.on('close', end);
      conn.on('error', end);
    }
    send(msg) {
      if (this.closed || !this.conn.open) return;
      const s = '{"q":' + ++this.seq + ',' + JSON.stringify(msg).slice(1);
      try {
        if (s.length <= PART) this.conn.send(s);
        else {
          const n = Math.ceil(s.length / PART);
          for (let i = 0; i < n; i++) this.conn.send('\u0001' + i + '/' + n + '|' + s.slice(i * PART, (i + 1) * PART));
        }
      } catch (e) {
        console.warn('envoi impossible', e);
      }
    }
    close() {
      try {
        this.conn.close();
      } catch (e) {
        /* ignore */
      }
    }
  }

  // ------------------------------------------------- autre joueur -----
  class RemotePlayer {
    constructor(net, pid, name) {
      this.net = net;
      this.pid = pid;
      this.name = name;
      this.x = this.y = this.z = 0; // dernière position reçue (IA des créatures)
      this.rx = this.ry = this.rz = 0; // position affichée (lissée)
      this.yaw = this.ryaw = this.pitch = 0;
      this.hw = 0.3;
      this.h = 1.8;
      this.flags = 0;
      this.held = 0;
      this.armor = 0; // matériaux portés (casque, plastron, jambières, bottes), codés en base 6
      this.dim = 'overworld'; // dimension où il se trouve (chacun voyage seul, comme dans Minecraft)
      this.alive = true;
      this.seen = false;
      this.walk = 0;
      this.moving = false;
      this.swingT = 0;
      this.free = true;
      this.accept = [];
      this.shirt = SHIRTS[pid % SHIRTS.length];
    }
    // [x, y, z, yaw, pitch, drapeaux, objet tenu, armure, dimension (1 : Nether)] ;
    // drapeaux : 1 accroupi, 2 vol, 4 vivant, 8 coup, 16 blessé
    setState(a) {
      if (!Array.isArray(a)) return;
      this.x = num(a[0]);
      this.y = num(a[1]);
      this.z = num(a[2]);
      this.yaw = num(a[3]);
      this.pitch = num(a[4]);
      this.flags = a[5] | 0;
      this.held = a[6] | 0;
      this.armor = a[7] | 0;
      this.dim = (a[8] | 0) === 1 ? 'nether' : 'overworld';
      this.offhand = CM.itemInfo(a[9] | 0) ? a[9] | 0 : 0; // main secondaire
      this.blocking = !!(this.flags & 64);
      this.alive = !!(this.flags & 4);
      if (this.flags & 8) this.swingT = 0.3;
      if (!this.seen || Math.hypot(this.x - this.rx, this.y - this.ry, this.z - this.rz) > 12) {
        this.rx = this.x;
        this.ry = this.y;
        this.rz = this.z;
        this.ryaw = this.yaw;
      }
      this.seen = true;
    }
    canTake(id) {
      return this.free || this.accept.includes(id);
    }
    // Dégâts infligés par l'hôte (créature, explosion, autre joueur) : envoyés à l'invité.
    damage(n, sx, sz, cause, bypass, vy, attacker) {
      this.net.hurtRemote(this, n, sx, sz, cause, bypass, vy, attacker);
    }
  }

  // ------------------------------------------------------ réseau ------
  class Net {
    constructor(game) {
      this.game = game;
      this.role = null; // 'host' | 'client' | null
      this.peer = null;
      this.code = '';
      this.name = '';
      this.hostName = '';
      this.pid = 0;
      this.hostLink = null; // invité : liaison vers l'hôte
      this.links = new Map(); // hôte : pid -> { pid, name, link, rp }
      this.remotes = new Map(); // pid -> RemotePlayer (tous les autres joueurs)
      this.nextPid = 1;
      this.queue = null; // invité : messages reçus pendant le chargement du monde
      this.outSets = []; // [origine, [x, y, z, bloc, ...]] dans l'ordre où l'hôte les applique
      this.pending = new Map(); // invité : blocs modifiés ici, pas encore confirmés par l'hôte
      this.muted = false;
      this.locks = new Map(); // hôte : coffre ouvert -> pid (0 = l'hôte)
      this.guests = {}; // hôte : progression de chaque invité (par pseudo)
      this.rules = { pvp: false, keep: false, cmds: false };
      this.dayLen = 0;
      this.chestKey = null;
      this.chestDirty = false;
      this.tState = 0;
      this.tEnt = 0;
      this.tTime = 0;
      this.tSave = 20;
      this.tInfo = 0;
      this.tAcc = 0;
      this.chatOpen = false;
      this.tags = new Map();
      this.M = CM.mat4.create();
      this.P = CM.mat4.create();
      this.R = CM.mat4.create();
      this.Q = CM.mat4.create();
      this.bindUI();
      setInterval(() => this.watchdog(), 2000);
    }
    get active() {
      return this.role !== null;
    }
    get isHost() {
      return this.role === 'host';
    }
    get isClient() {
      return this.role === 'client';
    }

    // ----------------------------------------------- connexion -------
    peerOptions() {
      const o = { debug: 1 };
      // tests : serveur de mise en relation local (« ?peerserver=localhost:9000 »)
      const q = new URLSearchParams(location.search).get('peerserver');
      if (q) {
        const [host, port] = q.split(':');
        Object.assign(o, { host, port: +port || 9000, path: '/', secure: false, config: { iceServers: [] } });
      }
      return o;
    }
    async ensureLib() {
      if (!window.Peer) await loadScript('js/vendor/peerjs.min.js');
      if (!window.Peer) throw new Error('bibliothèque réseau indisponible');
    }
    openPeer(id) {
      return new Promise((resolve, reject) => {
        const p = id ? new window.Peer(id, this.peerOptions()) : new window.Peer(this.peerOptions());
        let done = false;
        const to = setTimeout(() => {
          if (done) return;
          done = true;
          p.destroy();
          reject({ type: 'server' });
        }, 15000);
        p.on('open', () => {
          if (done) return;
          done = true;
          clearTimeout(to);
          resolve(p);
        });
        p.on('error', (e) => {
          if (!done) {
            done = true;
            clearTimeout(to);
            p.destroy();
            reject(e);
          } else if (this.onPeerErr) this.onPeerErr(e);
          else if (this.isHost && /network|server|socket/.test(e.type || '')) this.reconnectLater();
        });
      });
    }
    reconnectLater() {
      clearTimeout(this.rcT);
      this.rcT = setTimeout(() => {
        const p = this.peer;
        if (!this.isHost || !p || p.destroyed || !p.disconnected) return;
        try {
          p.reconnect();
        } catch (e) {
          this.reconnectLater();
        }
      }, 3000);
    }

    // Ouvre la partie en cours aux autres joueurs. Renvoie le code.
    async host(name, pvp) {
      if (this.active) return this.code;
      await this.ensureLib();
      let peer = null, last = null;
      for (let k = 0; k < 4 && !peer; k++) {
        const code = randomCode();
        try {
          peer = await this.openPeer(PREFIX + code);
          this.code = code;
        } catch (e) {
          last = e;
          if (e.type !== 'unavailable-id') break;
        }
      }
      if (!peer) throw last || { type: 'server' };
      this.peer = peer;
      this.role = 'host';
      this.pid = 0;
      this.name = name;
      this.rules.pvp = !!pvp;
      this.rules.keep = !!this.game.options.keepInventory;
      this.rules.cmds = !!(this.game.settings && this.game.settings.guestCheats); // triches des invités (/triche)
      peer.on('connection', (conn) => this.incoming(conn));
      peer.on('disconnected', () => this.reconnectLater());
      this.attachWorld();
      document.body.classList.add('net');
      this.sys('Partie ouverte ! Code : ' + this.code);
      return this.code;
    }

    // Rejoint une partie. Renvoie le message d'accueil de l'hôte (monde, règles…).
    async join(code, name, status) {
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 5) throw { type: 'input', message: 'Tape le code de la partie (5 caractères, donné par l’hôte).' };
      await this.ensureLib();
      status('Connexion au serveur de mise en relation…');
      const peer = await this.openPeer(null);
      this.peer = peer;
      status('Recherche de la partie ' + code + '…');
      try {
        const welcome = await new Promise((resolve, reject) => {
          let done = false;
          const fail = (e) => {
            if (done) return;
            done = true;
            clearTimeout(to);
            reject(e);
          };
          const to = setTimeout(() => fail({ type: 'timeout' }), 25000);
          this.onPeerErr = fail;
          const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'raw' });
          conn.on('open', () => {
            if (this.hostLink) return;
            status('Connecté ! Réception du monde…');
            this.hostLink = new Link(
              conn,
              (m) => {
                if (!done) {
                  if (m.t === 'welcome') {
                    done = true;
                    clearTimeout(to);
                    this.queue = [];
                    resolve(m);
                  } else if (m.t === 'deny') fail({ type: 'deny', message: m.r });
                  return;
                }
                if (this.queue) this.queue.push(m);
                else this.fromHost(m);
              },
              () => {
                if (!done) fail({ type: 'timeout' });
                else this.lost('Connexion perdue avec l’hôte.');
              },
            );
            this.hostLink.send({ t: 'hello', v: PROTO, name });
          });
          conn.on('error', () => fail({ type: 'timeout' }));
        });
        this.onPeerErr = null;
        this.role = 'client';
        this.pid = welcome.pid;
        this.name = name;
        this.code = code;
        this.hostName = welcome.host;
        this.applyRules(welcome.rules);
        this.dayLen = welcome.dayLen || 0;
        this.remotes.clear();
        for (const [pid, n] of welcome.players || []) this.remotes.set(pid, new RemotePlayer(this, pid, n));
        document.body.classList.add('net');
        return welcome;
      } catch (e) {
        this.onPeerErr = null;
        this.reset();
        try {
          peer.destroy();
        } catch (err) {
          /* ignore */
        }
        throw e;
      }
    }

    // Sauvegarde fictive construite à partir de l'accueil de l'hôte (pour startWorld).
    guestSave(w) {
      const you = w.you || {};
      const sp = w.spawn;
      // l'invité revient dans sa dimension (l'hôte l'a décidé d'après sa sauvegarde)
      const nether = w.dim === 'nether';
      return {
        v: 4, seed: w.seed, settings: w.settings, spawn: sp, edits: w.edits || {},
        dim: nether ? 'nether' : 'overworld',
        nether: w.ne ? { edits: w.ne } : undefined,
        player: you.player && Number.isFinite(you.player.x) ? you.player : { x: sp.x, y: sp.y, z: sp.z, health: 20, food: 20, sat: 5 },
        inv: you.inv || null, time: w.time, dayCount: w.day, stats: you.stats || {}, noteBlocks: w.notes || {}, chests: {},
        weather: w.wx && typeof w.wx === 'object' ? w.wx : null,
      };
    }

    // Le monde de la partie est prêt (appelé à la fin de startWorld).
    worldReady() {
      if (!this.active) return;
      this.attachWorld();
      if (this.isClient) {
        const q = this.queue || [];
        this.queue = null;
        for (const m of q) this.fromHost(m);
        this.sendMyState(true);
        this.sys('Connecté à la partie de ' + this.hostName + ' (code ' + this.code + '). Touche ' + (this.game.touch.enabled ? '💬' : 'T') + ' pour discuter.');
      }
    }

    // Les blocs modifiés dans un monde partent vers les joueurs de sa dimension.
    // Sans argument : tous les mondes simulés.
    attachWorld(w, dim) {
      const g = this.game;
      if (!w) {
        for (const c of Object.values(g.ctxs || {})) this.attachWorld(c.world, c.dim);
        return;
      }
      const d = dim === 'nether' ? 1 : 0;
      w.onSet = (x, y, z, id) => {
        if (this.muted || !this.active) return;
        if (this.isClient) {
          const k = x + ',' + y + ',' + z;
          this.pending.set(k, (this.pending.get(k) || 0) + 1);
        }
        this.queueSet(0, x, y, z, id, d);
      };
    }

    // Quitte la partie (ou la ferme, pour l'hôte).
    leave() {
      if (!this.active) return;
      if (this.isClient) {
        this.sendGuestSave();
        if (this.hostLink) this.hostLink.send({ t: 'bye' });
      } else this.broadcast({ t: 'bye', r: 'L’hôte a fermé la partie.' });
      const peer = this.peer;
      setTimeout(() => {
        try {
          if (peer) peer.destroy();
        } catch (e) {
          /* ignore */
        }
      }, 500);
      this.reset();
    }
    reset() {
      this.role = null;
      this.peer = null;
      this.hostLink = null;
      this.links.clear();
      this.remotes.clear();
      this.queue = null;
      this.outSets = [];
      this.pending.clear();
      this.locks.clear();
      this.chestKey = null;
      this.code = '';
      this.dayLen = 0;
      this.rules = { pvp: false, keep: false, cmds: false };
      if (this.chatOpen) this.closeChat(false, true);
      document.body.classList.remove('net');
      this.tagsEl.innerHTML = '';
      this.tags.clear();
      this.chatEl.innerHTML = '';
      $('netinfo').classList.add('hidden');
    }
    lost(msg) {
      if (!this.isClient) return;
      this.game.exitToMenu(msg);
    }
    watchdog() {
      const now = performance.now();
      if (this.isHost) {
        for (const e of [...this.links.values()]) if (now - e.link.last > TIMEOUT) this.dropClient(e, 'lost');
        if (this.links.size) this.broadcast({ t: 'ping' });
      } else if (this.isClient && this.hostLink) {
        if (now - this.hostLink.last > TIMEOUT) this.lost('Connexion perdue avec l’hôte.');
        else this.hostLink.send({ t: 'ping' });
      }
    }

    // ------------------------------------------------- envois --------
    send(m) {
      if (this.isClient && this.hostLink) this.hostLink.send(m);
    }
    sendTo(pid, m) {
      const e = this.links.get(pid);
      if (e) e.link.send(m);
    }
    broadcast(m, except) {
      for (const e of this.links.values()) if (e.pid !== except) e.link.send(m);
    }
    // À tous les invités d'une dimension.
    toDim(m, dim, except) {
      for (const e of this.links.values()) if (e.pid !== except && e.rp.dim === dim) e.link.send(m);
    }
    // Hôte : envoie un effet aux joueurs proches.
    fx(m, except) {
      if (!this.isHost) return;
      for (const e of this.links.values()) {
        if (e.pid === except || !e.rp.seen || e.rp.dim !== this.game.dim) continue;
        if (Math.abs(e.rp.x - m.x) < 96 && Math.abs(e.rp.z - m.z) < 96) e.link.send(Object.assign({ t: 'fx' }, m));
      }
    }
    // L'ordre compte : chacun applique les modifications exactement dans l'ordre de l'hôte.
    // (d : dimension du bloc, 0 monde normal, 1 Nether ; par défaut celle en cours de traitement)
    queueSet(origin, x, y, z, id, d) {
      if (d === undefined) d = this.dimId;
      const last = this.outSets[this.outSets.length - 1];
      if (last && last[0] === origin && last[2] === d) last[1].push(x, y, z, id);
      else this.outSets.push([origin, [x, y, z, id], d]);
    }
    // Numéro de la dimension courante (0 : monde normal, 1 : Nether), joint aux blocs modifiés.
    get dimId() {
      return this.game.dim === 'nether' ? 1 : 0;
    }
    flushSets() {
      if (!this.outSets.length) return;
      if (this.isHost) {
        // chacun ne reçoit que les blocs de la dimension où il se trouve
        for (const [o, b, d] of this.outSets) for (const e of this.links.values()) if ((e.rp.dim === 'nether' ? 1 : 0) === d) e.link.send({ t: 'set', o, b, d });
      } else if (this.hostLink) {
        for (const [, b, d] of this.outSets) this.hostLink.send({ t: 'set', b, d });
      }
      this.outSets = [];
    }
    rulesMsg() {
      const s = this.game.settings || {};
      return {
        pvp: this.rules.pvp, keep: !!this.game.options.keepInventory, cmds: !!this.rules.cmds,
        fallDamage: s.fallDamage !== false, hunger: s.hunger !== false, mobSpawn: s.mobSpawn !== false,
      };
    }
    applyRules(r) {
      if (!r) return;
      this.rules.pvp = !!r.pvp;
      this.rules.keep = !!r.keep;
      this.rules.cmds = !!r.cmds;
      // règles de la partie (/regle) qui jouent chez l'invité
      for (const k of ['fallDamage', 'hunger', 'mobSpawn']) this.rules[k] = r[k] !== false;
    }
    // Hôte : réglages du monde modifiés (mode, difficulté, règles).
    sendCfg() {
      if (!this.isHost) return;
      this.rules.keep = !!this.game.options.keepInventory;
      this.broadcast({ t: 'cfg', mode: this.game.mode, diff: this.game.difficulty, rules: this.rulesMsg(), l: this.game.dayLen });
    }
    stateOf(p) {
      const g = this.game;
      const f = (p.sneaking ? 1 : 0) | (p.flying ? 2 : 0) | (p.alive ? 4 : 0) | (p.swing > 0.55 ? 8 : 0) | (p.hurtFlash > 0.25 ? 16 : 0) | (p.sleeping ? 32 : 0) | (p.blocking ? 64 : 0);
      const held = g.inventory.held();
      let armor = 0;
      g.inventory.armor.forEach((s, k) => {
        if (s) armor += (CM.ARMOR_MATS.findIndex((m) => m.key === CM.itemInfo(s.id).mat) + 1) * 6 ** k;
      });
      const off = g.inventory.offhand;
      return [r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), f, held ? held.id : 0, armor, g.playerDim === 'nether' ? 1 : 0, off ? off.id : 0];
    }
    sendMyState(withInv) {
      const g = this.game;
      if (!this.hostLink || !g.player) return;
      const m = { t: 'st', s: this.stateOf(g.player) };
      if (withInv) {
        const slots = g.inventory.slots;
        const acc = [];
        for (const s of slots) if (s && s.count < CM.itemInfo(s.id).stack && !acc.includes(s.id)) acc.push(s.id);
        m.a = [slots.some((s) => !s) ? 1 : 0, ...acc];
      }
      this.hostLink.send(m);
    }
    sendGuestSave() {
      const g = this.game, p = g.player;
      if (!this.isClient || !this.hostLink || !p || !g.world) return;
      const sp = p.alive ? null : g.respawnPoint();
      this.hostLink.send({
        t: 'save',
        d: {
          dim: sp ? sp.dim : g.dim,
          player: {
            x: p.alive ? p.x : sp.x, y: p.alive ? p.y : sp.y, z: p.alive ? p.z : sp.z,
            yaw: p.yaw, pitch: p.pitch, health: p.alive ? p.health : 20, food: p.alive ? p.food : 20, sat: p.sat, flying: p.flying, bed: p.bed || null,
            xp: p.xpTotal, enchSeed: p.enchSeed,
          },
          inv: g.inventory.serialize(),
          stats: g.stats,
        },
      });
    }

    // ---------------------------------------- mise à jour (image) ----
    update(dt) {
      if (!this.active) return;
      const g = this.game;
      if (this.isHost) {
        if (this.links.size) {
          this.tState -= dt;
          if (this.tState <= 0) {
            this.tState = 1 / 12;
            this.sendStates();
          }
          this.tEnt -= dt;
          if (this.tEnt <= 0) {
            this.tEnt = 0.1;
            this.sendEntities();
          }
          this.tTime -= dt;
          if (this.tTime <= 0) {
            this.tTime = 2;
            this.broadcast({ t: 'time', ti: g.time, d: g.dayCount, l: g.dayLen });
          }
        }
      } else {
        this.tState -= dt;
        this.tAcc -= dt;
        if (this.tState <= 0) {
          this.tState = 1 / 12;
          const inv = this.tAcc <= 0 || g.inventory.netDirty;
          if (inv) {
            this.tAcc = 2;
            g.inventory.netDirty = false;
          }
          this.sendMyState(inv);
        }
        this.tSave -= dt;
        if (this.tSave <= 0) {
          this.tSave = 20;
          this.sendGuestSave();
        }
        if (this.chestDirty) {
          this.chestDirty = false;
          if (this.chestKey && g.ui.chest) this.send({ t: 'cs', k: this.chestKey, s: g.ui.chest });
        }
      }
      this.flushSets();
      // autres joueurs : position affichée lissée
      const k = Math.min(1, dt * 12);
      for (const rp of this.remotes.values()) {
        if (!rp.seen) continue;
        const ox = rp.rx, oz = rp.rz;
        rp.rx += (rp.x - rp.rx) * k;
        rp.ry += (rp.y - rp.ry) * k;
        rp.rz += (rp.z - rp.rz) * k;
        let d = rp.yaw - rp.ryaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        rp.ryaw += d * k;
        const sp = Math.hypot(rp.rx - ox, rp.rz - oz) / Math.max(dt, 1e-3);
        rp.moving = sp > 0.4;
        rp.walk += Math.min(sp, 8) * dt * 2.6;
        rp.swingT = Math.max(0, rp.swingT - dt);
      }
      this.tInfo -= dt;
      if (this.tInfo <= 0) {
        this.tInfo = 1;
        const el = $('netinfo');
        el.textContent = '🌐 ' + this.code + ' · ' + (this.remotes.size + 1) + ' joueur' + (this.remotes.size ? 's' : '');
        el.classList.remove('hidden');
      }
    }

    // Hôte : positions de tous les joueurs, envoyées à chacun.
    sendStates() {
      const g = this.game;
      const all = [[0, ...this.stateOf(g.player)]];
      for (const e of this.links.values()) {
        const rp = e.rp;
        if (rp.seen) all.push([e.pid, r2(rp.x), r2(rp.y), r2(rp.z), r2(rp.yaw), r2(rp.pitch), rp.flags, rp.held, rp.armor, rp.dim === 'nether' ? 1 : 0, rp.offhand || 0]);
      }
      for (const e of this.links.values()) e.link.send({ t: 'ps', p: all.filter((a) => a[0] !== e.pid) });
    }
    // Hôte : créatures, objets au sol et TNT proches de chaque invité.
    sendEntities() {
      const g = this.game;
      for (const e of this.links.values()) {
        const rp = e.rp, ctx = g.ctxs[rp.dim];
        if (!rp.seen || !ctx) continue;
        const ents = ctx.entities, w = ctx.world;
        const near = (o) => Math.abs(o.x - rp.x) < VIEW && Math.abs(o.z - rp.z) < VIEW;
        const m = [], d = [], tn = [];
        for (const o of ents.mobs) {
          if (o.dead || !near(o)) continue;
          const fl = (o.hurt > 0 ? 1 : 0) | (o.ai.chasing ? 2 : 0) | (o.baby > 0 ? 4 : 0) | (o.love > 0 ? 8 : 0) | (o.loveCd > 0 ? 16 : 0) | (o.fire > 0 ? 32 : 0) | (o.ai.special ? 64 : 0);
          m.push([o.uid, o.type, r2(o.x), r2(o.y), r2(o.z), r2(o.yaw), fl]);
        }
        for (const o of ents.drops) if (!o.dead && near(o) && w.loaded(o.x, o.z)) d.push([o.uid, o.id, o.count, r2(o.x), r2(o.y), r2(o.z), Math.round(o.age)]);
        for (const o of ents.tnts) if (near(o)) tn.push([o.uid, r2(o.x), r2(o.y), r2(o.z), r2(o.fuse)]);
        const x = ents.snapExtra(near);
        e.link.send({ t: 'ent', m, d, tn, ar: x.ar, ca: x.ca, fb: x.fb });
      }
    }
    // Hôte : zones à garder chargées autour des invités.
    simCenters() {
      const out = [], dim = this.game.dim;
      for (const rp of this.remotes.values()) if (rp.seen && rp.dim === dim) out.push([rp.x, rp.z, SIM]);
      return out;
    }
    // Joueurs présents dans la simulation de l'hôte (IA des créatures, ramassage).
    // (seulement ceux de la dimension simulée en ce moment)
    simPlayers() {
      const g = this.game;
      const out = g.dim === g.playerDim ? [g.player] : [];
      if (this.isHost) for (const rp of this.remotes.values()) if (rp.seen && rp.dim === g.dim) out.push(rp);
      return out;
    }

    // ---------------------------------------------- côté hôte --------
    incoming(conn) {
      const e = { pid: -1, name: '', link: null, rp: null, gone: false };
      conn.on('open', () => {
        if (!e.link) e.link = new Link(conn, (m) => this.fromClient(e, m), () => this.dropClient(e, 'left'));
      });
      setTimeout(() => {
        if (e.pid < 0 && !e.gone) {
          e.gone = true;
          try {
            conn.close();
          } catch (err) {
            /* ignore */
          }
        }
      }, 20000);
    }

    hello(e, m) {
      const g = this.game;
      const name = cleanName(m.name) || CM.randomPlayerName();
      const deny = (r) => {
        e.link.send({ t: 'deny', r });
        setTimeout(() => e.link.close(), 800);
      };
      if (m.v !== PROTO) return deny('Versions du jeu différentes : recharge la page (l’hôte et toi).');
      if (g.state !== 'playing' || !g.world) return deny('La partie de l’hôte n’est pas prête.');
      // même pseudo qu'un invité silencieux depuis quelques secondes (page rechargée,
      // téléphone verrouillé) : c'est sûrement lui qui revient, on remplace l'ancienne session
      const same = (n) => n.toLowerCase() === name.toLowerCase();
      for (const o of [...this.links.values()]) if (same(o.name) && performance.now() - o.link.last > 6000) this.dropClient(o, 'lost');
      if (same(this.name) || [...this.links.values()].some((x) => same(x.name))) return deny('Le pseudo « ' + name + ' » est déjà pris dans cette partie : choisis-en un autre.');
      if (this.links.size >= MAX_PLAYERS - 1) return deny('La partie est pleine (' + MAX_PLAYERS + ' joueurs au maximum).');
      e.pid = this.nextPid++;
      e.name = name;
      e.rp = new RemotePlayer(this, e.pid, name);
      // il revient dans la dimension où il était (chacun voyage seul)
      const you = this.guests[name] || null;
      if (you && you.dim === 'nether' && you.player && Number.isFinite(you.player.x)) e.rp.dim = 'nether';
      const w = g.worlds.overworld, nw = g.worlds.nether;
      e.link.send({
        t: 'welcome', v: PROTO, pid: e.pid, host: this.name,
        seed: w.seed, settings: Object.assign({}, g.settings, { mode: g.mode, difficulty: g.difficulty }),
        spawn: w.spawn, edits: w.editsObject(), notes: g.noteBlocks,
        dim: e.rp.dim, ne: nw ? nw.editsObject() : g.netherEdits,
        time: g.time, day: g.dayCount, dayLen: g.dayLen, rules: this.rulesMsg(), wx: g.weather || null,
        players: [[0, this.name], ...[...this.links.values()].map((x) => [x.pid, x.name])],
        you,
      });
      this.links.set(e.pid, e);
      this.remotes.set(e.pid, e.rp);
      this.broadcast({ t: 'join', pid: e.pid, n: name }, e.pid);
      this.sys(name + ' a rejoint la partie');
      CM.Audio.play('pop');
    }

    dropClient(e, why) {
      if (e.gone) return;
      e.gone = true;
      if (!this.isHost || e.pid < 0 || !this.links.has(e.pid)) return;
      this.links.delete(e.pid);
      this.remotes.delete(e.pid);
      for (const [k, pid] of [...this.locks]) if (pid === e.pid) this.lockDel(k);
      if (e.link) e.link.close();
      this.broadcast({ t: 'leave', pid: e.pid });
      this.sys(e.name + (why === 'lost' ? ' a perdu la connexion' : ' a quitté la partie'));
    }

    fromClient(e, m) {
      if (e.gone) return;
      if (e.pid < 0) {
        if (m.t === 'hello') this.hello(e, m);
        return;
      }
      // chaque message est traité dans la dimension de son auteur (blocs, créatures, coffres…)
      this.game.withDim(e.rp.dim, () => this.handleClient(e, m));
    }
    handleClient(e, m) {
      const g = this.game, rp = e.rp;
      switch (m.t) {
        case 'st':
          // (position envoyée avant un voyage : ignorée, l'hôte a déjà placé le joueur à l'arrivée)
          if (!Array.isArray(m.s) || ((m.s[8] | 0) === 1 ? 'nether' : 'overworld') !== rp.dim) break;
          {
            const ox = rp.x, oy = rp.y, oz = rp.z, was = rp.seen;
            rp.setState(m.s);
            // les pas des invités font vibrer les capteurs de sculk (sauf accroupis ou en vol)
            const moved = Math.hypot(rp.x - ox, rp.z - oz);
            if (was && rp.alive && !(rp.flags & 3) && moved < 4 && Math.abs(rp.y - oy) < 0.6 && g.ticks.rs && g.world.solidAt(Math.floor(rp.x), Math.floor(rp.y - 0.05), Math.floor(rp.z))) {
              rp.stepAcc = (rp.stepAcc || 0) + moved;
              if (rp.stepAcc > 1.8) {
                rp.stepAcc = 0;
                g.ticks.rs.vibrate(rp.x, rp.y + 0.5, rp.z);
              }
            }
          }
          if (Array.isArray(m.a)) {
            rp.free = !!m.a[0];
            rp.accept = m.a.slice(1);
          }
          break;
        case 'set':
          if ((m.d | 0) === this.dimId) this.clientSets(e.pid, m.b); // (envoyé avant un voyage : ignoré)
          break;
        case 'portal': {
          // un invité est resté dans un portail : il voyage seul (comme dans Minecraft)
          const x = m.x | 0, y = m.y | 0, z = m.z | 0;
          let pid = 0;
          for (let dy = -1; dy <= 1 && !pid; dy++) for (let dz = -1; dz <= 1 && !pid; dz++) for (let dx = -1; dx <= 1 && !pid; dx++) {
            const id = g.world.get(x + dx, y + dy, z + dz);
            if (CM.blocks[id].portal) pid = id;
          }
          if (!pid || Math.hypot(rp.x - x, rp.z - z) > 4) break;
          this.travelGuest(e, rp.dim === 'nether' ? 'overworld' : 'nether', { from: [x, y, z], axis: pid === CM.PORTALS[1] ? 1 : 0 });
          break;
        }
        case 'respawn': {
          // mort dans le Nether : retour au monde normal, à son lit ou au point de départ
          if (rp.dim !== 'nether' || !Array.isArray(m.at)) break;
          this.travelGuest(e, 'overworld', { at: { x: num(m.at[0]), y: num(m.at[1]), z: num(m.at[2]) }, respawn: true });
          break;
        }
        case 'drop': {
          const id = m.id | 0, n = Math.min(4096, m.n | 0);
          if (!CM.itemInfo(id) || n <= 0) break;
          const v = Array.isArray(m.v) ? m.v.map(num) : null;
          g.entities.addDrop(id, n, num(m.x), num(m.y), num(m.z), netExtra(m), v);
          break;
        }
        case 'hit': {
          const mob = g.entities.mobs.find((o) => o.uid === m.id);
          if (!mob || mob.dead || Math.hypot(mob.x - rp.x, mob.z - rp.z) > 8) break;
          const lv = (v, max) => Math.min(max, Math.max(0, v | 0));
          g.entities.hurtMob(mob, Math.min(60, Math.max(0, num(m.d))), [rp.x, rp.z], false, rp, { kb: lv(m.kb, 2), fire: lv(m.fi, 2), loot: lv(m.lo, 3) });
          break;
        }
        case 'feed': {
          const mob = g.entities.mobs.find((o) => o.uid === m.id);
          if (mob && Math.hypot(mob.x - rp.x, mob.z - rp.z) < 7) g.entities.feedMob(mob);
          break;
        }
        case 'tnt':
          g.entities.addTnt(num(m.x), num(m.y), num(m.z), Math.min(10, num(m.f) || 3.2));
          if (Math.hypot(g.player.x - m.x, g.player.z - m.z) < 24) CM.Audio.play('fuse');
          this.fx({ k: 'fuse', x: num(m.x), y: num(m.y), z: num(m.z) }, e.pid);
          break;
        case 'co':
          if (typeof m.k === 'string') this.cartChestOpen(e, m.k);
          else this.chestOpen(e, m.x | 0, m.y | 0, m.z | 0);
          break;
        case 'cs':
          this.chestSet(e, m.k, m.s);
          break;
        case 'cc':
          if (this.locks.get(m.k) === e.pid) this.lockDel(m.k);
          break;
        case 'note': {
          const x = m.x | 0, y = m.y | 0, z = m.z | 0, n = (m.n | 0) % 25;
          g.noteBlocks[g.bkey(x, y, z)] = n;
          g.noteFx(x, y, z, n);
          this.toDim({ t: 'note', x, y, z, n }, g.dim, e.pid);
          break;
        }
        case 'chat': {
          const s = cleanText(m.s);
          if (s) this.chatAll(e.name, s);
          break;
        }
        case 'cmd':
          // commande tapée par l'invité (exécutée ici, dans sa dimension)
          CM.Commands.fromGuest(e, m);
          break;
        case 'act':
          // action d'une commande de l'invité sur un joueur (relayée)
          CM.Commands.guestAct(e, m);
          break;
        case 'save':
          if (m.d && typeof m.d === 'object') this.guests[e.name] = m.d;
          break;
        case 'dead':
          this.sysAll('💀 ' + e.name + ' a perdu la vie' + (m.c ? ' (' + cleanText(m.c) + ')' : ''));
          break;
        case 'pvp': {
          if (!this.rules.pvp) break;
          const d = Math.min(30, Math.max(0, num(m.d)));
          if (m.to === 0) {
            if (g.playerDim === rp.dim) g.player.damage(d, rp.x, rp.z, e.name);
          } else {
            const t = this.links.get(m.to);
            if (t && t.rp.seen && t.rp.dim === rp.dim && Math.hypot(t.rp.x - rp.x, t.rp.z - rp.z) < 8) t.rp.damage(d, rp.x, rp.z, e.name);
          }
          break;
        }
        case 'sleep':
          this.sysAll('💤 ' + e.name + ' est allé se coucher');
          break;
        case 'golem': {
          const x = m.x | 0, y = m.y | 0, z = m.z | 0;
          if (Math.hypot(x - rp.x, z - rp.z) < 16) g.spawnBuiltGolem(x, y, z);
          break;
        }
        case 'arrow': {
          // flèche tirée par un invité (arc)
          if (!Array.isArray(m.p) || !Array.isArray(m.v)) break;
          const [x, y, z] = m.p.map(num), v = m.v.map((a) => Math.max(-80, Math.min(80, num(a))));
          if (Math.hypot(x - rp.x, y - rp.y - 1.6, z - rp.z) > 4) break;
          g.entities.shootArrow(x, y, z, v[0], v[1], v[2], rp);
          break;
        }
        case 'cart': {
          if (!CM.CART_ITEMS[m.ty] || !Array.isArray(m.p)) break;
          const [x, y, z] = m.p.map(num);
          if (Math.hypot(x - rp.x, z - rp.z) < 10) g.entities.addCart(m.ty, x, y, z);
          break;
        }
        case 'hitcart': {
          const c = g.entities.cartByUid(m.id);
          if (c && Math.hypot(c.x - rp.x, c.z - rp.z) < 8) g.entities.hitCart(c, Math.min(20, Math.max(0, num(m.d))));
          break;
        }
        case 'ride': {
          const c = g.entities.cartByUid(m.id);
          if (c && Math.hypot(c.x - rp.x, c.z - rp.z) < 8 && g.entities.mount(c, e.pid)) break;
          e.link.send({ t: 'unride' });
          break;
        }
        case 'unride': {
          const c = (g.entities.carts || []).find((o) => o.rider === e.pid);
          if (c) c.rider = null;
          break;
        }
        case 'laser': {
          // tir de pistolet laser d'un invité (portée 32 blocs)
          const mob = g.entities.mobs.find((o) => o.uid === m.id);
          if (mob && !mob.dead && Math.hypot(mob.x - rp.x, mob.z - rp.z) < 40) g.entities.hurtMob(mob, Math.min(8, Math.max(0, num(m.d))), [rp.x, rp.z], false, rp);
          break;
        }
        case 'laserfx':
          if (Array.isArray(m.p) && Array.isArray(m.q)) this.fx({ k: 'laser', x: num(m.p[0]), y: num(m.p[1]), z: num(m.p[2]), t: m.q.map(num) }, e.pid);
          if (Array.isArray(m.p) && Array.isArray(m.q) && g.playerDim === rp.dim) g.player.laserFx(num(m.p[0]), num(m.p[1]), num(m.p[2]), num(m.q[0]), num(m.q[1]), num(m.q[2]));
          break;
        case 'crank': {
          const x = m.x | 0, y = m.y | 0, z = m.z | 0;
          if (CM.Tech && Math.hypot(x + 0.5 - rp.x, z + 0.5 - rp.z) < 8 && CM.blocks[g.world.get(x, y, z)].tech) CM.Tech.crank(g, x, y, z);
          break;
        }
        case 'meter': {
          const x = m.x | 0, y = m.y | 0, z = m.z | 0;
          const s = CM.Tech && Math.hypot(x + 0.5 - rp.x, z + 0.5 - rp.z) < 10 ? CM.Tech.info(g, x, y, z) : null;
          if (s) e.link.send({ t: 'meter', s });
          break;
        }
        case 'cpush': {
          // le passager invité pousse son wagonnet
          const c = (g.entities.carts || []).find((o) => o.rider === e.pid);
          if (c && Array.isArray(m.v)) c.push = [Math.max(-1, Math.min(1, num(m.v[0]))), Math.max(-1, Math.min(1, num(m.v[1])))];
          break;
        }
        case 'bye':
          this.dropClient(e, 'left');
          break;
      }
    }

    // Hôte : blocs modifiés par un invité (renvoyés à tous, y compris à l'auteur pour confirmation).
    clientSets(pid, b) {
      if (!Array.isArray(b)) return;
      const g = this.game, w = g.world;
      let fx = 6;
      for (let i = 0; i + 3 < b.length; i += 4) {
        const x = b[i] | 0, y = b[i + 1] | 0, z = b[i + 2] | 0, id = b[i + 3] | 0;
        this.queueSet(pid, x, y, z, id);
        if (id < 0 || id >= CM.ITEM_BASE || !CM.blocks[id] || y < CM.WORLD.MINY || y >= CM.WORLD.H) continue;
        const old = w.get(x, y, z);
        this.muted = true;
        w.applyRemote(x, y, z, id);
        this.muted = false;
        if (old !== id) g.onRemoteBlock(x, y, z, old, id, fx > 0, fx-- === 6);
      }
    }

    chestOpen(e, x, y, z) {
      const g = this.game;
      if (!CM.blocks[g.world.get(x, y, z)].container) return;
      const k = g.bkey(x, y, z);
      const by = this.locks.get(k);
      if (by !== undefined && by !== e.pid) {
        e.link.send({ t: 'cbusy', n: by === 0 ? this.name : (this.links.get(by) || {}).name || '?' });
        return;
      }
      this.lockSet(k, e.pid);
      e.link.send({ t: 'chest', k, s: g.chestAt(x, y, z) });
    }
    cartChestOpen(e, k) {
      const g = this.game, c = g.entities.cartByUid(Number(k.slice(1)));
      if (k[0] !== 'C' || !c || !c.slots || Math.hypot(c.x - e.rp.x, c.z - e.rp.z) > 8) return;
      const by = this.locks.get(k);
      if (by !== undefined && by !== e.pid) {
        e.link.send({ t: 'cbusy', n: by === 0 ? this.name : (this.links.get(by) || {}).name || '?' });
        return;
      }
      this.lockSet(k, e.pid);
      e.link.send({ t: 'chest', k, s: c.slots });
    }
    chestSet(e, k, s) {
      const g = this.game;
      if (this.locks.get(k) !== e.pid || !Array.isArray(s)) return;
      const arr = g.containerByKey(k);
      if (!arr) return;
      for (let i = 0; i < arr.length; i++) {
        const it = s[i];
        const id = it ? it.id | 0 : 0;
        if (!it || !CM.itemInfo(id) || !(it.count > 0)) arr[i] = null;
        else {
          arr[i] = { id, count: Math.min(it.count | 0, 999) };
          if (it.xp !== undefined) arr[i].xp = num(it.xp);
          const en = CM.cleanEnch(it.ench);
          if (en) arr[i].ench = en;
        }
      }
    }
    // Un coffre disparaît (cassé, explosion) : celui qui l'avait ouvert le referme.
    chestGone(k) {
      if (this.isHost) {
        const by = this.locks.get(k);
        this.locks.delete(k);
        if (by) this.sendTo(by, { t: 'cclose', k });
      }
      if (this.chestKey === k && this.game.ui.invOpen) {
        this.chestKey = null;
        this.game.ui.chest = null;
        this.game.ui.closeInventory();
      }
    }

    // Dégâts à un invité (depuis l'hôte).
    hurtRemote(rp, n, sx, sz, cause, bypass, vy, attacker) {
      if (!this.isHost) return;
      const m = { t: 'hurt', n, c: cause || '' };
      if (sx !== null && sx !== undefined) {
        m.sx = r2(sx);
        m.sz = r2(sz);
      }
      if (bypass) m.b = 1;
      if (vy) m.vy = r2(vy);
      if (attacker && attacker.uid) m.u = attacker.uid;
      this.sendTo(rp.pid, m);
    }
    // Hôte : un objet au sol ramassé par un invité.
    give(rp, d) {
      const m = { t: 'give', id: d.id, n: d.count };
      if (d.extra && d.extra.xp !== undefined) m.xp = d.extra.xp;
      if (d.extra && d.extra.ench) m.en = d.extra.ench;
      this.sendTo(rp.pid, m);
    }

    // --------------------------------------------- côté invité -------
    fromHost(m) {
      const g = this.game, w = g.world, p = g.player;
      switch (m.t) {
        case 'set': {
          const b = m.b;
          if (!Array.isArray(b) || (m.d | 0) !== this.dimId) break;
          const mine = m.o === this.pid;
          let fx = 6;
          for (let i = 0; i + 3 < b.length; i += 4) {
            const x = b[i], y = b[i + 1], z = b[i + 2], id = b[i + 3];
            const k = x + ',' + y + ',' + z;
            if (mine) {
              const n = (this.pending.get(k) || 0) - 1;
              if (n > 0) this.pending.set(k, n);
              else this.pending.delete(k);
              continue;
            }
            if (this.pending.has(k)) continue; // notre propre modification est plus récente
            const old = w.get(x, y, z);
            this.muted = true;
            w.applyRemote(x, y, z, id);
            this.muted = false;
            if (old !== id && fx > 0) g.netBlockFx(x, y, z, old, id, fx === 6);
            if (old !== id) fx--;
          }
          break;
        }
        case 'ps':
          for (const a of m.p || []) {
            let rp = this.remotes.get(a[0]);
            if (!rp) this.remotes.set(a[0], (rp = new RemotePlayer(this, a[0], '?')));
            rp.setState(a.slice(1));
          }
          break;
        case 'ent':
          g.entities.applySnapshot(m);
          break;
        case 'give': {
          const id = m.id | 0, n = m.n | 0;
          if (!CM.itemInfo(id) || n <= 0) break;
          const extra = netExtra(m);
          const left = g.inventory.add(id, n, extra);
          if (left < n) {
            CM.Audio.play('pop');
            g.onPickup(id, n - left);
          }
          if (left > 0) this.send({ t: 'drop', id, n: left, x: r2(p.x), y: r2(p.y + 0.6), z: r2(p.z), xp: m.xp, en: m.en, v: [0, 2, 0] });
          break;
        }
        case 'hurt':
          if (!p) break;
          const h0 = p.health;
          p.damage(num(m.n), m.sx === undefined ? null : m.sx, m.sz, m.c, !!m.b, m.u ? g.entities.mobs.find((o) => o.uid === m.u) : null);
          if (m.c === 'Une Ombre ardente' && p.health < h0) p.burning = Math.max(p.burning || 0, 4);
          if (m.vy && p.alive) p.vy += m.vy;
          break;
        case 'fx':
          this.onFx(m);
          break;
        case 'push':
          // poussé par un piston de l'hôte
          if (p && p.alive && Array.isArray(m.v)) {
            p.x += num(m.v[0]);
            p.y += num(m.v[1]) + (m.v[1] > 0 ? 0.05 : 0);
            p.z += num(m.v[2]);
            if (m.v[1] > 0) p.vy = Math.max(p.vy, 0);
          }
          break;
        case 'unride':
          if (p) p.riding = null;
          break;
        case 'meter':
          if (typeof m.s === 'string') g.ui.toast(m.s.slice(0, 300), 'info', 'meter');
          break;
        case 'dim': {
          // l'hôte nous envoie dans l'autre dimension (portail, ou réapparition après une mort)
          if (m.to !== 'nether' && m.to !== 'overworld') break;
          const at = Array.isArray(m.at) ? { x: num(m.at[0]), y: num(m.at[1]), z: num(m.at[2]) } : null;
          if (!at) break;
          this.pending.clear();
          g.changeDim(m.to, { at, edits: m.e && typeof m.e === 'object' ? m.e : {}, quiet: !!m.r, then: m.r ? () => g.player.respawn() : null });
          break;
        }
        case 'time': {
          const d = m.d | 0;
          if (d > g.dayCount) g.ui.toast('Jour ' + (d + 1) + ' — tu as survécu à la nuit !', 'good');
          g.dayCount = d;
          g.time = num(m.ti);
          this.dayLen = num(m.l) || this.dayLen;
          break;
        }
        case 'cfg':
          this.applyRules(m.rules);
          this.dayLen = num(m.l) || this.dayLen;
          if (m.diff && m.diff !== g.difficulty) {
            g.difficulty = m.diff;
            g.ui.toast('L’hôte a changé la difficulté', 'info');
          }
          if (m.mode && m.mode !== g.mode) {
            g.setMode(m.mode);
            g.ui.worldStarted();
          }
          break;
        case 'chest':
          if (!g.player.alive || g.ui.invOpen) {
            this.send({ t: 'cc', k: m.k });
            break;
          }
          this.chestKey = m.k;
          {
            const n = Array.isArray(m.s) ? Math.min(27, Math.max(1, m.s.length)) : 27;
            g.ui.openChest(Array.isArray(m.s) ? m.s.slice(0, n).map((s) => (s && CM.itemInfo(s.id) ? s : null)) : new Array(n).fill(null), this.chestTitle);
            while (g.ui.chest.length < n) g.ui.chest.push(null);
          }
          break;
        case 'cbusy':
          g.ui.toast('Ce coffre est déjà ouvert par ' + m.n, 'warn', 'cbusy');
          break;
        case 'cclose':
          if (this.chestKey === m.k) {
            this.chestKey = null;
            g.ui.chest = null;
            g.ui.closeInventory();
          }
          break;
        case 'note': {
          const x = m.x | 0, y = m.y | 0, z = m.z | 0;
          g.noteBlocks[g.bkey(x, y, z)] = m.n | 0;
          g.noteFx(x, y, z, m.n | 0);
          break;
        }
        case 'kill':
          g.stats.kills[m.ty] = (g.stats.kills[m.ty] || 0) + 1;
          if (p) p.addXp(Math.min(20, m.xp | 0));
          break;
        case 'chat':
          this.addChat(m.n, m.s);
          break;
        case 'sys':
          this.sys(m.s);
          break;
        case 'cr':
          // réponse d'une commande, ou ligne pour tous (/moi, /dé…)
          if (typeof m.s === 'string') CM.Commands.print(m.s.replace(/[\u0000-\u001f]/g, ' ').slice(0, 600), ['ok', 'err', 'info', 'msg', 'me', 'ann'].includes(m.k) ? m.k : 'info');
          break;
        case 'act':
          // une commande nous vise (objets, soins, téléportation…)
          if (m.a && typeof m.a === 'object') CM.Commands.apply(m.a);
          break;
        case 'ann':
          if (typeof m.s === 'string') CM.Commands.ann(m.s);
          break;
        case 'wx':
          if (CM.Weather.NAMES[m.w]) {
            if (m.n && m.w !== (g.weather && g.weather.type)) CM.Weather.announce(g, m.w);
            g.weather = { type: m.w, t: num(m.d) };
          }
          break;
        case 'join':
          this.remotes.set(m.pid, new RemotePlayer(this, m.pid, cleanName(m.n)));
          this.sys(cleanName(m.n) + ' a rejoint la partie');
          break;
        case 'leave': {
          const rp = this.remotes.get(m.pid);
          this.remotes.delete(m.pid);
          if (rp) this.sys(rp.name + ' a quitté la partie');
          break;
        }
        case 'bye':
          this.lost(m.r || 'L’hôte a fermé la partie.');
          break;
      }
    }

    onFx(m) {
      const g = this.game, p = g.player, e = g.entities;
      const d = Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z);
      if (m.k === 'boom') {
        if (d < 64) g.explodeFx(m.x, m.y, m.z);
      } else if (m.k === 'fuse') {
        if (d < 24) CM.Audio.play('fuse');
      } else if (m.k === 'kill') {
        if (d < 48) e.killFx(m.ty, m.x, m.y, m.z);
      } else if (m.k === 'zap' && Array.isArray(m.t)) {
        if (d < 48 && CM.Tech) CM.Tech.zapFx(g, m.x, m.y, m.z, num(m.t[0]), num(m.t[1]), num(m.t[2]));
      } else if (m.k === 'laser' && Array.isArray(m.t)) {
        if (d < 64) g.player.laserFx(m.x, m.y, m.z, num(m.t[0]), num(m.t[1]), num(m.t[2]));
      } else if (m.k === 'bolt') {
        if (d < 400) CM.Weather.boltFx(g, m.x, m.y, m.z);
      } else if (m.k === 'love') {
        if (d < 40) e.burst(CM.Textures.layer.heart, m.x, m.y + 0.2, m.z, Math.min(10, m.n | 0) || 6, { speed: 0.6, grav: -1.2, life: 1, size: 0.12, spread: 0.4, emissive: true, full: true });
      }
    }

    // Actions de l'invité transmises à l'hôte.
    hitMob(mob, dmg, opts) {
      const m = { t: 'hit', id: mob.uid, d: r2(dmg) };
      if (opts) {
        if (opts.kb) m.kb = opts.kb;
        if (opts.fire) m.fi = opts.fire;
        if (opts.loot) m.lo = opts.loot;
      }
      this.send(m);
    }
    feedMob(mob) {
      this.send({ t: 'feed', id: mob.uid });
    }
    requestDrop(id, count, x, y, z, extra, vel) {
      const m = { t: 'drop', id, n: count, x: r2(x), y: r2(y), z: r2(z) };
      if (extra && extra.xp !== undefined) m.xp = extra.xp;
      if (extra && extra.ench) m.en = extra.ench;
      if (vel) m.v = vel.map(r2);
      this.send(m);
    }
    requestTnt(x, y, z, fuse) {
      this.send({ t: 'tnt', x, y, z, f: fuse });
    }
    noteChanged(x, y, z, n) {
      if (this.isClient) this.send({ t: 'note', x, y, z, n });
      else if (this.isHost) this.toDim({ t: 'note', x, y, z, n }, this.game.dim);
    }
    sleepChanged(on) {
      if (!this.active || !on) return;
      if (this.isClient) this.send({ t: 'sleep' });
      else this.sysAll('💤 ' + this.name + ' est allé se coucher');
    }
    died(cause) {
      const txt = this.name + ' a perdu la vie' + (cause ? ' (' + cause + ')' : '');
      if (this.isClient) this.send({ t: 'dead', c: cause || '' });
      else if (this.isHost) this.sysAll('💀 ' + txt);
    }
    // Hôte : envoie un invité seul dans l'autre dimension. opts.from : portail de départ
    // (portail d'arrivée trouvé ou construit) ; opts.at : point d'arrivée imposé.
    travelGuest(e, to, opts) {
      const g = this.game, rp = e.rp;
      let dest = opts.at || null;
      g.withDim(to, () => {
        const w = g.world;
        if (dest) {
          w.loadAround(dest.x, dest.z, 1);
          return;
        }
        const k = to === 'nether' ? 1 / 8 : 8;
        const tx = Math.floor(opts.from[0] * k), tz = Math.floor(opts.from[2] * k);
        w.loadAround(tx, tz, 2);
        dest = g.findPortal(w, tx, tz, to === 'nether' ? 16 : 128) || g.buildPortal(w, tx, opts.from[1], tz, opts.axis || 0);
      });
      rp.dim = to;
      rp.x = rp.rx = dest.x;
      rp.y = rp.ry = dest.y;
      rp.z = rp.rz = dest.z;
      e.link.send({ t: 'dim', to, e: g.worlds[to].editsObject(), at: [r2(dest.x), r2(dest.y), r2(dest.z)], r: opts.respawn ? 1 : 0 });
      if (!opts.respawn) this.sysAll('🌀 ' + e.name + (to === 'nether' ? ' est parti dans le Nether' : ' est revenu dans le monde normal'));
    }
    // Invité mort dans le Nether : on attend que l'hôte nous renvoie le monde normal.
    requestRespawn(rs) {
      const g = this.game;
      g.state = 'loading';
      g.ui.show('loading');
      $('load-text').textContent = 'Retour dans le monde normal…';
      $('load-fill').style.width = '0%';
      this.send({ t: 'respawn', at: [r2(rs.x), r2(rs.y), r2(rs.z)] });
    }

    // Ouvre un coffre partagé.
    // (ck : clé d'un coffre de wagonnet, à la place des coordonnées)
    openChest(x, y, z, title, ck) {
      const g = this.game, k = ck || g.bkey(x, y, z);
      if (this.isClient) {
        this.chestTitle = title;
        this.send(ck ? { t: 'co', k: ck } : { t: 'co', x, y, z });
        return;
      }
      const by = this.locks.get(k);
      if (by !== undefined && by !== 0) {
        g.ui.toast('Ce coffre est déjà ouvert par ' + ((this.links.get(by) || {}).name || '?'), 'warn', 'cbusy');
        return;
      }
      const slots = ck ? g.containerByKey(ck) : g.chestAt(x, y, z);
      if (!slots) return;
      this.lockSet(k, 0);
      this.chestKey = k;
      g.ui.openChest(slots, title);
    }
    lockSet(k, pid) {
      this.locks.set(k, pid);
      this.game.chestViewers(k, 1);
    }
    lockDel(k) {
      if (!this.locks.has(k)) return;
      this.locks.delete(k);
      this.game.chestViewers(k, 0);
    }
    chestChanged() {
      if (this.isClient && this.chestKey) this.chestDirty = true;
    }
    chestClosed() {
      if (!this.chestKey) return;
      if (this.isClient) {
        if (this.game.ui.chest) this.send({ t: 'cs', k: this.chestKey, s: this.game.ui.chest });
        this.send({ t: 'cc', k: this.chestKey });
      } else if (this.isHost && this.locks.get(this.chestKey) === 0) this.lockDel(this.chestKey);
      this.chestKey = null;
      this.chestDirty = false;
    }

    // Combat entre joueurs (si l'hôte l'a autorisé).
    raycastPlayer(e, d, maxD) {
      if (!this.rules.pvp) return null;
      let best = null, bestT = maxD;
      for (const rp of this.remotes.values()) {
        if (!rp.seen || !rp.alive || rp.dim !== this.game.playerDim) continue;
        const t = CM.rayBox(e[0], e[1], e[2], d[0], d[1], d[2], rp.x - 0.3, rp.y, rp.z - 0.3, rp.x + 0.3, rp.y + 1.8, rp.z + 0.3);
        if (t >= 0 && t < bestT) {
          bestT = t;
          best = rp;
        }
      }
      return best ? { rp: best, t: bestT } : null;
    }
    pvpHit(rp, dmg) {
      const p = this.game.player;
      if (this.isHost) rp.damage(dmg, p.x, p.z, this.name);
      else this.send({ t: 'pvp', to: rp.pid, d: r2(dmg) });
    }

    // ------------------------------------------------------ tchat ----
    bindUI() {
      this.chatEl = $('chat');
      this.chatIn = $('chat-input');
      this.suggEl = $('chat-sugg');
      this.tagsEl = $('tags');
      this.hist = []; // messages et commandes déjà envoyés (↑ ↓)
      this.histI = 0;
      this.chatIn.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          const s = cleanText(this.chatIn.value);
          this.chatIn.value = '';
          if (s) {
            if (this.hist[this.hist.length - 1] !== s) this.hist.push(s);
            if (this.hist.length > 50) this.hist.shift();
          }
          this.closeChat(true);
          if (s) this.say(s);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.closeChat(false);
        } else if (e.key === 'Tab') {
          // complète la commande (appuis suivants : suggestion suivante)
          e.preventDefault();
          const v = this.chatIn.value;
          if (this.tab && this.tab.last === v) this.tab.i = (this.tab.i + 1) % this.tab.items.length;
          else {
            const r = CM.Commands.complete(v);
            if (!r || !r.items.length) return;
            this.tab = { items: r.items, i: 0 };
          }
          this.chatIn.value = this.tab.last = this.tab.items[this.tab.i].text;
          this.suggest(this.tab.i);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          if (!this.hist.length) return;
          e.preventDefault();
          this.histI = Math.max(0, Math.min(this.hist.length, this.histI + (e.key === 'ArrowUp' ? -1 : 1)));
          this.chatIn.value = this.hist[this.histI] || '';
          this.suggest();
        }
      });
      this.chatIn.addEventListener('input', () => {
        this.tab = null;
        this.suggest();
      });
      // clic / toucher sur une suggestion : complète (sans quitter la saisie)
      this.suggEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const d = e.target.closest && e.target.closest('.sg');
        const it = d && this.suggItems && this.suggItems[+d.dataset.i];
        if (it) this.chatIn.value = it.text;
        this.tab = null;
        this.chatIn.focus();
        setTimeout(() => this.suggest(), 0);
      });
      // la saisie perd le focus (clic ailleurs, toucher sur l'écran…) : on ferme le tchat,
      // sinon il resterait affiché et les touches du jeu ne répondraient plus
      this.chatIn.addEventListener('blur', () => {
        setTimeout(() => {
          if (this.chatOpen && document.activeElement !== this.chatIn && document.hasFocus()) this.closeChat(false);
        }, 0);
      });
      $('t-chat').addEventListener('click', (e) => {
        e.preventDefault();
        if (this.chatOpen) this.closeChat(false);
        else this.openChat();
      });
    }
    // Tchat (aussi en solo, pour les commandes). prefill : texte déjà tapé (« / »).
    openChat(prefill) {
      const g = this.game;
      if (g.state !== 'playing' || g.ui.invOpen || this.chatOpen) return;
      this.chatOpen = true;
      g.clearInput();
      if (g.touch.enabled) g.touch.reset();
      this.chatEl.classList.add('open');
      this.chatIn.placeholder = this.active ? 'Message, ou commande (/aide) — Entrée pour envoyer, Tab pour compléter' : 'Commande (/aide pour la liste) — Entrée pour valider, Tab pour compléter';
      this.chatIn.value = prefill || '';
      this.chatIn.classList.remove('hidden');
      this.histI = this.hist.length;
      this.tab = null;
      g.releaseMouse();
      this.chatIn.focus();
      this.suggest();
    }
    closeChat(sent, silent) {
      if (!this.chatOpen) return;
      this.chatOpen = false;
      this.chatIn.blur();
      this.chatIn.classList.add('hidden');
      this.chatEl.classList.remove('open');
      this.suggEl.classList.add('hidden');
      if (!silent && this.game.state === 'playing' && !this.game.paused) this.game.captureMouse();
    }
    // Suggestions sous la saisie (commandes, puis arguments : objets, joueurs, créatures…).
    suggest(sel) {
      const el = this.suggEl, r = this.chatOpen ? CM.Commands.complete(this.chatIn.value) : null;
      if (!r || (!r.items.length && !r.usage)) {
        el.classList.add('hidden');
        return;
      }
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      let h = r.usage ? '<div class="sg-usage">' + esc(r.usage) + '</div>' : '';
      r.items.forEach((it, i) => {
        h += '<div class="sg' + (i === sel ? ' on' : '') + '" data-i="' + i + '"><b>' + esc(it.label) + '</b>' + (it.desc ? ' <span>' + esc(it.desc) + '</span>' : '') + '</div>';
      });
      if (r.more) h += '<div class="sg-more">… et ' + r.more + ' autre' + (r.more > 1 ? 's' : '') + ' (continue à taper)</div>';
      el.innerHTML = h;
      el.classList.remove('hidden');
      this.suggItems = r.items;
    }
    say(s) {
      // « / » : commande
      if (s[0] === '/') {
        CM.Commands.run(s);
        return;
      }
      if (!this.active) {
        this.addChat('Toi', s);
        return;
      }
      if (this.isHost) this.chatAll(this.name, s);
      else this.send({ t: 'chat', s });
    }
    chatAll(name, s) {
      this.addChat(name, s);
      this.broadcast({ t: 'chat', n: name, s });
    }
    addChat(name, s) {
      const d = document.createElement('div');
      d.className = 'cl';
      const b = document.createElement('b');
      b.textContent = cleanName(name) + ' ';
      d.appendChild(b);
      d.appendChild(document.createTextNode(cleanText(s)));
      this.pushLine(d);
      CM.Audio.play('click');
    }
    sys(s) {
      const d = document.createElement('div');
      d.className = 'cl sys';
      d.textContent = cleanText(s);
      this.pushLine(d);
    }
    sysAll(s) {
      this.sys(s);
      this.broadcast({ t: 'sys', s });
    }
    pushLine(d) {
      this.chatEl.appendChild(d);
      while (this.chatEl.children.length > 40) this.chatEl.removeChild(this.chatEl.firstChild);
      setTimeout(() => d.classList.add('old'), 10000);
    }
    playersHTML() {
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      const g = this.game, nth = (d) => (d === 'nether' ? ' · Nether' : '');
      const host = this.isHost ? null : this.remotes.get(0);
      const list = [(this.isHost ? this.name : this.hostName) + ' (hôte' + nth(this.isHost ? g.playerDim : host && host.dim) + ')'];
      if (this.isClient) list.push(this.name + ' (toi' + nth(g.playerDim) + ')');
      for (const rp of this.remotes.values()) if (rp.pid !== 0) list.push(rp.name + (rp.dim === 'nether' ? ' (Nether)' : ''));
      return 'Multijoueur — code <b>' + this.code + '</b>' + (this.rules.pvp ? ' · combats entre joueurs activés' : '') + '<br>Joueurs : ' + list.map(esc).join(', ');
    }

    // ------------------------------------------------------ rendu ----
    renderPlayers(batch) {
      if (!this.active) return;
      const L = CM.Textures.layer, ents = this.game.entities, mat4 = CM.mat4;
      const head = [L.player_head, L.player_head, L.player_hair, L.skin, L.player_hair, L.player_face];
      const me = this.game.player;
      for (const rp of this.remotes.values()) {
        if (!rp.seen || !rp.alive || rp.dim !== this.game.playerDim) continue;
        // caméra à l'intérieur du personnage (même point d'apparition) : on ne le dessine pas
        if (Math.hypot(rp.rx - me.x, rp.rz - me.z) < 0.5 && Math.abs(rp.ry - me.y) < 1.8) continue;
        const l = ents.lightAt(rp.rx, rp.ry + 1.2, rp.rz);
        const fl = rp.flags & 16 ? 2 : 0;
        const sneak = rp.flags & 1;
        const M = this.M;
        mat4.compose(M, rp.rx, rp.ry - (sneak ? 0.12 : 0), rp.rz, rp.ryaw, 0, 0, 1);
        const sw = rp.moving ? Math.sin(rp.walk) : 0;
        const shirt = L['concrete_' + rp.shirt] || L.sleeve;
        // (rotation autour de x : positif = vers l'avant pour un membre qui pend)
        ents.part(batch, M, -0.12, 0.7, 0, sw * 0.7, [-0.12, -0.7, -0.12, 0.12, 0, 0.12], L.player_pants, l, fl);
        ents.part(batch, M, 0.12, 0.7, 0, -sw * 0.7, [-0.12, -0.7, -0.12, 0.12, 0, 0.12], L.player_pants, l, fl);
        // corps (penché quand il est accroupi), tête qui suit le regard
        const lean = sneak ? 0.4 : 0;
        ents.part(batch, M, 0, 0.7, 0, -lean, [-0.25, 0, -0.13, 0.25, 0.65, 0.13], shirt, l, fl);
        const ny = 0.7 + 0.65 * Math.cos(lean), nz = -0.65 * Math.sin(lean);
        ents.part(batch, M, 0, ny, nz, CM.clamp(rp.pitch, -1.2, 1.2) * 0.8, [-0.22, 0, -0.22, 0.22, 0.44, 0.22], head, l, fl);
        // bras (le droit frappe, et avance un peu quand il tient quelque chose)
        const swing = rp.swingT > 0 ? 1.3 * Math.sin((1 - rp.swingT / 0.3) * Math.PI) : 0;
        const sy = ny - 0.02, sz = nz * 0.9;
        const arms = [[-0.36, rp.blocking ? 1.1 : -sw * 0.6 + (rp.offhand ? 0.3 : 0)], [0.36, sw * 0.6 + swing + (rp.held ? 0.3 : 0)]];
        for (const [ax, rot] of arms) {
          ents.part(batch, M, ax, sy, sz, rot, [-0.11, -0.24, -0.11, 0.11, 0.04, 0.11], shirt, l, fl);
          ents.part(batch, M, ax, sy, sz, rot, [-0.1, -0.62, -0.1, 0.1, -0.24, 0.1], L.skin, l, fl);
        }
        // armure portée : coques un peu plus grandes que chaque partie du corps
        const am = (k) => {
          const i = Math.floor(rp.armor / 6 ** k) % 6;
          return i ? L['armor_skin_' + CM.ARMOR_MATS[i - 1].key.toLowerCase()] : null;
        };
        const helm = am(0), chest = am(1), legs = am(2), boots = am(3);
        if (helm) ents.part(batch, M, 0, ny, nz, CM.clamp(rp.pitch, -1.2, 1.2) * 0.8, [-0.25, 0.28, -0.25, 0.25, 0.48, 0.25], helm, l, fl);
        if (chest) {
          ents.part(batch, M, 0, 0.7, 0, -lean, [-0.27, 0.06, -0.15, 0.27, 0.67, 0.15], chest, l, fl);
          for (const [ax, rot] of arms) ents.part(batch, M, ax, sy, sz, rot, [-0.13, -0.27, -0.13, 0.13, 0.06, 0.13], chest, l, fl);
        }
        for (const [lx, rot] of [[-0.12, sw * 0.7], [0.12, -sw * 0.7]]) {
          if (legs) ents.part(batch, M, lx, 0.7, 0, rot, [-0.135, -0.48, -0.135, 0.135, 0.02, 0.135], legs, l, fl);
          if (boots) ents.part(batch, M, lx, 0.7, 0, rot, [-0.14, -0.71, -0.14, 0.14, -0.5, 0.14], boots, l, fl);
        }
        if (legs) ents.part(batch, M, 0, 0.7, 0, -lean, [-0.265, -0.02, -0.145, 0.265, 0.1, 0.145], legs, l, fl);
        // main secondaire (gauche) : bouclier ou objet
        const oinfo = rp.offhand ? CM.itemInfo(rp.offhand) : null;
        if (oinfo && oinfo.type === 'shield') {
          mat4.compose(this.P, -0.36, sy, sz, 0, arms[0][1], 0, 1);
          mat4.multiply(this.R, M, this.P);
          mat4.compose(this.P, -0.08, -0.5, -0.16, rp.blocking ? 0.2 : 1.45, -Math.PI / 2, 0, 1);
          mat4.multiply(this.Q, this.R, this.P);
          const e = L.shield_edge;
          batch.box(this.Q, -0.24, -0.34, -0.03, 0.24, 0.34, 0.03, [e, e, e, e, L.shield_back, L.shield_face], l[0], l[1], 0);
        } else if (oinfo) {
          mat4.compose(this.P, -0.36, sy, sz, 0, arms[0][1], 0, 1);
          mat4.multiply(this.R, M, this.P);
          const layer = oinfo.isBlock ? CM.blockLayers[rp.offhand][0] : L[oinfo.tex];
          mat4.compose(this.P, 0, -0.6, -0.02, -Math.PI * 0.75, Math.PI, Math.PI / 2, 1);
          mat4.multiply(this.Q, this.R, this.P);
          batch.box(this.Q, -0.22, -0.12, 0, 0.22, 0.5, 0, [-1, -1, -1, -1, layer, -1], l[0], l[1], oinfo.isBlock && oinfo.block.light ? 1 : 0);
        }
        // objet tenu, dans la main droite
        const info = rp.held ? CM.itemInfo(rp.held) : null;
        if (info) {
          mat4.compose(this.P, 0.36, sy, sz, 0, arms[1][1], 0, 1);
          mat4.multiply(this.R, M, this.P);
          const r = info.isBlock ? info.block.render : '';
          const emi = info.isBlock && info.block.light ? 1 : 0;
          if (r === 'cube' || r === 'glass' || r === 'tglass' || r === 'slab' || r === 'carpet') {
            mat4.compose(this.P, 0, -0.78, -0.1, 0.4, 0, 0, 1);
            mat4.multiply(this.Q, this.R, this.P);
            ents.drawItem(batch, this.Q, rp.held, l, 0.26);
          } else {
            // plaque tenue vers l'avant, tournée de 45° pour être visible de face comme de profil
            const layer = info.isBlock ? CM.blockLayers[rp.held][0] : L[info.tex];
            mat4.compose(this.P, 0, -0.6, -0.02, -Math.PI * 0.75, Math.PI, Math.PI / 2, 1);
            mat4.multiply(this.Q, this.R, this.P);
            batch.box(this.Q, -0.27, -0.14, 0, 0.27, 0.62, 0, [-1, -1, -1, -1, layer, -1], l[0], l[1], emi);
          }
        }
      }
    }
    // Pseudos au-dessus des têtes (éléments HTML placés sur l'écran).
    updateTags(cam) {
      if (!this.active) return;
      const vp = this.game.renderer.viewProj;
      const W = this.game.canvas.clientWidth, H = this.game.canvas.clientHeight;
      for (const [pid, el] of this.tags) {
        if (!this.remotes.has(pid)) {
          el.remove();
          this.tags.delete(pid);
        }
      }
      for (const rp of this.remotes.values()) {
        let el = this.tags.get(rp.pid);
        if (!el) {
          el = document.createElement('div');
          el.className = 'tag';
          this.tagsEl.appendChild(el);
          this.tags.set(rp.pid, el);
        }
        if (el.textContent !== rp.name) el.textContent = rp.name;
        let show = rp.seen && rp.alive && rp.dim === this.game.playerDim;
        if (show) {
          const x = rp.rx - cam[0], y = rp.ry + (rp.flags & 1 ? 1.85 : 2.05) - cam[1], z = rp.rz - cam[2];
          const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
          const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
          const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
          if (cw < 0.1 || Math.hypot(x, y, z) > 72) show = false;
          else {
            el.style.transform = 'translate(' + Math.round(((cx / cw + 1) / 2) * W) + 'px,' + Math.round(((1 - cy / cw) / 2) * H) + 'px) translate(-50%, -100%)';
            el.style.opacity = rp.flags & 1 ? 0.35 : 1;
          }
        }
        el.style.display = show ? '' : 'none';
      }
    }
  }

  CM.Net = Net;
  CM.RemotePlayer = RemotePlayer;
})();
