'use strict';
// Décoration posée : panneaux (texte), tableaux, cadres, porte-armures, juke-box et musique.
// État partagé (g.deco) : { signs: {clé de bloc: {l: [4 lignes], r | n, c}}, items: [objets posés],
// jukes: {clé de bloc: {d: disque, n: numéro de lecture}} }.
// Chaque changement est une « opération » appliquée ici et envoyée aux autres joueurs
// (un invité l'envoie à l'hôte, qui la renvoie aux autres).
(function () {
  const mat4 = CM.mat4;
  const TAU = Math.PI * 2;
  const r2 = (v) => Math.round(v * 100) / 100;
  const key = (dim, x, y, z) => CM.dimPre(dim) + x + ',' + y + ',' + z;
  const clean = (s) =>
    String(s || '')
      .replace(/[\u0000-\u001f<>]/g, '')
      .slice(0, 15);
  const cleanStack = (s) => {
    if (!s || !CM.itemInfo(s.id | 0)) return null;
    const o = { id: s.id | 0, count: 1 };
    if (s.xp !== undefined) o.xp = Math.max(0, +s.xp || 0);
    const en = CM.cleanEnch(s.ench);
    if (en) o.ench = en;
    return o;
  };
  const DYE_TEXT = { BLACK: '#1c1c1c', WHITE: '#f4f4f4', RED: '#c0262d', ORANGE: '#e2701e', YELLOW: '#e8c434', LIME: '#6fb82d', GREEN: '#4a6b1c', CYAN: '#1d8b92', LIGHT_BLUE: '#3aa3d8', BLUE: '#35399d', PURPLE: '#7b2fae', MAGENTA: '#c13fb6', PINK: '#e88aa8', BROWN: '#744a2a', GRAY: '#474f52', LIGHT_GRAY: '#9d9d97' };

  const D = (CM.Deco = {
    key,
    fresh: () => ({ signs: {}, items: [], jukes: {} }),
    load(g, data) {
      const d = data && typeof data === 'object' ? data : {};
      g.deco = { signs: d.signs && typeof d.signs === 'object' ? d.signs : {}, items: Array.isArray(d.items) ? d.items.filter((e) => e && e.t) : [], jukes: d.jukes && typeof d.jukes === 'object' ? d.jukes : {} };
      D.stopAll();
    },
    save: (g) => g.deco || D.fresh(),

    // ------------------------------------------------------ opérations --
    apply(g, o) {
      const s = g.deco || (g.deco = D.fresh());
      if (!o || typeof o !== 'object') return false;
      switch (o.k) {
        case 'sign': {
          if (typeof o.b !== 'string' || o.b.length > 40) return false;
          if (!o.s) delete s.signs[o.b];
          else {
            const l = Array.isArray(o.s.l) ? o.s.l.slice(0, 4).map(clean) : ['', '', '', ''];
            while (l.length < 4) l.push('');
            const v = { l };
            if (Number.isFinite(o.s.r)) v.r = o.s.r & 15;
            if (Array.isArray(o.s.n)) v.n = [Math.sign(o.s.n[0] | 0), Math.sign(o.s.n[1] | 0)];
            if (typeof o.s.c === 'string' && DYE_TEXT[o.s.c]) v.c = o.s.c;
            s.signs[o.b] = v;
          }
          return true;
        }
        case 'add': {
          const e = o.e;
          if (!e || !['p', 'f', 's'].includes(e.t) || !Number.isFinite(e.u) || s.items.some((q) => q.u === e.u)) return false;
          const it = { u: e.u, t: e.t, d: CM.isDim(e.d) ? e.d : 'overworld', x: e.x | 0, y: e.y | 0, z: e.z | 0 };
          if (e.t === 'p') {
            const p = CM.PAINTINGS.find((q) => q.k === e.a);
            if (!p || !Array.isArray(e.n)) return false;
            it.a = p.k;
            it.n = [Math.sign(e.n[0] | 0), Math.sign(e.n[1] | 0)];
          } else if (e.t === 'f') {
            if (!Array.isArray(e.n)) return false;
            it.n = [Math.sign(e.n[0] | 0), Math.sign(e.n[1] | 0), Math.sign(e.n[2] | 0)];
            it.it = cleanStack(e.it);
            it.r = (e.r | 0) & 7;
          } else {
            it.yaw = Number.isFinite(e.yaw) ? e.yaw : 0;
            it.ar = [0, 1, 2, 3].map((k) => cleanStack(e.ar && e.ar[k]));
            it.h = cleanStack(e.h);
          }
          s.items.push(it);
          return true;
        }
        case 'del': {
          const n = s.items.length;
          s.items = s.items.filter((q) => q.u !== o.u);
          return s.items.length !== n;
        }
        case 'set': {
          const it = s.items.find((q) => q.u === o.u);
          if (!it) return false;
          if (o.f === 'it' && it.t === 'f') it.it = cleanStack(o.v);
          else if (o.f === 'r' && it.t === 'f') it.r = (o.v | 0) & 7;
          else if (o.f === 'ar' && it.t === 's' && Array.isArray(o.v)) it.ar = [0, 1, 2, 3].map((k) => cleanStack(o.v[k]));
          else if (o.f === 'h' && it.t === 's') it.h = cleanStack(o.v);
          else return false;
          return true;
        }
        case 'juke': {
          if (typeof o.b !== 'string' || o.b.length > 40) return false;
          if (!o.v) delete s.jukes[o.b];
          else if (Number.isFinite(o.v.d) && CM.DISCS[o.v.d]) s.jukes[o.b] = { d: o.v.d | 0, n: o.v.n | 0 };
          return true;
        }
      }
      return false;
    },
    // Action du joueur de cet écran : appliquée tout de suite, puis partagée.
    act(g, o) {
      if (!D.apply(g, o)) return false;
      if (g.net.isClient) g.net.send({ t: 'dco', o });
      else if (g.net.isHost) g.net.broadcast({ t: 'dco', o });
      return true;
    },
    // Hôte : opération d'un invité (vérifiée, appliquée, renvoyée aux autres).
    fromGuest(g, e, o) {
      if (D.apply(g, o)) g.net.broadcast({ t: 'dco', o }, e.pid);
    },
    newUid: () => Math.floor(Math.random() * 2147483647) + 1,

    // Un bloc change (tous les écrans le voient) : panneau, juke-box ou support d'un objet posé disparaît.
    onEdit(g, dim, x, y, z, id, old) {
      const s = g.deco;
      if (!s) return;
      const k = key(dim, x, y, z), ob = old !== undefined && CM.blocks[old];
      if (ob && ob.sign && !CM.blocks[id].sign) delete s.signs[k];
      if (old === CM.B.JUKEBOX && id !== CM.B.JUKEBOX && s.jukes[k]) {
        if (!g.net.isClient) g.entities.addDrop(CM.DISC_IDS[s.jukes[k].d], 1, x + 0.5, y + 0.8, z + 0.5);
        delete s.jukes[k];
      }
      // un bloc apparaît dans la case d'un objet posé, ou son support disparaît : l'objet tombe
      if (g.net.isClient || !s.items.length) return;
      const solid = CM.blocks[id].solid;
      for (const it of s.items.slice()) {
        if (it.d !== dim) continue;
        if (D.cells(it).some(([cx, cy, cz, sx, sy, sz]) => (solid && cx === x && cy === y && cz === z) || (!solid && sx === x && sy === y && sz === z))) D.breakItem(g, it, true);
      }
    },
    // Cases occupées par un objet posé : [x, y, z, (support) sx, sy, sz].
    cells(it) {
      if (it.t === 'p') {
        const p = CM.PAINTINGS.find((q) => q.k === it.a), [nx, nz] = it.n, rx = nz, rz = -nx, out = [];
        for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
          const x = it.x + rx * i, y = it.y + j, z = it.z + rz * i;
          out.push([x, y, z, x - nx, y, z - nz]);
        }
        return out;
      }
      if (it.t === 'f') return [[it.x, it.y, it.z, it.x - it.n[0], it.y - it.n[1], it.z - it.n[2]]];
      return [[it.x, it.y, it.z, it.x, it.y - 1, it.z]];
    },
    // Retire un objet posé ; drop : il tombe (avec ce qu'il porte).
    breakItem(g, it, drop) {
      D.act(g, { k: 'del', u: it.u });
      if (!drop) return;
      const e = g.entities, I = CM.I, c = D.center(it);
      const give = (id, s) => e.addDrop(id, 1, c[0], c[1], c[2], s ? CM.stackExtra(s) : null);
      give(it.t === 'p' ? I.PAINTING : it.t === 'f' ? I.ITEM_FRAME : I.ARMOR_STAND);
      if (it.t === 'f' && it.it) give(it.it.id, it.it);
      if (it.t === 's') for (const s of it.ar.concat([it.h])) if (s) give(s.id, s);
      CM.Audio.play('break', { mat: 'wood' });
    },
    center(it) {
      if (it.t === 'p') {
        const p = CM.PAINTINGS.find((q) => q.k === it.a), [nx, nz] = it.n;
        return [it.x + 0.5 + nz * (p.w - 1) * 0.5 - nx * 0.45, it.y + p.h * 0.5, it.z + 0.5 - nx * (p.w - 1) * 0.5 - nz * 0.45];
      }
      if (it.t === 'f') return [it.x + 0.5 - it.n[0] * 0.45, it.y + 0.5 - it.n[1] * 0.45, it.z + 0.5 - it.n[2] * 0.45];
      return [it.x + 0.5, it.y + 1, it.z + 0.5];
    },
    // Boîte de sélection d'un objet posé.
    box(it) {
      if (it.t === 's') return [it.x + 0.15, it.y, it.z + 0.15, it.x + 0.85, it.y + 1.95, it.z + 0.85];
      if (it.t === 'f') {
        const [nx, ny, nz] = it.n, c = D.center(it), e = [nx ? 0.05 : 0.38, ny ? 0.05 : 0.38, nz ? 0.05 : 0.38];
        return [c[0] - e[0], c[1] - e[1], c[2] - e[2], c[0] + e[0], c[1] + e[1], c[2] + e[2]];
      }
      const p = CM.PAINTINGS.find((q) => q.k === it.a), [nx, nz] = it.n;
      const xs = [it.x, it.x + nz * (p.w - 1)], zs = [it.z, it.z - nx * (p.w - 1)];
      let x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
      if (nx > 0) x1 = x0 + 0.08;
      if (nx < 0) x0 = x1 - 0.08;
      if (nz > 0) z1 = z0 + 0.08;
      if (nz < 0) z0 = z1 - 0.08;
      return [x0, it.y, z0, x1, it.y + p.h, z1];
    },
    raycast(g, e, d, maxD) {
      let best = null, bt = maxD;
      for (const it of (g.deco && g.deco.items) || []) {
        if (it.d !== g.playerDim || Math.abs(it.x - e[0]) > 8 || Math.abs(it.z - e[2]) > 8) continue;
        const b = D.box(it), t = CM.rayBox(e[0], e[1], e[2], d[0], d[1], d[2], b[0], b[1], b[2], b[3], b[4], b[5]);
        if (t >= 0 && t < bt) {
          bt = t;
          best = it;
        }
      }
      return best ? { it: best, t: bt } : null;
    },
    // Clics sur un objet posé (avant les blocs). true : clic pris.
    playerActions(p, input, e, d) {
      const g = p.game;
      if (!input.pressed.mouse0 && !input.pressed.mouse2) return false;
      const h = D.raycast(g, e, d, 4.5);
      if (!h || (p.target && p.target.t < h.t)) return false;
      const it = h.it, inv = g.inventory, held = inv.held(), I = CM.I, creative = p.creative;
      if (input.pressed.mouse0 && p.attackCd <= 0) {
        p.swing = 1;
        p.attackCd = 0.25;
        p.mining = null;
        // cadre avec un objet : l'objet tombe d'abord
        if (it.t === 'f' && it.it) {
          if (!creative) g.entities.addDrop(it.it.id, 1, ...D.center(it), CM.stackExtra(it.it));
          D.act(g, { k: 'set', u: it.u, f: 'it', v: null });
          CM.Audio.play('pop');
          return true;
        }
        D.breakItem(g, it, !creative);
        return true;
      }
      if (!input.pressed.mouse2) return false;
      if (it.t === 'f') {
        if (!it.it) {
          if (!held) return true;
          D.act(g, { k: 'set', u: it.u, f: 'it', v: Object.assign({ id: held.id, count: 1 }, CM.stackExtra(held) || {}) });
          if (!creative) p.consume(1);
          CM.Audio.play('place', { mat: 'wood' });
        } else {
          D.act(g, { k: 'set', u: it.u, f: 'r', v: ((it.r || 0) + 1) & 7 });
          CM.Audio.play('click');
        }
        p.swing = 1;
        return true;
      }
      if (it.t === 's') {
        const info = held && CM.itemInfo(held.id);
        if (info && info.type === 'armor') {
          const ar = it.ar.slice(), old = ar[info.slot];
          ar[info.slot] = Object.assign({ id: held.id, count: 1 }, CM.stackExtra(held) || {});
          inv.slots[inv.selected] = old ? Object.assign({ id: old.id, count: 1 }, CM.stackExtra(old) || {}) : held.count > 1 ? Object.assign({}, held, { count: held.count - 1 }) : null;
          inv.changed();
          D.act(g, { k: 'set', u: it.u, f: 'ar', v: ar });
          CM.Audio.play('equip', { mat: info.mat });
        } else if (held && !(info && info.isBlock)) {
          const old = it.h;
          D.act(g, { k: 'set', u: it.u, f: 'h', v: Object.assign({ id: held.id, count: 1 }, CM.stackExtra(held) || {}) });
          if (held.count > 1) held.count--;
          else inv.slots[inv.selected] = null;
          if (old) {
            const left = inv.add(old.id, 1, CM.stackExtra(old));
            if (left) g.dropNearPlayer(old.id, 1, old);
          }
          inv.changed();
          CM.Audio.play('equip', {});
        } else if (!held) {
          // main vide : on reprend une pièce (du haut vers le bas), puis l'objet tenu
          const k = [0, 1, 2, 3].find((i) => it.ar[i]);
          const take = k !== undefined ? it.ar[k] : it.h;
          if (take) {
            if (k !== undefined) {
              const ar = it.ar.slice();
              ar[k] = null;
              D.act(g, { k: 'set', u: it.u, f: 'ar', v: ar });
            } else D.act(g, { k: 'set', u: it.u, f: 'h', v: null });
            const left = inv.add(take.id, 1, CM.stackExtra(take));
            if (left) g.dropNearPlayer(take.id, 1, take);
            CM.Audio.play('equip', {});
          }
        }
        p.swing = 1;
        return true;
      }
      return false;
    },
    // Poser un tableau, un cadre ou un porte-armure (objet en main).
    place(p, info) {
      const g = p.game, w = g.world, t = p.target;
      if (!t) return false;
      const dim = g.playerDim, s = g.deco || (g.deco = D.fresh());
      const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
      const busy = (cx, cy, cz, n) => w.solidAt(cx, cy, cz) || CM.blocks[w.get(cx, cy, cz)].sign || s.items.some((it) => it.d === dim && (it.t === 's' ? D.cells(it).some((c) => c[0] === cx && (c[1] === cy || c[1] + 1 === cy) && c[2] === cz) : (!n || (it.n[0] === n[0] && it.n[it.n.length - 1] === n[n.length - 1])) && D.cells(it).some((c) => c[0] === cx && c[1] === cy && c[2] === cz)));
      let e = null;
      if (info.type === 'painting') {
        if (t.ny !== 0) return false;
        const nx = t.nx, nz = t.nz, rx = nz, rz = -nx;
        const fits = (pw, ph, i0, j0) => {
          for (let j = 0; j < ph; j++)
            for (let i = 0; i < pw; i++) {
              const cx = x + rx * (i0 + i), cy = y + j0 + j, cz = z + rz * (i0 + i);
              if (busy(cx, cy, cz, [nx, nz]) || !w.solidAt(cx - nx, cy, cz - nz)) return false;
            }
          return true;
        };
        const ok = [];
        for (const pt of CM.PAINTINGS)
          for (let j0 = 0; j0 > -pt.h; j0--)
            for (let i0 = 0; i0 > -pt.w; i0--)
              if (fits(pt.w, pt.h, i0, j0)) {
                ok.push({ pt, i0, j0 });
                j0 = -99;
                break;
              }
        if (!ok.length) {
          g.ui.toast('Pas de place pour un tableau ici', 'info', 'paint');
          return true;
        }
        const big = Math.max(...ok.map((o) => o.pt.w * o.pt.h)), pick = ok.filter((o) => o.pt.w * o.pt.h === big);
        const c = pick[Math.floor(Math.random() * pick.length)];
        e = { u: D.newUid(), t: 'p', d: dim, x: x + rx * c.i0, y: y + c.j0, z: z + rz * c.i0, a: c.pt.k, n: [nx, nz] };
        g.ui.toast('🖼 « ' + c.pt.name + ' »', 'info', 'paint');
      } else if (info.type === 'frame') {
        const n = [t.nx, t.ny, t.nz];
        if (busy(x, y, z, n)) return true;
        e = { u: D.newUid(), t: 'f', d: dim, x, y, z, n, it: null, r: 0 };
      } else {
        if (t.ny !== 1 || busy(x, y, z) || w.solidAt(x, y + 1, z)) return true;
        const yaw = Math.round((p.yaw + Math.PI) / (Math.PI / 4)) * (Math.PI / 4);
        e = { u: D.newUid(), t: 's', d: dim, x, y, z, yaw, ar: [null, null, null, null], h: null };
      }
      D.act(g, { k: 'add', e });
      p.consume(1);
      p.swing = 1;
      p.useCd = 0.25;
      CM.Audio.play('place', { mat: 'wood' });
      return true;
    },

    // --------------------------------------------------------- panneaux --
    signPlaced(g, x, y, z, p) {
      const id = g.world.get(x, y, z), k = key(g.dim, x, y, z);
      const s = { l: ['', '', '', ''] };
      if (id === CM.B.SIGN) s.r = ((Math.round(((p.yaw % TAU) + TAU) / (TAU / 16)) % 16) + 16) % 16;
      else {
        const t = p.target || p.lastTarget;
        s.n = t && (t.nx || t.nz) ? [t.nx, t.nz] : [Math.round(Math.sin(p.yaw)), Math.round(Math.cos(p.yaw))];
      }
      D.act(g, { k: 'sign', b: k, s });
      D.edit(g, k);
    },
    // Clic droit sur un panneau : teinture = couleur du texte, sinon on le modifie.
    signUse(g, t) {
      const k = key(g.dim, t.x, t.y, t.z), s = g.deco.signs[k];
      if (!s) return false;
      const held = g.inventory.held(), info = held && CM.itemInfo(held.id);
      if (info && info.dye) {
        D.act(g, { k: 'sign', b: k, s: Object.assign({}, s, { c: info.dye }) });
        if (!g.player.creative) g.player.consume(1);
        CM.Audio.play('place', { mat: 'wool' });
        return true;
      }
      D.edit(g, k);
      return true;
    },
    // Fenêtre d'écriture (4 lignes de 15 caractères).
    edit(g, k) {
      const el = document.getElementById('sign-edit');
      if (!el) return;
      const s = g.deco.signs[k] || { l: ['', '', '', ''] };
      const ins = el.querySelectorAll('input');
      ins.forEach((inp, i) => (inp.value = s.l[i] || ''));
      g.ui.modal = true;
      g.releaseMouse();
      el.classList.remove('hidden');
      D.editing = k;
      setTimeout(() => ins[0].focus(), 30);
    },
    closeEdit(g, save) {
      const el = document.getElementById('sign-edit');
      if (!el || !D.editing) return;
      const k = D.editing, s = g.deco.signs[k];
      D.editing = null;
      el.classList.add('hidden');
      g.ui.modal = false;
      if (save && s) D.act(g, { k: 'sign', b: k, s: Object.assign({}, s, { l: [...el.querySelectorAll('input')].map((i) => clean(i.value)) }) });
      if (!g.touch.enabled) g.captureMouse();
    },
    bindUI(g) {
      const el = document.getElementById('sign-edit');
      if (!el || el.dataset.bound) return;
      el.dataset.bound = 1;
      const ins = [...el.querySelectorAll('input')];
      ins.forEach((inp, i) =>
        inp.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            if (i < 3) ins[i + 1].focus();
            else D.closeEdit(g, true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            D.closeEdit(g, true);
          }
        }),
      );
      document.getElementById('sign-ok').addEventListener('click', () => D.closeEdit(g, true));
    },
    // Planche du panneau : centre, normale (vers le lecteur), droite.
    signFrame(k, s) {
      const [x, y, z] = CM.keyXYZ(k);
      if (s.r !== undefined) {
        const a = (s.r * TAU) / 16, n = [Math.sin(a), Math.cos(a)];
        return { c: [x + 0.5, y + 0.78, z + 0.5], n, stand: true };
      }
      const n = s.n || [0, 1];
      return { c: [x + 0.5 - n[0] * 0.44, y + 0.5, z + 0.5 - n[1] * 0.44], n, stand: false };
    },

    // ----------------------------------------------------------- dessin --
    render(g, batch) {
      const s = g.deco;
      if (!s) return;
      const ents = g.entities, L = CM.Textures.layer, M = ents.M, p = g.player, pre = CM.dimPre(g.playerDim);
      // panneaux
      for (const k in s.signs) {
        if (CM.dimPre(CM.dimOfKey(k)) !== pre) continue;
        const f = D.signFrame(k, s.signs[k]);
        if (Math.abs(f.c[0] - p.x) > 64 || Math.abs(f.c[2] - p.z) > 64) continue;
        const l = ents.lightAt(f.c[0] + f.n[0] * 0.6, f.c[1], f.c[2] + f.n[1] * 0.6);
        mat4.compose(M, f.c[0], f.c[1], f.c[2], Math.atan2(f.n[0], f.n[1]), 0, 0, 1);
        batch.box(M, -0.5, -0.25, -0.04, 0.5, 0.25, 0.04, L.sign_board, l[0], l[1], 0);
        if (f.stand) batch.box(M, -0.04, -0.78, -0.04, 0.04, -0.25, 0.04, L.stand_wood, l[0], l[1], 0);
      }
      for (const it of s.items) {
        if (it.d !== g.playerDim || Math.abs(it.x - p.x) > 64 || Math.abs(it.z - p.z) > 64) continue;
        if (it.t === 'p') D.renderPainting(ents, batch, it);
        else if (it.t === 'f') D.renderFrame(ents, batch, it);
        else D.renderStand(ents, batch, it);
      }
      D.renderJukes(g, batch);
    },
    renderPainting(ents, batch, it) {
      const L = CM.Textures.layer, M = ents.M, p = CM.PAINTINGS.find((q) => q.k === it.a), [nx, nz] = it.n, rx = nz, rz = -nx, back = L.painting_back;
      for (let j = 0; j < p.h; j++)
        for (let i = 0; i < p.w; i++) {
          const cx = it.x + rx * i + 0.5 - nx * 0.47, cy = it.y + j + 0.5, cz = it.z + rz * i + 0.5 - nz * 0.47;
          const l = ents.lightAt(cx + nx * 0.5, cy, cz + nz * 0.5);
          mat4.compose(M, cx, cy, cz, Math.atan2(nx, nz), 0, 0, 1);
          batch.box(M, -0.5, -0.5, -0.03, 0.5, 0.5, 0.03, [back, back, back, back, L['paint_' + p.k + '_' + i + '_' + (p.h - 1 - j)], back], l[0], l[1], 0);
        }
    },
    renderFrame(ents, batch, it) {
      const L = CM.Textures.layer, M = ents.M, [nx, ny, nz] = it.n, c = D.center(it);
      const l = ents.lightAt(it.x + 0.5, it.y + 0.5, it.z + 0.5);
      const yaw = ny ? 0 : Math.atan2(nx, nz), pitch = ny > 0 ? -Math.PI / 2 : ny < 0 ? Math.PI / 2 : 0;
      mat4.compose(M, c[0], c[1], c[2], yaw, pitch, 0, 1);
      const W = L.frame_wood;
      batch.box(M, -0.375, -0.375, -0.03, 0.375, 0.375, 0.03, [W, W, W, W, L.frame_leather, W], l[0], l[1], 0);
      if (!it.it) return;
      mat4.compose(ents.P, 0, 0, 0.05, 0, 0, ((it.r || 0) * Math.PI) / 4, 1);
      mat4.multiply(ents.R, M, ents.P);
      mat4.compose(ents.P, 0, -0.22, 0, 0, 0, 0, 1);
      mat4.multiply(ents.Q || (ents.Q = mat4.create ? mat4.create() : new Float32Array(16)), ents.R, ents.P);
      ents.drawItem(batch, ents.Q, it.it.id, l, 0.32);
    },
    renderStand(ents, batch, it) {
      const L = CM.Textures.layer, M = ents.M, l = ents.lightAt(it.x + 0.5, it.y + 1, it.z + 0.5), W = L.stand_wood;
      mat4.compose(M, it.x + 0.5, it.y, it.z + 0.5, it.yaw, 0, 0, 1);
      batch.box(M, -0.36, 0, -0.36, 0.36, 0.07, 0.36, L.stand_stone, l[0], l[1], 0);
      batch.box(M, -0.05, 0.07, -0.05, 0.05, 1.45, 0.05, W, l[0], l[1], 0);
      batch.box(M, -0.3, 1.3, -0.05, 0.3, 1.38, 0.05, W, l[0], l[1], 0);
      batch.box(M, -0.2, 0.68, -0.04, 0.2, 0.74, 0.04, W, l[0], l[1], 0);
      for (const sx of [-0.12, 0.12]) batch.box(M, sx - 0.04, 0.07, -0.04, sx + 0.04, 0.7, 0.04, W, l[0], l[1], 0);
      for (const sx of [-0.33, 0.33]) batch.box(M, sx - 0.04, 0.72, -0.04, sx + 0.04, 1.34, 0.04, W, l[0], l[1], 0);
      batch.box(M, -0.1, 1.45, -0.1, 0.1, 1.65, 0.1, W, l[0], l[1], 0);
      const skin = (s) => {
        const i = s && CM.itemInfo(s.id);
        return i && !i.elytra && L['armor_skin_' + String(i.mat).toLowerCase()];
      };
      const [h, c, lg, b] = it.ar.map(skin);
      if (h) batch.box(M, -0.25, 1.4, -0.25, 0.25, 1.9, 0.25, h, l[0], l[1], 0);
      if (c) {
        batch.box(M, -0.27, 0.76, -0.15, 0.27, 1.4, 0.15, c, l[0], l[1], 0);
        for (const sx of [-0.36, 0.36]) batch.box(M, sx - 0.13, 1.08, -0.13, sx + 0.13, 1.42, 0.13, c, l[0], l[1], 0);
      }
      if (lg) {
        batch.box(M, -0.265, 0.62, -0.145, 0.265, 0.8, 0.145, lg, l[0], l[1], 0);
        for (const sx of [-0.12, 0.12]) batch.box(M, sx - 0.135, 0.22, -0.135, sx + 0.135, 0.72, 0.135, lg, l[0], l[1], 0);
      }
      if (b) for (const sx of [-0.12, 0.12]) batch.box(M, sx - 0.14, 0, -0.14, sx + 0.14, 0.22, 0.14, b, l[0], l[1], 0);
      if (it.ar[1] && CM.itemInfo(it.ar[1].id).elytra && CM.Weapons) CM.Weapons.renderWings(ents, batch, M, l, 0, false);
      if (it.h && CM.itemInfo(it.h.id)) {
        mat4.compose(ents.P, 0.33, 0.78, -0.02, Math.PI / 2, 0, 0, 1);
        mat4.multiply(ents.R, M, ents.P);
        ents.drawItem(batch, ents.R, it.h.id, l, 0.4);
      }
    },
    // Texte des panneaux : posé en perspective sur la planche (éléments HTML), caché derrière les murs.
    overlay(g, cam) {
      const box = document.getElementById('signs');
      if (!box) return;
      D.pool = D.pool || [];
      const s = g.deco, vp = g.renderer.viewProj, W = g.canvas.clientWidth, H = g.canvas.clientHeight, w = g.world;
      let n = 0;
      const pre = CM.dimPre(g.playerDim);
      if (s && g.state === 'playing')
        for (const k in s.signs) {
          if (CM.dimPre(CM.dimOfKey(k)) !== pre || n >= 24) continue;
          const sg = s.signs[k];
          if (!sg.l.some((x) => x)) continue;
          const f = D.signFrame(k, sg);
          const cx = f.c[0] + f.n[0] * 0.045, cy = f.c[1], cz = f.c[2] + f.n[1] * 0.045;
          const dx = cx - cam[0], dy = cy - cam[1], dz = cz - cam[2], dist = Math.hypot(dx, dy, dz);
          if (dist > 16 || dx * f.n[0] + dz * f.n[1] > 0) continue;
          // un mur entre la caméra et le panneau ?
          const hit = w.raycast(cam[0], cam[1], cam[2], dx / dist, dy / dist, dz / dist, dist - 0.2, (id) => CM.blocks[id].solid && CM.blocks[id].opaque !== false);
          if (hit) continue;
          const R = [f.n[1], -f.n[0]], pts = [];
          for (const [u, v] of [[-0.46, 0.22], [0.46, 0.22], [0.46, -0.22], [-0.46, -0.22]]) {
            const x = cx + R[0] * u - cam[0], y = cy + v - cam[1], z = cz + R[1] * u - cam[2];
            const qx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], qy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], qw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
            if (qw < 0.05) break;
            pts.push(((qx / qw + 1) / 2) * W, ((1 - qy / qw) / 2) * H);
          }
          if (pts.length < 8) continue;
          let el = D.pool[n];
          if (!el) {
            el = D.pool[n] = document.createElement('div');
            el.className = 'sign-text';
            box.appendChild(el);
          }
          const txt = sg.l.join('\n');
          if (el.textContent !== txt) el.textContent = txt;
          el.style.color = DYE_TEXT[sg.c] || '#1c1208';
          el.style.transform = D.homography(pts, 200, 96);
          el.style.display = '';
          n++;
        }
      for (let i = n; i < D.pool.length; i++) D.pool[i].style.display = 'none';
    },
    // Transformation CSS qui envoie un rectangle W × H sur le quadrilatère p (4 coins à l'écran).
    homography(p, Wd, Hd) {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
      const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
      let a, b, c, d, e, f, gg, h;
      if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
        a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; gg = 0; h = 0;
      } else {
        const den = dx1 * dy2 - dx2 * dy1;
        gg = (dx3 * dy2 - dx2 * dy3) / den;
        h = (dx1 * dy3 - dx3 * dy1) / den;
        a = x1 - x0 + gg * x1; b = x3 - x0 + h * x3; c = x0;
        d = y1 - y0 + gg * y1; e = y3 - y0 + h * y3; f = y0;
      }
      const m = [a / Wd, d / Wd, 0, gg / Wd, b / Hd, e / Hd, 0, h / Hd, 0, 0, 1, 0, c, f, 0, 1];
      return 'matrix3d(' + m.map((v) => (Math.abs(v) < 1e-12 ? 0 : v.toFixed(8))).join(',') + ')';
    },

    // --------------------------------------------------------- juke-box --
    jukeUse(g, t) {
      const k = key(g.dim, t.x, t.y, t.z), cur = g.deco.jukes[k], p = g.player;
      if (cur) {
        D.act(g, { k: 'juke', b: k, v: null });
        g.entities.addDrop(CM.DISC_IDS[cur.d], 1, t.x + 0.5, t.y + 1.1, t.z + 0.5, null, [0, 3, 0]);
        return true;
      }
      const held = g.inventory.held(), info = held && CM.itemInfo(held.id);
      if (!info || info.type !== 'disc') return false;
      D.act(g, { k: 'juke', b: k, v: { d: info.disc, n: D.newUid() } });
      if (!p.creative) p.consume(1);
      g.ui.toast('♪ En écoute : « ' + CM.DISCS[info.disc].name + ' »', 'good', 'juke');
      return true;
    },
    renderJukes(g, batch) {
      // une note s'échappe du juke-box à chaque temps
      const now = CM.Audio.ctx ? CM.Audio.ctx.currentTime : 0;
      for (const [k, h] of D.playing) {
        if (!h.song || h.stopped) continue;
        const beat = Math.floor((now - h.start) / (60 / h.song.bpm));
        if (beat !== h.lastBeat && beat >= 0) {
          h.lastBeat = beat;
          const L = CM.Textures.layer, cols = ['concrete_lime', 'concrete_yellow', 'concrete_light_blue', 'concrete_magenta', 'concrete_orange'];
          g.entities.burst(L[cols[beat % cols.length]] || L.white, h.x + 0.5, h.y + 1.15, h.z + 0.5, 1, { speed: 0.6, grav: -1.4, life: 0.9, size: 0.1, emissive: true, full: true });
        }
      }
    },
    playing: new Map(),
    done: {},
    stopAll() {
      for (const h of D.playing.values()) CM.Music.stop(h);
      D.playing.clear();
    },
    // Chaque image : musique des juke-box proches (chaque joueur l'entend chez lui).
    updateMusic(g, dt) {
      const s = g.deco, A = CM.Audio;
      if (!A.ctx || !s) return;
      const p = g.player, pre = CM.dimPre(g.playerDim);
      for (const [k, h] of D.playing) {
        const j = s.jukes[k];
        if (!j || j.n !== h.n || CM.dimPre(CM.dimOfKey(k)) !== pre || Math.hypot(h.x + 0.5 - p.x, h.z + 0.5 - p.z) > 72 || h.ended) {
          if (h.ended) D.done[k] = h.n;
          CM.Music.stop(h);
          D.playing.delete(k);
        }
      }
      for (const k in s.jukes) {
        if (CM.dimPre(CM.dimOfKey(k)) !== pre || D.playing.has(k) || D.done[k] === s.jukes[k].n) continue;
        const [x, y, z] = CM.keyXYZ(k);
        if (Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z) > 56) continue;
        const h = CM.Music.play(s.jukes[k].d);
        if (!h) continue;
        Object.assign(h, { x, y, z, n: s.jukes[k].n });
        D.playing.set(k, h);
      }
      const e = p.eye(), yaw = p.yaw;
      for (const h of D.playing.values()) {
        const dx = h.x + 0.5 - e[0], dy = h.y + 0.5 - e[1], dz = h.z + 0.5 - e[2], d = Math.hypot(dx, dy, dz);
        const vol = Math.max(0, 1 - d / 48) ** 2 * (A.cat.sfx === undefined ? 1 : A.cat.sfx);
        const pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d)) : 0;
        CM.Music.update(h, vol, pan);
      }
    },
  });

  // ============================================================ MUSIQUE ==
  // Chaque disque est composé par le jeu : progression d'accords, basse, nappes, mélodie
  // (motif A, motif B, reprise), arpèges et batterie selon le style. 32 mesures.
  const SC = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    harm: [0, 2, 3, 5, 7, 8, 11], penta: [0, 2, 4, 7, 9],
  };
  const STYLES = [
    { bpm: 92, root: 60, sc: 'major', prog: [0, 4, 5, 3], lead: 'triangle', bass: 'sine', pad: 'sine', drums: 0, arp: 0, lv: 0.16 }, // aube
    { bpm: 104, root: 62, sc: 'penta', prog: [0, 3, 4, 0], lead: 'sine', bass: 'triangle', pad: 'triangle', drums: 1, arp: 0, vib: 1, lv: 0.2 }, // clairière
    { bpm: 66, root: 57, sc: 'minor', prog: [0, 5, 3, 4], lead: 'square', bass: 'sine', pad: 'triangle', drums: 0, arp: 0, echo: 1, lv: 0.07 }, // cavernes
    { bpm: 84, root: 55, sc: 'dorian', prog: [0, 3, 0, 4], lead: 'triangle', bass: 'sine', pad: 'sine', drums: 1, arp: 1, lv: 0.15 }, // marée
    { bpm: 128, root: 52, sc: 'minor', prog: [0, 5, 6, 4], lead: 'sawtooth', bass: 'sawtooth', pad: 'square', drums: 2, arp: 0, lv: 0.07 }, // forge
    { bpm: 76, root: 64, sc: 'lydian', prog: [0, 1, 0, 4], lead: 'sine', bass: 'sine', pad: 'triangle', drums: 0, arp: 2, echo: 1, lv: 0.17 }, // étoiles
    { bpm: 140, root: 60, sc: 'major', prog: [0, 5, 3, 4], lead: 'square', bass: 'square', pad: 'square', drums: 2, arp: 1, lv: 0.07 }, // pixel
    { bpm: 112, root: 50, sc: 'harm', prog: [0, 5, 3, 4], lead: 'sawtooth', bass: 'triangle', pad: 'sawtooth', drums: 2, arp: 1, lv: 0.07 }, // orage
  ];
  const RHYTHMS = [[1, 1, 1, 1], [0.5, 0.5, 1, 2], [1, 0.5, 0.5, 2], [1.5, 0.5, 1, 1], [2, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [1, 1, 2], [0.5, 1, 0.5, 2]];
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function compose(i) {
    const st = STYLES[i];
    let seed = 1234567 + i * 7919;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const sc = SC[st.sc], nS = sc.length;
    const note = (deg) => st.root + sc[((deg % nS) + nS) % nS] + 12 * Math.floor(deg / nS);
    const chordOf = (bar) => st.prog[bar % st.prog.length] % nS;
    const ev = [];
    const add = (t, m, d, w, v) => ev.push({ t, f: midi(m), d, w, v });
    const drum = (t, k, v) => ev.push({ t, k, v });
    // motif de 8 mesures
    const motif = (startDeg) => {
      const out = [];
      let deg = startDeg;
      for (let bar = 0; bar < 8; bar++) {
        const rh = RHYTHMS[Math.floor(rnd() * RHYTHMS.length)];
        let t = 0;
        const ch = chordOf(bar);
        rh.forEach((d, k) => {
          if (k === 0 || t === 2) {
            // temps fort : une note de l'accord proche
            const opts = [ch, ch + 2, ch + 4, ch + 7].map((c) => c + (deg > ch + 5 ? 0 : 0));
            deg = opts.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a));
          } else deg += [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)];
          deg = Math.max(-1, Math.min(10, deg));
          out.push({ bar, t, d, deg, rest: rnd() < 0.08 && k > 0 });
          t += d;
        });
      }
      out[out.length - 1].deg = chordOf(7);
      return out;
    };
    const A = motif(4), B = motif(6);
    const bars = 32;
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 4, ch = chordOf(bar), outro = bar >= 28, intro = bar < 4;
      const fade = outro ? 1 - (bar - 27) / 5 : 1;
      // nappe : l'accord tenu
      for (const k of [0, 2, 4]) add(t0, note(ch + k) , 4, st.pad, st.lv * 0.35 * fade);
      // basse
      const br = note(ch) - 12;
      if (st.drums === 2) for (let b = 0; b < 8; b++) add(t0 + b * 0.5, b % 4 === 3 ? br + 7 : br, 0.45, st.bass, st.lv * 0.9 * fade);
      else {
        add(t0, br, 2, st.bass, st.lv * 1.1 * fade);
        add(t0 + 2, bar % 2 ? br + 7 : br, 2, st.bass, st.lv * 1.0 * fade);
      }
      // arpèges
      if (st.arp && !intro) {
        const step = st.arp === 2 ? 0.25 : 0.5;
        for (let q = 0; q < 4 / step; q++) add(t0 + q * step, note(ch + [0, 2, 4, 7][q % 4]) + 12, step * 0.9, st.arp === 2 ? 'sine' : st.lead, st.lv * 0.35 * fade);
      }
      // mélodie : A (4-11), B (12-19), A' (20-27)
      if (bar >= 4 && bar < 28) {
        const sec = bar < 12 ? A : bar < 20 ? B : A;
        const lb = (bar - 4) % 8, shift = bar >= 20 && lb >= 4 ? 1 : 0;
        for (const n of sec) if (n.bar === lb && !n.rest) add(t0 + n.t, note(n.deg + shift) + 12, n.d * 0.95, st.lead, st.lv * (st.vib ? 0.9 : 0.8));
      }
      // batterie
      if (st.drums && !intro && !(outro && bar === bars - 1)) {
        for (let b = 0; b < 4; b++) {
          if (b % 2 === 0 || st.drums === 2) drum(t0 + b, b % 2 ? 'snare' : 'kick', st.drums === 2 ? 0.5 : 0.3);
          if (st.drums === 2 || b % 2 === 1) drum(t0 + b + 0.5, 'hat', 0.12);
        }
      }
    }
    ev.sort((a, b) => a.t - b.t);
    return { bpm: st.bpm, beats: bars * 4, ev, style: st };
  }
  const Music = (CM.Music = {
    songs: [],
    song(i) {
      return this.songs[i] || (this.songs[i] = compose(i));
    },
    noiseBuf() {
      const A = CM.Audio;
      if (this.nb && this.nbCtx === A.ctx) return this.nb;
      const b = A.ctx.createBuffer(1, A.ctx.sampleRate * 0.5, A.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.nbCtx = A.ctx;
      return (this.nb = b);
    },
    play(i) {
      const A = CM.Audio;
      if (!A.ctx || !A.master || !CM.DISCS[i]) return null;
      const ctx = A.ctx, song = this.song(i);
      const out = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      out.gain.value = 0;
      if (pan) {
        out.connect(pan);
        pan.connect(A.master);
      } else out.connect(A.master);
      let dest = out;
      if (song.style.echo) {
        // écho (grottes, étoiles)
        const dl = ctx.createDelay(1), fb = ctx.createGain(), mixIn = ctx.createGain();
        dl.delayTime.value = (60 / song.bpm) * 0.75;
        fb.gain.value = 0.35;
        mixIn.connect(out);
        mixIn.connect(dl);
        dl.connect(fb);
        fb.connect(dl);
        dl.connect(out);
        dest = mixIn;
      }
      return { song, out, pan, dest, start: ctx.currentTime + 0.15, next: 0, nodes: [] };
    },
    stop(h) {
      if (!h || h.stopped) return;
      h.stopped = true;
      const ctx = CM.Audio.ctx;
      try {
        h.out.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        setTimeout(() => {
          try {
            h.out.disconnect();
          } catch (e) {}
        }, 600);
      } catch (e) {}
    },
    // Programme les notes des 0,4 prochaines secondes ; volume et position.
    update(h, vol, pan) {
      const ctx = CM.Audio.ctx, song = h.song, spb = 60 / song.bpm, now = ctx.currentTime;
      h.out.gain.setTargetAtTime(vol, now, 0.1);
      if (h.pan) h.pan.pan.setTargetAtTime(pan, now, 0.1);
      while (h.next < song.ev.length && h.start + song.ev[h.next].t * spb < now + 0.4) {
        const e = song.ev[h.next++], t = Math.max(now, h.start + e.t * spb);
        if (e.k) this.drum(h, e, t);
        else this.tone(h, e, t, e.d * spb);
      }
      if (h.next >= song.ev.length && now > h.start + song.beats * spb + 1) h.ended = true;
    },
    tone(h, e, t, dur) {
      const ctx = CM.Audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = e.w;
      o.frequency.setValueAtTime(e.f, t);
      if (h.song.style.vib) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 5.5;
        lg.gain.value = e.f * 0.008;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.3);
      }
      const a = Math.min(0.03, dur * 0.2), rel = Math.min(0.25, dur * 0.5);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(e.v, t + a);
      g.gain.setValueAtTime(e.v, t + Math.max(a, dur - rel));
      g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      o.connect(g);
      g.connect(h.dest);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    drum(h, e, t) {
      const ctx = CM.Audio.ctx, g = ctx.createGain();
      g.connect(h.dest);
      if (e.k === 'kick') {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        g.gain.setValueAtTime(e.v, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.26);
        return;
      }
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      s.buffer = this.noiseBuf();
      f.type = e.k === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = e.k === 'hat' ? 7000 : 1800;
      const len = e.k === 'hat' ? 0.05 : 0.16;
      g.gain.setValueAtTime(e.v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(f);
      f.connect(g);
      s.start(t);
      s.stop(t + len + 0.02);
    },
  });

  // Le juke-box (bloc déjà existant) reçoit les disques.
  if (CM.B.JUKEBOX !== undefined) CM.blocks[CM.B.JUKEBOX].use = (g, t) => D.jukeUse(g, t);
})();
