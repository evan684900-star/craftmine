'use strict';
// Skins personnalisés : une image de skin Minecraft (64 × 64, ou l'ancien format 64 × 32) choisie
// dans le menu G → Compte. Le navigateur la garde ; elle part avec l'apparence du joueur (les autres
// la voient). Chaque face du personnage (tête, corps, bras, jambes) devient une couche de texture,
// dans des places réservées à l'avance (une par joueur visible, les moins récents sont remplacés).
(function () {
  const KEY = 'craftmine-skin';
  const MAX_LEN = 40000; // (une image de skin PNG fait 1 à 10 Ko)
  const PER = 36; // couches par skin : 6 parties × 6 faces
  // Parties : [droite (+x), gauche (−x), dessus, dessous, dos (+z), devant (−z)], régions [x, y, l, h]
  // de l'image (« droite » : le côté droit du personnage), et la couche de dessus (chapeau, veste…).
  const PARTS = {
    head: { r: [0, 8, 8, 8], l: [16, 8, 8, 8], t: [8, 0, 8, 8], b: [16, 0, 8, 8], k: [24, 8, 8, 8], f: [8, 8, 8, 8], o: [32, 0] },
    body: { r: [16, 20, 4, 12], l: [28, 20, 4, 12], t: [20, 16, 8, 4], b: [28, 16, 8, 4], k: [32, 20, 8, 12], f: [20, 20, 8, 12], o: [0, 16] },
    rarm: { r: [40, 20, 4, 12], l: [48, 20, 4, 12], t: [44, 16, 4, 4], b: [48, 16, 4, 4], k: [52, 20, 4, 12], f: [44, 20, 4, 12], o: [0, 16] },
    larm: { r: [32, 52, 4, 12], l: [40, 52, 4, 12], t: [36, 48, 4, 4], b: [40, 48, 4, 4], k: [44, 52, 4, 12], f: [36, 52, 4, 12], o: [16, 0] },
    rleg: { r: [0, 20, 4, 12], l: [8, 20, 4, 12], t: [4, 16, 4, 4], b: [8, 16, 4, 4], k: [12, 20, 4, 12], f: [4, 20, 4, 12], o: [0, 16] },
    lleg: { r: [16, 52, 4, 12], l: [24, 52, 4, 12], t: [20, 48, 4, 4], b: [24, 48, 4, 4], k: [28, 52, 4, 12], f: [20, 52, 4, 12], o: [-16, 0] },
  };
  const NAMES = Object.keys(PARTS);

  const S = {
    cache: new Map(), // clé -> { parts } | { pending } | { bad }
    slots: [], // place -> { key, used }

    // Clé courte d'une image (pour la retrouver dans le cache).
    keyOf(url) {
      let h = 0;
      for (let i = 0; i < url.length; i += 7) h = (h * 31 + url.charCodeAt(i)) >>> 0;
      return url.length + ':' + h.toString(36);
    },
    mine() {
      try {
        const v = localStorage.getItem(KEY);
        return S.valid(v) ? v : null;
      } catch (e) {
        return null;
      }
    },
    valid: (v) => typeof v === 'string' && v.length <= MAX_LEN && v.startsWith('data:image/png;base64,'),

    // Couches du skin (dessin du personnage), ou null tant qu'il n'est pas prêt.
    layersFor(url) {
      const r = CM.game && CM.game.renderer;
      if (!r || !r.skinSlots || !S.valid(url)) return null;
      const k = S.keyOf(url);
      const c = S.cache.get(k);
      if (c) {
        if (c.parts) {
          S.slots[c.slot].used = performance.now();
          return c.parts;
        }
        return null;
      }
      S.cache.set(k, { pending: true });
      const img = new Image();
      img.onload = () => S.upload(k, img);
      img.onerror = () => S.cache.set(k, { bad: true });
      img.src = url;
      return null;
    },
    // Découpe l'image en faces de 16 × 16 et les envoie à la carte graphique.
    upload(k, img) {
      const r = CM.game.renderer;
      const px = S.pixels(img);
      if (!px) {
        S.cache.set(k, { bad: true });
        return;
      }
      // place libre, sinon celle du skin vu il y a le plus longtemps
      let slot = S.slots.findIndex((s) => !s);
      if (slot < 0 && S.slots.length < r.skinSlots) slot = S.slots.length;
      if (slot < 0) {
        slot = 0;
        for (let i = 1; i < S.slots.length; i++) if (S.slots[i].used < S.slots[slot].used) slot = i;
        S.cache.delete(S.slots[slot].key);
      }
      const base = r.skinBase + slot * PER, data = new Uint8Array(PER * 1024), parts = {};
      NAMES.forEach((name, pi) => {
        const p = PARTS[name];
        parts[name] = ['r', 'l', 't', 'b', 'k', 'f'].map((f, fi) => {
          const i = pi * 6 + fi;
          S.face(px, p[f], p.o, data, i * 1024, f === 't');
          return base + i;
        });
      });
      r.uploadLayers(base, PER, data);
      S.slots[slot] = { key: k, used: performance.now() };
      S.cache.set(k, { parts, slot });
    },
    // Image 64 × 64 (l'ancien format 64 × 32 est complété : bras et jambe gauches en miroir).
    pixels(img) {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w !== 64 || (h !== 64 && h !== 32)) return null;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      if (h === 32) {
        // jambe et bras gauches : ceux de droite, retournés
        const flip = (sx, sy, dx, dy) => {
          ctx.save();
          ctx.translate(dx + 16, dy);
          ctx.scale(-1, 1);
          ctx.drawImage(cv, sx, sy, 16, 16, 0, 0, 16, 16);
          ctx.restore();
        };
        flip(0, 16, 16, 48);
        flip(40, 16, 32, 48);
      }
      return { d: ctx.getImageData(0, 0, 64, 64).data, old: h === 32 };
    },
    // Une face : région agrandie en 16 × 16 (au plus proche), couche du dessus par-dessus.
    face(px, reg, off, out, o, top) {
      const [x0, y0, w, h] = reg, d = px.d;
      for (let j = 0; j < 16; j++)
        for (let i = 0; i < 16; i++) {
          // (dessus : retourné, le devant du personnage est en bas de la région)
          const ii = top ? 15 - i : i, jj = top ? 15 - j : j;
          const sx = x0 + Math.floor((ii * w) / 16), sy = y0 + Math.floor((jj * h) / 16);
          const s = (sy * 64 + sx) * 4, t = o + (j * 16 + i) * 4;
          let r = d[s], g = d[s + 1], b = d[s + 2];
          const ox = sx + off[0], oy = sy + off[1];
          if (!px.old && ox >= 0 && ox < 64 && oy >= 0 && oy < 64) {
            const q = (oy * 64 + ox) * 4, a = d[q + 3] / 255;
            if (a > 0) {
              r = r * (1 - a) + d[q] * a;
              g = g * (1 - a) + d[q + 1] * a;
              b = b * (1 - a) + d[q + 2] * a;
            }
          } else if (px.old && off[1] === 0 && off[0] === 32) {
            // (ancien format : seul le chapeau existe)
            const q = (oy * 64 + ox) * 4, a = d[q + 3] / 255;
            if (a > 0) {
              r = r * (1 - a) + d[q] * a;
              g = g * (1 - a) + d[q + 1] * a;
              b = b * (1 - a) + d[q + 2] * a;
            }
          }
          out[t] = r;
          out[t + 1] = g;
          out[t + 2] = b;
          out[t + 3] = 255;
        }
    },

    // ------------------------------------------------ menu G → Compte --
    load(g, file) {
      const msg = (s, bad) => {
        const el = document.getElementById('ac-skin-msg');
        if (el) {
          el.textContent = s;
          el.style.color = bad ? '#ff8f8f' : '';
        }
      };
      if (!file || !/png$/i.test(file.type || file.name)) return msg('Choisis une image PNG (un skin Minecraft).', true);
      if (file.size > 200000) return msg('Image trop lourde : un skin fait 64 × 64 pixels.', true);
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth !== 64 || (img.naturalHeight !== 64 && img.naturalHeight !== 32)) return msg('Il faut une image de 64 × 64 pixels (ou 64 × 32), comme les skins de Minecraft. Celle-ci fait ' + img.naturalWidth + ' × ' + img.naturalHeight + '.', true);
          // (réenregistrée telle quelle, sans ce qui ne sert pas : plus légère)
          const cv = document.createElement('canvas');
          cv.width = 64;
          cv.height = img.naturalHeight;
          cv.getContext('2d').drawImage(img, 0, 0);
          const url = cv.toDataURL('image/png');
          if (!S.valid(url)) return msg('Image trop compliquée : essaie un autre skin.', true);
          try {
            localStorage.setItem(KEY, url);
          } catch (e) {
            return msg('Impossible de garder l’image sur cet appareil (navigation privée ?).', true);
          }
          CM.Comfort.lookChanged(g);
          S.preview(g);
          msg('✅ Skin enregistré : les autres joueurs le voient (vue de derrière : touche ' + g.keyName(g.binds.view) + ').');
        };
        img.onerror = () => msg('Image illisible.', true);
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    },
    clear(g) {
      try {
        localStorage.removeItem(KEY);
      } catch (e) {
        /* ignore */
      }
      CM.Comfort.lookChanged(g);
      S.preview(g);
      const el = document.getElementById('ac-skin-msg');
      if (el) el.textContent = 'Skin retiré : ton apparence (Options) revient.';
    },
    // Aperçu : la tête et le corps de face, en grand.
    preview(g) {
      const cv = document.getElementById('ac-skin-prev');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      const url = S.mine();
      const el = document.getElementById('ac-skin-msg');
      if (el && !el.textContent) el.textContent = url ? '' : 'Aucun skin : tu as l’apparence choisie dans les options.';
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        ctx.imageSmoothingEnabled = false;
        const old = img.naturalHeight === 32;
        // devant : tête (8×8), corps (8×12), bras (4×12), jambes (4×12) → 16 × 32, centré
        const d = (sx, sy, w, h, dx, dy) => ctx.drawImage(img, sx, sy, w, h, dx * 2, dy * 2, w * 2, h * 2);
        d(8, 8, 8, 8, 8, 0);
        if (!old) d(40, 8, 8, 8, 8, 0);
        d(20, 20, 8, 12, 8, 8);
        d(44, 20, 4, 12, 4, 8);
        if (old) d(44, 20, 4, 12, 16, 8);
        else d(36, 52, 4, 12, 16, 8);
        d(4, 20, 4, 12, 8, 20);
        if (old) d(4, 20, 4, 12, 12, 20);
        else d(20, 52, 4, 12, 12, 20);
      };
      img.src = url;
    },
  };
  CM.Skins = S;
})();
