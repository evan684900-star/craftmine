'use strict';
// Boucle de jeu, cycle jour/nuit, sauvegarde, entrées et menus.
(function () {
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'craftmine_save_v2';
  const OPT_KEY = 'craftmine_options_v1';
  const SAVE_VERSION = 4;
  const B = CM.B;

  // Réglages par défaut (modifiables dans Options).
  CM.DEFAULT_BINDS = {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sprint: 'ShiftLeft',
    sneak: 'KeyC', dash: 'KeyF', inventory: 'KeyE', drop: 'KeyQ', swap: 'KeyX',
  };
  CM.DEFAULT_OPTIONS = {
    // graphismes
    renderDist: 8, fov: 75, dynFov: true, brightness: 30, clouds: true, smoothLight: true, waving: true, realLight: true, halos: true,
    particles: 2, viewBob: true, showHand: true, resolution: 100, maxFps: 0,
    // contrôles
    sens: 1, invertY: false, toggleSprint: false, autoJump: false, binds: null,
    // jeu
    showQuests: true, keepInventory: false, fireSpread: true, dayLength: 10, autosave: 45, toasts: 2,
    // audio
    volume: 50, sfxVolume: 100, mobVolume: 100, uiVolume: 100,
    // interface
    guiScale: 100, crosshair: 'cross', showCoords: false, showFps: false, showBiome: true, itemNames: true,
    // écran tactile
    touchControls: 'auto', touchSens: 1, touchSize: 100, touchAim: 'finger', touchOpacity: 100, touchLayout: null,
    // multijoueur
    netName: '',
  };
  // Réglages plus légers pour les téléphones et tablettes.
  CM.applyMobileDefaults = function (o) {
    Object.assign(o, { renderDist: 5, resolution: 75, particles: 1, guiScale: 85, autoJump: true });
  };

  function storageGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function storageSet(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch (e) {
      return false;
    }
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // Graine vraiment aléatoire (et non Math.random seul).
  function randomSeed() {
    try {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % 4000000000;
    } catch (e) {
      return Math.floor((Math.random() * 1e9 + Date.now()) % 4e9);
    }
  }

  const KEY_NAMES = {
    Space: 'Espace', ShiftLeft: 'Maj gauche', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl gauche', ControlRight: 'Ctrl droit',
    AltLeft: 'Alt', AltRight: 'Alt Gr', Tab: 'Tab', CapsLock: 'Verr. maj', Enter: 'Entrée', Backspace: 'Retour',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };

  class Game {
    constructor() {
      this.canvas = $('game');
      const savedTxt = storageGet(OPT_KEY);
      const saved = JSON.parse(savedTxt || '{}');
      this.options = Object.assign({}, CM.DEFAULT_OPTIONS, saved);
      // premier lancement sur téléphone : réglages allégés
      if (!savedTxt && CM.isTouchDevice()) CM.applyMobileDefaults(this.options);
      this.binds = Object.assign({}, CM.DEFAULT_BINDS, this.options.binds || {});
      this.mode = 'survival';
      this.difficulty = 'normal';
      CM.Textures.buildIcons();
      CM.Mesher.init();
      this.renderer = new CM.Renderer(this.canvas);
      this.input = { keys: {}, pressed: {}, mouse: [false, false, false] };
      this.noInput = { keys: {}, pressed: {}, mouse: [false, false, false] };
      this.state = 'menu';
      this.paused = false;
      this.locked = false;
      this.forceInput = false;
      this.clock = 0;
      this.fovCur = this.options.fov;
      this.fps = 60;
      this.last = performance.now();
      this.stats = this.freshStats();
      this.inventory = new CM.Inventory();
      this.inventory.onChange = () => {
        this.inventory.netDirty = true;
        if (!this.ui) return;
        this.ui.dirtyInv = true;
        if (this.ui.chest) this.net.chestChanged();
      };
      this.ui = new CM.UI(this);
      this.touch = new CM.Touch(this);
      this.net = new CM.Net(this);
      this.applyOptions();
      this.batch = new CM.Batch();
      this.overlay = new CM.Batch();
      this.hand = new CM.Batch();
      this.translucent = new CM.Batch();
      this.bindInput();
      this.bindMenus();
      this.refreshMenu();
      requestAnimationFrame((t) => this.frame(t));
    }

    freshStats() {
      return { mined: {}, placed: {}, crafted: {}, kills: {}, deaths: 0, grapples: 0, playTime: 0 };
    }
    crafted(id) {
      return (this.stats.crafted[id] || 0) > 0;
    }
    keyName(code) {
      if (!code) return '—';
      if (KEY_NAMES[code]) return KEY_NAMES[code];
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      if (code.startsWith('Numpad')) return 'Pavé ' + code.slice(6);
      return code;
    }

    // ------------------------------------------------------- options -----
    applyOptions() {
      const o = this.options;
      const r = this.renderer;
      r.renderDist = o.renderDist;
      r.resolution = o.resolution / 100;
      r.brightness = o.brightness / 100;
      r.clouds = o.clouds;
      const mo = CM.Mesher.opts;
      if (mo.smoothLight !== o.smoothLight || mo.waving !== o.waving) {
        mo.smoothLight = o.smoothLight;
        mo.waving = o.waving;
        this.remeshAll();
      }
      CM.Audio.setVolume(o.volume / 100);
      CM.Audio.cat = { sfx: o.sfxVolume / 100, mob: o.mobVolume / 100, ui: o.uiVolume / 100 };
      $('objective').classList.toggle('hidden', !o.showQuests);
      document.documentElement.style.setProperty('--gui', String(o.guiScale / 100));
      $('crosshair').className = 'ch-' + o.crosshair;
      document.documentElement.style.setProperty('--tsize', String(o.touchSize / 100));
      if (this.touch) this.touch.applyLayout();
      const touchOn = o.touchControls === 'on' || (o.touchControls === 'auto' && CM.isTouchDevice());
      if (this.touch && touchOn !== this.touch.enabled) {
        this.touch.setEnabled(touchOn);
        if (touchOn && this.state === 'playing') this.forceInput = true;
        if (!touchOn && !this.autostart) this.forceInput = false;
      }
      o.binds = Object.assign({}, this.binds);
      storageSet(OPT_KEY, JSON.stringify(o));
      if (this.ui) this.ui.optionsChanged();
      if (this.net && this.net.isHost) this.net.sendCfg();
    }
    remeshAll() {
      if (!this.world) return;
      for (const k of this.renderer.sections.keys()) this.world.dirty.set(k, 1);
    }
    get dayLen() {
      if (this.net && this.net.isClient && this.net.dayLen) return this.net.dayLen;
      return Math.max(1, this.options.dayLength) * 60;
    }
    // Garder l'inventaire à la mort : option du joueur, ou de l'hôte en multijoueur.
    keepInventory() {
      return this.net.isClient ? this.net.rules.keep : !!this.options.keepInventory;
    }

    // ------------------------------------------------ démarrage monde -----
    async startWorld(seed, save, settings) {
      this.ui.hide('menu');
      this.ui.hide('newworld');
      this.ui.hide('multi');
      this.ui.show('loading');
      $('load-fill').style.width = '0%';
      await new Promise((r) => setTimeout(r, 30));
      this.renderer.freeAll();
      const ws = Object.assign({ mode: 'survival', difficulty: 'normal', type: 'normal', biomeSize: 'normal', bonusChest: false, dayCycle: true, gen: 5 }, (save && save.settings) || settings || {});
      // monde créé avant la version 4 : on garde l'ancien relief (les bases restent intactes)
      if (save && (save.v || 2) < 4) ws.gen = 1;
      this.settings = ws;
      this.mode = ws.mode;
      this.difficulty = ws.difficulty;
      // deux mondes : le monde normal et le Nether (créé au premier voyage)
      this.worlds = { overworld: new CM.World(seed, save ? save.edits : null, ws) };
      // les modifications sont maintenant rangées avec les couches négatives : à noter dans la sauvegarde
      ws.ymin = this.worlds.overworld.settings.ymin;
      this.netherEdits = (save && save.nether && save.nether.edits) || null;
      this.netherArrival = (save && save.nether && save.nether.arrival) || null;
      this.dim = save && save.dim === 'nether' ? 'nether' : 'overworld';
      if (save && save.spawn) this.worlds.overworld.spawn = save.spawn;
      if (this.dim === 'nether') this.worlds.nether = this.makeNether();
      // contexte de la dimension du joueur (monde, créatures, blocs qui évoluent)
      this.ctxs = {};
      // wagonnets de chaque dimension (restaurés à l'ouverture de la dimension)
      this.dimCarts = (!this.net.isClient && save && save.carts && typeof save.carts === 'object' && save.carts) || {};
      this.dimDrops = {};
      this.useCtx(this.openCtx(this.dim));
      this.playerDim = this.dim;
      if (!this.net.isClient) this.net.guests = (save && save.guests) || {};
      this.golemHomes = (!this.net.isClient && save && Array.isArray(save.golems) && save.golems) || []; // golems construits par les joueurs
      this.animals = (!this.net.isClient && save && Array.isArray(save.animals) && save.animals.filter((a) => Array.isArray(a) && a.length >= 4)) || []; // élevage hors de portée
      this.stats = this.freshStats();
      this.time = 0.03;
      this.dayCount = 0;
      this.dawnHearts = [];
      this.victory = false;
      this.chests = new Map();
      this.noteBlocks = {};
      this.techData = {}; // extension Électricité : charge des batteries, combustible, progression
      // commandes : météo, maisons (/defmaison), dernière position (/retour), constructions (/annuler)
      this.weather = save && save.weather && CM.Weather.NAMES[save.weather.type] ? { type: save.weather.type, t: +save.weather.t || 0 } : { type: 'clear', t: 0 };
      this.wLevel = this.weather.type !== 'clear' ? 1 : 0;
      this.homes = (save && save.homes && typeof save.homes === 'object' && save.homes) || {};
      this.cmdBack = null;
      this.cmdUndo = null;
      this.bolts = null;
      this.inventory.slots = new Array(36).fill(null);
      this.inventory.armor = [null, null, null, null];
      this.inventory.offhand = null;
      this.inventory.selected = 0;
      const sp = save && save.player && isFinite(save.player.x) ? save.player : this.world.spawn;
      // génération des tronçons autour du point de départ
      const radius = this.renderer.renderDist + 1;
      let total = 0;
      for (;;) {
        const left = this.world.stream(sp.x, sp.z, radius, 40);
        if (!total) total = left + 1;
        $('load-text').textContent = 'Génération du monde…';
        $('load-fill').style.width = Math.round((1 - left / total) * 70) + '%';
        if (left <= 0) break;
        await new Promise((r) => setTimeout(r, 0));
      }
      if (this.dim === 'overworld') this.world.fixSpawn();
      this.world.dirty.clear();
      this.player = new CM.Player(this);
      if (save) {
        const v = save.v || 2;
        const p = save.player || {};
        Object.assign(this.player, {
          x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0, pitch: p.pitch || 0,
          health: p.health || 20,
          food: Number.isFinite(p.food) ? p.food : 20,
          sat: Number.isFinite(p.sat) ? p.sat : 5,
          flying: !!p.flying,
        });
        this.player.bed = Array.isArray(p.bed) ? p.bed : null;
        // pouvoirs donnés par commande (/vol, /invincible, /vitesse, /saut, /vision)
        if (p.cmd && typeof p.cmd === 'object') {
          const c = p.cmd;
          Object.assign(this.player, { cmdFly: !!c.f, cmdGod: !!c.g, cmdSpeed: Math.max(0.1, Math.min(10, +c.s || 1)), cmdJump: Math.max(0, Math.min(10, c.j | 0)), nightVision: !!c.n });
        }
        this.player.xpTotal = Math.max(0, p.xp | 0);
        if (Number.isFinite(p.enchSeed)) this.player.enchSeed = p.enchSeed >>> 0;
        this.player.fallStart = this.player.y;
        this.inventory.load(save.inv, v);
        this.time = save.time || 0.03;
        this.dayCount = save.dayCount || 0;
        this.stats = Object.assign(this.freshStats(), migrateStats(save.stats || {}, v));
        this.dawnHearts = save.dawnHearts || [];
        this.victory = !!save.victory;
        this.noteBlocks = save.noteBlocks || {};
        this.techData = (save.tech && typeof save.tech === 'object' && save.tech) || {};
        for (const k in save.chests || {}) {
          this.chests.set(k, save.chests[k].map((s) => {
            if (!s) return null;
            const id = CM.migrateId(s.id, v);
            return CM.itemInfo(id) ? Object.assign({}, s, { id }) : null;
          }));
        }
      } else if (ws.bonusChest) this.placeBonusChest();
      if (!save && ws.mode === 'creative') this.player.flying = false;
      this.inventory.changed();
      if (!this.net.isClient && this.dim === 'overworld') this.spawnInitialMobs();
      // pré-construction des maillages autour du joueur
      $('load-text').textContent = 'Construction du paysage…';
      total = 0;
      for (;;) {
        const left = this.renderer.updateMeshes(this.world, this.player.x, this.player.z, 40);
        if (!total) total = left + 1;
        $('load-fill').style.width = Math.round(70 + (1 - left / total) * 30) + '%';
        if (left <= 0) break;
        await new Promise((r) => setTimeout(r, 0));
      }
      this.ui.hide('loading');
      this.state = 'playing';
      this.paused = false;
      this.saveTimer = this.options.autosave;
      this.ui.show('hud');
      this.ui.worldStarted();
      document.body.classList.add('ingame');
      if (this.autostart) {
        this.forceInput = true;
      } else if (this.touch.enabled) {
        // écran tactile : pas de verrouillage du pointeur, on joue directement
        this.forceInput = true;
        this.ui.showTouchHint();
      } else this.ui.show('start');
      this.net.worldReady();
      if (save && save.v < 4) setTimeout(() => this.ui.toast('Nouvelle version : plus de 500 blocs, la faim remplace l’endurance, mode créatif…', 'gold'), 800);
    }

    // ------------------------------------------------------ dimensions --
    makeNether(edits) {
      const ws = Object.assign({}, this.settings, { type: 'nether', ymin: CM.WORLD.MINY });
      return new CM.World(this.worlds.overworld.seed, edits !== undefined ? edits : this.netherEdits, ws);
    }
    // Chaque dimension simulée a son contexte : monde, créatures, blocs qui évoluent, repères.
    // Celui du joueur de cet écran est le contexte courant (this.world, this.entities…).
    // En multijoueur, l'hôte simule aussi l'autre dimension tant qu'un invité s'y trouve,
    // en basculant un instant sur son contexte (withDim).
    openCtx(dim) {
      const w = this.worlds[dim] || (this.worlds[dim] = this.makeNether());
      const ctx = { dim, world: w, entities: new CM.Entities(this), ticks: new CM.BlockTicks(this, w), growTimer: 1 };
      ctx.entities.remote = this.net.isClient; // invité : l'hôte simule créatures et objets
      // objets restés au sol dans cette dimension (par exemple après une mort)
      if (!this.net.isClient && this.dimDrops[dim]) {
        ctx.entities.drops.push(...this.dimDrops[dim]);
        delete this.dimDrops[dim];
      }
      if (!this.net.isClient && Array.isArray(this.dimCarts[dim])) {
        for (const c of this.dimCarts[dim]) {
          if (!c || !CM.CART_ITEMS[c.type] || !isFinite(c.x) || !isFinite(c.y) || !isFinite(c.z)) continue;
          const slots = Array.isArray(c.slots) ? c.slots.map((s) => (s && CM.itemInfo(s.id) ? s : null)) : undefined;
          ctx.entities.addCart(c.type, c.x, c.y, c.z, { yaw: c.yaw || 0, slots });
        }
        delete this.dimCarts[dim];
      }
      // repères tirés des modifications (pousses, cultures, terre labourée, tables d'enchantement)
      ctx.saplings = new Set();
      for (const id of CM.TAGS.saplings) for (const p of w.editedPositions(id)) ctx.saplings.add(p.join(','));
      ctx.crops = new Set();
      ctx.farmland = new Set();
      for (const p of w.editedWhere((id) => {
        const b = CM.blocks[id];
        return b.farmland || (b.crop !== undefined && (b.crop < 3 || b.fruit));
      })) (CM.blocks[p[3]].farmland ? ctx.farmland : ctx.crops).add(p[0] + ',' + p[1] + ',' + p[2]);
      ctx.enchTables = new Set(w.editedWhere((id) => id === B.ENCHANTING_TABLE).map((q) => q[0] + ',' + q[1] + ',' + q[2]));
      // pièces animées de l'extension Électricité (roues, éoliennes, ventilateurs…)
      ctx.techAnim = new Set(w.editedWhere((id) => !!CM.blocks[id].anim).map((q) => q[0] + ',' + q[1] + ',' + q[2]));
      // liquides qui coulent et feu
      ctx.ticks.reset();
      w.onEdit = (x, y, z, id, old) => {
        const k = x + ',' + y + ',' + z;
        if (id === B.ENCHANTING_TABLE) ctx.enchTables.add(k);
        else if (ctx.enchTables.size) ctx.enchTables.delete(k);
        if (CM.blocks[id].anim) ctx.techAnim.add(k);
        else if (ctx.techAnim.size) ctx.techAnim.delete(k);
        ctx.ticks.onEdit(x, y, z, id, old);
      };
      this.ctxs[dim] = ctx;
      if (this.net.active) this.net.attachWorld(w, dim);
      return ctx;
    }
    // Plus personne dans cette dimension : on la range (ses modifications restent en mémoire,
    // les animaux d'élevage et les objets au sol seront là au retour).
    closeCtx(dim) {
      const ctx = this.ctxs[dim];
      if (!ctx) return;
      if (!this.net.isClient) {
        if (dim === 'overworld') this.animals = ctx.entities.tameList();
        this.dimDrops[dim] = ctx.entities.drops.filter((d) => !d.dead);
        this.dimCarts[dim] = ctx.entities.cartList();
      }
      const w = ctx.world;
      w.onEdit = null;
      w.onSet = null;
      for (const c of [...w.chunks.values()]) w.removeChunk(c);
      w.dirty.clear();
      delete this.ctxs[dim];
    }
    // Rend courant un contexte (celui du joueur, ou un autre le temps de le simuler).
    useCtx(ctx) {
      const cur = this.ctxs[this.dim];
      if (cur && cur !== ctx && cur.world === this.world) cur.growTimer = this.growTimer;
      this.dim = ctx.dim;
      this.world = ctx.world;
      this.entities = ctx.entities;
      this.ticks = ctx.ticks;
      this.saplings = ctx.saplings;
      this.crops = ctx.crops;
      this.farmland = ctx.farmland;
      this.enchTables = ctx.enchTables;
      this.techAnim = ctx.techAnim;
      this.growTimer = ctx.growTimer;
    }
    // Exécute fn dans une autre dimension (sans son ni effet pour le joueur de cet écran).
    withDim(dim, fn) {
      if (dim === this.dim) return fn();
      const back = this.ctxs[this.dim];
      this.useCtx(this.ctxs[dim] || this.openCtx(dim));
      CM.Audio.mute++;
      try {
        return fn();
      } finally {
        CM.Audio.mute--;
        this.useCtx(back);
      }
    }
    // Hôte : simule la dimension où des invités se trouvent sans lui, range celle qui est vide.
    updateOtherDims(dt) {
      const net = this.net;
      for (const dim of ['overworld', 'nether']) {
        if (dim === this.dim) continue;
        let busy = false;
        for (const rp of net.remotes.values()) if (rp.dim === dim) busy = true;
        if (!busy) {
          if (this.ctxs[dim]) this.closeCtx(dim);
          continue;
        }
        this.withDim(dim, () => {
          const cs = net.simCenters();
          if (cs.length) this.world.stream(cs[0][0], cs[0][1], cs[0][2], 3, cs.slice(1));
          this.entities.update(dt);
          this.ticks.update(dt);
          this.growTimer -= dt;
          if (this.growTimer <= 0) {
            this.growTimer = 1;
            this.growPlants();
          }
          this.world.dirty.clear(); // (pas affichée ici)
        });
      }
    }
    // Où réapparaître : comme dans Minecraft, dans le monde normal (lit ou point de départ).
    respawnPoint() {
      const ow = this.worlds.overworld, bed = this.player.bed;
      if (bed) return { dim: 'overworld', x: bed[0] + 0.5, y: bed[1] + 9 / 16 + 0.01, z: bed[2] + 0.5 };
      return { dim: 'overworld', x: ow.spawn.x, y: ow.spawn.y, z: ow.spawn.z };
    }

    // Cadre de portail autour d'une case vide : 2 à 21 de large, 3 à 21 de haut, en obsidienne
    // (les coins ne comptent pas). axis 0 : plan le long de x, 1 : le long de z.
    portalFrame(x, y, z, axis) {
      const w = this.world, OB = B.OBSIDIAN;
      const ax = axis ? 0 : 1, az = axis ? 1 : 0;
      const open = (id) => id === 0 || id === B.FIRE || CM.blocks[id].portal;
      if (!open(w.get(x, y, z))) return null;
      let by = y;
      while (by > y - 22 && open(w.get(x, by - 1, z))) by--;
      if (w.get(x, by - 1, z) !== OB) return null;
      let l = 0, r = 0;
      while (l < 22 && open(w.get(x - ax * (l + 1), by, z - az * (l + 1)))) l++;
      while (r < 22 && open(w.get(x + ax * (r + 1), by, z + az * (r + 1)))) r++;
      const width = l + r + 1;
      if (width < 2 || width > 21) return null;
      const x0 = x - ax * l, z0 = z - az * l;
      let h = 0;
      while (h < 22 && open(w.get(x0, by + h, z0))) h++;
      if (h < 3 || h > 21) return null;
      for (let i = 0; i < width; i++) {
        const X = x0 + ax * i, Z = z0 + az * i;
        if (w.get(X, by - 1, Z) !== OB || w.get(X, by + h, Z) !== OB) return null;
        for (let j = 0; j < h; j++) if (!open(w.get(X, by + j, Z))) return null;
      }
      for (let j = 0; j < h; j++) {
        if (w.get(x0 - ax, by + j, z0 - az) !== OB || w.get(x0 + ax * width, by + j, z0 + az * width) !== OB) return null;
      }
      return { x0, y0: by, z0, ax, az, width, h, axis };
    }
    // Briquet dans un cadre d'obsidienne : le portail s'allume.
    tryLightPortal(x, y, z) {
      for (const axis of [0, 1]) {
        const f = this.portalFrame(x, y, z, axis);
        if (!f) continue;
        const id = CM.PORTALS[axis];
        for (let i = 0; i < f.width; i++) for (let j = 0; j < f.h; j++) this.world.setBlock(f.x0 + f.ax * i, f.y0 + j, f.z0 + f.az * i, id);
        CM.Audio.play('portal');
        if (!this.stats.portal) {
          this.stats.portal = 1;
          this.ui.toast('Le portail du Nether s’allume ! Reste quelques secondes dedans pour voyager.', 'gold');
        }
        return true;
      }
      return false;
    }
    // Un bloc voisin d'un portail a changé : si le cadre est cassé, tout le portail s'éteint.
    checkPortal(x, y, z) {
      const w = this.world, id = w.get(x, y, z), b = CM.blocks[id];
      if (!b.portal) return;
      const axis = id === CM.PORTALS[1] ? 1 : 0;
      if (this.portalFrame(x, y, z, axis)) return;
      const ax = axis ? 0 : 1, az = axis ? 1 : 0;
      const todo = [[x, y, z]], seen = new Set();
      while (todo.length && seen.size < 500) {
        const [X, Y, Z] = todo.pop();
        const k = X + ',' + Y + ',' + Z;
        if (seen.has(k) || w.get(X, Y, Z) !== id) continue;
        seen.add(k);
        w.setBlock(X, Y, Z, 0);
        todo.push([X + ax, Y, Z + az], [X - ax, Y, Z - az], [X, Y + 1, Z], [X, Y - 1, Z]);
      }
    }
    // Portail existant le plus proche (d'après les modifications : les portails sont toujours posés).
    findPortal(w, tx, tz, radius) {
      let best = null, bd = Infinity;
      for (const [x, y, z, id] of w.editedWhere((i) => !!CM.blocks[i].portal)) {
        const d = Math.hypot(x - tx, z - tz);
        if (d > radius || d >= bd) continue;
        let yy = y;
        while (CM.blocks[w.get(x, yy - 1, z)].portal && yy > y - 22) yy--;
        bd = d;
        best = { x: x + 0.5, y: yy, z: z + 0.5, id };
      }
      return best;
    }
    // Construit un portail (cadre 4 × 5) à l'arrivée ; cherche un endroit dégagé, sinon creuse
    // et pose une plateforme d'obsidienne. Renvoie le point d'arrivée.
    buildPortal(w, tx, ty, tz, axis) {
      const ax = axis ? 0 : 1, az = axis ? 1 : 0;
      const nether = w.nether;
      const free = (id) => !CM.blocks[id].solid && !CM.isFluid(id) && !CM.blocks[id].portal;
      const siteOK = (x, y, z) => {
        for (let i = 0; i < 4; i++)
          for (let j = -1; j <= 1; j++) {
            const X = x + ax * i + az * j, Z = z + az * i + ax * j;
            if (!w.loaded(X, Z) || !w.solidAt(X, y - 1, Z) || CM.isFluid(w.get(X, y - 1, Z))) return false;
            for (let k = 0; k < 5; k++) if (!free(w.get(X, y + k, Z))) return false;
          }
        return true;
      };
      let site = null;
      const R = nether ? 12 : 16;
      search: for (let r = 0; r <= R; r++)
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const x = tx + dx, z = tz + dz;
            if (!w.loaded(x, z)) continue;
            if (nether) {
              for (let k = 0; k <= 24; k++) {
                const y = ty + (k % 2 ? -((k + 1) >> 1) : k >> 1);
                if (y < 33 || y > 84) continue;
                if (siteOK(x, y, z)) {
                  site = [x, y, z];
                  break search;
                }
              }
            } else {
              const y = w.groundBelow(x, CM.WORLD.H - 1, z) + 1;
              if (y > CM.WORLD.MINY + 5 && y < CM.WORLD.H - 6 && siteOK(x, y, z)) {
                site = [x, y, z];
                break search;
              }
            }
          }
      let [x, y, z] = site || [tx, ty, tz];
      if (!site) {
        // rien de dégagé : on creuse une niche et on pose une plateforme
        y = nether ? Math.max(34, Math.min(80, ty)) : Math.max(CM.WORLD.MINY + 6, Math.min(CM.WORLD.H - 7, ty));
        for (let i = -1; i <= 4; i++)
          for (let j = -1; j <= 1; j++) {
            const X = x + ax * i + az * j, Z = z + az * i + ax * j;
            for (let k = 0; k < 5; k++) if (w.get(X, y + k, Z) !== B.BEDROCK) w.setBlock(X, y + k, Z, 0);
            if (i >= 0 && i <= 3 && w.get(X, y - 1, Z) !== B.BEDROCK && !w.solidAt(X, y - 1, Z)) w.setBlock(X, y - 1, Z, B.OBSIDIAN);
          }
      }
      for (let i = 0; i < 4; i++)
        for (let k = 0; k < 5; k++) {
          const edge = i === 0 || i === 3 || k === 0 || k === 4;
          w.setBlock(x + ax * i, y + k, z + az * i, edge ? B.OBSIDIAN : CM.PORTALS[axis]);
        }
      return { x: x + ax * 2 + az * 0.5, y: y + 1, z: z + az * 2 + ax * 0.5 };
    }
    // Le joueur est resté assez longtemps dans un portail.
    enterPortal(x, y, z) {
      if (this.net.isClient) {
        this.net.send({ t: 'portal', x, y, z });
        this.ui.toast('Le portail vous emporte…', 'info', 'portal');
        return;
      }
      this.changeDim(this.dim === 'nether' ? 'overworld' : 'nether', { from: [x, y, z] });
    }
    // Voyage vers l'autre dimension. opts.from : portail de départ (le portail d'arrivée est
    // trouvé ou construit) ; opts.at : point d'arrivée imposé (réapparition, invité) ;
    // opts.edits : modifications du monde d'arrivée envoyées par l'hôte.
    async changeDim(to, opts) {
      opts = opts || {};
      if (this.switching || !this.world) return;
      this.switching = true;
      const net = this.net, p = this.player;
      const fromDim = this.playerDim;
      net.flushSets();
      if (this.ui.invOpen) this.ui.closeInventory();
      if (p.sleeping) this.wake('dim');
      const from = this.world;
      const src = opts.from ? { x: opts.from[0], y: opts.from[1], z: opts.from[2], id: from.get(opts.from[0], opts.from[1], opts.from[2]) } : null;
      this.state = 'loading';
      this.ui.show('loading');
      $('load-text').textContent = to === 'nether' ? 'Voyage vers le Nether…' : 'Retour dans le monde normal…';
      $('load-fill').style.width = '0%';
      CM.Audio.play('travel');
      // invité : le monde d'arrivée vient de l'hôte (à jour)
      if (opts.edits !== undefined) {
        this.closeCtx(to);
        this.worlds[to] = to === 'nether' ? this.makeNether(opts.edits) : new CM.World(from.seed, opts.edits, this.settings);
      }
      this.useCtx(this.ctxs[to] || this.openCtx(to));
      this.playerDim = to;
      // l'ancienne dimension reste simulée si des invités y sont encore, sinon on la range
      if (!(net.isHost && [...net.remotes.values()].some((rp) => rp.dim === fromDim))) this.closeCtx(fromDim);
      this.renderer.freeAll();
      const w = this.world;
      // point visé : coordonnées ÷ 8 dans le Nether, × 8 au retour
      let dest = opts.at || null;
      const k = to === 'nether' ? 1 / 8 : 8;
      const tx = dest ? Math.floor(dest.x) : Math.floor((src ? src.x : p.x) * k);
      const tz = dest ? Math.floor(dest.z) : Math.floor((src ? src.z : p.z) * k);
      const ty = dest ? Math.floor(dest.y) : Math.floor(src ? src.y : p.y);
      let total = 0;
      for (;;) {
        const left = w.stream(tx, tz, this.renderer.renderDist + 1, 40, net.isHost ? net.simCenters() : null);
        if (!total) total = left + 1;
        $('load-fill').style.width = Math.round((1 - left / total) * 60) + '%';
        if (left <= 0) break;
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!dest) dest = this.findPortal(w, tx, tz, to === 'nether' ? 16 : 128) || this.buildPortal(w, tx, ty, tz, src && src.id === CM.PORTALS[1] ? 1 : 0);
      if (to === 'nether') this.netherArrival = { x: dest.x, y: dest.y, z: dest.z };
      p.x = dest.x;
      p.y = dest.y;
      p.z = dest.z;
      p.vx = p.vy = p.vz = 0;
      p.fallStart = p.y;
      p.portalLock = true;
      p.portalT = 0;
      p.target = null;
      p.mining = null;
      p.hook = null;
      w.stream(p.x, p.z, this.renderer.renderDist + 1, 40, net.isHost ? net.simCenters() : null);
      if (net.isHost && !opts.quiet) net.sysAll('🌀 ' + net.name + (to === 'nether' ? ' est parti dans le Nether' : ' est revenu dans le monde normal'));
      $('load-text').textContent = 'Construction du paysage…';
      total = 0;
      for (;;) {
        const left = this.renderer.updateMeshes(w, p.x, p.z, 40);
        if (!total) total = left + 1;
        $('load-fill').style.width = Math.round(60 + (1 - left / total) * 40) + '%';
        if (left <= 0) break;
        await new Promise((r) => setTimeout(r, 0));
      }
      this.ui.hide('loading');
      this.state = 'playing';
      this.switching = false;
      this.last = performance.now();
      if (to === 'nether') this.ui.toast('Bienvenue dans le Nether ! Attention à la lave et aux Ombres ardentes.', 'gold', 'dim');
      else if (!opts.quiet) this.ui.toast('De retour dans le monde normal', 'good', 'dim');
      if (net.isClient) net.sendMyState(true);
      this.save(true);
      if (opts.then) opts.then();
    }

    // Coffre de départ (option à la création du monde).
    placeBonusChest() {
      const w = this.world, sp = w.spawn;
      const x = Math.floor(sp.x) + 2, z = Math.floor(sp.z) + 1;
      if (!w.loaded(x, z)) return;
      const y = w.groundBelow(x, CM.WORLD.H - 1, z) + 1;
      if (y <= 0 || w.solidAt(x, y, z)) return;
      w.setBlock(x, y, z, B.CHEST);
      const I = CM.I;
      const slots = new Array(27).fill(null);
      const items = [[I.BREAD, 6], [I.APPLE, 4], [I.PICKAXE_1, 1], [I.AXE_1, 1], [B.TORCH, 12], [B.OAK_SAPLING || B.SAPLING, 3], [I.SEEDS, 6], [B.TABLE, 1], [B.LOG, 12]];
      items.forEach(([id, n], i) => {
        slots[i] = { id, count: n };
        if (CM.hasWear(id)) slots[i].xp = 0;
      });
      this.chests.set(this.bkey(x, y, z), slots);
    }

    spawnInitialMobs() {
      const w = this.world, sp = this.player, r = CM.rng(w.seed + 5);
      let n = 0;
      for (let k = 0; k < 400 && n < 14; k++) {
        const x = Math.floor(sp.x + (r() - 0.5) * 140), z = Math.floor(sp.z + (r() - 0.5) * 140);
        if (!w.loaded(x, z)) continue;
        const y = w.groundBelow(x, CM.WORLD.H - 1, z);
        const type = this.entities.animalFor(w.column(x, z).bi);
        if (type && y > 0 && CM.blocks[w.get(x, y, z)].soil && Math.hypot(x - sp.x, z - sp.z) > 8) {
          this.entities.addMob(type, x + 0.5, y + 1, z + 0.5);
          n++;
        }
      }
    }

    // ----------------------------------------------------- sauvegarde ----
    // État complet de la partie en cours (ce qui est sauvegardé / exporté).
    saveData() {
      const p = this.player, ow = this.worlds.overworld;
      // mort : on repart du point de réapparition (monde normal, ou portail du Nether en multijoueur)
      const rs = p.alive ? null : this.respawnPoint();
      const nether = this.worlds.nether ? this.worlds.nether.editsObject() : this.netherEdits;
      return {
        v: SAVE_VERSION,
        seed: ow.seed,
        settings: Object.assign({}, this.settings, { mode: this.mode, difficulty: this.difficulty }),
        spawn: ow.spawn,
        edits: ow.editsObject(),
        dim: rs ? rs.dim : this.dim,
        nether: nether ? { edits: nether, arrival: this.netherArrival } : undefined,
        player: {
          x: rs ? rs.x : p.x, y: rs ? rs.y : p.y, z: rs ? rs.z : p.z,
          yaw: p.yaw, pitch: p.pitch, health: p.alive ? p.health : 20, food: p.alive ? p.food : 20, sat: p.sat, flying: p.flying, bed: p.bed || null,
          xp: p.xpTotal, enchSeed: p.enchSeed,
          cmd: p.cmdFly || p.cmdGod || (p.cmdSpeed && p.cmdSpeed !== 1) || p.cmdJump || p.nightVision ? { f: p.cmdFly ? 1 : 0, g: p.cmdGod ? 1 : 0, s: p.cmdSpeed || 1, j: p.cmdJump || 0, n: p.nightVision ? 1 : 0 } : undefined,
        },
        inv: this.inventory.serialize(),
        time: this.time,
        dayCount: this.dayCount,
        stats: this.stats,
        dawnHearts: this.dawnHearts,
        victory: this.victory,
        chests: Object.fromEntries(this.chests),
        noteBlocks: this.noteBlocks,
        tech: this.techData,
        weather: this.weather,
        homes: this.homes,
        golems: this.golemHomes,
        animals: this.ctxs.overworld ? this.ctxs.overworld.entities.tameList() : this.animals,
        carts: Object.fromEntries(['overworld', 'nether'].map((d) => [d, this.ctxs[d] ? this.ctxs[d].entities.cartList() : this.dimCarts[d] || []])),
        guests: this.net.guests,
        savedAt: new Date().toISOString(),
      };
    }
    save(silent) {
      if (!this.world || this.state !== 'playing') return;
      // invité : sa progression est gardée par l'hôte (sa propre partie solo reste intacte)
      if (this.net.isClient) {
        this.net.sendGuestSave();
        if (!silent) this.ui.toast('Progression envoyée à l’hôte', 'good');
        return;
      }
      const ok = storageSet(SAVE_KEY, JSON.stringify(this.saveData()));
      if (!silent) this.ui.toast(ok ? 'Partie sauvegardée' : 'Sauvegarde impossible (stockage plein ou bloqué)', ok ? 'good' : 'warn');
    }
    // ------------------------------------------- export / import (.zip) ---
    async exportSave(data) {
      if (!data) {
        this.menuMsg("Aucune sauvegarde à exporter : lance d'abord une partie.", 'warn');
        return;
      }
      const day = (data.dayCount || 0) + 1;
      const stamp = new Date().toISOString().slice(0, 10);
      const readme =
        'Sauvegarde CraftMine — L\'Aube des Éclats\r\n' +
        '=========================================\r\n\r\n' +
        'Graine du monde : ' + data.seed + '\r\n' +
        'Jour : ' + day + '\r\n' +
        'Exportée le : ' + new Date().toLocaleString('fr-FR') + '\r\n\r\n' +
        'Pour retrouver cette partie sur un autre appareil :\r\n' +
        '1. Ouvre CraftMine (index.html) dans le navigateur.\r\n' +
        '2. Dans le menu principal, clique sur « Importer une sauvegarde ».\r\n' +
        '3. Choisis ce fichier .zip, puis clique sur « Continuer ».\r\n';
      try {
        const blob = await CM.Zip.create([
          { name: 'craftmine-sauvegarde.json', data: JSON.stringify(data) },
          { name: 'LISEZMOI.txt', data: readme },
        ]);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'craftmine-sauvegarde-jour' + day + '-' + stamp + '.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        const msg = 'Sauvegarde exportée : ' + a.download;
        if (this.state === 'playing') this.ui.toast(msg, 'good');
        else this.menuMsg(msg, 'good');
      } catch (err) {
        console.error(err);
        this.menuMsg("L'export a échoué : " + err.message, 'warn');
      }
    }

    async importSave(file) {
      try {
        const buf = await file.arrayBuffer();
        const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
        let text;
        if (head[0] === 0x50 && head[1] === 0x4b) {
          const entries = await CM.Zip.read(buf);
          const e = entries.find((x) => /craftmine-sauvegarde\.json$/i.test(x.name)) || entries.find((x) => /\.json$/i.test(x.name));
          if (!e) throw new Error('aucune sauvegarde CraftMine dans ce fichier');
          text = new TextDecoder().decode(e.data);
        } else text = new TextDecoder().decode(buf);
        let data;
        try {
          data = JSON.parse(text);
        } catch (err) {
          throw new Error("le fichier n'est pas une sauvegarde CraftMine");
        }
        if (data && data.v === 1) throw new Error("cette sauvegarde vient d'une ancienne version du jeu (monde limité) et ne peut plus être chargée");
        if (!data || !(data.v >= 2 && data.v <= SAVE_VERSION) || !Number.isFinite(data.seed) || typeof data.edits !== 'object' || !data.player) {
          throw new Error("le fichier n'est pas une sauvegarde CraftMine valide");
        }
        const existing = this.loadSave();
        if (existing && !confirm('Remplacer la partie actuelle de cet appareil (jour ' + ((existing.dayCount || 0) + 1) + ') par la sauvegarde importée ?')) return;
        if (!storageSet(SAVE_KEY, JSON.stringify(data))) {
          // stockage indisponible : on lance directement la partie importée
          this.startWorld(data.seed, data);
          return;
        }
        this.refreshMenu();
        this.menuMsg('Sauvegarde importée (jour ' + ((data.dayCount || 0) + 1) + ', graine ' + data.seed + '). Clique sur « Continuer » pour jouer !', 'good');
      } catch (err) {
        console.error(err);
        this.menuMsg("Import impossible : " + err.message + '.', 'warn');
      }
    }

    menuMsg(text, type) {
      const el = $('menu-msg');
      el.textContent = text;
      el.className = 'menu-msg ' + (type || '');
    }

    loadSave() {
      try {
        const s = JSON.parse(storageGet(SAVE_KEY));
        return s && s.v >= 2 && s.v <= SAVE_VERSION ? s : null;
      } catch (e) {
        return null;
      }
    }

    // --------------------------------------------------------- entrées ---
    captureMouse() {
      if (this.touch && this.touch.enabled) {
        if (this.state === 'playing') this.forceInput = true;
        return;
      }
      if (this.state !== 'playing' || this.paused || this.ui.invOpen || !this.player.alive || this.forceInput) return;
      const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => this.ui.show('start'));
    }
    releaseMouse() {
      if (document.pointerLockElement) document.exitPointerLock();
    }

    bindInput() {
      const inp = this.input;
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === this.canvas;
        if (this.locked) {
          this.ui.hide('start');
          return;
        }
        this.clearInput();
        if (this.state === 'playing' && !this.ui.invOpen && this.player.alive && !this.paused && !this.net.chatOpen && !this.player.sleeping && $('victory').classList.contains('hidden')) this.pause();
      });
      document.addEventListener('pointerlockerror', () => {
        if (this.state === 'playing' && !this.paused && !this.ui.invOpen) this.ui.show('start');
      });
      document.addEventListener('mousemove', (e) => {
        if (!this.locked) return;
        const s = 0.0023 * this.options.sens;
        this.player.yaw -= e.movementX * s;
        this.player.pitch -= e.movementY * s * (this.options.invertY ? -1 : 1);
        this.player.pitch = CM.clamp(this.player.pitch, -1.55, 1.55);
      });
      document.addEventListener('mousedown', (e) => {
        CM.Audio.init();
        if (this.locked) {
          inp.mouse[e.button] = true;
          inp.pressed['mouse' + e.button] = true;
          e.preventDefault();
        } else if (e.target === this.canvas && !this.touch.enabled && this.state === 'playing' && !this.paused && !this.ui.invOpen && this.player.alive) {
          this.captureMouse();
        }
      });
      document.addEventListener('mouseup', (e) => {
        inp.mouse[e.button] = false;
      });
      document.addEventListener('contextmenu', (e) => {
        if (this.state === 'playing') e.preventDefault();
      });
      document.addEventListener(
        'wheel',
        (e) => {
          if (!this.locked && !this.forceInput) return;
          const d = Math.sign(e.deltaY);
          this.inventory.selected = (this.inventory.selected + d + 9) % 9;
        },
        { passive: true },
      );
      window.addEventListener('keydown', (e) => {
        CM.Audio.init();
        if (this.ui.captureKey(e)) return;
        if (this.state !== 'playing') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
        const c = e.code;
        const K = this.binds;
        if (['Space', 'Tab', 'F3', K.dash, K.jump].includes(c) || c.startsWith('Arrow')) e.preventDefault();
        if (c === 'F3') {
          this.ui.toggleDebug();
          return;
        }
        if (c === 'F1') {
          e.preventDefault();
          this.ui.toggleHud();
          return;
        }
        // tchat (et commandes, aussi en solo) ; « / » l'ouvre avec la commande commencée
        if ((c === 'KeyT' || c === 'Enter' || e.key === '/' || c === 'NumpadDivide') && this.state === 'playing' && !this.ui.invOpen && !this.paused) {
          e.preventDefault();
          this.net.openChat(e.key === '/' || c === 'NumpadDivide' ? '/' : '');
          return;
        }
        if (c === K.inventory && !this.paused && this.player.alive) {
          if (this.ui.invOpen) this.ui.closeInventory();
          else this.ui.openInventory();
          return;
        }
        if (c === 'Escape' && this.ui.invOpen) {
          this.ui.closeInventory();
          return;
        }
        if (c === 'Escape' && this.forceInput && !this.paused) {
          this.pause();
          return;
        }
        if (!this.locked && !this.forceInput) return;
        if (c.startsWith('Digit')) {
          const n = +c.slice(5);
          if (n >= 1 && n <= 9) this.inventory.selected = n - 1;
        }
        if (c === K.drop) this.dropHeld(e.ctrlKey);
        if (c === K.swap && !e.repeat && this.player.alive) this.swapHands();
        inp.keys[c] = true;
        if (!e.repeat) inp.pressed[c] = true;
      });
      window.addEventListener('keyup', (e) => {
        inp.keys[e.code] = false;
      });
      window.addEventListener('blur', () => this.clearInput());
      // application mise en arrière-plan (téléphone) : pause et sauvegarde
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing' && !this.paused && !this.autostart) {
          this.clearInput();
          if (this.touch.enabled) this.touch.reset();
          this.pause();
        }
      });
      window.addEventListener('beforeunload', () => {
        if (this.state === 'playing') this.save(true);
        this.net.leave();
      });
    }

    clearInput() {
      this.input.keys = {};
      this.input.mouse = [false, false, false];
      this.input.pressed = {};
    }

    bindMenus() {
      const on = (id, fn) => $(id).addEventListener('click', (e) => {
        CM.Audio.init();
        CM.Audio.play('click');
        fn(e);
      });
      on('btn-continue', () => {
        this.maybeFullscreen();
        const s = this.loadSave();
        if (s) this.startWorld(s.seed, s);
      });
      on('btn-new', () => {
        this.ui.hide('menu');
        this.ui.openNewWorld();
      });
      on('btn-nw-back', () => {
        this.ui.hide('newworld');
        this.ui.show('menu');
      });
      on('btn-nw-create', () => {
        this.maybeFullscreen();
        if (this.loadSave() && !confirm('Une partie existe déjà. La remplacer par un nouveau monde ?')) return;
        const txt = $('seed').value.trim();
        let seed;
        if (!txt) seed = randomSeed();
        else if (/^-?\d+$/.test(txt)) seed = Math.abs(+txt) % 4294967296;
        else seed = CM.hashString(txt);
        $('seed').value = '';
        this.startWorld(seed, null, this.ui.newWorldSettings());
      });
      on('btn-help', () => $('help').classList.toggle('hidden'));
      on('btn-export', () => this.exportSave(this.loadSave()));
      on('btn-export2', () => {
        this.save(true);
        this.exportSave(this.saveData());
      });
      on('btn-import', () => $('import-file').click());
      $('import-file').addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (f) this.importSave(f);
      });
      on('btn-options', () => this.openOptions('menu'));
      on('btn-options2', () => this.openOptions('pause'));
      on('btn-opt-back', () => {
        this.ui.hide('options');
        this.ui.show(this.optionsFrom);
        if (this.optionsFrom === 'pause') this.ui.refreshPause();
      });
      on('btn-start', () => {
        this.ui.hide('start');
        this.captureMouse();
      });
      on('btn-resume', () => this.resume());
      on('btn-save', () => this.save(false));
      // guide (objectifs à l'écran) : bouton du menu pause et croix sur le panneau
      on('btn-guide', () => this.setGuide(!this.options.showQuests));
      on('obj-close', (e) => {
        e.stopPropagation();
        this.setGuide(false);
      });
      on('btn-quit', () => this.exitToMenu());
      on('btn-wake', () => this.wake('button'));
      // multijoueur
      on('btn-multi', () => this.openMulti());
      on('btn-mp-back', () => {
        this.ui.hide('multi');
        this.ui.show('menu');
      });
      on('btn-mp-join', () => this.joinGame());
      $('mp-code').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.joinGame();
      });
      on('btn-lan', () => this.openHostDialog());
      on('btn-host-cancel', () => {
        this.ui.hide('hostdlg');
        this.ui.refreshPause();
        this.ui.show('pause');
      });
      on('btn-host-open', () => this.hostGame());
      on('btn-host-copy', () => this.shareInvite());
      on('btn-host-done', () => {
        this.ui.hide('hostdlg');
        this.resume();
      });
      on('btn-respawn', () => {
        this.player.respawn();
        this.captureMouse();
      });
      on('btn-victory', () => {
        this.ui.hide('victory');
        this.captureMouse();
      });
    }

    // Retour au menu principal (bouton Quitter, ou partie multijoueur interrompue).
    exitToMenu(msg) {
      if (this.state === 'playing') {
        if (this.ui.invOpen) this.ui.closeInventory();
        this.save(true);
      }
      this.net.leave();
      this.state = 'menu';
      this.paused = false;
      this.releaseMouse();
      document.body.classList.remove('ingame');
      this.touch.reset();
      for (const id of ['pause', 'hud', 'death', 'victory', 'start', 'hostdlg', 'options', 'loading', 'sleep']) this.ui.hide(id);
      this.renderer.freeAll();
      this.refreshMenu();
      this.ui.show('menu');
      if (msg) this.menuMsg(msg, 'warn');
    }

    // ------------------------------------------------ multijoueur ------
    rememberName(name) {
      if (this.options.netName === name) return;
      this.options.netName = name;
      storageSet(OPT_KEY, JSON.stringify(this.options));
    }
    openMulti(code) {
      this.ui.hide('menu');
      $('mp-name').value = this.options.netName || '';
      if (code) $('mp-code').value = String(code).toUpperCase().slice(0, 5);
      this.mpStatus('');
      this.ui.show('multi');
      if (!$('mp-name').value) $('mp-name').focus();
    }
    mpStatus(text, type) {
      const el = $('mp-status');
      el.textContent = text;
      el.className = 'menu-msg ' + (type || '') + (text ? '' : ' hidden');
    }
    async joinGame() {
      if (this.joining) return;
      const name = CM.cleanName($('mp-name').value);
      if (!name) {
        this.mpStatus('Choisis un pseudo (celui que verront les autres joueurs).', 'warn');
        return;
      }
      this.rememberName(name);
      this.maybeFullscreen();
      this.joining = true;
      $('btn-mp-join').disabled = true;
      let joined = false;
      try {
        const w = await this.net.join($('mp-code').value, name, (t) => this.mpStatus(t));
        joined = true;
        await this.startWorld(w.seed, this.net.guestSave(w));
      } catch (e) {
        console.warn(e);
        if (joined) this.exitToMenu('La partie n’a pas pu démarrer : ' + (e.message || e));
        else this.mpStatus(CM.netErrorText(e), 'warn');
      }
      this.joining = false;
      $('btn-mp-join').disabled = false;
    }
    openHostDialog() {
      this.ui.hide('pause');
      $('host-name').value = this.options.netName || CM.randomPlayerName();
      const ready = this.net.isHost;
      $('host-setup').classList.toggle('hidden', ready);
      $('host-ready').classList.toggle('hidden', !ready);
      if (ready) $('host-code').textContent = this.net.code;
      this.hostStatus('');
      this.ui.show('hostdlg');
    }
    hostStatus(text, type) {
      const el = $('host-status');
      el.textContent = text;
      el.className = 'menu-msg ' + (type || '') + (text ? '' : ' hidden');
    }
    async hostGame() {
      const name = CM.cleanName($('host-name').value);
      if (!name) {
        this.hostStatus('Choisis un pseudo.', 'warn');
        return;
      }
      this.rememberName(name);
      $('btn-host-open').disabled = true;
      this.hostStatus('Ouverture de la partie…');
      try {
        const code = await this.net.host(name, $('host-pvp').checked);
        $('host-code').textContent = code;
        $('host-setup').classList.add('hidden');
        $('host-ready').classList.remove('hidden');
        this.hostStatus('');
        this.save(true);
      } catch (e) {
        console.warn(e);
        this.hostStatus(CM.netErrorText(e), 'warn');
      }
      $('btn-host-open').disabled = false;
    }
    async shareInvite() {
      const url = location.origin + location.pathname + '?join=' + this.net.code;
      const text = 'Rejoins ma partie CraftMine ! Code : ' + this.net.code;
      try {
        if (navigator.share && this.touch.enabled) {
          await navigator.share({ title: 'CraftMine', text, url });
          return;
        }
        await navigator.clipboard.writeText(url);
        this.hostStatus('Lien copié : ' + url, 'good');
      } catch (e) {
        this.hostStatus('Lien d’invitation : ' + url, 'good');
      }
    }

    // Plein écran automatique sur téléphone (là où le navigateur le permet).
    maybeFullscreen() {
      if (!this.touch.enabled || document.fullscreenElement) return;
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!fn) return;
      try {
        const p = fn.call(el, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* ignore */
      }
    }

    refreshMenu() {
      const s = this.loadSave();
      $('btn-export').disabled = !s;
      $('btn-continue').classList.toggle('hidden', !s);
      if (s) {
        const mode = s.settings && s.settings.mode === 'creative' ? ', créatif' : '';
        $('btn-continue').textContent = 'Continuer (jour ' + ((s.dayCount || 0) + 1) + mode + ')';
      }
    }
    openOptions(from) {
      this.optionsFrom = from;
      this.ui.hide(from);
      this.ui.openOptions(from === 'pause');
    }
    setGuide(show) {
      this.options.showQuests = show;
      this.applyOptions();
      if (this.ui) this.ui.refreshPause();
      this.ui.toast(show ? 'Guide affiché' : 'Guide masqué — Pause > « Afficher le guide » pour le remettre', 'info', 'guide');
    }
    pause() {
      this.paused = true;
      this.ui.hide('start');
      this.ui.refreshPause();
      this.ui.show('pause');
      this.save(true);
    }
    resume() {
      this.paused = false;
      this.ui.hide('pause');
      this.captureMouse();
    }
    setMode(mode) {
      this.mode = mode;
      if (mode !== 'creative') this.player.flying = false;
      this.ui.dirtyInv = true;
      this.ui.toast(mode === 'creative' ? 'Mode créatif : blocs infinis, vol (double saut), pas de dégâts' : 'Mode survie', 'gold');
      this.net.sendCfg();
    }
    setDifficulty(d) {
      this.difficulty = d;
      if (d === 'peaceful') for (const m of this.entities.mobs) if (m.type === 'ombre' || m.type === 'ardent') m.dead = true;
      this.net.sendCfg();
    }

    // ------------------------------------------------ utilitaires jeu ----
    nearbyStations() {
      const p = this.player, w = this.world;
      const out = { table: false, forge: false, smithing: false, atelier: false };
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      for (let dy = -3; dy <= 4; dy++)
        for (let dz = -4; dz <= 4; dz++)
          for (let dx = -4; dx <= 4; dx++) {
            const st = CM.blocks[w.get(px + dx, py + dy, pz + dz)].station;
            if (st) out[st] = true;
          }
      if (this.mode === 'creative') out.table = out.forge = out.smithing = out.atelier = true;
      return out;
    }
    dropNearPlayer(id, count, extra) {
      const p = this.player;
      const f = [-Math.sin(p.yaw), -Math.cos(p.yaw)];
      const ex = CM.stackExtra(extra);
      this.entities.addDrop(id, count, p.x + f[0] * 0.4, p.y + 1.3, p.z + f[1] * 0.4, ex, [f[0] * 4, 2.5, f[1] * 4]);
    }
    dropHeld(all) {
      const s = this.inventory.held();
      if (!s || !this.player.alive) return;
      const n = all ? s.count : 1;
      this.dropNearPlayer(s.id, n, s);
      this.inventory.consumeHeld(n);
    }
    onPickup(id, n) {
      this.ui.pickup(id, n);
    }
    // Ouvre un coffre (partagé en multijoueur : un seul joueur à la fois).
    // Clé d'un bloc à contenu (coffre, bloc musical) : celles du Nether commencent par « N ».
    bkey(x, y, z) {
      return (this.dim === 'nether' ? 'N' : '') + x + ',' + y + ',' + z;
    }
    openChestAt(x, y, z, title) {
      if (this.net.active) this.net.openChest(x, y, z, title);
      else {
        this.ui.openChest(this.chestAt(x, y, z), title);
        this.soloChest = this.bkey(x, y, z);
        this.chestViewers(this.soloChest, 1);
      }
    }
    // Coffre d'un wagonnet (clé « C » + identifiant du wagonnet).
    openCartChest(c) {
      const title = c.type === 'hopper' ? 'Wagonnet à entonnoir' : 'Wagonnet avec coffre';
      if (this.net.active) this.net.openChest(null, null, null, title, 'C' + c.uid);
      else if (c.slots) {
        this.ui.openChest(c.slots, title);
        this.soloChest = 'C' + c.uid;
      }
    }
    // Contenu d'un conteneur d'après sa clé (bloc ou wagonnet de la dimension simulée).
    containerByKey(k) {
      if (k[0] === 'C') {
        const c = this.entities.cartByUid(Number(k.slice(1)));
        return c && c.slots ? c.slots : null;
      }
      return this.chests.get(k) || null;
    }
    // Coffre piégé : le nombre de joueurs qui regardent dedans alimente la redstone.
    chestViewers(k, n) {
      if (!k || k[0] === 'C') return;
      const dim = k[0] === 'N' ? 'nether' : 'overworld';
      const [x, y, z] = (dim === 'nether' ? k.slice(1) : k).split(',').map(Number);
      if (dim !== this.dim && !this.ctxs[dim]) return;
      this.withDim(dim, () => {
        if (this.ticks.rs) this.ticks.rs.setViewers(x, y, z, n);
      });
    }
    chestClosed() {
      if (this.soloChest) {
        this.chestViewers(this.soloChest, 0);
        this.soloChest = null;
      }
      this.net.chestClosed();
    }
    chestAt(x, y, z) {
      if (this.net.isClient) return new Array(27).fill(null); // les coffres sont chez l'hôte
      const k = this.bkey(x, y, z);
      if (!this.chests.has(k)) {
        // 27 cases (coffre), 9 (distributeur, dropper), 5 (entonnoir)…
        const slots = new Array(CM.blocks[this.world.get(x, y, z)].slots || 27).fill(null);
        if (this.world.isNaturalChest(x, y, z)) this.fillLoot(slots, x, y, z);
        this.chests.set(k, slots);
      }
      return this.chests.get(k);
    }
    // Butin (déterministe) des coffres trouvés dans les ruines.
    fillLoot(slots, x, y, z) {
      const r = CM.rng((CM.hash3(x, y, z, this.world.seed + 999) * 4294967296) >>> 0);
      const I = CM.I;
      // coffre de forteresse du Nether
      if (this.world.nether) {
        const nt = [[I.GOLD_INGOT, 0.7, 2, 7], [I.IRON_INGOT, 0.5, 1, 5], [I.DIAMOND, 0.25, 1, 3], [I.FLINT_AND_STEEL, 0.25, 1, 1], [B.OBSIDIAN, 0.35, 2, 6],
          [I.NETHERITE_SCRAP, 0.12, 1, 1], [I.QUARTZ, 0.45, 3, 10], [I.GOLDEN_APPLE, 0.1, 1, 1], [I.GLOWSTONE_DUST, 0.35, 2, 8], [I.LAVA_BUCKET, 0.08, 1, 1],
          [I.CHESTPLATE_GOLD, 0.15, 1, 1], [I.HELMET_GOLD, 0.15, 1, 1], [I.SWORD_GOLD, 0.15, 1, 1], [I.BOOTS_IRON, 0.08, 1, 1], [I.COOKED_MEAT, 0.3, 1, 4]];
        const its = [];
        for (const [id, p, a, b] of nt) if (id !== undefined && r() < p) its.push({ id, count: a + Math.floor(r() * (b - a + 1)) });
        if (r() < 0.25) {
          const pool = [I.SWORD_GOLD, I.PICKAXE_IRON, I.CHESTPLATE_GOLD, I.BOOTS_GOLD, I.HELMET_IRON];
          const id = pool[Math.floor(r() * pool.length)];
          if (id !== undefined) its.push({ id, count: 1, ench: CM.rollEnchants(id, 10 + Math.floor(r() * 16), r) });
        }
        const free = [...Array(27).keys()];
        for (const it of its) {
          if (CM.hasWear(it.id)) it.xp = it.xp || 0;
          slots[free.splice(Math.floor(r() * free.length), 1)[0]] = it;
        }
        return;
      }
      // coffre d'une maison de village (celui du forgeron est mieux garni)
      const vil = this.world.villageNear(x, z, 0);
      const vc = vil && vil.chests.find((c) => c.x === x && c.y === y && c.z === z);
      if (vc) {
        const vt = vc.smith
          ? [[I.IRON_INGOT, 0.8, 2, 6], [I.COAL, 0.6, 3, 10], [I.EMERALD, 0.5, 1, 4], [I.PICKAXE_IRON, 0.25, 1, 1], [I.SWORD_IRON, 0.2, 1, 1], [I.AXE_IRON, 0.2, 1, 1], [I.GOLD_INGOT, 0.3, 1, 3], [I.BREAD, 0.4, 1, 3], [I.DIAMOND, 0.06, 1, 1],
            [I.HELMET_IRON, 0.2, 1, 1], [I.CHESTPLATE_IRON, 0.12, 1, 1], [I.LEGGINGS_IRON, 0.12, 1, 1], [I.BOOTS_IRON, 0.2, 1, 1]]
          : [[I.BREAD, 0.6, 1, 4], [I.WHEAT, 0.5, 2, 8], [I.SEEDS, 0.5, 2, 8], [I.APPLE, 0.45, 1, 4], [I.EMERALD, 0.35, 1, 3], [I.COAL, 0.3, 1, 4], [B.TORCH, 0.4, 2, 6], [I.PAPER, 0.25, 1, 5], [I.IRON_INGOT, 0.15, 1, 2], [I.PUMPKIN_PIE, 0.15, 1, 2], [I.CARROT, 0.35, 2, 6], [I.POTATO, 0.35, 2, 6], [I.BEETROOT_SEEDS, 0.3, 2, 6], [I.BUCKET, 0.1, 1, 1]];
        const its = [];
        for (const [id, p, a, b] of vt) if (id !== undefined && r() < p) its.push({ id, count: a + Math.floor(r() * (b - a + 1)) });
        const free = [...Array(27).keys()];
        for (const it of its) {
          if (CM.hasWear(it.id)) it.xp = 0;
          slots[free.splice(Math.floor(r() * free.length), 1)[0]] = it;
        }
        return;
      }
      // armure trouvée dans une ruine : déjà un peu usée
      const worn = (it) => {
        const info = CM.itemInfo(it.id);
        if (info.type === 'armor') it.xp = Math.floor(r() * info.maxDur * 0.6);
        return it;
      };
      const table = [
        [B.TORCH, 0.6, 4, 12], [I.COAL, 0.5, 3, 8], [I.IRON_INGOT, 0.55, 1, 4], [I.COPPER_INGOT, 0.45, 2, 6],
        [I.GOLD_INGOT, 0.35, 1, 3], [I.APPLE, 0.4, 1, 3], [I.COOKED_MEAT, 0.35, 1, 3], [I.ROPE, 0.35, 1, 3],
        [I.CRYSTAL, 0.22, 1, 2], [I.RUBY, 0.12, 1, 2], [I.SKY_SHARD, 0.08, 1, 1], [I.GOLDEN_APPLE, 0.06, 1, 1],
        [I.FEATHER, 0.25, 1, 4], [I.PUMPKIN_PIE, 0.2, 1, 2], [I.BREAD, 0.4, 1, 4], [I.SEEDS, 0.35, 2, 6],
        [I.DIAMOND, 0.12, 1, 2], [I.EMERALD, 0.15, 1, 3], [I.LAPIS, 0.2, 2, 6], [I.REDSTONE, 0.2, 2, 6],
        [I.BOOK, 0.2, 1, 3], [I.SLIMEBALL, 0.12, 1, 3], [I.HONEYCOMB, 0.12, 1, 3], [I.NETHERITE_SCRAP, 0.03, 1, 1],
        [I.AMETHYST_SHARD, 0.15, 1, 4], [I.GLOWSTONE_DUST, 0.15, 2, 5], [I.BONE_MEAL, 0.3, 2, 6], [I.LEATHER, 0.2, 1, 3],
        [I.CARROT, 0.2, 1, 4], [I.POTATO, 0.2, 1, 4], [I.PUMPKIN_SEEDS, 0.12, 1, 3], [I.MELON_SEEDS, 0.12, 1, 3],
        [I.HELMET_GOLD, 0.1, 1, 1], [I.CHESTPLATE_GOLD, 0.06, 1, 1], [I.BOOTS_IRON, 0.08, 1, 1], [I.CHESTPLATE_IRON, 0.05, 1, 1],
        [I.LEGGINGS_DIAMOND, 0.02, 1, 1],
      ];
      const items = [];
      for (const [id, p, a, b] of table) if (r() < p) items.push(worn({ id, count: a + Math.floor(r() * (b - a + 1)) }));
      // parfois un objet déjà enchanté
      if (r() < 0.2) {
        const pool = [I.SWORD_IRON, I.PICKAXE_IRON, I.AXE_IRON, I.SWORD_GOLD, I.HELMET_IRON, I.BOOTS_IRON, I.CHESTPLATE_GOLD];
        const id = pool[Math.floor(r() * pool.length)];
        items.push(worn({ id, count: 1, xp: 0, ench: CM.rollEnchants(id, 5 + Math.floor(r() * 16), r) }));
      }
      const saplings = CM.TAGS.saplings;
      if (r() < 0.4) items.push({ id: saplings[Math.floor(r() * saplings.length)], count: 1 + Math.floor(r() * 3) });
      const free = [...Array(27).keys()];
      for (const it of items.slice(0, 27)) slots[free.splice(Math.floor(r() * free.length), 1)[0]] = it;
    }
    spillChest(x, y, z) {
      if (this.net.isClient) return; // l'hôte fait tomber le contenu
      const k = this.bkey(x, y, z);
      const c = this.chests.get(k);
      if (!c) return;
      this.net.chestGone(k);
      for (const s of c) if (s) this.entities.addDrop(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, CM.stackExtra(s));
      this.chests.delete(k);
    }
    // Pousses d'arbre et cultures (croissance lente, lumière nécessaire).
    growPlants() {
      const w = this.world;
      for (const key of [...this.saplings]) {
        const [x, y, z] = key.split(',').map(Number);
        if (!w.loaded(x, z)) continue;
        const id = w.get(x, y, z);
        if (!CM.TAGS.saplings.includes(id)) {
          this.saplings.delete(key);
          continue;
        }
        if (Math.random() > 1 / 50) continue;
        if (w.skyAt(x, y, z) < 9 && w.blockLightAt(x, y, z) < 9) continue;
        this.growAt(x, y, z, false);
      }
      for (const key of [...this.crops]) {
        const [x, y, z] = key.split(',').map(Number);
        if (!w.loaded(x, z)) continue;
        const b = CM.blocks[w.get(x, y, z)];
        if (b.crop === undefined || (b.crop >= 3 && !b.fruit)) {
          this.crops.delete(key);
          continue;
        }
        // terre irriguée : pousse deux fois et demie plus vite
        const wet = CM.blocks[w.get(x, y - 1, z)].wet;
        if (Math.random() > (wet ? 1 / 40 : 1 / 100)) continue;
        if (w.skyAt(x, y, z) < 9 && w.blockLightAt(x, y, z) < 9) continue;
        this.growAt(x, y, z, false);
      }
      // terre labourée : s'humidifie près de l'eau, sèche sinon ; laissée vide et sèche, elle redevient de la terre
      for (const key of [...this.farmland]) {
        const [x, y, z] = key.split(',').map(Number);
        if (!w.loaded(x, z)) continue;
        const id = w.get(x, y, z);
        if (!CM.blocks[id].farmland) {
          this.farmland.delete(key);
          continue;
        }
        if (Math.random() > 0.25) continue;
        const above = CM.blocks[w.get(x, y + 1, z)];
        const wet = this.waterNear(x, y, z);
        if (above.solid) {
          w.setBlock(x, y, z, B.DIRT);
          this.farmland.delete(key);
        } else if (wet !== (id === B.FARMLAND_WET)) w.setBlock(x, y, z, wet ? B.FARMLAND_WET : B.FARMLAND);
        else if (!wet && above.crop === undefined && Math.random() < 1 / 40) {
          w.setBlock(x, y, z, B.DIRT);
          this.farmland.delete(key);
        }
      }
    }
    // De l'eau à 4 blocs ou moins (au même niveau ou juste au-dessus) ?
    waterNear(x, y, z) {
      const w = this.world;
      for (let dy = 0; dy <= 1; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (CM.isWater(w.get(x + dx, y + dy, z + dz))) return true;
      return false;
    }
    // Labourer (houe) : terre labourée, déjà irriguée s'il y a de l'eau à côté.
    till(x, y, z) {
      this.world.setBlock(x, y, z, this.waterNear(x, y, z) ? B.FARMLAND_WET : B.FARMLAND);
      this.farmland.add(x + ',' + y + ',' + z);
    }
    // Tige adulte : une citrouille ou une pastèque pousse sur une case voisine libre.
    growFruit(x, y, z, fruit) {
      const w = this.world;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      if (dirs.some(([dx, dz]) => w.get(x + dx, y, z + dz) === fruit)) return false;
      const [dx, dz] = dirs[Math.floor(Math.random() * 4)];
      const X = x + dx, Z = z + dz, cur = w.get(X, y, Z), under = CM.blocks[w.get(X, y - 1, Z)];
      if ((cur !== 0 && !CM.blocks[cur].replaceable) || CM.isWater(cur) || !(under.soil || under.farmland || under.id === B.DIRT)) return false;
      w.setBlock(X, y, Z, fruit);
      this.entities.burst(CM.Textures.layer.leaves, X + 0.5, y + 0.5, Z + 0.5, 8, { speed: 2, size: 0.06 });
      return true;
    }
    // Fait pousser ce qui se trouve en (x, y, z). bonemeal : poudre d'os (effet immédiat).
    growAt(x, y, z, bonemeal) {
      const w = this.world;
      const id = w.get(x, y, z);
      const b = CM.blocks[id];
      if (CM.TAGS.saplings.includes(id)) {
        if (bonemeal && Math.random() < 0.55) return true; // la poudre ne suffit pas toujours
        if (w.growTree(x, y, z, CM.woodOf(id).key)) {
          this.saplings.delete(x + ',' + y + ',' + z);
          this.entities.burst(CM.Textures.layer.leaves, x + 0.5, y + 1, z + 0.5, 12, { speed: 2, size: 0.07 });
          return true;
        }
        return bonemeal;
      }
      if (b.crop !== undefined && b.crop < 3) {
        const next = Math.min(3, b.crop + (bonemeal ? 1 + Math.floor(Math.random() * 2) : 1));
        w.setBlock(x, y, z, b.cropSet[next]);
        if (next >= 3 && !b.fruit) this.crops.delete(x + ',' + y + ',' + z);
        return true;
      }
      if (b.fruit && !bonemeal) return this.growFruit(x, y, z, b.fruit);
      if (bonemeal && b.soil) {
        // herbe et fleurs autour
        const flowers = [B.TALLGRASS, B.TALLGRASS, B.TALLGRASS, B.FLOWER, B.DANDELION, B.DAISY, B.AZURE_BLUET];
        let n = 0;
        for (let k = 0; k < 24; k++) {
          const X = x + Math.floor(Math.random() * 7) - 3, Z = z + Math.floor(Math.random() * 7) - 3;
          for (let Y = y + 2; Y >= y - 2; Y--) {
            if (CM.blocks[w.get(X, Y, Z)].soil && w.get(X, Y + 1, Z) === 0) {
              w.setBlock(X, Y + 1, Z, flowers[Math.floor(Math.random() * flowers.length)]);
              n++;
              break;
            }
          }
        }
        return n > 0;
      }
      return false;
    }
    // Hôte : bloc modifié par un invité (effets secondaires comme en solo).
    onRemoteBlock(x, y, z, old, id, fx, sound) {
      const k = x + ',' + y + ',' + z;
      if (old && CM.blocks[old].container && !CM.blocks[id].container) {
        this.chestAt(x, y, z);
        this.spillChest(x, y, z);
      }
      if (CM.TAGS.saplings.includes(id)) this.saplings.add(k);
      const b = CM.blocks[id];
      if (b.crop !== undefined && (b.crop < 3 || b.fruit)) this.crops.add(k);
      if (b.farmland) this.farmland.add(k);
      if (id === B.DAWN_HEART) this.onDawnHeart(x, y, z, true);
      if (fx) this.netBlockFx(x, y, z, old, id, sound);
    }
    // Son et particules d'un bloc modifié par un autre joueur, s'il est proche.
    netBlockFx(x, y, z, old, id, sound) {
      const p = this.player;
      if (!p || Math.hypot(p.x - x - 0.5, p.y - y, p.z - z - 0.5) > 24) return;
      if (old && !id) {
        this.entities.blockParticles(old, x, y, z, 10);
        if (sound) CM.Audio.play('break', { mat: CM.blocks[old].sound });
      } else if (id && sound) CM.Audio.play('place', { mat: CM.blocks[id].sound });
    }
    noteFx(x, y, z, n) {
      const p = this.player;
      if (p && Math.hypot(p.x - x, p.y - y, p.z - z) > 24) return;
      CM.Audio.play('note', { note: n });
      this.entities.burst(CM.Textures.layer.white, x + 0.5, y + 1.2, z + 0.5, 3, { speed: 1, grav: -2, life: 0.6, size: 0.08, emissive: true });
    }

    // --------------------------------------------------------- portes ---
    toggleDoor(x, y, z) {
      const b = CM.blocks[this.world.get(x, y, z)];
      if (!b.door) return;
      if (b.door.iron) {
        this.ui.toast('Une porte en fer ne s’ouvre qu’avec la redstone (bouton, levier…)', 'info', 'irondoor');
        return;
      }
      this.setDoorOpen(x, y, z, !b.door.open);
    }
    // Ouvre ou ferme une porte (les deux moitiés).
    setDoorOpen(x, y, z, open) {
      const w = this.world, b = CM.blocks[w.get(x, y, z)];
      if (!b.door) return;
      const y0 = b.door.half ? y - 1 : y;
      const { set, axis } = b.door;
      const n = open ? 1 : 0;
      const same = (id) => CM.blocks[id].door && CM.blocks[id].door.set === set;
      if (same(w.get(x, y0, z))) w.setBlock(x, y0, z, set[axis * 2 + n]);
      if (same(w.get(x, y0 + 1, z))) w.setBlock(x, y0 + 1, z, set[4 + axis * 2 + n]);
      CM.Audio.play('door', { open: !!n });
    }

    // ----------------------------------------------------------- lits -----
    tryBed(x, y, z) {
      const p = this.player;
      // dans le Nether, un lit explose (comme dans Minecraft)
      if (this.dim === 'nether') {
        this.world.setBlock(x, y, z, 0);
        this.ui.toast('Les lits explosent dans le Nether !', 'warn', 'bednether');
        if (this.net.isClient) this.entities.addTnt(x + 0.5, y, z + 0.5, 0.05);
        else this.explode(x + 0.5, y + 0.5, z + 0.5, 4.5);
        return;
      }
      if (!p.bed || p.bed.join() !== [x, y, z].join()) this.ui.toast('Point de réapparition défini sur ce lit', 'good', 'bedspawn');
      p.bed = [x, y, z];
      if (this.daylight >= 0.35) {
        this.ui.toast('Tu ne peux dormir que la nuit', 'info', 'bedday');
        return;
      }
      if (this.entities.mobs.some((m) => m.type === 'ombre' && Math.hypot(m.x - x, m.z - z) < 10 && Math.abs(m.y - y) < 6)) {
        this.ui.toast('Impossible de dormir : des Ombres rôdent tout près !', 'warn', 'bedombre');
        return;
      }
      const p2 = this.player;
      p2.sleeping = { x, y, z, t0: this.clock };
      this.clearInput();
      if (this.touch.enabled) this.touch.reset();
      this.releaseMouse();
      $('sleep-text').textContent = this.net.active ? 'Le jour se lèvera quand tout le monde sera couché.' : 'Le jour va bientôt se lever…';
      this.ui.show('sleep');
      this.net.sleepChanged(true);
    }
    wake(reason) {
      const p = this.player;
      if (!p || !p.sleeping) return;
      p.sleeping = null;
      p.y += 0.02;
      this.ui.hide('sleep');
      this.net.sleepChanged(false);
      if (reason === 'button' || reason === 'day') this.captureMouse();
    }
    // Solo ou hôte : quand tous les joueurs dorment depuis un moment, on passe au matin.
    checkSleep() {
      const p = this.player;
      if (this.net.isClient || !p.sleeping || this.clock - p.sleeping.t0 < 2.5) return;
      // (comme dans Minecraft, ceux qui sont dans le Nether ne comptent pas)
      for (const rp of this.net.remotes.values()) if (rp.seen && rp.alive && rp.dim === 'overworld' && !(rp.flags & 32)) return;
      if (this.time > 0.4) this.dayCount++;
      this.time = 0.02;
      this.ui.toast('Jour ' + (this.dayCount + 1) + ' — bien dormi !', 'good');
      if (this.net.isHost) this.net.broadcast({ t: 'time', ti: this.time, d: this.dayCount, l: this.dayLen });
    }

    // ------------------------------------------------ enchantement ------
    // Bibliothèques autour d'une table : à 2 blocs (même hauteur ou un au-dessus), de l'air entre les deux.
    shelves(x, y, z) {
      const w = this.world, out = [];
      for (let dy = 0; dy <= 1; dy++)
        for (let dz = -2; dz <= 2; dz++)
          for (let dx = -2; dx <= 2; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2 || w.get(x + dx, y + dy, z + dz) !== B.BOOKSHELF) continue;
            if (CM.blocks[w.get(x + Math.trunc(dx / 2), y + dy, z + Math.trunc(dz / 2))].solid) continue;
            out.push([x + dx, y + dy, z + dz]);
          }
      return out;
    }
    countShelves(x, y, z) {
      return Math.min(15, this.shelves(x, y, z).length);
    }
    // Livre qui flotte au-dessus des tables proches et s'ouvre quand on s'approche ; runes venues des bibliothèques.
    renderEnchantTables(dt) {
      const p = this.player, ents = this.entities, L = CM.Textures.layer;
      for (const k of this.enchTables) {
        const [x, y, z] = k.split(',').map(Number);
        if (Math.abs(x + 0.5 - p.x) > 24 || Math.abs(z + 0.5 - p.z) > 24 || Math.abs(y - p.y) > 16) continue;
        if (this.world.get(x, y, z) !== B.ENCHANTING_TABLE) continue;
        const cx = x + 0.5, cz = z + 0.5, near = Math.hypot(p.x - cx, p.z - cz);
        const cy = y + 1.1 + Math.sin(this.clock * 1.8 + x) * 0.05;
        const open = Math.max(0, Math.min(1, (4 - near) / 2));
        const l = ents.lightAt(cx, y + 1, cz);
        const M = this.bookM || (this.bookM = CM.mat4.create());
        CM.mat4.compose(M, cx, cy, cz, Math.atan2(-(p.x - cx), -(p.z - cz)) + Math.PI / 2, 0.35 * open, 0, 1);
        const a = 0.12 + open * 1.05;
        ents.part(this.batch, M, 0, 0, 0, 0, [0, -0.012, -0.17, 0.25, 0.012, 0.17], L.ench_cover, l, 0, null, 0, -a);
        ents.part(this.batch, M, 0, 0, 0, 0, [-0.25, -0.012, -0.17, 0, 0.012, 0.17], L.ench_cover, l, 0, null, 0, a);
        ents.part(this.batch, M, 0, 0, 0, 0, [0, 0.012, -0.15, 0.22, 0.04, 0.15], L.ench_pages, l, 0, null, 0, -a * 0.96);
        ents.part(this.batch, M, 0, 0, 0, 0, [-0.22, 0.012, -0.15, 0, 0.04, 0.15], L.ench_pages, l, 0, null, 0, a * 0.96);
        // runes : des bibliothèques vers le livre, quand un joueur est près
        if (near < 7 && Math.random() < dt * 5) {
          const sh = this.shelves(x, y, z);
          if (sh.length) {
            const [bx, by, bz] = sh[Math.floor(Math.random() * sh.length)];
            ents.particles.push({ x: bx + 0.5, y: by + 1, z: bz + 0.5, vx: (cx - bx - 0.5) * 0.7, vy: 0.3, vz: (cz - bz - 0.5) * 0.7, life: 1.4, layer: L.ench_glyph, u0: 0, v0: 0, size: 0.07, grav: 0.4, flags: 1, full: true });
          }
        }
      }
    }

    // ---------------------------------------------------------- golems ---
    // Citrouille posée sur un T de 4 blocs de fer : le golem se réveille.
    tryBuildGolem(x, y, z) {
      const w = this.world, IB = B.IRON_BLOCK;
      if (this.dim === 'nether') return false;
      if (w.get(x, y - 1, z) !== IB || w.get(x, y - 2, z) !== IB) return false;
      let arms = null;
      if (w.get(x - 1, y - 1, z) === IB && w.get(x + 1, y - 1, z) === IB) arms = [[x - 1, y - 1, z], [x + 1, y - 1, z]];
      else if (w.get(x, y - 1, z - 1) === IB && w.get(x, y - 1, z + 1) === IB) arms = [[x, y - 1, z - 1], [x, y - 1, z + 1]];
      if (!arms) return false;
      for (const [a, b, c] of [[x, y, z], [x, y - 1, z], [x, y - 2, z], ...arms]) w.setBlock(a, b, c, 0);
      this.entities.burst(CM.Textures.layer.white, x + 0.5, y - 1, z + 0.5, 24, { speed: 3, size: 0.08 });
      this.ui.toast('Un golem de fer se réveille ! Il protégera les environs des Ombres.', 'gold');
      if (this.net.isClient) this.net.send({ t: 'golem', x, y: y - 2, z });
      else this.spawnBuiltGolem(x, y - 2, z);
      return true;
    }
    spawnBuiltGolem(x, y, z) {
      const m = this.entities.addMob('golem', x + 0.5, y, z + 0.5);
      m.home = [x, z];
      m.built = true;
      this.golemHomes.push([x, y, z]);
      CM.Audio.play('golem');
    }

    // ---------------------------------------------------------- TNT -----
    primeTnt(x, y, z) {
      this.world.setBlock(x, y, z, 0);
      this.entities.addTnt(x + 0.5, y, z + 0.5, 3.2);
      CM.Audio.play('fuse');
    }
    explodeFx(x, y, z) {
      const p = this.player;
      if (p && Math.hypot(p.x - x, p.y - y, p.z - z) > 64) return;
      CM.Audio.play('explode');
      this.entities.burst(CM.Textures.layer.smoke, x, y, z, 40, { speed: 9, grav: -1, life: 1.4, size: 0.5, spread: 2 });
      this.entities.burst(CM.Textures.layer.white, x, y, z, 30, { speed: 12, grav: 4, life: 0.5, size: 0.12, emissive: true });
    }
    explode(x, y, z, power) {
      const w = this.world;
      const R = Math.ceil(power);
      this.explodeFx(x, y, z);
      this.net.fx({ k: 'boom', x, y, z });
      const chain = [];
      for (let dy = -R; dy <= R; dy++)
        for (let dz = -R; dz <= R; dz++)
          for (let dx = -R; dx <= R; dx++) {
            const d = Math.hypot(dx, dy, dz);
            if (d > power + (CM.hash3(x + dx, y + dy, z + dz, 7) - 0.5)) continue;
            const X = Math.floor(x) + dx, Y = Math.floor(y) + dy, Z = Math.floor(z) + dz;
            const id = w.get(X, Y, Z);
            if (!id || CM.isWater(id)) continue;
            const b = CM.blocks[id];
            if (b.unbreakable || b.hardness >= 10) continue;
            if (b.tnt) {
              chain.push([X, Y, Z]);
              continue;
            }
            if (b.container) {
              this.chestAt(X, Y, Z);
              w.setBlock(X, Y, Z, 0);
              this.spillChest(X, Y, Z);
              continue;
            }
            w.setBlock(X, Y, Z, 0);
            if (Math.random() < 0.3 && this.mode !== 'creative') for (const [did, n] of CM.blockDrops(id, Math.random)) this.entities.addDrop(did, n, X + 0.5, Y + 0.5, Z + 0.5);
          }
      for (const [X, Y, Z] of chain) {
        w.setBlock(X, Y, Z, 0);
        this.entities.addTnt(X + 0.5, Y, Z + 0.5, 0.5 + Math.random() * 1);
      }
      // dégâts aux créatures et au joueur
      const hurt = (ex, ey, ez) => Math.max(0, 1 - Math.hypot(ex - x, ey - y, ez - z) / (power * 2));
      const p = this.player;
      const hp = this.dim === this.playerDim ? hurt(p.x, p.y + 0.9, p.z) : 0;
      if (hp > 0) {
        p.damage(Math.round(hp * 22), x, z, 'Une explosion', true);
        p.vy += hp * 10;
      }
      for (const m of this.entities.mobs) {
        const k = hurt(m.x, m.y + 0.5, m.z);
        if (k > 0) this.entities.hurtMob(m, k * 30, [x, z]);
      }
      // invités pris dans l'explosion
      for (const rp of this.net.remotes.values()) {
        if (!rp.seen || !rp.alive || rp.dim !== this.dim) continue;
        const k = hurt(rp.x, rp.y + 0.9, rp.z);
        if (k > 0) rp.damage(Math.round(k * 22), x, z, 'Une explosion', true, k * 10);
      }
    }

    nearDawnHeart(x, z, r) {
      for (const [hx, , hz] of this.dawnHearts) if (Math.hypot(hx - x, hz - z) < r) return true;
      return false;
    }
    // remote : Cœur posé par un autre joueur (pas d'écran de victoire ici).
    onDawnHeart(x, y, z, remote) {
      this.dawnHearts.push([x, y, z]);
      for (const m of this.entities.mobs) {
        if (m.type === 'ombre' && Math.hypot(m.x - x, m.z - z) < 48) {
          m.dead = true;
          this.entities.burst(CM.Textures.layer.smoke, m.x, m.y + 1, m.z, 16, { speed: 2, grav: -1.5, life: 1.2, size: 0.3 });
        }
      }
      this.entities.burst(CM.Textures.layer.dawn_heart, x + 0.5, y + 0.5, z + 0.5, 60, { speed: 9, grav: 2, life: 1.6, size: 0.12, emissive: true });
      if (!this.victory && !remote) {
        this.victory = true;
        if (!this.net.isClient) this.time = 0.0;
        CM.Audio.play('victory');
        const s = this.stats;
        const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
        $('victory-text').innerHTML =
          "Le Cœur d'aube pulse d'une lumière éternelle : les Ombres ne s'approcheront plus jamais de ce lieu.<br><br>" +
          'Jours survécus : <b>' + this.dayCount + '</b> · Blocs minés : <b>' + sum(s.mined) + '</b><br>' +
          'Ombres vaincues : <b>' + (s.kills.ombre || 0) + '</b> · Morts : <b>' + (s.deaths || 0) + '</b><br><br>' +
          'Tu peux continuer à explorer et construire. Pose d’autres Cœurs pour protéger d’autres régions !';
        this.ui.closeInventory();
        this.releaseMouse();
        this.ui.show('victory');
      }
    }

    // --------------------------------------------------- environnement ---
    computeEnv(cam) {
      const t = this.time;
      const a = t * Math.PI * 2;
      const sy = Math.sin(a), sx = Math.cos(a);
      const l = Math.hypot(sx, sy, 0.3);
      const sunDir = [sx / l, sy / l, 0.3 / l];
      const day = CM.smoothstep(-0.18, 0.22, sy);
      this.daylight = day;
      const sunset = CM.clamp(1 - Math.abs(sy) * 3.2, 0, 1) * (sy > -0.35 ? 1 : 0);
      let zenith = mix([0.015, 0.02, 0.06], [0.3, 0.54, 0.95], day);
      let horizon = mix([0.04, 0.05, 0.12], [0.66, 0.8, 0.98], day);
      horizon = mix(horizon, [0.98, 0.56, 0.3], sunset * 0.55);
      const p = this.player;
      const w = this.world;
      const skyHere = w.skyAt(Math.floor(cam[0]), Math.floor(cam[1]), Math.floor(cam[2])) / 15;
      const cave = CM.clamp(skyHere * 1.3, 0, 1);
      let fogColor = mix([0.02, 0.02, 0.03], horizon, 0.25 + 0.75 * cave);
      const rd = this.renderer.renderDist * 16;
      let fog = [rd * 0.55, rd - 6];
      const camId = w.get(Math.floor(cam[0]), Math.floor(cam[1] + 0.05), Math.floor(cam[2]));
      const underwater = CM.isWater(camId);
      let flatSky = null, ambient = null;
      if (w.nether) {
        // Nether : brume colorée selon le biome, pas de ciel, lueur ambiante
        const bi = w.column(Math.floor(cam[0]), Math.floor(cam[2])).bi, BIO = CM.BIO;
        const want = bi === BIO.CRIMSON_FOREST ? [0.24, 0.03, 0.03] : bi === BIO.WARPED_FOREST ? [0.05, 0.12, 0.12] : bi === BIO.SOUL_VALLEY ? [0.1, 0.2, 0.19] : bi === BIO.BASALT_DELTAS ? [0.28, 0.24, 0.27] : [0.22, 0.04, 0.03];
        const nf = this.netherFog || (this.netherFog = want.slice());
        for (let i = 0; i < 3; i++) nf[i] += (want[i] - nf[i]) * 0.02;
        fogColor = nf.slice();
        fog = [rd * 0.2, rd * 0.8];
        flatSky = fogColor;
        ambient = [0.3, 0.2, 0.17];
      }
      if (underwater) {
        fogColor = mix([0.02, 0.05, 0.12], [0.1, 0.28, 0.55], day);
        fog = [0, 22];
        flatSky = [0.1, 0.22, 0.45];
      } else if (CM.isLava(camId)) {
        fogColor = [0.72, 0.22, 0.03];
        fog = [0, 1.6];
        flatSky = fogColor;
      }
      // vision nocturne (/vision) : on voit clair partout
      if (p.nightVision) ambient = ambient ? ambient.map((v) => Math.max(v, 0.62)) : [0.62, 0.62, 0.66];
      const env = {
        sunDir, zenith, horizon, fogColor, fog,
        day: 0.14 + 0.86 * day,
        skyTint: mix([0.5, 0.58, 0.95], [1.0, 0.99, 0.95], day),
        night: 1 - day,
        sunset,
        time: this.clock,
        underwater,
        flatSky,
        ambient,
        held: [cam[0], cam[1], cam[2], p.heldLight()],
        cam,
        // extension Lumière réaliste : couleurs des lumières
        real: CM.Light.on(this),
        heldCol: CM.Light.heldColor(this),
        handCol: CM.Light.colorAt(this.world, Math.floor(cam[0]), Math.floor(cam[1]), Math.floor(cam[2])),
      };
      CM.Weather.env(this, env); // pluie, orage
      return env;
    }

    // Main principale <-> main secondaire.
    swapHands() {
      const p = this.player;
      p.bowT = 0;
      p.blockT = 0;
      p.blocking = false;
      if (p.eating) p.eating = null;
      this.inventory.swapHands();
      CM.Audio.play('equip', { mat: 'leather' });
    }
    // Halos et fumée des torches (extension Lumière réaliste).
    glowQuads(right, up, cam) {
      const dt = Math.min(0.1, this.clock - (this.lastGlowClock || this.clock));
      this.lastGlowClock = this.clock;
      return CM.Light.glow(this, right, up, cam, dt);
    }

    // ---------------------------------------------------------- boucle ---
    frame(now) {
      requestAnimationFrame((t) => this.frame(t));
      // limite d'images par seconde (option)
      const cap = this.options.maxFps;
      if (cap > 0 && now - this.last < 1000 / cap - 1.5) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (!(dt > 0)) dt = 0.016;
      this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
      dt = Math.min(dt, 0.05);
      if (this.state !== 'playing') return;
      try {
        this.touch.frame();
        // en multijoueur, la pause ne fige pas le monde (les autres continuent de jouer)
        if (!this.paused || this.net.active) this.update(dt);
        this.render();
        this.ui.update(dt);
      } catch (err) {
        console.error(err);
        if (!this.errorShown) {
          this.errorShown = true;
          this.ui.toast('Erreur : ' + err.message, 'warn');
        }
      }
      this.input.pressed = {};
    }

    update(dt) {
      const net = this.net;
      this.clock += dt;
      this.stats.playTime += dt;
      if (this.settings.dayCycle !== false) this.time += (dt / this.dayLen) * (this.daylight < 0.35 ? 1.5 : 1);
      // invité : l'hôte annonce le changement de jour
      if (net.isClient) this.time = Math.min(this.time, 0.99999);
      else if (this.time >= 1) {
        this.time -= 1;
        this.dayCount++;
        this.ui.toast('Jour ' + (this.dayCount + 1) + ' — tu as survécu à la nuit !', 'good');
      }
      const prevDay = this.daylight;
      this.daylight = CM.smoothstep(-0.18, 0.22, Math.sin(this.time * Math.PI * 2));
      if (prevDay >= 0.35 && this.daylight < 0.35 && this.difficulty !== 'peaceful') {
        this.ui.toast('La nuit tombe… les Ombres se réveillent.', 'warn');
        this.entities.nightfall = true;
      }
      const active = (this.locked || this.forceInput) && !this.ui.invOpen && !this.paused && !net.chatOpen && !this.player.sleeping;
      if (this.player.sleeping) {
        this.checkSleep();
        if (this.daylight > 0.45 && this.clock - this.player.sleeping.t0 > 0.5) this.wake('day');
      }
      // l'hôte garde aussi chargés les alentours de ses invités (créatures, objets)
      this.world.stream(this.player.x, this.player.z, this.renderer.renderDist + 1, 5, net.isHost ? net.simCenters() : null);
      this.player.update(dt, active ? this.input : this.noInput);
      this.entities.update(dt);
      if (!net.isClient) {
        this.ticks.update(dt);
        this.growTimer -= dt;
        if (this.growTimer <= 0) {
          this.growTimer = 1;
          this.growPlants();
        }
        this.saveTimer -= dt;
        if (this.saveTimer <= 0) {
          this.saveTimer = this.options.autosave;
          this.save(true);
        }
      }
      // hôte : l'autre dimension continue de vivre tant qu'un invité s'y trouve
      if (net.isHost) this.updateOtherDims(dt);
      CM.Weather.update(this, dt);
      this.renderer.updateMeshes(this.world, this.player.x, this.player.z, 5, false);
      net.update(dt);
    }

    render() {
      const p = this.player;
      const bobOn = this.options.viewBob ? 1 : 0;
      const cam = [p.x, p.y + p.eyeH - p.eyeOffset + Math.sin(p.bob * 2) * 0.025 * p.bobAmp * bobOn, p.z];
      const env = this.computeEnv(cam);
      const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
      const right = [cy, 0, -sy];
      const up = [sy * sp, cp, cy * sp];
      const fwd = [-sy * cp, sp, -cy * cp];
      this.batch.reset(cam);
      this.overlay.reset(cam);
      this.hand.reset();
      this.translucent.reset(cam);
      this.entities.render(this.batch, { right, up }, this.clock);
      if (this.enchTables.size) {
        const rdt = Math.min(0.1, this.clock - (this.lastRenderClock || this.clock));
        this.renderEnchantTables(rdt);
      }
      if (this.techAnim && this.techAnim.size && CM.Tech) CM.Tech.render(this, this.batch);
      CM.Weather.render(this, this.translucent, cam); // pluie, neige, éclairs
      this.lastRenderClock = this.clock;
      this.net.renderPlayers(this.batch);
      // corde du grappin
      if (p.hook) {
        const a = [cam[0] + right[0] * 0.3 - up[0] * 0.25 + fwd[0] * 0.5, cam[1] + right[1] * 0.3 - up[1] * 0.25 + fwd[1] * 0.5, cam[2] + right[2] * 0.3 - up[2] * 0.25 + fwd[2] * 0.5];
        const b = [p.hook.x, p.hook.y, p.hook.z];
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const len = Math.hypot(d[0], d[1], d[2]);
        let s = [d[1] * fwd[2] - d[2] * fwd[1], d[2] * fwd[0] - d[0] * fwd[2], d[0] * fwd[1] - d[1] * fwd[0]];
        const sl = Math.hypot(s[0], s[1], s[2]) || 1;
        s = s.map((v) => (v / sl) * 0.035);
        const L = CM.Textures.layer.ropeline;
        this.batch.quad(
          [[a[0] - s[0], a[1] - s[1], a[2] - s[2]], [a[0] + s[0], a[1] + s[1], a[2] + s[2]], [b[0] + s[0], b[1] + s[1], b[2] + s[2]], [b[0] - s[0], b[1] - s[1], b[2] - s[2]]],
          [[0, 0], [1, 0], [1, len * 3], [0, len * 3]],
          L, 1, 0.3, 1, 0,
        );
        CM.mat4.compose(this.overlayM || (this.overlayM = CM.mat4.create()), b[0], b[1], b[2], this.clock * 3, 0, 0, 1);
        this.batch.box(this.overlayM, -0.1, -0.1, -0.1, 0.1, 0.1, 0.1, CM.Textures.layer.hook, 1, 0.3, 0);
      }
      // fissures du bloc en cours de minage
      if (p.mining && p.mining.progress > 0.02) {
        const stage = Math.min(9, Math.floor(p.mining.progress * 10));
        const m = p.mining;
        const M = this.crackM || (this.crackM = CM.mat4.create());
        CM.mat4.compose(M, m.x, m.y, m.z, 0, 0, 0, 1);
        const bx = m.box || CM.FULL_BOX;
        this.overlay.box(M, bx[0] - 0.003, bx[1] - 0.003, bx[2] - 0.003, bx[3] + 0.003, bx[4] + 0.003, bx[5] + 0.003, CM.Textures.layer['crack_' + stage], 1, 1, 1);
      }
      if (p.alive) p.buildHand(this.hand, this.clock);
      const t = p.target;
      const dyn = this.options.dynFov;
      const targetFov = this.options.fov + (dyn && p.sprinting ? 6 : 0) + (dyn && p.dashTime > 0 ? 12 : 0) + (dyn && p.flying && p.sprinting ? 6 : 0) - (dyn && p.bowT > 0 ? 12 * Math.min(1, p.bowT) : 0);
      this.fovCur += (targetFov - (this.fovCur || this.options.fov)) * 0.2;
      this.renderer.render({
        env,
        cam,
        yaw: p.yaw,
        pitch: p.pitch,
        fov: this.fovCur,
        batch: this.batch,
        overlay: this.overlay,
        hand: this.hand,
        translucent: this.translucent,
        glow: env.real && this.options.halos !== false ? this.glowQuads(right, up, cam) : null,
        target: t && this.player.alive && !this.ui.invOpen ? { x: t.x, y: t.y, z: t.z, h: CM.blocks[t.id].height, box: t.box } : null,
      });
      this.net.updateTags(cam);
    }
  }

  // Anciennes sauvegardes : les objets comptés dans les statistiques changent d'identifiant.
  function migrateStats(st, v) {
    if (v >= 4) return st;
    const out = Object.assign({}, st);
    for (const k of ['crafted', 'placed', 'mined']) {
      const m = {};
      for (const id in st[k] || {}) m[CM.migrateId(+id, v)] = st[k][id];
      out[k] = m;
    }
    return out;
  }

  window.addEventListener('load', () => {
    try {
      const game = new Game();
      CM.game = game;
      const params = new URLSearchParams(location.search);
      // lien d'invitation : ?join=CODE
      if (params.has('join')) game.openMulti(params.get('join'));
      if (params.has('autostart')) {
        game.autostart = true;
        const v = params.get('autostart');
        const mode = params.get('mode') === 'creative' ? 'creative' : 'survival';
        game.startWorld(v && /^\d+$/.test(v) ? +v : 12345, null, { mode, type: params.get('type') || 'normal', ext: { tech: params.get('tech') !== '0', light: params.get('light') !== '0', gravity: params.get('gravity') === '1' } });
      }
    } catch (err) {
      console.error(err);
      document.getElementById('menu').classList.add('hidden');
      document.getElementById('error').classList.remove('hidden');
      document.getElementById('error-text').textContent =
        'Impossible de démarrer le jeu : ' + err.message + '. Un navigateur récent avec WebGL2 est nécessaire (Chrome, Firefox, Edge, Safari 15+).';
    }
  });
})();
