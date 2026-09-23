'use strict';
// Contrôles tactiles (téléphones et tablettes) : joystick, caméra au doigt, boutons.
//  - moitié gauche de l'écran : joystick (il apparaît là où le pouce se pose) ;
//  - reste de l'écran : glisser pour regarder, toucher = poser / utiliser / frapper,
//    maintenir = miner ;
//  - boutons : saut, accroupi, course, ruée, miner, utiliser, inventaire, pause, jeter.
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
          if (onUp) onUp();
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
      hold('t-mine', () => {
        inp.mouse[0] = true;
        inp.pressed.mouse0 = true;
      }, () => (inp.mouse[0] = false));
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
      $('t-stick').classList.add('hidden');
      document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down'));
    }

    // Toucher bref : frapper la créature visée, sinon poser / utiliser.
    tapUse() {
      const g = this.game, p = g.player, inp = g.input;
      if (!p || !p.alive) return;
      const e = p.eye(), d = p.look();
      const mob = g.entities.raycastMob(e[0], e[1], e[2], d[0], d[1], d[2], 3.6);
      if (mob && (!p.target || mob.t < p.target.t)) {
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
      if (g.state !== 'playing' || g.paused || g.ui.invOpen || g.net.chatOpen) return;
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      const W = window.innerWidth;
      // pouce gauche : joystick (apparaît sous le doigt)
      if (e.clientX < W * 0.4 && !this.stick) {
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
      if (!cancel && !L.moved && performance.now() - L.t0 < TAP_MS) this.tapUse();
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
      // doigt immobile maintenu : on mine (ou frappe) jusqu'au relâchement
      const now = performance.now();
      for (const L of this.looks.values()) {
        if (!L.mining && !L.moved && now - L.t0 > HOLD_MS && active) {
          L.mining = true;
          inp.mouse[0] = true;
          inp.pressed.mouse0 = true;
        }
      }
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
