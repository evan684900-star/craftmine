'use strict';
// Interface : HUD, inventaire, fabrication, journal, menus.
(function () {
  const $ = (id) => document.getElementById(id);
  const I = CM.I;

  // Texte d'aide partagé (menu principal + onglet « Mécaniques »).
  const GUIDE = [
    ['⚡ Endurance (pas de faim)', "Courir, sauter, la ruée, le grappin et le minage consomment de l'endurance. Elle remonte vite dès que tu reprends ton souffle. À zéro tu es épuisé : plus de course, minage ralenti. Sous l'eau, l'endurance sert de souffle. La nourriture soigne et recharge l'endurance."],
    ['🪝 Grappin', "Fabrique-le avec 3 lingots de fer et 2 cordes. En main, clic droit sur un bloc jusqu'à 34 blocs : tu es tiré vers lui en gardant ton élan. Espace pendant la traction pour te décrocher avec un bond."],
    ['💨 Ruée et double saut', "F lance une ruée rapide (tu es brièvement invulnérable et tu frappes plus fort). L'Amulette de plume, gardée dans l'inventaire, donne un double saut."],
    ['🔥 Combo de minage', "Casse des blocs à la suite (moins de 2,4 s d'écart) : chaque niveau de combo accélère le minage. À partir de x5, les minerais peuvent donner un double butin."],
    ['⭐ Maîtrise des outils', "Les outils ne s'usent jamais. Ils gagnent de l'expérience à l'usage et montent jusqu'à ★★★★★ : plus rapides (et plus de dégâts pour les épées). Une hache en fer abat l'arbre entier d'un coup, et la pioche de cristal mine les filons de minerai entiers."],
    ['📖 Fabrication libre', "Pas de grille : ouvre l'inventaire (E) et choisis une recette. Certaines demandent d'être près d'un Établi ou d'une Forge (dans un rayon de 4 blocs). La forge sert à fondre et cuire, avec du charbon."],
    ['🌑 Les Ombres', "La nuit, et dans l'obscurité des grottes, des Ombres apparaissent. Elles brûlent au soleil et ont peur de la lumière : elles refusent d'entrer dans la zone d'une torche et y souffrent. Éclaire ta base ! Tenir une torche éclaire autour de toi."],
    ['🍄 Champignons rebond', "Dans les grottes poussent des champignons violets lumineux. Saute dessus pour rebondir très haut ; tomber dessus annule les dégâts de chute. Tu peux les récolter et les poser."],
    ['🏝 Îles célestes', "Des îles flottent au-dessus du monde (vers la couche 75). Leur pierre renferme des Éclats célestes. Atteins-les avec le grappin, depuis une montagne ou en empilant des blocs."],
    ["☀ Le Cœur d'aube", "Le but final : forge le Cœur d'aube (4 éclats célestes, 4 essences d'ombre, 4 cristaux, 2 lingots de fer) et pose-le. Il chasse les Ombres alentour pour toujours."],
  ];

  const OBJECTIVES = [
    { t: 'Coupe du bois', d: 'Maintiens le clic gauche sur un tronc d’arbre pour récolter 3 bûches.', done: (g) => (g.stats.mined[CM.B.LOG] || 0) >= 3 },
    { t: 'Fabrique un établi', d: 'Ouvre l’inventaire (E) : bûches → planches, puis établi.', done: (g) => g.crafted(CM.B.TABLE) },
    { t: 'Ta première pioche', d: 'Pose l’établi (clic droit) et fabrique une pioche en bois à côté.', done: (g) => g.crafted(I.PICKAXE_1) },
    { t: 'L’âge de pierre', d: 'Mine de la pierre (tu obtiens des galets) et fabrique une pioche en pierre.', done: (g) => g.crafted(I.PICKAXE_2) },
    { t: 'Lumière contre les Ombres', d: 'Trouve du charbon et fabrique des torches. Les Ombres fuient la lumière.', done: (g) => g.crafted(CM.B.TORCH) },
    { t: 'La forge', d: 'Fabrique une forge (8 galets) près de l’établi.', done: (g) => g.crafted(CM.B.FORGE) },
    { t: 'Le fer', d: 'Mine du minerai de fer (pioche en pierre) et fonds-le à la forge.', done: (g) => g.crafted(I.IRON_INGOT) },
    { t: 'Le grappin', d: 'Herbes hautes → fibres → cordes. Puis grappin : 3 lingots + 2 cordes.', done: (g) => g.crafted(I.GRAPPLE) },
    { t: 'Les profondeurs', d: 'Descends sous la couche 20 et mine du cristal avec une pioche en fer.', done: (g) => (g.stats.mined[CM.B.CRYSTAL_ORE] || 0) >= 1 },
    { t: 'Chasseur d’Ombres', d: 'Vaincs une Ombre (la nuit ou dans une grotte sombre) pour son essence.', done: (g) => (g.stats.kills.ombre || 0) >= 1 },
    { t: 'Vers les îles célestes', d: 'Monte sur une île flottante et mine un éclat céleste.', done: (g) => (g.stats.mined[CM.B.SHARD_ORE] || 0) >= 1 },
    { t: 'Le Cœur d’aube', d: 'Forge le Cœur d’aube et pose-le pour chasser les Ombres.', done: (g) => (g.stats.placed[CM.B.DAWN_HEART] || 0) >= 1 },
  ];
  CM.OBJECTIVES = OBJECTIVES;

  function heartIcon(kind) {
    const rows = ['.xx...xx.', 'xhhx.xrrx', 'xhrrxrrrx', 'xrrrrrrrx', '.xrrrrrx.', '..xrrrx..', '...xrx...', '....x....'];
    const c = document.createElement('canvas');
    c.width = 9;
    c.height = 8;
    const ctx = c.getContext('2d');
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < 9; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        let col = '#1a0a0a';
        if (ch !== 'x') {
          const filled = kind === 'full' || (kind === 'half' && x < 5);
          col = filled ? (ch === 'h' ? '#ff9a9a' : '#e0263a') : '#3a1c22';
        }
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    return c.toDataURL();
  }

  class UI {
    constructor(game) {
      this.game = game;
      this.cursor = null;
      this.invOpen = false;
      this.tab = 'craft';
      this.filter = 'tout';
      this.onlyCan = false;
      this.toastKeys = new Map();
      this.dirtyInv = true;
      this.lastHealth = -1;
      this.lastSel = -1;
      this.itemNameT = 0;
      this.stations = {};
      this.hearts = { full: heartIcon('full'), half: heartIcon('half'), empty: heartIcon('empty') };
      this.buildHUD();
      this.buildInventory();
      this.buildGuide();
    }

    // ------------------------------------------------------------- HUD --
    buildHUD() {
      const hb = $('hotbar');
      hb.innerHTML = '';
      this.hotSlots = [];
      for (let i = 0; i < 9; i++) {
        const s = document.createElement('div');
        s.className = 'slot';
        hb.appendChild(s);
        this.hotSlots.push(s);
      }
      const he = $('hearts');
      he.innerHTML = '';
      this.heartEls = [];
      for (let i = 0; i < 10; i++) {
        const h = document.createElement('i');
        he.appendChild(h);
        this.heartEls.push(h);
      }
    }

    slotHTML(s, keyNum) {
      if (!s) return keyNum ? '<span class="key">' + keyNum + '</span>' : '';
      const icon = CM.Textures.icons[s.id];
      let h = '<div class="icon" style="background-image:url(' + icon + ')"></div>';
      if (s.count > 1) h += '<span class="count">' + s.count + '</span>';
      if (s.xp !== undefined) {
        const lvl = CM.masteryLevel(s.xp);
        h += '<span class="stars">' + '★'.repeat(lvl) + '</span>';
        if (lvl < 5) {
          const a = CM.MASTERY_XP[lvl - 1], b = CM.MASTERY_XP[lvl];
          h += '<div class="xp"><div style="width:' + Math.round(((s.xp - a) / (b - a)) * 100) + '%"></div></div>';
        }
      }
      return h;
    }

    renderHotbar() {
      const inv = this.game.inventory;
      for (let i = 0; i < 9; i++) {
        this.hotSlots[i].innerHTML = this.slotHTML(inv.slots[i]);
        this.hotSlots[i].classList.toggle('sel', i === inv.selected);
      }
    }

    update(dt) {
      const g = this.game, p = g.player, inv = g.inventory;
      if (this.dirtyInv) {
        this.dirtyInv = false;
        this.renderHotbar();
        if (this.invOpen) this.renderInventory();
        const sel = inv.held();
        $('ab-double').classList.toggle('hidden', !inv.has(I.FEATHER_CHARM));
        this.heldId = sel ? sel.id : -1;
      }
      if (inv.selected !== this.lastSel) {
        this.lastSel = inv.selected;
        this.renderHotbar();
        const s = inv.held();
        $('item-name').textContent = s ? CM.itemName(s.id) : '';
        $('item-name').style.opacity = s ? 1 : 0;
        this.itemNameT = 2;
      }
      if (this.itemNameT > 0) {
        this.itemNameT -= dt;
        if (this.itemNameT <= 0) $('item-name').style.opacity = 0;
      }
      // cœurs
      const hp = Math.ceil(p.health);
      if (hp !== this.lastHealth) {
        this.lastHealth = hp;
        for (let i = 0; i < 10; i++) {
          const v = hp - i * 2;
          this.heartEls[i].style.backgroundImage = 'url(' + (v >= 2 ? this.hearts.full : v === 1 ? this.hearts.half : this.hearts.empty) + ')';
        }
        $('hearts').classList.toggle('low', hp <= 6 && hp > 0);
      }
      // endurance
      const st = $('stamina');
      $('stamina-fill').style.width = (p.stamina / p.maxStamina) * 100 + '%';
      st.style.width = 186 * (p.maxStamina / 100) + 'px';
      st.classList.toggle('exhausted', p.exhausted);
      st.classList.toggle('vigor', p.vigor > 0);
      $('stamina-label').textContent = p.headInWater ? 'Souffle' : p.exhausted ? 'Épuisé' : 'Endurance';
      $('ab-dash').classList.toggle('cool', p.dashCd > 0 || p.stamina < 20 || p.exhausted);
      // combo
      const combo = $('combo');
      if (p.combo >= 2) {
        combo.classList.remove('hidden');
        if (this.lastCombo !== p.combo) {
          $('combo-text').textContent = 'COMBO x' + p.combo;
          combo.classList.remove('pulse');
          void combo.offsetWidth;
          combo.classList.add('pulse');
        }
        $('combo-fill').style.width = (p.comboTimer / 2.4) * 100 + '%';
      } else combo.classList.add('hidden');
      this.lastCombo = p.combo;
      // effets
      $('vignette').style.opacity = Math.min(1, p.hurtFlash * 2 + (p.health <= 4 && p.alive ? 0.35 + Math.sin(g.clock * 5) * 0.15 : 0));
      $('water-overlay').style.opacity = p.headInWater ? 1 : 0;
      // horloge
      this.clockT = (this.clockT || 0) - dt;
      if (this.clockT <= 0) {
        this.clockT = 0.5;
        const night = g.daylight < 0.35;
        const hours = (Math.floor(((g.time + 0.25) % 1) * 24) + 0) % 24;
        const hh = String(hours).padStart(2, '0');
        $('clock').innerHTML = (night ? '<span class="danger">☾ Nuit ' : '<span>☀ Jour ') + (g.dayCount + 1) + '</span> · ' + hh + 'h';
        this.updateObjective();
        if (this.invOpen) this.refreshStations();
      }
      if (this.debug) this.updateDebug();
    }

    updateObjective() {
      const g = this.game;
      let idx = OBJECTIVES.findIndex((o) => !o.done(g));
      const done = idx < 0 ? OBJECTIVES.length : idx;
      if (this.lastObj !== undefined && done > this.lastObj) {
        const o = OBJECTIVES[this.lastObj];
        if (o && o.done(g)) {
          this.toast('Objectif accompli : ' + o.t, 'good');
          CM.Audio.play('objective');
          $('objective').classList.remove('flash');
          void $('objective').offsetWidth;
          $('objective').classList.add('flash');
        }
      }
      this.lastObj = done;
      $('obj-count').textContent = '(' + done + '/' + OBJECTIVES.length + ')';
      if (idx < 0) {
        $('obj-title').textContent = 'Toutes les quêtes sont accomplies !';
        $('obj-desc').textContent = 'Le monde est à toi. Construis, explore, affronte la nuit.';
      } else {
        $('obj-title').textContent = OBJECTIVES[idx].t;
        $('obj-desc').textContent = OBJECTIVES[idx].d;
      }
    }

    toggleDebug() {
      this.debug = !this.debug;
      $('debug').classList.toggle('hidden', !this.debug);
    }
    updateDebug() {
      const g = this.game, p = g.player, w = g.world;
      const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
      const t = p.target;
      $('debug').textContent =
        'FPS ' + g.fps.toFixed(0) + '\n' +
        'XYZ ' + p.x.toFixed(1) + ' / ' + p.y.toFixed(1) + ' / ' + p.z.toFixed(1) + '\n' +
        'Lumière ciel ' + w.skyAt(fx, fy + 1, fz) + ' · bloc ' + w.blockLightAt(fx, fy + 1, fz) + '\n' +
        'Sections ' + g.renderer.stats.drawn + ' · faces ' + g.renderer.stats.quads + '\n' +
        'Créatures ' + g.entities.mobs.length + ' · objets ' + g.entities.drops.length + ' · particules ' + g.entities.particles.length + '\n' +
        'Visée ' + (t ? CM.blocks[t.id].name + ' (' + t.x + ',' + t.y + ',' + t.z + ')' : '—') + '\n' +
        'Heure ' + g.time.toFixed(3) + ' · lumière du jour ' + g.daylight.toFixed(2);
    }

    toast(msg, type, key) {
      const k = key || msg;
      const now = performance.now();
      if (this.toastKeys.has(k) && now - this.toastKeys.get(k) < 3500) return;
      this.toastKeys.set(k, now);
      const box = $('toasts');
      const el = document.createElement('div');
      el.className = 'toast ' + (type || '');
      el.textContent = msg;
      box.appendChild(el);
      while (box.children.length > 4) box.removeChild(box.firstChild);
      setTimeout(() => el.classList.add('fade'), 2600);
      setTimeout(() => el.remove(), 3200);
    }

    pickup(id, n) {
      const box = $('pickups');
      const last = box.lastElementChild;
      if (last && last.dataset.id === String(id) && !last.classList.contains('fade')) {
        last.dataset.n = +last.dataset.n + n;
        last.querySelector('span').textContent = '+' + last.dataset.n + ' ' + CM.itemName(id);
        clearTimeout(last._t);
        last._t = setTimeout(() => this.fadePickup(last), 1800);
        return;
      }
      const el = document.createElement('div');
      el.className = 'pickup';
      el.dataset.id = id;
      el.dataset.n = n;
      el.innerHTML = '<i style="background-image:url(' + CM.Textures.icons[id] + ')"></i><span>+' + n + ' ' + CM.itemName(id) + '</span>';
      box.appendChild(el);
      while (box.children.length > 6) box.removeChild(box.firstChild);
      el._t = setTimeout(() => this.fadePickup(el), 1800);
    }
    fadePickup(el) {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 600);
    }

    // ------------------------------------------------------ inventaire --
    buildInventory() {
      const main = $('inv-main'), hot = $('inv-hot');
      main.innerHTML = '';
      hot.innerHTML = '';
      this.invSlots = [];
      const mk = (i, parent) => {
        const s = document.createElement('div');
        s.className = 'slot';
        s.dataset.i = i;
        s.addEventListener('mousedown', (e) => this.slotClick(this.game.inventory.slots, i, e, 'inv'));
        s.addEventListener('mouseenter', (e) => this.showTip(this.game.inventory.slots[i], e));
        s.addEventListener('mouseleave', () => this.hideTip());
        parent.appendChild(s);
        this.invSlots[i] = s;
      };
      for (let i = 9; i < 36; i++) mk(i, main);
      for (let i = 0; i < 9; i++) mk(i, hot);
      const cg = $('chest-grid');
      this.chestSlots = [];
      for (let i = 0; i < 27; i++) {
        const s = document.createElement('div');
        s.className = 'slot';
        s.addEventListener('mousedown', (e) => this.chest && this.slotClick(this.chest, i, e, 'chest'));
        s.addEventListener('mouseenter', (e) => this.chest && this.showTip(this.chest[i], e));
        s.addEventListener('mouseleave', () => this.hideTip());
        cg.appendChild(s);
        this.chestSlots.push(s);
      }
      const inv = $('inventory');
      inv.addEventListener('contextmenu', (e) => e.preventDefault());
      inv.addEventListener('mousemove', (e) => {
        const c = $('cursor-stack');
        c.style.left = e.clientX + 'px';
        c.style.top = e.clientY + 'px';
        const tt = $('tooltip');
        tt.style.left = e.clientX + 16 + 'px';
        tt.style.top = e.clientY + 12 + 'px';
      });
      document.querySelectorAll('.tabs button').forEach((b) =>
        b.addEventListener('click', () => {
          this.tab = b.dataset.tab;
          document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
          for (const t of ['craft', 'journal', 'guide']) $('tab-' + t).classList.toggle('hidden', t !== this.tab);
          if (this.tab === 'journal') this.renderJournal();
        }),
      );
      document.querySelectorAll('.filters button').forEach((b) =>
        b.addEventListener('click', () => {
          this.filter = b.dataset.f;
          document.querySelectorAll('.filters button').forEach((x) => x.classList.toggle('active', x === b));
          this.renderRecipes();
        }),
      );
      $('only-can').addEventListener('change', (e) => {
        this.onlyCan = e.target.checked;
        this.renderRecipes();
      });
    }

    buildGuide() {
      const html = GUIDE.map(([t, d]) => '<h3>' + t + '</h3><p>' + d + '</p>').join('');
      $('tab-guide').innerHTML = html;
      $('help').innerHTML =
        '<h3>Commandes</h3><ul>' +
        '<li><b>ZQSD / WASD</b> : se déplacer · <b>Espace</b> : sauter / nager · <b>Maj</b> : courir</li>' +
        '<li><b>F</b> : ruée · <b>E</b> : inventaire et fabrication · <b>Échap</b> : pause · <b>F3</b> : infos</li>' +
        '<li><b>Clic gauche</b> (maintenu) : miner / frapper · <b>Clic droit</b> : poser, manger, grappin</li>' +
        '<li><b>1-9</b> ou <b>molette</b> : choisir l’objet en main</li></ul>' +
        '<h3>Le concept</h3><p>Comme dans Minecraft : un monde en cubes à miner, des ressources à récolter, des outils à fabriquer, des nuits dangereuses. Mais les règles changent :</p>' +
        GUIDE.map(([t, d]) => '<h3>' + t + '</h3><p>' + d + '</p>').join('');
    }

    openChest(slots) {
      this.chest = slots;
      this.openInventory(true);
    }
    openInventory(withChest) {
      if (this.invOpen || !this.game.player.alive) return;
      if (!withChest) this.chest = null;
      document.querySelector('.side-panel').classList.toggle('chest-mode', !!this.chest);
      $('chest-panel').classList.toggle('hidden', !this.chest);
      if (this.chest) CM.Audio.play('place', { mat: 'wood' });
      this.invOpen = true;
      this.game.releaseMouse();
      $('inventory').classList.remove('hidden');
      this.refreshStations();
      this.renderInventory();
      if (this.tab === 'journal') this.renderJournal();
    }
    closeInventory() {
      if (!this.invOpen) return;
      this.invOpen = false;
      if (this.cursor) {
        const left = this.game.inventory.add(this.cursor.id, this.cursor.count, this.cursor.xp !== undefined ? { xp: this.cursor.xp } : null);
        if (left > 0) this.game.dropNearPlayer(this.cursor.id, left, this.cursor);
        this.cursor = null;
      }
      this.chest = null;
      $('cursor-stack').classList.add('hidden');
      this.hideTip();
      $('inventory').classList.add('hidden');
      this.game.captureMouse();
    }

    refreshStations() {
      const st = this.game.nearbyStations();
      const changed = st.table !== this.stations.table || st.forge !== this.stations.forge;
      this.stations = st;
      $('stations').innerHTML =
        '<span class="station ' + (st.table ? 'on' : '') + '">' + (st.table ? '✔' : '✖') + ' Établi</span>' +
        '<span class="station ' + (st.forge ? 'on' : '') + '">' + (st.forge ? '✔' : '✖') + ' Forge</span>';
      if (changed && this.invOpen) this.renderRecipes();
    }

    renderInventory() {
      const inv = this.game.inventory;
      for (let i = 0; i < 36; i++) this.invSlots[i].innerHTML = this.slotHTML(inv.slots[i], i < 9 ? i + 1 : 0);
      if (this.chest) for (let i = 0; i < 27; i++) this.chestSlots[i].innerHTML = this.slotHTML(this.chest[i]);
      const c = $('cursor-stack');
      if (this.cursor) {
        c.innerHTML = this.slotHTML(this.cursor);
        c.classList.remove('hidden');
      } else c.classList.add('hidden');
      this.renderRecipes();
    }

    // Range un stack dans des cases (fusion puis cases vides). Renvoie le reste.
    stowInto(s, slots, from, to) {
      const max = CM.itemInfo(s.id).stack;
      for (let j = from; j < to && s.count > 0; j++) {
        const t = slots[j];
        if (t && t.id === s.id && t.count < max) {
          const n = Math.min(max - t.count, s.count);
          t.count += n;
          s.count -= n;
        }
      }
      for (let j = from; j < to && s.count > 0; j++) {
        if (!slots[j]) {
          slots[j] = Object.assign({}, s);
          s.count = 0;
        }
      }
      return s.count;
    }

    // Clic sur une case d'un conteneur (inventaire ou coffre).
    slotClick(slots, i, e, kind) {
      e.preventDefault();
      const inv = this.game.inventory;
      const s = slots[i];
      const max = (id) => CM.itemInfo(id).stack;
      CM.Audio.play('click');
      if (e.shiftKey && s && !this.cursor) {
        if (kind === 'chest') this.stowInto(s, inv.slots, 0, 36);
        else if (this.chest) this.stowInto(s, this.chest, 0, 27);
        else if (i >= 9) this.stowInto(s, inv.slots, 0, 9);
        else this.stowInto(s, inv.slots, 9, 36);
        if (s.count <= 0) slots[i] = null;
        inv.changed();
        return;
      }
      if (e.button === 0) {
        if (!this.cursor) {
          if (s) {
            this.cursor = s;
            slots[i] = null;
          }
        } else if (!s) {
          slots[i] = this.cursor;
          this.cursor = null;
        } else if (s.id === this.cursor.id && max(s.id) > 1) {
          const n = Math.min(max(s.id) - s.count, this.cursor.count);
          s.count += n;
          this.cursor.count -= n;
          if (this.cursor.count <= 0) this.cursor = null;
        } else {
          slots[i] = this.cursor;
          this.cursor = s;
        }
      } else if (e.button === 2) {
        if (!this.cursor) {
          if (s) {
            const half = Math.ceil(s.count / 2);
            this.cursor = Object.assign({}, s, { count: half });
            s.count -= half;
            if (s.count <= 0) slots[i] = null;
          }
        } else if (!s) {
          slots[i] = Object.assign({}, this.cursor, { count: 1 });
          if (--this.cursor.count <= 0) this.cursor = null;
        } else if (s.id === this.cursor.id && s.count < max(s.id)) {
          s.count++;
          if (--this.cursor.count <= 0) this.cursor = null;
        }
      }
      inv.changed();
      this.showTip(slots[i], e);
    }

    showTip(s, e) {
      const tt = $('tooltip');
      if (!s || this.cursor) {
        tt.classList.add('hidden');
        return;
      }
      tt.innerHTML = this.tipHTML(s.id, s);
      tt.classList.remove('hidden');
      if (e) {
        tt.style.left = e.clientX + 16 + 'px';
        tt.style.top = e.clientY + 12 + 'px';
      }
    }
    hideTip() {
      $('tooltip').classList.add('hidden');
    }
    tipHTML(id, s) {
      const info = CM.itemInfo(id);
      let h = '<b>' + info.name + '</b>';
      if (info.type === 'tool') {
        const lvl = CM.masteryLevel((s && s.xp) || 0);
        const spd = info.toolType === 'sword' ? 'Dégâts ' + (CM.SWORD_DAMAGE[info.tier] + Math.floor((lvl - 1) / 2)) : 'Vitesse ×' + (CM.TOOL_SPEED[info.tier] * (1 + 0.12 * (lvl - 1))).toFixed(1);
        h += '<div class="tt-gold">Maîtrise ' + '★'.repeat(lvl) + '☆'.repeat(5 - lvl) + (s ? ' · ' + s.xp + ' XP' : '') + '</div>';
        h += '<div class="tt-sub">' + spd + ' · ne s’use jamais</div>';
        if (info.toolType === 'pickaxe' && info.tier === 4) h += '<div class="tt-sub">Mine les filons de minerai d’un coup.</div>';
        if (info.toolType === 'axe' && info.tier >= 3) h += '<div class="tt-sub">Abat l’arbre entier d’un coup.</div>';
      } else if (info.type === 'food') {
        h += '<div class="tt-sub">Clic droit pour manger : +' + info.heal / 2 + ' ♥, +' + info.stamina + ' endurance' + (info.vigor ? ', Vigueur' : '') + '</div>';
      } else if (info.type === 'charm') {
        h += '<div class="tt-gold">' + info.desc + '</div>';
      } else if (info.type === 'grapple') {
        h += '<div class="tt-sub">Clic droit : s’accrocher à un bloc (34 blocs). Espace : se décrocher.</div>';
      } else if (info.isBlock) {
        const b = info.block;
        const bits = [];
        if (b.light) bits.push('Lumineux (' + b.light + ')');
        if (b.station) bits.push('Station de fabrication');
        if (b.bounce) bits.push('Rebondissant');
        if (b.id === CM.B.SAPLING) bits.push('Pose-la sur de l’herbe au soleil : un arbre poussera');
        if (b.tier > 1) bits.push('Pioche en ' + CM.TIER_NAMES[b.tier] + ' requise');
        if (bits.length) h += '<div class="tt-sub">' + bits.join(' · ') + '</div>';
      }
      return h;
    }

    renderRecipes() {
      const g = this.game, inv = g.inventory, st = this.stations;
      const box = $('recipes');
      const list = CM.recipes
        .map((r, i) => ({ r, i, can: inv.canCraft(r, st) }))
        .filter((o) => (this.filter === 'tout' || o.r.cat === this.filter) && (!this.onlyCan || o.can));
      list.sort((a, b) => (b.can ? 1 : 0) - (a.can ? 1 : 0));
      let h = '';
      for (const { r, i, can } of list) {
        const ing = r.ing
          .map(([id, n]) => {
            const have = inv.count(id);
            return '<span class="ing ' + (have >= n ? '' : 'miss') + '"><i style="background-image:url(' + CM.Textures.icons[id] + ')"></i>' + n + ' ' + CM.itemName(id) + '</span>';
          })
          .join('');
        const stn = r.station ? '<span class="r-station ' + (st[r.station] ? '' : 'miss') + '">' + CM.STATION_NAMES[r.station] + '</span>' : '';
        h +=
          '<div class="recipe ' + (can ? 'can' : '') + '" data-r="' + i + '">' +
          '<div class="slot">' + this.slotHTML({ id: r.out, count: r.n }) + '</div>' +
          '<div class="r-body"><div class="r-name">' + CM.itemName(r.out) + (r.n > 1 ? ' ×' + r.n : '') + '</div><div class="r-ing">' + ing + '</div></div>' +
          stn + '</div>';
      }
      if (!list.length) h = '<div class="hint">Aucune recette ne correspond.</div>';
      const scroll = box.scrollTop;
      box.innerHTML = h;
      box.scrollTop = scroll;
      box.querySelectorAll('.recipe').forEach((el) => {
        const r = CM.recipes[+el.dataset.r];
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.craft(r, e.shiftKey);
        });
        el.addEventListener('mouseenter', (e) => this.showTip({ id: r.out, count: r.n, xp: CM.itemInfo(r.out).type === 'tool' ? 0 : undefined }, e));
        el.addEventListener('mouseleave', () => this.hideTip());
      });
    }

    craft(r, many) {
      const g = this.game, inv = g.inventory;
      if (!inv.canCraft(r, this.stations)) {
        if (r.station && !this.stations[r.station]) this.toast('Il faut être près d’' + CM.STATION_NEAR[r.station] + ' (4 blocs)', 'warn');
        else this.toast('Ingrédients manquants', 'warn');
        return;
      }
      const times = many ? inv.maxCrafts(r) : 1;
      for (let k = 0; k < times; k++) {
        const left = inv.craft(r);
        if (left > 0) g.dropNearPlayer(r.out, left);
        g.stats.crafted[r.out] = (g.stats.crafted[r.out] || 0) + r.n;
        if (CM.itemInfo(r.out).stack === 1) break;
      }
      CM.Audio.play('craft');
      this.updateObjective();
    }

    renderJournal() {
      const g = this.game;
      let cur = OBJECTIVES.findIndex((o) => !o.done(g));
      let h = '';
      OBJECTIVES.forEach((o, i) => {
        const done = o.done(g);
        h += '<div class="journal-item ' + (done ? 'done' : i === cur ? 'current' : '') + '"><div class="jt">' + (done ? '✔ ' : i === cur ? '➤ ' : '') + o.t + '</div><div class="jd">' + o.d + '</div></div>';
      });
      const s = g.stats;
      const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
      h +=
        '<div class="stats">' +
        '<div>Jours survécus : <b>' + g.dayCount + '</b></div>' +
        '<div>Blocs minés : <b>' + sum(s.mined) + '</b></div>' +
        '<div>Blocs posés : <b>' + sum(s.placed) + '</b></div>' +
        '<div>Ombres vaincues : <b>' + (s.kills.ombre || 0) + '</b></div>' +
        '<div>Grappins lancés : <b>' + (s.grapples || 0) + '</b></div>' +
        '<div>Morts : <b>' + (s.deaths || 0) + '</b></div>' +
        '</div>';
      $('tab-journal').innerHTML = h;
    }

    // ---------------------------------------------------------- écrans --
    show(id) {
      $(id).classList.remove('hidden');
    }
    hide(id) {
      $(id).classList.add('hidden');
    }
    showDeath(cause) {
      this.closeInventory();
      $('death-cause').textContent = (cause || 'Quelque chose') + ' a eu raison de vous.';
      this.game.releaseMouse();
      this.show('death');
    }
    hideDeath() {
      this.hide('death');
    }
  }

  CM.UI = UI;
})();
