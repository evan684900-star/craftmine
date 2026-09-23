'use strict';
// Interface : HUD, inventaire, fabrication, inventaire créatif, journal, options, menus.
(function () {
  const $ = (id) => document.getElementById(id);
  // Texte sans accents ni majuscules (pour la recherche).
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const I = CM.I;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // Texte d'aide partagé (menu principal + onglet « Mécaniques »).
  const GUIDE = [
    ['🍗 La faim', "La barre de faim (à droite des cœurs) baisse quand tu cours, sautes, mines, nages ou te bats. Faim presque pleine : tes cœurs remontent tout seuls. Faim à zéro : tu perds de la vie. En dessous de 3 cuisses tu ne peux plus courir ni faire de ruée. Chaque aliment rend de la faim et de la saturation (qui retarde la prochaine fringale) : la viande grillée, le pain et la tarte à la citrouille sont les plus nourrissants. Sous l'eau, surveille tes bulles d'air."],
    ['🌾 Cultures', "Casse des herbes hautes pour trouver des graines. Laboure la terre avec une houe (clic droit), plante les graines puis récolte le blé mûr. 3 blés = 1 pain. La poudre d'os (clic droit) fait pousser instantanément cultures, pousses et fleurs."],
    ['🪝 Grappin', "Fabrique-le avec 3 lingots de fer et 2 cordes. En main, clic droit sur un bloc jusqu'à 34 blocs : tu es tiré vers lui en gardant ton élan. Saut pendant la traction pour te décrocher avec un bond."],
    ['💨 Ruée et double saut', "La touche de ruée (F) lance un sprint éclair (tu es brièvement invulnérable et tu frappes plus fort). L'Amulette de plume, gardée dans l'inventaire, donne un double saut."],
    ['🔥 Combo de minage', "Casse des blocs à la suite (moins de 2,4 s d'écart) : chaque niveau de combo accélère le minage. À partir de x5, les minerais peuvent donner un double butin."],
    ['⭐ Maîtrise des outils', "Les outils ne s'usent jamais. Ils gagnent de l'expérience et montent jusqu'à ★★★★★. Sept matériaux : bois, pierre, or (très rapide), fer, cristal, diamant et netherite (le meilleur, à la table de forgeron). Une hache en fer abat l'arbre entier, la pioche de cristal mine tout un filon, et la hache écorce les bûches (clic droit)."],
    ['📖 Fabrication libre', "Pas de grille : ouvre l'inventaire (E) et choisis une recette (plus de 400, avec recherche et catégories). Certaines demandent un Établi, une Forge / un Fourneau ou une Table de forgeron à moins de 4 blocs. La forge sert à fondre et cuire avec du charbon."],
    ['🌑 Les Ombres', "La nuit et dans les grottes sombres, des Ombres apparaissent (leurs yeux brillent dans le noir). Elles brûlent au soleil et ont peur de la lumière : elles refusent d'entrer dans la zone d'une torche et y souffrent. Éclaire ta base ! Leur nombre dépend de la difficulté et des jours passés."],
    ['🧱 Plus de 500 blocs', "Laine, béton, poudre de béton (devient du béton au contact de l'eau), terre cuite et verre en 16 couleurs, tapis, dalles (deux dalles = un bloc), 12 essences de bois et leurs versions écorcées, ardoise des abîmes, tuf, calcite, pierre noire, basalte, blocs du Nether et de l'End, prismarine, quartz, coraux, grenouillampes, TNT (à allumer au briquet)…"],
    ['🎨 Mode créatif', "Choisis-le en créant un monde (ou en pause > Options > Jeu). Blocs infinis, vol (appuie deux fois sur saut), minage instantané, pas de dégâts ni de faim. L'onglet Créatif de l'inventaire contient tous les blocs et objets ; le clic molette copie le bloc visé."],
    ['🍄 Champignons rebond', "Dans les grottes poussent des champignons violets lumineux. Saute dessus pour rebondir très haut ; tomber dessus annule les dégâts de chute (comme le bloc de slime et la botte de foin)."],
    ['🏝 Îles célestes', "Des îles flottent au-dessus du monde (vers la couche 75). Leur pierre renferme des Éclats célestes. Certaines portent des ruines de purpur et de pierre de l'End."],
    ['🗺 Biomes', "Plus de 20 biomes : plaines, prairies fleuries, forêts (chêne, bouleau, chêne noir), bosquets de cerisiers, taïga, taïga enneigée, toundra, pics de glace, savane, jungle, bambouseraie, marais, mangrove, désert, canyon rouge, montagnes, champignonnière, terres volcaniques, forêts fongiques, océans chauds à coraux, océans, lacs… et la Sylve cristalline. La taille des biomes se règle en créant le monde."],
    ['⛏ Minerais', "Charbon, fer, cuivre, or (canyons rouges), lapis-lazuli, redstone, diamant (très profond), émeraude et rubis (montagnes), cristal (sous la couche 20), quartz et or du Nether (terres volcaniques), débris antiques → netherite, et éclats célestes. Sous la couche 14, les minerais sont dans l'ardoise des abîmes."],
    ['🏛 Ruines', "Des ruines cachent un coffre rempli de butin : lingots, nourriture, diamants, livres, pousses, parfois un rubis ou un éclat céleste."],
    ['🐗 Faune', "Mouflons dans les prairies (laine, viande), sangliers dans les forêts (cuir ; ils chargent si on les attaque !), pingouins sur la neige (plumes pour l'Amulette de plume)."],
    ["☀ Le Cœur d'aube", "Le but final : forge le Cœur d'aube (4 éclats célestes, 4 essences d'ombre, 4 cristaux, 2 lingots de fer) et pose-le. Il chasse les Ombres alentour pour toujours."],
  ];

  const OBJECTIVES = [
    { t: 'Coupe du bois', d: 'Maintiens le clic gauche sur un tronc d’arbre pour récolter 3 bûches.', done: (g) => CM.TAGS.logs.reduce((n, id) => n + (g.stats.mined[id] || 0), 0) >= 3 },
    { t: 'Fabrique un établi', d: 'Ouvre l’inventaire (E) : bûches → planches, puis établi.', done: (g) => g.crafted(CM.B.TABLE) },
    { t: 'Ta première pioche', d: 'Pose l’établi (clic droit) et fabrique une pioche en bois à côté.', done: (g) => g.crafted(I.PICKAXE_1) },
    { t: 'L’âge de pierre', d: 'Mine de la pierre (tu obtiens des galets) et fabrique une pioche en pierre.', done: (g) => g.crafted(I.PICKAXE_2) },
    { t: 'Lumière contre les Ombres', d: 'Trouve du charbon et fabrique des torches. Les Ombres fuient la lumière.', done: (g) => g.crafted(CM.B.TORCH) },
    { t: 'La forge', d: 'Fabrique une forge (8 galets) près de l’établi.', done: (g) => g.crafted(CM.B.FORGE) || g.crafted(CM.B.FURNACE) },
    { t: 'Le fer', d: 'Mine du minerai de fer (pioche en pierre) et fonds-le à la forge.', done: (g) => g.crafted(I.IRON_INGOT) },
    { t: 'Le grappin', d: 'Herbes hautes → fibres → cordes. Puis grappin : 3 lingots + 2 cordes.', done: (g) => g.crafted(I.GRAPPLE) },
    { t: 'Les profondeurs', d: 'Descends sous la couche 20 et mine du cristal avec une pioche en fer.', done: (g) => (g.stats.mined[CM.B.CRYSTAL_ORE] || 0) >= 1 },
    { t: 'Chasseur d’Ombres', d: 'Vaincs une Ombre (la nuit ou dans une grotte sombre) pour son essence.', done: (g) => (g.stats.kills.ombre || 0) >= 1 },
    { t: 'Vers les îles célestes', d: 'Monte sur une île flottante et mine un éclat céleste.', done: (g) => (g.stats.mined[CM.B.SHARD_ORE] || 0) >= 1 },
    { t: 'Le Cœur d’aube', d: 'Forge le Cœur d’aube et pose-le pour chasser les Ombres.', done: (g) => (g.stats.placed[CM.B.DAWN_HEART] || 0) >= 1 },
  ];
  CM.OBJECTIVES = OBJECTIVES;

  // Petites icônes pixel-art du HUD (cœurs, cuisses, bulles).
  function pixIcon(rows, pal) {
    const c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    const ctx = c.getContext('2d');
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const col = pal[rows[y][x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    return c.toDataURL();
  }
  const HEART = ['.xx...xx.', 'xhhx.xrrx', 'xhrrxrrrx', 'xrrrrrrrx', '.xrrrrrx.', '..xrrrx..', '...xrx...', '....x....'];
  function heartIcon(kind) {
    const rows = HEART.map((row) => row.split('').map((ch, x) => (ch === 'x' || ch === '.' ? ch : kind === 'full' || (kind === 'half' && x < 5) ? ch : 'e')).join(''));
    return pixIcon(rows, { x: '#1a0a0a', h: '#ff9a9a', r: '#e0263a', e: '#3a1c22' });
  }
  const DRUM = ['.....xxx.', '....xmmmx', '...xmhmmx', '...xmmmmx', '..xxmmmx.', '.xbxxxx..', 'xbx......', '.x.......'];
  function foodIcon(kind) {
    const rows = DRUM.map((row) => row.split('').map((ch, x) => (ch === 'x' || ch === '.' ? ch : kind === 'full' || (kind === 'half' && x >= 4) ? ch : 'e')).join(''));
    return pixIcon(rows, { x: '#1a0e06', m: '#b5652b', h: '#e39a55', b: '#eee4d0', e: '#3b2518' });
  }
  const BUBBLE = ['..xxx..', '.xhwwx.', 'xhwwwwx', 'xwwwwwx', 'xwwwwwx', '.xwwwx.', '..xxx..'];
  const bubbleIcon = (kind) => pixIcon(kind === 'pop' ? ['.......', '..x.x..', '.x...x.', '.......', '.x...x.', '..x.x..', '.......'] : BUBBLE, { x: '#1d4a8a', h: '#ffffff', w: '#8fd0ff' });

  // --------------------------------------------------------- Options ---
  const pct = (v) => v + ' %';
  const OPTION_TABS = [
    ['graph', 'Graphismes', [
      { k: 'renderDist', t: 'range', label: "Distance d'affichage", min: 3, max: 16, step: 1, fmt: (v) => v + ' tronçons (' + v * 16 + ' blocs)' },
      { k: 'fov', t: 'range', label: 'Champ de vision', min: 50, max: 110, step: 1, fmt: (v) => v + '°' },
      { k: 'brightness', t: 'range', label: 'Luminosité', min: 0, max: 100, step: 5, fmt: (v) => (v <= 5 ? 'Sombre' : v >= 95 ? 'Très lumineux' : v + ' %') },
      { k: 'resolution', t: 'range', label: 'Résolution de rendu', min: 40, max: 100, step: 5, fmt: pct, note: 'Baisse-la si le jeu rame.' },
      { k: 'maxFps', t: 'select', label: 'Images par seconde max', opts: [[0, 'Illimitées'], [30, '30'], [60, '60'], [120, '120']] },
      { k: 'particles', t: 'select', label: 'Particules', opts: [[2, 'Toutes'], [1, 'Réduites'], [0, 'Aucune']] },
      { k: 'smoothLight', t: 'check', label: 'Éclairage doux et ombres dans les coins' },
      { k: 'waving', t: 'check', label: 'Feuillage et plantes qui ondulent au vent' },
      { k: 'clouds', t: 'check', label: 'Nuages' },
      { k: 'viewBob', t: 'check', label: 'Balancement de la vue en marchant' },
      { k: 'dynFov', t: 'check', label: 'Champ de vision dynamique (course, ruée)' },
      { k: 'showHand', t: 'check', label: 'Afficher la main et l’objet tenu' },
    ]],
    ['ctrl', 'Contrôles', [
      { k: 'sens', t: 'range', label: 'Sensibilité de la souris', min: 0.2, max: 3, step: 0.1, fmt: (v) => (+v).toFixed(1) },
      { k: 'invertY', t: 'check', label: "Inverser l'axe vertical" },
      { k: 'toggleSprint', t: 'check', label: 'Course : un appui suffit (au lieu de maintenir la touche)' },
      { k: 'autoJump', t: 'check', label: 'Saut automatique devant une marche' },
      { t: 'binds' },
    ]],
    ['game', 'Jeu', [
      { t: 'world' },
      { k: 'dayLength', t: 'select', label: "Durée d'une journée", opts: [[5, '5 minutes'], [10, '10 minutes'], [20, '20 minutes'], [40, '40 minutes']] },
      { k: 'keepInventory', t: 'check', label: "Garder l'inventaire à la mort" },
      { k: 'showQuests', t: 'check', label: 'Afficher les objectifs à l’écran' },
      { k: 'autosave', t: 'select', label: 'Sauvegarde automatique', opts: [[30, 'Toutes les 30 s'], [45, 'Toutes les 45 s'], [120, 'Toutes les 2 min'], [300, 'Toutes les 5 min']] },
    ]],
    ['audio', 'Audio', [
      { k: 'volume', t: 'range', label: 'Volume général', min: 0, max: 100, step: 1, fmt: pct },
      { k: 'sfxVolume', t: 'range', label: 'Blocs et actions', min: 0, max: 100, step: 1, fmt: pct },
      { k: 'mobVolume', t: 'range', label: 'Créatures', min: 0, max: 100, step: 1, fmt: pct },
      { k: 'uiVolume', t: 'range', label: 'Interface', min: 0, max: 100, step: 1, fmt: pct },
    ]],
    ['ui', 'Interface', [
      { k: 'guiScale', t: 'range', label: "Taille de l'interface", min: 70, max: 140, step: 5, fmt: pct },
      { k: 'crosshair', t: 'select', label: 'Réticule', opts: [['cross', 'Croix'], ['dot', 'Point'], ['circle', 'Cercle'], ['none', 'Aucun']] },
      { k: 'toasts', t: 'select', label: 'Notifications', opts: [[2, 'Toutes'], [1, 'Importantes seulement'], [0, 'Aucune']] },
      { k: 'showCoords', t: 'check', label: 'Afficher les coordonnées' },
      { k: 'showFps', t: 'check', label: 'Afficher les images par seconde' },
      { k: 'showBiome', t: 'check', label: 'Afficher le nom du biome' },
      { k: 'itemNames', t: 'check', label: "Afficher le nom de l'objet en main" },
    ]],
  ];
  const BIND_LABELS = {
    forward: 'Avancer', back: 'Reculer', left: 'Aller à gauche', right: 'Aller à droite', jump: 'Sauter / nager / monter (vol)',
    sprint: 'Courir', sneak: "S'accroupir / descendre (vol)", dash: 'Ruée', inventory: 'Inventaire', drop: "Jeter l'objet",
  };
  const MODE_NAMES = { survival: 'Survie', creative: 'Créatif' };
  const DIFF_NAMES = { peaceful: 'Paisible', easy: 'Facile', normal: 'Normale', hard: 'Difficile' };
  const TYPE_NAMES = { normal: 'Normal', amplified: 'Amplifié', flat: 'Plat', islands: 'Archipel' };

  // Catégorie d'un bloc/objet pour l'inventaire créatif.
  function creativeCat(id) {
    if (id >= CM.ITEM_BASE) return 'items';
    const b = CM.blocks[id];
    for (const f of Object.keys(CM.COLOR)) if (Object.values(CM.COLOR[f]).includes(id)) return 'color';
    if (b.plant || b.wood && b.id === CM.woodOf(id).leaves || b.soil || b.farmland || /CORAL|SNOW|ICE|MUSHROOM|CACTUS|MELON|PUMPKIN|SAND|GRAVEL|CLAY|MUD|MOSS|DIRT/.test(b.key) && !/SANDSTONE|BRICK/.test(b.key)) return 'nature';
    if (b.ore || /_BLOCK$/.test(b.key) && /IRON|GOLD|COPPER|DIAMOND|EMERALD|LAPIS|REDSTONE|NETHERITE|RUBY|CRYSTAL|COAL|AMETHYST|RAW/.test(b.key) || /COPPER/.test(b.key)) return 'ores';
    if (b.light || b.station || b.container || b.tnt || b.note || b.render === 'glass' || b.render === 'torch' || /TABLE|LOOM|JUKEBOX|TARGET|DISPENSER|DROPPER|OBSERVER|BOOKSHELF|BEEHIVE|SPONGE|HAY|SLIME|HONEY/.test(b.key)) return 'deco';
    return 'build';
  }

  class UI {
    constructor(game) {
      this.game = game;
      this.cursor = null;
      this.invOpen = false;
      this.tab = 'craft';
      this.filter = 'tout';
      this.onlyCan = false;
      this.search = '';
      this.cSearch = '';
      this.cCat = 'all';
      this.toastKeys = new Map();
      this.dirtyInv = true;
      this.lastHealth = -1;
      this.lastFood = -1;
      this.lastAir = -1;
      this.lastSel = -1;
      this.itemNameT = 0;
      this.stations = {};
      this.bindWaiting = null;
      this.optTab = 'graph';
      this.hearts = { full: heartIcon('full'), half: heartIcon('half'), empty: heartIcon('empty') };
      this.foods = { full: foodIcon('full'), half: foodIcon('half'), empty: foodIcon('empty') };
      this.bubbles = { full: bubbleIcon('full'), pop: bubbleIcon('pop') };
      this.buildHUD();
      this.buildInventory();
      this.buildGuide();
      this.buildNewWorld();
      $('btn-opt-reset').addEventListener('click', () => {
        if (!confirm('Remettre toutes les options (et les touches) par défaut ?')) return;
        Object.assign(this.game.options, CM.DEFAULT_OPTIONS, { binds: null });
        this.game.binds = Object.assign({}, CM.DEFAULT_BINDS);
        this.game.applyOptions();
        this.renderOptions();
      });
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
      const mk = (id, n) => {
        const el = $(id);
        el.innerHTML = '';
        const out = [];
        for (let i = 0; i < n; i++) out.push(el.appendChild(document.createElement('i')));
        return out;
      };
      this.heartEls = mk('hearts', 10);
      this.foodEls = mk('food', 10);
      this.airEls = mk('air', 10);
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

    // Appelé au lancement d'une partie.
    worldStarted() {
      this.lastObj = undefined;
      this.lastHealth = this.lastFood = this.lastAir = -1;
      this.updateObjective();
      this.optionsChanged();
      const creative = this.game.mode === 'creative';
      $('tab-btn-creative').classList.toggle('hidden', !creative);
      if (!creative && this.tab === 'creative') this.setTab('craft');
      if (creative && this.tab === 'craft') this.setTab('creative');
    }
    optionsChanged() {
      const g = this.game, K = g.binds, kn = (a) => '<b>' + esc(g.keyName(K[a])) + '</b>';
      $('ab-dash-key').textContent = g.keyName(K.dash);
      $('start-keys').innerHTML =
        '<div>' + kn('forward') + kn('left') + kn('back') + kn('right') + ' se déplacer</div>' +
        '<div>' + kn('jump') + ' sauter · ' + kn('sprint') + ' courir</div>' +
        '<div>' + kn('dash') + ' ruée · ' + kn('inventory') + ' inventaire &amp; fabrication</div>' +
        '<div><b>Clic gauche</b> miner / frapper</div>' +
        '<div><b>Clic droit</b> poser / utiliser / manger</div>' +
        '<div><b>1-9 / molette</b> barre rapide · <b>Échap</b> pause</div>';
      if (this.game.player) this.lastHealth = this.lastFood = -1;
      if ($('options').classList.contains('hidden') === false) this.renderOptions();
    }

    update(dt) {
      const g = this.game, p = g.player, inv = g.inventory, o = g.options;
      const creative = g.mode === 'creative';
      if (this.dirtyInv) {
        this.dirtyInv = false;
        this.renderHotbar();
        if (this.invOpen) this.renderInventory();
        $('ab-double').classList.toggle('hidden', !inv.has(I.FEATHER_CHARM) || creative);
      }
      if (inv.selected !== this.lastSel) {
        this.lastSel = inv.selected;
        this.renderHotbar();
        const s = inv.held();
        $('item-name').textContent = s ? CM.itemName(s.id) : '';
        $('item-name').style.opacity = s && o.itemNames ? 1 : 0;
        this.itemNameT = 2;
      }
      if (this.itemNameT > 0) {
        this.itemNameT -= dt;
        if (this.itemNameT <= 0) $('item-name').style.opacity = 0;
      }
      // cœurs, faim, bulles (cachés en créatif)
      $('hearts').classList.toggle('hidden', creative);
      $('food').classList.toggle('hidden', creative);
      const hp = Math.ceil(p.health);
      const nHearts = p.maxHealth / 2;
      if (nHearts !== this.heartEls.length) {
        const he = $('hearts');
        while (this.heartEls.length < nHearts) this.heartEls.push(he.appendChild(document.createElement('i')));
        while (this.heartEls.length > nHearts) he.removeChild(this.heartEls.pop());
        this.lastHealth = -1;
      }
      if (hp !== this.lastHealth) {
        this.lastHealth = hp;
        for (let i = 0; i < nHearts; i++) {
          const v = hp - i * 2;
          this.heartEls[i].style.backgroundImage = 'url(' + (v >= 2 ? this.hearts.full : v === 1 ? this.hearts.half : this.hearts.empty) + ')';
        }
        $('hearts').classList.toggle('low', hp <= 6 && hp > 0);
      }
      const food = Math.ceil(p.food);
      if (food !== this.lastFood) {
        this.lastFood = food;
        for (let i = 0; i < 10; i++) {
          const v = food - (9 - i) * 2; // se vide de gauche à droite comme dans Minecraft
          this.foodEls[i].style.backgroundImage = 'url(' + (v >= 2 ? this.foods.full : v === 1 ? this.foods.half : this.foods.empty) + ')';
        }
      }
      $('food').classList.toggle('low', food <= 6);
      $('food').classList.toggle('shake', p.sat <= 0 && food <= 6);
      const showAir = p.headInWater || p.air < 14.9;
      $('air').classList.toggle('hidden', !showAir || creative);
      const air = Math.ceil((p.air / 15) * 10);
      if (showAir && air !== this.lastAir) {
        this.lastAir = air;
        for (let i = 0; i < 10; i++) {
          const k = 9 - i;
          this.airEls[i].style.backgroundImage = k < air ? 'url(' + this.bubbles.full + ')' : k === air ? 'url(' + this.bubbles.pop + ')' : 'none';
        }
      }
      $('ab-dash').classList.toggle('cool', p.dashCd > 0 || !p.canSprint());
      $('ab-dash').classList.toggle('hidden', p.flying);
      $('ab-fly').classList.toggle('hidden', !p.flying);
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
      $('vignette').style.opacity = Math.min(1, p.hurtFlash * 2 + (p.health <= 4 && p.alive && !creative ? 0.35 + Math.sin(g.clock * 5) * 0.15 : 0));
      $('water-overlay').style.opacity = p.headInWater ? 1 : 0;
      // horloge, biome, coordonnées
      this.clockT = (this.clockT || 0) - dt;
      if (this.clockT <= 0) {
        this.clockT = 0.25;
        const night = g.daylight < 0.35;
        const hours = Math.floor(((g.time + 0.25) % 1) * 24) % 24;
        const hh = String(hours).padStart(2, '0');
        let h = (night ? '<span class="danger">☾ Nuit ' : '<span>☀ Jour ') + (g.dayCount + 1) + '</span> · ' + hh + 'h';
        if (o.showBiome) h += '<div class="biome">' + g.world.biomeName(p.x, p.z) + '</div>';
        if (o.showCoords) h += '<div class="biome">X ' + Math.floor(p.x) + ' · Y ' + Math.floor(p.y) + ' · Z ' + Math.floor(p.z) + '</div>';
        if (o.showFps) h += '<div class="biome">' + Math.round(g.fps) + ' images/s</div>';
        if (creative) h += '<div class="biome gold">Mode créatif</div>';
        $('clock').innerHTML = h;
        this.updateObjective();
        if (this.invOpen) {
          this.refreshStations();
          this.renderVitals();
        }
      }
      if (this.debug) this.updateDebug();
    }

    updateObjective() {
      const g = this.game;
      let idx = OBJECTIVES.findIndex((o) => !o.done(g));
      const done = idx < 0 ? OBJECTIVES.length : idx;
      if (this.lastObj !== undefined && done > this.lastObj) {
        const o = OBJECTIVES[this.lastObj];
        if (o && o.done(g) && g.options.showQuests) {
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
    toggleHud() {
      $('hud').classList.toggle('bare');
    }
    updateDebug() {
      const g = this.game, p = g.player, w = g.world;
      const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
      const t = p.target;
      $('debug').textContent =
        'FPS ' + g.fps.toFixed(0) + ' · graine ' + w.seed + '\n' +
        'XYZ ' + p.x.toFixed(1) + ' / ' + p.y.toFixed(1) + ' / ' + p.z.toFixed(1) + '\n' +
        'Biome ' + w.biomeName(p.x, p.z) + '\n' +
        'Lumière ciel ' + w.skyAt(fx, fy + 1, fz) + ' · bloc ' + w.blockLightAt(fx, fy + 1, fz) + '\n' +
        'Tronçons ' + w.chunks.size + ' · sections ' + g.renderer.stats.drawn + ' · faces ' + g.renderer.stats.quads + '\n' +
        'Créatures ' + g.entities.mobs.length + ' · objets ' + g.entities.drops.length + ' · particules ' + g.entities.particles.length + '\n' +
        'Faim ' + p.food + ' · saturation ' + p.sat.toFixed(1) + ' · épuisement ' + p.exh.toFixed(2) + '\n' +
        'Visée ' + (t ? CM.blocks[t.id].name + ' (' + t.x + ',' + t.y + ',' + t.z + ')' : '—') + '\n' +
        'Heure ' + g.time.toFixed(3) + ' · lumière du jour ' + g.daylight.toFixed(2);
    }

    toast(msg, type, key) {
      const level = this.game.options.toasts;
      if (level === 0) return;
      if (level === 1 && type !== 'warn' && type !== 'gold') return;
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
      el.innerHTML = '<i style="background-image:url(' + CM.Textures.icons[id] + ')"></i><span>+' + n + ' ' + esc(CM.itemName(id)) + '</span>';
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
        tt.style.left = Math.min(e.clientX + 16, window.innerWidth - 300) + 'px';
        tt.style.top = e.clientY + 12 + 'px';
      });
      document.querySelectorAll('.side-panel .tabs button').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
      document.querySelectorAll('#tab-craft .filters button').forEach((b) =>
        b.addEventListener('click', () => {
          this.filter = b.dataset.f;
          document.querySelectorAll('#tab-craft .filters button').forEach((x) => x.classList.toggle('active', x === b));
          this.renderRecipes();
        }),
      );
      const stop = (e) => e.stopPropagation();
      $('recipe-search').addEventListener('input', (e) => {
        this.search = norm(e.target.value.trim());
        this.renderRecipes();
      });
      $('recipe-search').addEventListener('keydown', stop);
      $('only-can').addEventListener('change', (e) => {
        this.onlyCan = e.target.checked;
        this.renderRecipes();
      });
      $('creative-search').addEventListener('input', (e) => {
        this.cSearch = norm(e.target.value.trim());
        this.renderCreative();
      });
      $('creative-search').addEventListener('keydown', stop);
      $('creative-cat').addEventListener('change', (e) => {
        this.cCat = e.target.value;
        this.renderCreative();
      });
      // grille créative (construite une seule fois)
      this.creativeIds = [];
      for (const b of CM.blocks) if (b && b.id && b.id !== CM.B.WATER && b.tex) this.creativeIds.push(b.id);
      for (const it of CM.items) if (it) this.creativeIds.push(it.id);
      const grid = $('creative-grid');
      this.creativeEls = new Map();
      for (const id of this.creativeIds) {
        const el = document.createElement('div');
        el.className = 'slot';
        el.innerHTML = '<div class="icon" style="background-image:url(' + CM.Textures.icons[id] + ')"></div>';
        el.addEventListener('mousedown', (e) => this.creativeClick(id, e));
        el.addEventListener('mouseenter', (e) => this.showTip({ id, count: 1, xp: CM.itemInfo(id).type === 'tool' ? 0 : undefined }, e));
        el.addEventListener('mouseleave', () => this.hideTip());
        grid.appendChild(el);
        this.creativeEls.set(id, { el, cat: creativeCat(id), name: norm(CM.itemName(id)) });
      }
    }

    setTab(tab) {
      this.tab = tab;
      document.querySelectorAll('.side-panel .tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
      for (const t of ['craft', 'creative', 'journal', 'guide']) $('tab-' + t).classList.toggle('hidden', t !== tab);
      if (tab === 'journal') this.renderJournal();
      if (tab === 'creative') this.renderCreative();
    }

    renderCreative() {
      let n = 0;
      for (const [, o] of this.creativeEls) {
        const show = (this.cCat === 'all' || o.cat === this.cCat) && (!this.cSearch || o.name.includes(this.cSearch));
        o.el.classList.toggle('hidden', !show);
        if (show) n++;
      }
      $('creative-count').textContent = n + ' blocs et objets';
    }
    creativeClick(id, e) {
      e.preventDefault();
      const info = CM.itemInfo(id);
      const stack = { id, count: e.button === 2 ? 1 : info.stack };
      if (info.type === 'tool') stack.xp = 0;
      CM.Audio.play('click');
      if (e.shiftKey) {
        this.game.inventory.add(id, stack.count, info.type === 'tool' ? { xp: 0 } : null);
        return;
      }
      if (this.cursor && this.cursor.id === id && this.cursor.count < info.stack) this.cursor.count = info.stack;
      else this.cursor = stack;
      this.renderInventory();
    }

    buildGuide() {
      const html = GUIDE.map(([t, d]) => '<h3>' + t + '</h3><p>' + d + '</p>').join('');
      $('tab-guide').innerHTML = html;
      $('help').innerHTML =
        '<h3>Commandes (modifiables dans Options &gt; Contrôles)</h3><ul>' +
        '<li><b>ZQSD / WASD</b> : se déplacer · <b>Espace</b> : sauter / nager · <b>Maj</b> : courir · <b>C</b> : s’accroupir</li>' +
        '<li><b>F</b> : ruée · <b>E</b> : inventaire et fabrication · <b>Échap</b> : pause · <b>F1</b> : masquer l’interface · <b>F3</b> : infos</li>' +
        '<li><b>Clic gauche</b> (maintenu) : miner / frapper · <b>Clic droit</b> : poser, manger, utiliser · <b>Clic molette</b> : choisir le bloc visé</li>' +
        '<li><b>1-9</b> ou <b>molette</b> : choisir l’objet en main · <b>Q</b> : jeter</li></ul>' +
        '<h3>Le concept</h3><p>Comme dans Minecraft : un monde en cubes à miner, des ressources à récolter, des outils à fabriquer, la faim à gérer et des nuits dangereuses. Mais certaines règles changent :</p>' +
        html;
    }

    openChest(slots, title) {
      this.chest = slots;
      $('chest-title').textContent = title || 'Coffre';
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
      this.renderVitals();
      if (this.tab === 'journal') this.renderJournal();
      if (this.tab === 'creative') this.renderCreative();
    }
    closeInventory() {
      if (!this.invOpen) return;
      this.invOpen = false;
      if (this.cursor) {
        const left = this.game.inventory.add(this.cursor.id, this.cursor.count, this.cursor.xp !== undefined ? { xp: this.cursor.xp } : null);
        if (left > 0 && this.game.mode !== 'creative') this.game.dropNearPlayer(this.cursor.id, left, this.cursor);
        this.cursor = null;
      }
      this.chest = null;
      $('cursor-stack').classList.add('hidden');
      this.hideTip();
      $('inventory').classList.add('hidden');
      this.game.captureMouse();
    }

    renderVitals() {
      const g = this.game, p = g.player;
      if (g.mode === 'creative') {
        $('inv-vitals').innerHTML = 'Mode créatif · ' + DIFF_NAMES[g.difficulty];
        return;
      }
      $('inv-vitals').innerHTML =
        '❤ <b>' + Math.ceil(p.health) + '</b>/' + p.maxHealth + ' · 🍗 Faim <b>' + p.food + '</b>/20 · Saturation <b>' + p.sat.toFixed(1) + '</b>' +
        (p.food <= 6 ? ' · <span class="warn">trop faim pour courir</span>' : p.food >= 18 && p.health < p.maxHealth ? ' · <span class="good">régénération</span>' : '');
    }

    refreshStations() {
      const st = this.game.nearbyStations();
      const changed = st.table !== this.stations.table || st.forge !== this.stations.forge || st.smithing !== this.stations.smithing;
      this.stations = st;
      const one = (k, n) => '<span class="station ' + (st[k] ? 'on' : '') + '">' + (st[k] ? '✔' : '✖') + ' ' + n + '</span>';
      $('stations').innerHTML = one('table', 'Établi') + one('forge', 'Forge / fourneau') + one('smithing', 'Table de forgeron');
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
      if (this.tab === 'craft') this.renderRecipes();
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
        tt.style.left = Math.min(e.clientX + 16, window.innerWidth - 300) + 'px';
        tt.style.top = e.clientY + 12 + 'px';
      }
    }
    hideTip() {
      $('tooltip').classList.add('hidden');
    }
    tipHTML(id, s) {
      const info = CM.itemInfo(id);
      let h = '<b>' + esc(info.name) + '</b>';
      if (info.type === 'tool') {
        const lvl = CM.masteryLevel((s && s.xp) || 0);
        const spd = info.toolType === 'sword' ? 'Dégâts ' + (info.damage + Math.floor((lvl - 1) / 2)) : info.toolType === 'hoe' ? 'Laboure la terre (clic droit)' : 'Vitesse ×' + (info.speed * (1 + 0.12 * (lvl - 1))).toFixed(1) + ' · dégâts ' + info.damage;
        h += '<div class="tt-gold">Maîtrise ' + '★'.repeat(lvl) + '☆'.repeat(5 - lvl) + (s && s.xp !== undefined ? ' · ' + s.xp + ' XP' : '') + '</div>';
        h += '<div class="tt-sub">' + spd + ' · ne s’use jamais</div>';
        if (info.toolType === 'pickaxe') h += '<div class="tt-sub">Récolte jusqu’au niveau ' + CM.TIER_NAMES[Math.min(info.tier, 5)] + '.</div>';
        if (info.toolType === 'pickaxe' && info.mat === 'CRYSTAL') h += '<div class="tt-sub">Mine les filons de minerai d’un coup.</div>';
        if (info.toolType === 'axe' && info.tier >= 3) h += '<div class="tt-sub">Abat l’arbre entier d’un coup.</div>';
        if (info.toolType === 'axe') h += '<div class="tt-sub">Clic droit sur une bûche : l’écorcer.</div>';
      } else if (info.type === 'food') {
        h += '<div class="tt-sub">Clic droit pour manger : +' + info.food / 2 + ' 🍗 (saturation ' + info.sat + ')' + (info.regen ? ', Régénération' : '') + '</div>';
      } else if (info.type === 'charm') {
        h += '<div class="tt-gold">' + info.desc + '</div>';
      } else if (info.type === 'grapple') {
        h += '<div class="tt-sub">Clic droit : s’accrocher à un bloc (34 blocs). Saut : se décrocher.</div>';
      } else if (info.type === 'seeds') {
        h += '<div class="tt-sub">Clic droit sur de la terre labourée pour planter.</div>';
      } else if (info.type === 'bonemeal') {
        h += '<div class="tt-sub">Clic droit : fait pousser cultures, pousses et fleurs.</div>';
      } else if (info.type === 'igniter') {
        h += '<div class="tt-sub">Clic droit sur une TNT pour l’allumer.</div>';
      } else if (info.dye) {
        h += '<div class="tt-sub">Teint la laine, le verre, la terre cuite et le béton.</div>';
      } else if (info.isBlock) {
        const b = info.block;
        const bits = [];
        if (b.light) bits.push('Lumineux (' + b.light + ')');
        if (b.station) bits.push('Station de fabrication');
        if (b.container) bits.push('Rangement (27 cases)');
        if (b.bounce) bits.push('Rebondissant');
        if (CM.TAGS.saplings.includes(b.id)) bits.push('Pose-la au soleil : un arbre poussera');
        if (b.slip) bits.push('Glissant');
        if (b.slow) bits.push('Ralentit la marche');
        if (b.hurts) bits.push('Blesse au contact !');
        if (b.render === 'slab') bits.push('Dalle : pose-en deux l’une sur l’autre pour un bloc plein');
        if (b.becomes) bits.push('Devient du béton au contact de l’eau');
        if (b.tnt) bits.push('S’allume avec un briquet ou une torche (clic droit)');
        if (b.note) bits.push('Clic droit : joue une note');
        if (b.tier > 1) bits.push('Pioche en ' + CM.TIER_NAMES[b.tier] + ' requise');
        if (bits.length) h += '<div class="tt-sub">' + bits.join(' · ') + '</div>';
      }
      return h;
    }

    renderRecipes() {
      const g = this.game, inv = g.inventory, st = this.stations;
      const box = $('recipes');
      const creative = g.mode === 'creative';
      const list = CM.recipes
        .map((r, i) => ({ r, i, can: creative || inv.canCraft(r, st) }))
        .filter((o) => (this.filter === 'tout' || o.r.cat === this.filter) && (!this.onlyCan || o.can))
        .filter((o) => !this.search || norm(CM.itemName(o.r.out)).includes(this.search) || o.r.ing.some(([id]) => norm(CM.ingName(id)).includes(this.search)));
      list.sort((a, b) => (b.can ? 1 : 0) - (a.can ? 1 : 0));
      $('recipe-count').textContent = list.length + ' recette' + (list.length > 1 ? 's' : '') + (list.length ? ' — fais défiler la liste pour tout voir' : '');
      let h = '';
      for (const { r, i, can } of list) {
        const ing = r.ing
          .map(([id, n]) => {
            const have = inv.count(id);
            const shown = typeof id === 'string' ? CM.tagMembers(id).find((m) => inv.has(m)) || CM.tagMembers(id)[0] : id;
            return '<span class="ing ' + (have >= n || creative ? '' : 'miss') + '"><i style="background-image:url(' + CM.Textures.icons[shown] + ')"></i>' + n + ' ' + esc(CM.ingName(id)) + '</span>';
          })
          .join('');
        const stn = r.station ? '<span class="r-station ' + (st[r.station] ? '' : 'miss') + '">' + CM.STATION_NAMES[r.station] + '</span>' : '';
        h +=
          '<div class="recipe ' + (can ? 'can' : '') + '" data-r="' + i + '">' +
          '<div class="slot">' + this.slotHTML({ id: r.out, count: r.n }) + '</div>' +
          '<div class="r-body"><div class="r-name">' + esc(CM.itemName(r.out)) + (r.n > 1 ? ' ×' + r.n : '') + '</div><div class="r-ing">' + ing + '</div></div>' +
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
      if (g.mode === 'creative') {
        const info = CM.itemInfo(r.out);
        inv.add(r.out, many ? info.stack : r.n, info.type === 'tool' ? { xp: 0 } : null);
        CM.Audio.play('craft');
        return;
      }
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
        '<div>Graine : <b>' + g.world.seed + '</b></div>' +
        '<div>Types de blocs posés : <b>' + Object.keys(s.placed).length + '</b></div>' +
        '</div>';
      $('tab-journal').innerHTML = h;
    }

    // ---------------------------------------------------- nouveau monde --
    buildNewWorld() {
      const upd = () => {
        const s = this.newWorldSettings();
        const d = [];
        d.push(s.mode === 'creative' ? 'Créatif : blocs infinis, vol, aucun danger.' : 'Survie : récolte, faim, nuits dangereuses.');
        if (s.difficulty === 'peaceful') d.push('Paisible : aucune Ombre et la faim remonte seule.');
        if (s.difficulty === 'hard') d.push('Difficile : Ombres nombreuses et dégâts renforcés, la faim peut tuer.');
        if (s.type === 'amplified') d.push('Amplifié : reliefs gigantesques.');
        if (s.type === 'flat') d.push('Plat : un monde d’herbe parfaitement plat, idéal pour construire.');
        if (s.type === 'islands') d.push('Archipel : des îles dispersées sur un grand océan.');
        $('nw-desc').textContent = d.join(' ');
      };
      for (const id of ['nw-mode', 'nw-diff', 'nw-type', 'nw-biome']) $(id).addEventListener('change', upd);
      $('seed').addEventListener('keydown', (e) => e.stopPropagation());
      upd();
    }
    openNewWorld() {
      $('seed').value = '';
      this.show('newworld');
    }
    newWorldSettings() {
      return {
        mode: $('nw-mode').value,
        difficulty: $('nw-diff').value,
        type: $('nw-type').value,
        biomeSize: $('nw-biome').value,
        bonusChest: $('nw-bonus').checked,
        dayCycle: $('nw-daycycle').checked,
      };
    }
    refreshPause() {
      const g = this.game;
      if (!g.world) return;
      $('pause-info').innerHTML =
        'Graine : <b>' + g.world.seed + '</b> · ' + MODE_NAMES[g.mode] + ' · ' + DIFF_NAMES[g.difficulty] + ' · monde ' + TYPE_NAMES[g.settings.type || 'normal'] +
        '<br>Jour ' + (g.dayCount + 1) + ' · ' + g.world.editCount() + ' blocs modifiés';
    }

    // ------------------------------------------------------- options -----
    openOptions(inGame) {
      this.optInGame = inGame;
      this.renderOptions();
      this.show('options');
    }
    renderOptions() {
      const g = this.game, o = g.options;
      $('opt-tabs').innerHTML = OPTION_TABS.map(([k, n]) => '<button data-o="' + k + '" class="' + (k === this.optTab ? 'active' : '') + '">' + n + '</button>').join('');
      $('opt-tabs').querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => {
          this.optTab = b.dataset.o;
          this.bindWaiting = null;
          this.renderOptions();
        }),
      );
      const body = $('opt-body');
      body.innerHTML = '';
      const items = OPTION_TABS.find((t) => t[0] === this.optTab)[2];
      for (const it of items) {
        if (it.t === 'binds') {
          const h = document.createElement('div');
          h.className = 'opt binds';
          h.innerHTML = '<div class="opt-sub">Touches</div>' + Object.keys(BIND_LABELS).map((a) =>
            '<div class="bind"><span>' + BIND_LABELS[a] + '</span><button data-a="' + a + '" class="' + (this.bindWaiting === a ? 'wait' : '') + '">' +
            (this.bindWaiting === a ? 'Appuie sur une touche…' : esc(g.keyName(g.binds[a]))) + '</button></div>').join('');
          h.querySelectorAll('button').forEach((b) =>
            b.addEventListener('click', () => {
              this.bindWaiting = b.dataset.a;
              this.renderOptions();
            }),
          );
          body.appendChild(h);
          continue;
        }
        if (it.t === 'world') {
          if (!this.optInGame || !g.world) {
            const n = document.createElement('div');
            n.className = 'small-note';
            n.textContent = 'Le mode de jeu et la difficulté se choisissent en créant un monde (et se modifient ici pendant une partie).';
            body.appendChild(n);
            continue;
          }
          const mkSel = (label, value, opts, fn) => {
            const d = document.createElement('div');
            d.className = 'opt';
            d.innerHTML = '<label>' + label + '</label><select>' + opts.map(([v, n]) => '<option value="' + v + '"' + (v === value ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
            d.querySelector('select').addEventListener('change', (e) => fn(e.target.value));
            body.appendChild(d);
          };
          mkSel('Mode de jeu (ce monde)', g.mode, Object.entries(MODE_NAMES), (v) => {
            g.setMode(v);
            this.worldStarted();
          });
          mkSel('Difficulté (ce monde)', g.difficulty, Object.entries(DIFF_NAMES), (v) => g.setDifficulty(v));
          continue;
        }
        const d = document.createElement('div');
        d.className = 'opt' + (it.t === 'check' ? ' check' : '');
        if (it.t === 'range') {
          d.innerHTML = '<label>' + it.label + ' <span></span></label><input type="range" min="' + it.min + '" max="' + it.max + '" step="' + it.step + '" />' + (it.note ? '<div class="opt-note">' + it.note + '</div>' : '');
          const inp = d.querySelector('input'), span = d.querySelector('span');
          inp.value = o[it.k];
          span.textContent = it.fmt(o[it.k]);
          inp.addEventListener('input', () => {
            o[it.k] = +inp.value;
            span.textContent = it.fmt(o[it.k]);
            g.applyOptions();
          });
        } else if (it.t === 'check') {
          d.innerHTML = '<label><input type="checkbox" /> ' + it.label + '</label>';
          const inp = d.querySelector('input');
          inp.checked = !!o[it.k];
          inp.addEventListener('change', () => {
            o[it.k] = inp.checked;
            g.applyOptions();
          });
        } else if (it.t === 'select') {
          d.innerHTML = '<label>' + it.label + '</label><select>' + it.opts.map(([v, n]) => '<option value="' + v + '"' + (String(v) === String(o[it.k]) ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
          d.querySelector('select').addEventListener('change', (e) => {
            o[it.k] = typeof CM.DEFAULT_OPTIONS[it.k] === 'number' ? +e.target.value : e.target.value;
            g.applyOptions();
          });
        }
        body.appendChild(d);
      }
    }
    // Capture d'une touche pour la réaffectation (renvoie true si la touche est consommée).
    captureKey(e) {
      if (!this.bindWaiting) return false;
      e.preventDefault();
      e.stopPropagation();
      const g = this.game, a = this.bindWaiting;
      this.bindWaiting = null;
      if (e.code !== 'Escape') {
        // si la touche servait déjà à une autre action, on échange
        const other = Object.keys(g.binds).find((k) => g.binds[k] === e.code && k !== a);
        if (other) g.binds[other] = g.binds[a];
        g.binds[a] = e.code;
        g.applyOptions();
      }
      this.renderOptions();
      return true;
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
      $('death-note').textContent = this.game.options.keepInventory ? 'Tu gardes ton inventaire (option activée).' : 'Vos objets sont tombés sur place. Allez vite les récupérer !';
      this.game.releaseMouse();
      this.show('death');
    }
    hideDeath() {
      this.hide('death');
    }
  }

  CM.UI = UI;
})();
