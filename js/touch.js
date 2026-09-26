'use strict';
// Contrôles tactiles (téléphones et tablettes) : joystick, caméra au doigt, boutons.
//  - bas gauche de l'écran : joystick (il apparaît là où le pouce se pose) ;
//  - reste de l'écran : glisser pour regarder ; toucher = poser / utiliser / frapper et
//    appui long = casser, sur le bloc (ou la créature) qui se trouve sous le doigt ;
//  - boutons : saut, accroupi, course, ruée, utiliser, inventaire, pause, jeter.
(function () {
  const $ = (id) => document.getElementById(id);

  // L'appareil a-t-il un écran tactile comme pointeur principal ?
  CM.isTouchDevice = function () {
    try {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    } catch (e) {
      /* ignore */
    }
    return 'ontouchstart' in window && navigator.maxTouchPoints > 0 && !(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
  };

  // Boutons que l'on peut déplacer, agrandir, rendre transparents ou masquer (Options).
  const LAYOUT = {
    't-jump': 'Sauter', 't-sneak': 'S’accroupir', 't-sprint': 'Courir', 't-dash': 'Ruée', 't-use': 'Poser au centre',
    't-inv': 'Inventaire', 't-drop': 'Jeter', 't-chat': 'Tchat', 't-pause': 'Pause',
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const TAP_MS = 280; // un toucher plus court = « toucher »
  const HOLD_MS = 330; // maintenu plus longtemps sans bouger = miner
  const MOVE_TOL = 14; // pixels de tolérance avant de considérer que le doigt glisse
  const STICK_R = 62; // rayon du joystick (pixels)

  class Touch {
    constructor(game) {
      this.game = game;
      this.enabled = false;
      this.stick = null; // { id, ox, oy, x, y }
      this.looks = new Map(); // pointerId -> { x, y, t0, sx, sy, moved, mining }
      this.analog = { x: 0, y: 0 };
      this.releaseUse = 0;
      this.sneak = false;
      this.sprint = false;
      this.tapAim = null; // visée d'un toucher bref (gardée quelques images)
      this.build();
    }

    build() {
      const layer = $('touch-layer');
      const opt = { passive: false };
      layer.addEventListener('pointerdown', (e) => this.down(e), opt);
      layer.addEventListener('pointermove', (e) => this.move(e), opt);
      layer.addEventListener('pointerup', (e) => this.up(e), opt);
      layer.addEventListener('pointercancel', (e) => this.up(e, true), opt);
      // gestes du navigateur (zoom, défilement) désactivés sur la zone de jeu
      for (const ev of ['touchstart', 'touchmove', 'touchend']) layer.addEventListener(ev, (e) => e.preventDefault(), opt);
      document.addEventListener('gesturestart', (e) => e.preventDefault());
      const hold = (id, onDown, onUp) => {
        const el = $(id);
        el.addEventListener('pointerdown', (e) => {
          if (this.editing) return;
          e.preventDefault();
          e.stopPropagation();
          CM.Audio.init();
          try {
            el.setPointerCapture(e.pointerId);
          } catch (err) {
            /* ignore */
          }
          el.classList.add('down');
          onDown();
        });
        const end = (e) => {
          e.preventDefault();
          el.classList.remove('down');
          if (onUp && !this.editing) onUp();
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
      };
      const g = this.game, inp = g.input;
      const K = () => g.binds;
      hold('t-jump', () => {
        inp.keys[K().jump] = true;
        inp.pressed[K().jump] = true;
      }, () => (inp.keys[K().jump] = false));
      hold('t-sneak', () => {
        this.sneak = !this.sneak;
        $('t-sneak').classList.toggle('on', this.sneak);
      });
      hold('t-sprint', () => {
        this.sprint = !this.sprint;
        $('t-sprint').classList.toggle('on', this.sprint);
      });
      hold('t-dash', () => (inp.pressed[K().dash] = true));
      hold('t-use', () => this.tapUse());
      hold('t-inv', () => {
        if (!g.player || !g.player.alive || g.paused) return;
        if (g.ui.invOpen) g.ui.closeInventory();
        else g.ui.openInventory();
      });
      hold('t-pause', () => {
        if (g.state === 'playing' && !g.paused) g.pause();
      });
      hold('t-drop', () => g.dropHeld(false));
      this.buildEditor();
      // barre rapide : toucher une case la sélectionne
      $('hotbar').addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        const slot = e.target.closest('.slot');
        if (!slot) return;
        e.preventDefault();
        const i = [...$('hotbar').children].indexOf(slot);
        if (i >= 0) g.inventory.selected = i;
      });
    }

    // ------------------------------------------ disposition des boutons --
    // Positions enregistrées en fraction de l'écran (s'adaptent à toutes les tailles).
    applyLayout() {
      const o = this.game.options, lay = o.touchLayout || {};
      const all = (o.touchOpacity === undefined ? 100 : o.touchOpacity) / 100;
      for (const id in LAYOUT) {
        const el = $(id), L = lay[id] || {};
        const custom = L.x !== undefined;
        el.classList.toggle('t-custom', custom);
        el.style.left = custom ? L.x * 100 + '%' : '';
        el.style.top = custom ? L.y * 100 + '%' : '';
        if (L.s && L.s !== 1) el.style.setProperty('--t', 'calc(var(--tsize, 1) * ' + L.s + ')');
        else el.style.removeProperty('--t');
        const op = all * (L.o === undefined ? 1 : L.o);
        el.style.opacity = op < 1 ? String(op) : '';
        el.classList.toggle('t-hidden', !!L.hide);
      }
      $('t-stick').style.opacity = all < 1 ? String(all) : '';
    }
    entry(id) {
      const o = this.game.options;
      if (!o.touchLayout) o.touchLayout = {};
      return o.touchLayout[id] || (o.touchLayout[id] = {});
    }
    buildEditor() {
      for (const id in LAYOUT) {
        const el = $(id);
        el.addEventListener('pointerdown', (e) => {
          if (!this.editing) return;
          e.preventDefault();
          e.stopPropagation();
          try {
            el.setPointerCapture(e.pointerId);
          } catch (err) {
            /* ignore */
          }
          const r = el.getBoundingClientRect();
          this.drag = { id, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2), x0: e.clientX, y0: e.clientY, moved: false };
          this.selectEdit(id);
        });
        el.addEventListener('pointermove', (e) => {
          const d = this.drag;
          if (!this.editing || !d || d.id !== id) return;
          if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
          d.moved = true;
          const L = this.entry(id);
          L.x = clamp((e.clientX - d.dx) / window.innerWidth, 0.02, 0.98);
          L.y = clamp((e.clientY - d.dy) / window.innerHeight, 0.02, 0.98);
          this.applyLayout();
        });
        const end = () => {
          if (this.drag && this.drag.id === id) this.drag = null;
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
      }
      const o = () => this.game.options;
      const range = (id, fn) => $(id).addEventListener('input', (e) => fn(+e.target.value));
      range('te-size', (v) => {
        if (!this.sel) return;
        this.entry(this.sel).s = v / 100;
        this.applyLayout();
        this.refreshEdit();
      });
      range('te-opa', (v) => {
        if (!this.sel) return;
        this.entry(this.sel).o = v / 100;
        this.applyLayout();
        this.refreshEdit();
      });
      range('te-all', (v) => {
        o().touchOpacity = v;
        this.applyLayout();
        this.refreshEdit();
      });
      $('te-hide').addEventListener('change', (e) => {
        if (!this.sel) return;
        this.entry(this.sel).hide = e.target.checked;
        this.applyLayout();
      });
      $('te-reset').addEventListener('click', () => {
        if (!confirm('Remettre tous les boutons tactiles à leur place d’origine ?')) return;
        o().touchLayout = {};
        o().touchOpacity = 100;
        this.selectEdit(null);
        this.applyLayout();
        this.refreshEdit();
      });
      $('te-done').addEventListener('click', () => this.closeEditor());
      // le panneau se déplace par son titre (pour atteindre les boutons qu'il cache)
      const panel = document.querySelector('.te-panel'), title = document.querySelector('.te-title');
      let pd = null;
      title.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const r = panel.getBoundingClientRect();
        pd = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        try {
          title.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      });
      title.addEventListener('pointermove', (e) => {
        if (!pd) return;
        const r = panel.getBoundingClientRect();
        panel.style.translate = 'none';
        panel.style.left = clamp(e.clientX - pd.dx, 0, window.innerWidth - r.width) + 'px';
        panel.style.top = clamp(e.clientY - pd.dy, 0, window.innerHeight - 40) + 'px';
      });
      const stop = () => (pd = null);
      title.addEventListener('pointerup', stop);
      title.addEventListener('pointercancel', stop);
    }
    openEditor(onDone) {
      const o = this.game.options;
      o.touchLayout = JSON.parse(JSON.stringify(o.touchLayout || {}));
      this.onEditDone = onDone;
      this.editing = true;
      this.reset();
      document.body.classList.add('touch-edit');
      $('touch-editor').classList.remove('hidden');
      this.selectEdit(null);
      this.applyLayout();
      this.refreshEdit();
    }
    closeEditor() {
      if (!this.editing) return;
      this.editing = false;
      this.drag = null;
      this.selectEdit(null);
      document.body.classList.remove('touch-edit');
      $('touch-editor').classList.add('hidden');
      this.game.applyOptions(); // enregistre
      if (this.onEditDone) this.onEditDone();
    }
    selectEdit(id) {
      if (this.sel) $(this.sel).classList.remove('te-sel');
      this.sel = id;
      if (id) $(id).classList.add('te-sel');
      this.refreshEdit();
    }
    refreshEdit() {
      const o = this.game.options, L = (this.sel && (o.touchLayout || {})[this.sel]) || {};
      const all = o.touchOpacity === undefined ? 100 : o.touchOpacity;
      $('te-all').value = all;
      $('te-all-v').textContent = all + ' %';
      $('te-one').classList.toggle('off', !this.sel);
      $('te-name').textContent = this.sel ? 'Bouton : ' + LAYOUT[this.sel] + ' ' + $(this.sel).textContent : 'Touche un bouton pour le régler';
      const s = Math.round((L.s || 1) * 100), op = Math.round((L.o === undefined ? 1 : L.o) * 100);
      $('te-size').value = s;
      $('te-size-v').textContent = s + ' %';
      $('te-opa').value = op;
      $('te-opa-v').textContent = op + ' %';
      $('te-hide').checked = !!L.hide;
    }

    setEnabled(on) {
      this.enabled = on;
      document.body.classList.toggle('touch', on);
      this.reset();
    }
    reset() {
      const inp = this.game.input;
      this.stick = null;
      this.looks.clear();
      this.analog.x = this.analog.y = 0;
      inp.analog = null;
      inp.mouse[0] = false;
      inp.mouse[2] = false;
      this.tapAim = null;
      if (this.game.player) this.game.player.aimDir = null;
      $('t-stick').classList.add('hidden');
      document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down'));
    }

    // Visée au doigt : direction du rayon qui passe par le point (x, y) de l'écran.
    aimAt(x, y) {
      const g = this.game, p = g.player;
      if (!p) return;
      if (g.options.touchAim === 'center' || x === undefined) {
        p.aimDir = null;
        return;
      }
      const W = g.canvas.clientWidth || window.innerWidth, H = g.canvas.clientHeight || window.innerHeight;
      const t = Math.tan(((g.fovCur || g.options.fov) * Math.PI) / 360);
      const a = ((x / W) * 2 - 1) * t * (W / H), b = (1 - (y / H) * 2) * t;
      const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
      // même repère que la caméra (droite, haut, avant)
      const d = [-sy * cp + cy * a + sy * sp * b, sp + cp * b, -cy * cp - sy * a + cy * sp * b];
      const l = Math.hypot(d[0], d[1], d[2]);
      p.aimDir = [d[0] / l, d[1] / l, d[2] / l];
    }

    // Toucher bref : frapper la créature visée, sinon poser / utiliser.
    // (x, y) : point touché (visée au doigt) ; sans coordonnées, le centre de l'écran.
    tapUse(x, y) {
      const g = this.game, p = g.player, inp = g.input;
      if (!p || !p.alive) return;
      this.aimAt(x, y);
      this.tapAim = p.aimDir ? { x, y, n: 4 } : null;
      p.updateTarget();
      const e = p.eye(), d = p.aim();
      const mob = g.entities.raycastMob(e[0], e[1], e[2], d[0], d[1], d[2], 3.6);
      if (mob && (!p.target || mob.t < p.target.t) && mob.mob.type !== 'villager') {
        inp.pressed.mouse0 = true;
        return;
      }
      inp.mouse[2] = true;
      inp.pressed.mouse2 = true;
      this.releaseUse = 2;
    }

    down(e) {
      if (!this.enabled) return;
      e.preventDefault();
      CM.Audio.init();
      const g = this.game;
      // tchat ouvert : toucher le jeu le ferme (le bouton 💬 garde son propre effet)
      if (g.net.chatOpen && !(e.target.closest && e.target.closest('#t-chat'))) {
        g.net.closeChat(false);
        return;
      }
      if (g.state !== 'playing' || g.paused || g.ui.invOpen || g.net.chatOpen) return;
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      const W = window.innerWidth, H = window.innerHeight;
      // pouce gauche : joystick (apparaît sous le doigt) ; le haut de l'écran reste libre
      // pour toucher les blocs qui s'y trouvent
      if (e.clientX < W * 0.4 && e.clientY > H * 0.3 && !this.stick) {
        this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        const st = $('t-stick');
        st.style.left = e.clientX + 'px';
        st.style.top = e.clientY + 'px';
        st.classList.remove('hidden');
        this.updateStick();
        return;
      }
      this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, mining: false });
    }

    move(e) {
      if (!this.enabled) return;
      e.preventDefault();
      if (this.stick && e.pointerId === this.stick.id) {
        this.stick.x = e.clientX;
        this.stick.y = e.clientY;
        this.updateStick();
        return;
      }
      const L = this.looks.get(e.pointerId);
      if (!L) return;
      const g = this.game, p = g.player;
      const dx = e.clientX - L.x, dy = e.clientY - L.y;
      L.x = e.clientX;
      L.y = e.clientY;
      if (Math.hypot(e.clientX - L.sx, e.clientY - L.sy) > MOVE_TOL) L.moved = true;
      if (!p || g.paused) return;
      const s = 0.0062 * (g.options.touchSens || 1);
      p.yaw -= dx * s;
      p.pitch -= dy * s * (g.options.invertY ? -1 : 1);
      p.pitch = CM.clamp(p.pitch, -1.55, 1.55);
    }

    up(e, cancel) {
      if (!this.enabled) return;
      e.preventDefault();
      if (this.stick && e.pointerId === this.stick.id) {
        this.stick = null;
        this.analog.x = this.analog.y = 0;
        $('t-stick').classList.add('hidden');
        return;
      }
      const L = this.looks.get(e.pointerId);
      if (!L) return;
      this.looks.delete(e.pointerId);
      if (L.mining) {
        if (![...this.looks.values()].some((o) => o.mining)) this.game.input.mouse[0] = false;
        return;
      }
      if (!cancel && !L.moved && performance.now() - L.t0 < TAP_MS) this.tapUse(L.x, L.y);
    }

    updateStick() {
      const s = this.stick;
      let dx = s.x - s.ox, dy = s.y - s.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) {
        // le joystick suit le pouce s'il dépasse le bord
        s.ox += (dx / d) * (d - STICK_R);
        s.oy += (dy / d) * (d - STICK_R);
        dx = s.x - s.ox;
        dy = s.y - s.oy;
        const st = $('t-stick');
        st.style.left = s.ox + 'px';
        st.style.top = s.oy + 'px';
      }
      $('t-knob').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      let ax = dx / STICK_R, ay = -dy / STICK_R;
      const m = Math.hypot(ax, ay);
      if (m < 0.15) ax = ay = 0;
      this.analog.x = ax;
      this.analog.y = ay;
    }

    // Appelé à chaque image, avant la mise à jour du jeu.
    frame() {
      if (!this.enabled) return;
      const g = this.game, inp = g.input, K = g.binds;
      const active = g.state === 'playing' && !g.paused && !g.ui.invOpen && !g.net.chatOpen;
      inp.analog = active && (this.analog.x || this.analog.y) ? this.analog : null;
      // boutons à bascule (on ne touche pas au clavier s'ils sont éteints)
      if (this.sneak || this.sneakSet) inp.keys[K.sneak] = active && this.sneak;
      if (this.sprint || this.sprintSet) inp.keys[K.sprint] = active && this.sprint;
      this.sneakSet = this.sneak;
      this.sprintSet = this.sprint;
      // doigt immobile maintenu : on casse le bloc sous le doigt (ou on frappe) jusqu'au relâchement
      const now = performance.now();
      let aim = null;
      for (const L of this.looks.values()) {
        if (!L.mining && !L.moved && now - L.t0 > HOLD_MS && active) {
          L.mining = true;
          inp.mouse[0] = true;
          inp.pressed.mouse0 = true;
        }
        if (L.mining) aim = L;
      }
      // la visée suit le doigt qui casse (même s'il glisse pour tourner la caméra)
      if (aim) this.aimAt(aim.x, aim.y);
      else if (this.tapAim && this.tapAim.n-- > 0) this.aimAt(this.tapAim.x, this.tapAim.y);
      else if (g.player && g.player.aimDir) g.player.aimDir = null;
      if (this.releaseUse > 0 && --this.releaseUse === 0) inp.mouse[2] = false;
      const p = g.player;
      if (p) {
        $('t-dash').classList.toggle('cool', p.dashCd > 0 || !p.canSprint());
        $('t-jump').textContent = p.flying ? '▲' : '⤒';
        $('t-sneak').textContent = p.flying ? '▼' : '⤓';
      }
    }
  }

  CM.Touch = Touch;
})();
