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
    sneak: 'KeyC', dash: 'KeyF', inventory: 'KeyE', drop: 'KeyQ',
  };
  CM.DEFAULT_OPTIONS = {
    // graphismes
    renderDist: 8, fov: 75, dynFov: true, brightness: 30, clouds: true, smoothLight: true, waving: true,
    particles: 2, viewBob: true, showHand: true, resolution: 100, maxFps: 0,
    // contrôles
    sens: 1, invertY: false, toggleSprint: false, autoJump: false, binds: null,
    // jeu
    showQuests: true, keepInventory: false, dayLength: 10, autosave: 45, toasts: 2,
    // audio
    volume: 50, sfxVolume: 100, mobVolume: 100, uiVolume: 100,
    // interface
    guiScale: 100, crosshair: 'cross', showCoords: false, showFps: false, showBiome: true, itemNames: true,
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
      const saved = JSON.parse(storageGet(OPT_KEY) || '{}');
      this.options = Object.assign({}, CM.DEFAULT_OPTIONS, saved);
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
        if (this.ui) this.ui.dirtyInv = true;
      };
      this.ui = new CM.UI(this);
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
      o.binds = Object.assign({}, this.binds);
      storageSet(OPT_KEY, JSON.stringify(o));
      if (this.ui) this.ui.optionsChanged();
    }
    remeshAll() {
      if (!this.world) return;
      for (const k of this.renderer.sections.keys()) this.world.dirty.set(k, 1);
    }
    get dayLen() {
      return Math.max(1, this.options.dayLength) * 60;
    }

    // ------------------------------------------------ démarrage monde -----
    async startWorld(seed, save, settings) {
      this.ui.hide('menu');
      this.ui.hide('newworld');
      this.ui.show('loading');
      $('load-fill').style.width = '0%';
      await new Promise((r) => setTimeout(r, 30));
      this.renderer.freeAll();
      const ws = Object.assign({ mode: 'survival', difficulty: 'normal', type: 'normal', biomeSize: 'normal', bonusChest: false, dayCycle: true, gen: 2 }, (save && save.settings) || settings || {});
      // monde créé avant la version 4 : on garde l'ancien relief (les bases restent intactes)
      if (save && (save.v || 2) < 4) ws.gen = 1;
      this.settings = ws;
      this.mode = ws.mode;
      this.difficulty = ws.difficulty;
      this.world = new CM.World(seed, save ? save.edits : null, ws);
      this.entities = new CM.Entities(this);
      this.stats = this.freshStats();
      this.time = 0.03;
      this.dayCount = 0;
      this.dawnHearts = [];
      this.victory = false;
      this.chests = new Map();
      this.noteBlocks = {};
      this.inventory.slots = new Array(36).fill(null);
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
      this.world.fixSpawn();
      this.world.dirty.clear();
      this.saplings = new Set();
      for (const id of CM.TAGS.saplings) for (const p of this.world.editedPositions(id)) this.saplings.add(p.join(','));
      this.crops = new Set();
      for (let s = 0; s < 3; s++) for (const p of this.world.editedPositions(B['WHEAT_' + s])) this.crops.add(p.join(','));
      this.growTimer = 1;
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
        this.player.fallStart = this.player.y;
        this.inventory.load(save.inv, v);
        this.time = save.time || 0.03;
        this.dayCount = save.dayCount || 0;
        this.stats = Object.assign(this.freshStats(), migrateStats(save.stats || {}, v));
        this.dawnHearts = save.dawnHearts || [];
        this.victory = !!save.victory;
        if (save.spawn) this.world.spawn = save.spawn;
        this.noteBlocks = save.noteBlocks || {};
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
      this.spawnInitialMobs();
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
      if (this.autostart) {
        this.forceInput = true;
      } else this.ui.show('start');
      if (save && save.v < 4) setTimeout(() => this.ui.toast('Nouvelle version : plus de 500 blocs, la faim remplace l’endurance, mode créatif…', 'gold'), 800);
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
        if (CM.itemInfo(id).type === 'tool') slots[i].xp = 0;
      });
      this.chests.set(x + ',' + y + ',' + z, slots);
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
      const p = this.player;
      return {
        v: SAVE_VERSION,
        seed: this.world.seed,
        settings: Object.assign({}, this.settings, { mode: this.mode, difficulty: this.difficulty }),
        spawn: this.world.spawn,
        edits: this.world.editsObject(),
        player: {
          x: p.alive ? p.x : this.world.spawn.x, y: p.alive ? p.y : this.world.spawn.y, z: p.alive ? p.z : this.world.spawn.z,
          yaw: p.yaw, pitch: p.pitch, health: p.alive ? p.health : 20, food: p.alive ? p.food : 20, sat: p.sat, flying: p.flying,
        },
        inv: this.inventory.serialize(),
        time: this.time,
        dayCount: this.dayCount,
        stats: this.stats,
        dawnHearts: this.dawnHearts,
        victory: this.victory,
        chests: Object.fromEntries(this.chests),
        noteBlocks: this.noteBlocks,
        savedAt: new Date().toISOString(),
      };
    }
    save(silent) {
      if (!this.world || this.state !== 'playing') return;
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
        if (this.state === 'playing' && !this.ui.invOpen && this.player.alive && !this.paused && $('victory').classList.contains('hidden')) this.pause();
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
        } else if (e.target === this.canvas && this.state === 'playing' && !this.paused && !this.ui.invOpen && this.player.alive) {
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
        inp.keys[c] = true;
        if (!e.repeat) inp.pressed[c] = true;
      });
      window.addEventListener('keyup', (e) => {
        inp.keys[e.code] = false;
      });
      window.addEventListener('blur', () => this.clearInput());
      window.addEventListener('beforeunload', () => {
        if (this.state === 'playing') this.save(true);
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
      on('btn-quit', () => {
        this.save(true);
        this.state = 'menu';
        this.paused = false;
        this.ui.hide('pause');
        this.ui.hide('hud');
        this.renderer.freeAll();
        this.refreshMenu();
        this.ui.show('menu');
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
    }
    setDifficulty(d) {
      this.difficulty = d;
      if (d === 'peaceful') for (const m of this.entities.mobs) if (m.type === 'ombre') m.dead = true;
    }

    // ------------------------------------------------ utilitaires jeu ----
    nearbyStations() {
      const p = this.player, w = this.world;
      const out = { table: false, forge: false, smithing: false };
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      for (let dy = -3; dy <= 4; dy++)
        for (let dz = -4; dz <= 4; dz++)
          for (let dx = -4; dx <= 4; dx++) {
            const st = CM.blocks[w.get(px + dx, py + dy, pz + dz)].station;
            if (st) out[st] = true;
          }
      if (this.mode === 'creative') out.table = out.forge = out.smithing = true;
      return out;
    }
    dropNearPlayer(id, count, extra) {
      const p = this.player;
      const f = [-Math.sin(p.yaw), -Math.cos(p.yaw)];
      const ex = extra && extra.xp !== undefined ? { xp: extra.xp } : null;
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
    chestAt(x, y, z) {
      const k = x + ',' + y + ',' + z;
      if (!this.chests.has(k)) {
        const slots = new Array(27).fill(null);
        if (this.world.isNaturalChest(x, y, z)) this.fillLoot(slots, x, y, z);
        this.chests.set(k, slots);
      }
      return this.chests.get(k);
    }
    // Butin (déterministe) des coffres trouvés dans les ruines.
    fillLoot(slots, x, y, z) {
      const r = CM.rng((CM.hash3(x, y, z, this.world.seed + 999) * 4294967296) >>> 0);
      const I = CM.I;
      const table = [
        [B.TORCH, 0.6, 4, 12], [I.COAL, 0.5, 3, 8], [I.IRON_INGOT, 0.55, 1, 4], [I.COPPER_INGOT, 0.45, 2, 6],
        [I.GOLD_INGOT, 0.35, 1, 3], [I.APPLE, 0.4, 1, 3], [I.COOKED_MEAT, 0.35, 1, 3], [I.ROPE, 0.35, 1, 3],
        [I.CRYSTAL, 0.22, 1, 2], [I.RUBY, 0.12, 1, 2], [I.SKY_SHARD, 0.08, 1, 1], [I.GOLDEN_APPLE, 0.06, 1, 1],
        [I.FEATHER, 0.25, 1, 4], [I.PUMPKIN_PIE, 0.2, 1, 2], [I.BREAD, 0.4, 1, 4], [I.SEEDS, 0.35, 2, 6],
        [I.DIAMOND, 0.12, 1, 2], [I.EMERALD, 0.15, 1, 3], [I.LAPIS, 0.2, 2, 6], [I.REDSTONE, 0.2, 2, 6],
        [I.BOOK, 0.2, 1, 3], [I.SLIMEBALL, 0.12, 1, 3], [I.HONEYCOMB, 0.12, 1, 3], [I.NETHERITE_SCRAP, 0.03, 1, 1],
        [I.AMETHYST_SHARD, 0.15, 1, 4], [I.GLOWSTONE_DUST, 0.15, 2, 5], [I.BONE_MEAL, 0.3, 2, 6], [I.LEATHER, 0.2, 1, 3],
      ];
      const items = [];
      for (const [id, p, a, b] of table) if (r() < p) items.push({ id, count: a + Math.floor(r() * (b - a + 1)) });
      const saplings = CM.TAGS.saplings;
      if (r() < 0.4) items.push({ id: saplings[Math.floor(r() * saplings.length)], count: 1 + Math.floor(r() * 3) });
      const free = [...Array(27).keys()];
      for (const it of items.slice(0, 27)) slots[free.splice(Math.floor(r() * free.length), 1)[0]] = it;
    }
    spillChest(x, y, z) {
      const k = x + ',' + y + ',' + z;
      const c = this.chests.get(k);
      if (!c) return;
      for (const s of c) if (s) this.entities.addDrop(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, s.xp !== undefined ? { xp: s.xp } : null);
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
        if (b.crop === undefined || b.crop >= 3) {
          this.crops.delete(key);
          continue;
        }
        if (Math.random() > 1 / 45) continue;
        if (w.skyAt(x, y, z) < 9 && w.blockLightAt(x, y, z) < 9) continue;
        this.growAt(x, y, z, false);
      }
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
        w.setBlock(x, y, z, B['WHEAT_' + next]);
        if (next >= 3) this.crops.delete(x + ',' + y + ',' + z);
        return true;
      }
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
    // ---------------------------------------------------------- TNT -----
    primeTnt(x, y, z) {
      this.world.setBlock(x, y, z, 0);
      this.entities.addTnt(x + 0.5, y, z + 0.5, 3.2);
      CM.Audio.play('fuse');
    }
    explode(x, y, z, power) {
      const w = this.world;
      const R = Math.ceil(power);
      CM.Audio.play('explode');
      this.entities.burst(CM.Textures.layer.smoke, x, y, z, 40, { speed: 9, grav: -1, life: 1.4, size: 0.5, spread: 2 });
      this.entities.burst(CM.Textures.layer.white, x, y, z, 30, { speed: 12, grav: 4, life: 0.5, size: 0.12, emissive: true });
      const chain = [];
      for (let dy = -R; dy <= R; dy++)
        for (let dz = -R; dz <= R; dz++)
          for (let dx = -R; dx <= R; dx++) {
            const d = Math.hypot(dx, dy, dz);
            if (d > power + (CM.hash3(x + dx, y + dy, z + dz, 7) - 0.5)) continue;
            const X = Math.floor(x) + dx, Y = Math.floor(y) + dy, Z = Math.floor(z) + dz;
            const id = w.get(X, Y, Z);
            if (!id || id === B.WATER) continue;
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
      const hp = hurt(p.x, p.y + 0.9, p.z);
      if (hp > 0) {
        p.damage(Math.round(hp * 22), x, z, 'Une explosion', true);
        p.vy += hp * 10;
      }
      for (const m of this.entities.mobs) {
        const k = hurt(m.x, m.y + 0.5, m.z);
        if (k > 0) this.entities.hurtMob(m, k * 30, [x, z]);
      }
    }

    nearDawnHeart(x, z, r) {
      for (const [hx, , hz] of this.dawnHearts) if (Math.hypot(hx - x, hz - z) < r) return true;
      return false;
    }
    onDawnHeart(x, y, z) {
      this.dawnHearts.push([x, y, z]);
      for (const m of this.entities.mobs) {
        if (m.type === 'ombre' && Math.hypot(m.x - x, m.z - z) < 48) {
          m.dead = true;
          this.entities.burst(CM.Textures.layer.smoke, m.x, m.y + 1, m.z, 16, { speed: 2, grav: -1.5, life: 1.2, size: 0.3 });
        }
      }
      this.entities.burst(CM.Textures.layer.dawn_heart, x + 0.5, y + 0.5, z + 0.5, 60, { speed: 9, grav: 2, life: 1.6, size: 0.12, emissive: true });
      if (!this.victory) {
        this.victory = true;
        this.time = 0.0;
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
      const underwater = w.get(Math.floor(cam[0]), Math.floor(cam[1] + 0.05), Math.floor(cam[2])) === B.WATER;
      if (underwater) {
        fogColor = mix([0.02, 0.05, 0.12], [0.1, 0.28, 0.55], day);
        fog = [0, 22];
      }
      return {
        sunDir, zenith, horizon, fogColor, fog,
        day: 0.14 + 0.86 * day,
        skyTint: mix([0.5, 0.58, 0.95], [1.0, 0.99, 0.95], day),
        night: 1 - day,
        sunset,
        time: this.clock,
        underwater,
        held: [cam[0], cam[1], cam[2], p.heldLight()],
        cam,
      };
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
        if (!this.paused) this.update(dt);
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
      this.clock += dt;
      this.stats.playTime += dt;
      if (this.settings.dayCycle !== false) this.time += (dt / this.dayLen) * (this.daylight < 0.35 ? 1.5 : 1);
      if (this.time >= 1) {
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
      const active = (this.locked || this.forceInput) && !this.ui.invOpen;
      this.world.stream(this.player.x, this.player.z, this.renderer.renderDist + 1, 5);
      this.player.update(dt, active ? this.input : this.noInput);
      this.entities.update(dt);
      this.growTimer -= dt;
      if (this.growTimer <= 0) {
        this.growTimer = 1;
        this.growPlants();
      }
      this.renderer.updateMeshes(this.world, this.player.x, this.player.z, 5, false);
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) {
        this.saveTimer = this.options.autosave;
        this.save(true);
      }
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
        this.overlay.box(M, -0.003, -0.003, -0.003, 1.003, (m.h || 1) + 0.003, 1.003, CM.Textures.layer['crack_' + stage], 1, 1, 1);
      }
      if (p.alive) p.buildHand(this.hand, this.clock);
      const t = p.target;
      const dyn = this.options.dynFov;
      const targetFov = this.options.fov + (dyn && p.sprinting ? 6 : 0) + (dyn && p.dashTime > 0 ? 12 : 0) + (dyn && p.flying && p.sprinting ? 6 : 0);
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
        target: t && this.player.alive && !this.ui.invOpen ? { x: t.x, y: t.y, z: t.z, h: CM.blocks[t.id].height } : null,
      });
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
      if (params.has('autostart')) {
        game.autostart = true;
        const v = params.get('autostart');
        const mode = params.get('mode') === 'creative' ? 'creative' : 'survival';
        game.startWorld(v && /^\d+$/.test(v) ? +v : 12345, null, { mode, type: params.get('type') || 'normal' });
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
