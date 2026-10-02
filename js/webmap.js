'use strict';
// Carte du monde sur le site (adresse ?carte, ou lien « Carte du serveur ») : la page se connecte au
// serveur en spectateur (sans jouer, sans compter comme joueur), refait le monde normal à partir de
// la graine et des blocs modifiés, et le dessine vu du ciel, avec les terrains protégés et les
// joueurs en direct. Glisser pour se déplacer, molette / pincer / + − pour zoomer.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ZOOMS = [0.25, 0.5, 1, 2, 3, 4, 6, 8];
  const BUDGET = 14; // ms de génération par image
  const MAX_TILES = 9000;
  const DIM = { nether: 'Nether', end: 'End' };

  const M = {
    w: null,
    tiles: new Map(), // "cx,cz" -> { cv, h }
    redo: new Set(), // tronçons à refaire (blocs modifiés)
    players: [],
    soc: null,
    x: 0,
    z: 0,
    zi: 3, // index de ZOOMS
    dirty: true,
    follow: null,

    async start(game, code) {
      this.game = game;
      document.body.classList.add('webmap');
      for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
      $('webmap').classList.remove('hidden');
      this.cv = $('wm-cv');
      this.bind();
      this.resize();
      const srv = !code || code === '1' || /^serveur$/i.test(code);
      this.code = srv ? CM.SERVER_CODE : String(code).toUpperCase();
      this.connect();
      requestAnimationFrame((t) => this.frame(t));
    },
    status(s, warn) {
      const el = $('wm-status');
      el.textContent = s;
      el.classList.toggle('warn', !!warn);
    },
    async connect() {
      try {
        const r = await this.game.net.spectate(this.code, (m) => this.onMsg(m), () => this.lost(), (s) => this.status(s));
        this.link = r.link;
        const w = r.w;
        $('wm-title').textContent = '🗺 ' + (w.srv ? w.name : 'Partie de ' + w.name);
        this.w = new CM.World(w.seed, w.edits || null, w.settings || {});
        if (w.spawn) this.w.spawn = w.spawn;
        this.soc = w.soc || null;
        this.players = Array.isArray(w.p) ? w.p : [];
        const first = this.players.find((p) => p[3] === 'overworld');
        const at = first ? { x: first[1], z: first[2] } : this.w.spawn;
        this.x = at.x;
        this.z = at.z;
        this.status('');
        this.listPlayers();
        this.dirty = true;
        clearInterval(this.pingT);
        this.pingT = setInterval(() => this.link && this.link.send({ t: 'ping' }), 2000);
      } catch (e) {
        console.warn(e);
        this.status(CM.netErrorText(Object.assign({}, e, { type: e && e.type, message: e && e.message, server: this.code === CM.SERVER_CODE })) + ' — nouvel essai dans 15 s', true);
        setTimeout(() => this.connect(), 15000);
      }
    },
    lost() {
      this.link = null;
      clearInterval(this.pingT);
      this.status('Connexion perdue (serveur qui redémarre ?) — nouvel essai dans 15 s', true);
      setTimeout(() => this.connect(), 15000);
    },
    onMsg(m) {
      if (m.t === 'mapp' && Array.isArray(m.p)) {
        this.players = m.p.filter((p) => Array.isArray(p) && typeof p[0] === 'string');
        if (this.follow) {
          const p = this.players.find((q) => q[0] === this.follow && q[3] === 'overworld');
          if (p) {
            this.x = p[1];
            this.z = p[2];
          }
        }
        this.listPlayers();
        this.dirty = true;
      } else if (m.t === 'set' && Array.isArray(m.b) && this.w) {
        // blocs posés ou cassés : le tronçon sera redessiné
        for (let i = 0; i + 3 < m.b.length; i += 4) {
          const x = m.b[i] | 0, y = m.b[i + 1] | 0, z = m.b[i + 2] | 0, id = m.b[i + 3] | 0;
          if (!CM.blocks[id]) continue;
          this.w.applyRemote(x, y, z, id);
          this.redo.add((x >> 4) + ',' + (z >> 4));
        }
      } else if (m.t === 'soc' && m.p && typeof m.p === 'object') {
        this.soc = m.p;
        this.dirty = true;
      }
    },

    // ------------------------------------------------- tronçons vus du ciel --
    tile(cx, cz) {
      const w = this.w, c = w.generateChunk(cx, cz);
      const { H, MINY } = CM.WORLD;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 16;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16), px = img.data;
      const h = new Int16Array(256), north = this.tiles.get(cx + ',' + (cz - 1));
      const B = c.blocks, col = CM.Comfort.blockColor;
      for (let lz = 0; lz < 16; lz++)
        for (let lx = 0; lx < 16; lx++) {
          let y = H - 1, rgb = [10, 10, 14], top = MINY;
          for (; y > MINY; y--) {
            const id = B[((y - MINY) << 8) | (lz << 4) | lx];
            if (!id) continue;
            const b = CM.blocks[id];
            if (!b || (b.render === 'model' && !b.solid && !b.plant)) continue;
            rgb = col(id);
            top = y;
            if (CM.isWater(id)) {
              let d = 0;
              while (d < 8 && CM.isWater(B[((y - d - 1 - MINY) << 8) | (lz << 4) | lx])) d++;
              rgb = rgb.map((v) => v * (1.1 - d * 0.07));
            }
            break;
          }
          h[(lz << 4) | lx] = top;
          // relief : plus clair si plus haut que la case au nord, plus sombre sinon
          const n = lz > 0 ? h[((lz - 1) << 4) | lx] : north ? north.h[(15 << 4) | lx] : top;
          const f = top > n ? 1.12 : top < n ? 0.84 : 1;
          const o = ((lz << 4) | lx) * 4;
          px[o] = rgb[0] * f;
          px[o + 1] = rgb[1] * f;
          px[o + 2] = rgb[2] * f;
          px[o + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
      return { cv, h };
    },
    // Génère les tronçons visibles qui manquent (les plus proches du centre d'abord).
    generate() {
      if (!this.w) return;
      const t0 = performance.now(), v = this.view();
      // d'abord les tronçons modifiés
      for (const k of [...this.redo]) {
        this.redo.delete(k);
        if (!this.tiles.has(k)) continue;
        const [cx, cz] = k.split(',').map(Number);
        this.tiles.set(k, this.tile(cx, cz));
        this.dirty = true;
        if (performance.now() - t0 > BUDGET) return;
      }
      const ccx = Math.floor(this.x / 16), ccz = Math.floor(this.z / 16);
      const want = [];
      for (let cz = v.cz0; cz <= v.cz1; cz++)
        for (let cx = v.cx0; cx <= v.cx1; cx++) if (!this.tiles.has(cx + ',' + cz)) want.push([(cx - ccx) ** 2 + (cz - ccz) ** 2, cx, cz]);
      if (!want.length) return;
      want.sort((a, b) => a[0] - b[0]);
      for (const [, cx, cz] of want) {
        this.tiles.set(cx + ',' + cz, this.tile(cx, cz));
        this.dirty = true;
        if (performance.now() - t0 > BUDGET) break;
      }
      // trop de tronçons gardés : on oublie les plus éloignés
      if (this.tiles.size > MAX_TILES) {
        const all = [...this.tiles.keys()].map((k) => {
          const [cx, cz] = k.split(',').map(Number);
          return [(cx - ccx) ** 2 + (cz - ccz) ** 2, k];
        });
        all.sort((a, b) => b[0] - a[0]);
        for (let i = 0; i < all.length - MAX_TILES * 0.8; i++) this.tiles.delete(all[i][1]);
      }
    },
    view() {
      const s = ZOOMS[this.zi], W = this.cv.width / s, Hh = this.cv.height / s;
      const x0 = this.x - W / 2, z0 = this.z - Hh / 2;
      return { s, x0, z0, cx0: Math.floor(x0 / 16), cz0: Math.floor(z0 / 16), cx1: Math.floor((x0 + W) / 16), cz1: Math.floor((z0 + Hh) / 16) };
    },

    // ------------------------------------------------------------- dessin --
    draw() {
      const ctx = this.cv.getContext('2d'), v = this.view(), dpr = this.dpr;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0d0f16';
      ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      const T = 16 * v.s;
      for (let cz = v.cz0; cz <= v.cz1; cz++)
        for (let cx = v.cx0; cx <= v.cx1; cx++) {
          const t = this.tiles.get(cx + ',' + cz);
          // (un pixel de plus : pas de fente entre deux tronçons)
          if (t) ctx.drawImage(t.cv, Math.floor((cx * 16 - v.x0) * v.s), Math.floor((cz * 16 - v.z0) * v.s), Math.ceil(T) + 1, Math.ceil(T) + 1);
        }
      // terrains protégés (monde normal)
      const soc = this.soc;
      if (soc && soc.claims) {
        ctx.font = 'bold ' + Math.round(11 * dpr) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        for (const [k, o] of Object.entries(soc.claims)) {
          if (k[0] !== '0') continue;
          const [cx, cz] = k.slice(2).split(',').map(Number);
          if (cx < v.cx0 || cx > v.cx1 || cz < v.cz0 || cz > v.cz1) continue;
          const sx = (cx * 16 - v.x0) * v.s, sz = (cz * 16 - v.z0) * v.s;
          const hue = this.hue(o);
          ctx.fillStyle = 'hsla(' + hue + ',80%,55%,0.28)';
          ctx.fillRect(sx, sz, T, T);
          ctx.strokeStyle = 'hsla(' + hue + ',85%,60%,0.9)';
          ctx.lineWidth = Math.max(1, dpr);
          // (bordure seulement là où le terrain voisin n'est pas au même joueur)
          const same = (dx, dz) => soc.claims['0:' + (cx + dx) + ',' + (cz + dz)] === o;
          ctx.beginPath();
          if (!same(0, -1)) {
            ctx.moveTo(sx, sz);
            ctx.lineTo(sx + T, sz);
          }
          if (!same(0, 1)) {
            ctx.moveTo(sx, sz + T);
            ctx.lineTo(sx + T, sz + T);
          }
          if (!same(-1, 0)) {
            ctx.moveTo(sx, sz);
            ctx.lineTo(sx, sz + T);
          }
          if (!same(1, 0)) {
            ctx.moveTo(sx + T, sz);
            ctx.lineTo(sx + T, sz + T);
          }
          ctx.stroke();
          if (v.s >= 3 && !same(-1, 0) && !same(0, -1)) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillText((soc.names && soc.names[o]) || o, sx + T / 2, sz + T / 2 + 4 * dpr);
          }
        }
      }
      // joueurs
      ctx.textAlign = 'left';
      ctx.font = 'bold ' + Math.round(13 * dpr) + 'px system-ui, sans-serif';
      for (const p of this.players) {
        if (p[3] !== 'overworld') continue;
        const sx = (p[1] - v.x0) * v.s, sz = (p[2] - v.z0) * v.s, r = 6 * dpr;
        ctx.fillStyle = 'hsl(' + this.hue(p[0].toLowerCase()) + ',90%,60%)';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(sx, sz, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const lab = (p[4] ? '[' + p[4] + '] ' : '') + p[0];
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(lab, sx + r + 4 * dpr, sz + 4 * dpr);
        ctx.fillStyle = '#fff';
        ctx.fillText(lab, sx + r + 4 * dpr, sz + 4 * dpr);
      }
      // point d'apparition
      if (this.w) {
        const sp = this.w.spawn, sx = (sp.x - v.x0) * v.s, sz = (sp.z - v.z0) * v.s;
        ctx.font = Math.round(16 * dpr) + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⭐', sx, sz + 6 * dpr);
      }
    },
    hue(k) {
      let h = 0;
      for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
      return h % 360;
    },
    listPlayers() {
      const ps = this.players;
      $('wm-count').textContent = ps.length + ' joueur' + (ps.length > 1 ? 's' : '') + ' en ligne';
      const h = ps
        .map((p) => {
          const where = DIM[p[3]];
          return '<button data-p="' + esc(p[0]) + '"' + (where ? ' disabled' : '') + (this.follow === p[0] ? ' class="on"' : '') + '><i style="background:hsl(' + this.hue(p[0].toLowerCase()) + ',90%,60%)"></i>' + esc((p[4] ? '[' + p[4] + '] ' : '') + p[0]) + (where ? ' <em>(' + where + ')</em>' : '') + '</button>';
        })
        .join('');
      const el = $('wm-players');
      if (el._h !== h) el.innerHTML = el._h = h || '<span class="wm-none">Personne sur le serveur pour l’instant</span>';
    },
    frame() {
      requestAnimationFrame((t) => this.frame(t));
      this.generate();
      if (this.dirty) {
        this.dirty = false;
        this.draw();
      }
    },

    // ------------------------------------------------------- commandes --
    resize() {
      const dpr = (this.dpr = Math.min(2, window.devicePixelRatio || 1));
      this.cv.width = Math.round(this.cv.clientWidth * dpr);
      this.cv.height = Math.round(this.cv.clientHeight * dpr);
      this.dirty = true;
    },
    zoom(d, at) {
      const zi = Math.max(0, Math.min(ZOOMS.length - 1, this.zi + d));
      if (zi === this.zi) return;
      // (le point sous le doigt ou la souris reste en place)
      if (at) {
        const v = this.view(), wx = v.x0 + at[0] / v.s, wz = v.z0 + at[1] / v.s;
        const s2 = ZOOMS[zi];
        this.x = wx - (at[0] - this.cv.width / 2) / s2;
        this.z = wz - (at[1] - this.cv.height / 2) / s2;
      }
      this.zi = zi;
      this.dirty = true;
      this.zoomLabel();
    },
    zoomLabel() {
      $('wm-zoom-lv').textContent = ZOOMS[this.zi] >= 1 ? '×' + ZOOMS[this.zi] : '1/' + 1 / ZOOMS[this.zi];
    },
    coords(ex, ey) {
      const r = this.cv.getBoundingClientRect(), v = this.view();
      const x = Math.floor(v.x0 + ((ex - r.left) * this.dpr) / v.s), z = Math.floor(v.z0 + ((ey - r.top) * this.dpr) / v.s);
      let s = 'X ' + x + ' · Z ' + z;
      const o = this.soc && this.soc.claims && this.soc.claims['0:' + Math.floor(x / 16) + ',' + Math.floor(z / 16)];
      if (o) s += ' · 🏡 terrain de ' + ((this.soc.names && this.soc.names[o]) || o);
      $('wm-coords').textContent = s;
    },
    bind() {
      const cv = this.cv, pts = new Map();
      let pinch = 0;
      window.addEventListener('resize', () => this.resize());
      cv.addEventListener('pointerdown', (e) => {
        cv.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
        }
      });
      cv.addEventListener('pointermove', (e) => {
        this.coords(e.clientX, e.clientY);
        const p = pts.get(e.pointerId);
        if (!p) return;
        if (pts.size === 1) {
          const s = ZOOMS[this.zi] / this.dpr;
          this.x -= (e.clientX - p[0]) / s;
          this.z -= (e.clientY - p[1]) / s;
          if (Math.abs(e.clientX - p[0]) + Math.abs(e.clientY - p[1]) > 2) this.follow = null;
          this.dirty = true;
        }
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch && (d / pinch > 1.35 || d / pinch < 0.74)) {
            const r = cv.getBoundingClientRect();
            this.zoom(d > pinch ? 1 : -1, [(((a[0] + b[0]) / 2 - r.left) * this.dpr), (((a[1] + b[1]) / 2 - r.top) * this.dpr)]);
            pinch = d;
          }
        }
      });
      const up = (e) => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = 0;
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const r = cv.getBoundingClientRect();
          this.zoom(e.deltaY < 0 ? 1 : -1, [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr]);
        },
        { passive: false },
      );
      $('wm-in').addEventListener('click', () => this.zoom(1));
      $('wm-out').addEventListener('click', () => this.zoom(-1));
      $('wm-home').addEventListener('click', () => {
        if (!this.w) return;
        this.follow = null;
        this.x = this.w.spawn.x;
        this.z = this.w.spawn.z;
        this.dirty = true;
      });
      $('wm-players').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-p]');
        if (!b || b.disabled) return;
        const p = this.players.find((q) => q[0] === b.dataset.p);
        if (!p) return;
        this.follow = this.follow === p[0] ? null : p[0];
        this.x = p[1];
        this.z = p[2];
        this.dirty = true;
        this.listPlayers();
      });
      this.zoomLabel();
    },
  };
  CM.WebMap = M;
})();
