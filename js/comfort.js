'use strict';
// Confort : mini-carte et carte, boussoles, lieu de la mort, objets de mort qui durent plus,
// tri de l'inventaire et des coffres, recherche dans les coffres proches, succès, apparence.
(function () {
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, ' ')
      .trim();

  const C = (CM.Comfort = {});

  // ============================================================ CARTE ==
  // Couleur du dessus de chaque colonne (mise en cache, effacée quand un bloc change).
  const cache = { overworld: new Map(), nether: new Map(), end: new Map() };
  const bcol = [];
  function blockColor(id) {
    if (bcol[id]) return bcol[id];
    const b = CM.blocks[id];
    let c = [128, 128, 128];
    if (CM.isWater(id)) c = [52, 92, 196];
    else if (CM.isLava(id)) c = [226, 96, 24];
    else {
      let t = b.tex;
      t = typeof t === 'string' ? t : t && (t.top || t.side || t.front);
      const cv = t && CM.Textures.canvases[t];
      if (cv) {
        const px = cv.getContext('2d').getImageData(0, 0, 16, 16).data;
        let r = 0, gg = 0, bb = 0, n = 0;
        for (let i = 0; i < px.length; i += 4)
          if (px[i + 3] > 20) {
            r += px[i];
            gg += px[i + 1];
            bb += px[i + 2];
            n++;
          }
        if (n) c = [r / n, gg / n, bb / n];
      }
    }
    return (bcol[id] = c);
  }
  // [r, g, b, hauteur] du haut de la colonne (Nether : sous le plafond, près du joueur).
  function column(w, dim, x, z, py) {
    const m = cache[dim], k = x + ',' + z;
    let v = m.get(k);
    if (v) return v;
    if (!w.loaded(x, z)) return null;
    const { H, MINY } = CM.WORLD;
    let y = dim === 'nether' ? Math.min(H - 1, Math.floor(py) + 3) : H - 1;
    if (dim === 'nether') while (y > MINY && w.get(x, y, z)) y--;
    for (; y > MINY; y--) {
      const id = w.get(x, y, z);
      if (!id) continue;
      const b = CM.blocks[id];
      if (b.render === 'model' && !b.solid && !b.plant) continue;
      let c = blockColor(id);
      if (CM.isWater(id)) {
        let d = 0;
        while (d < 8 && CM.isWater(w.get(x, y - d - 1, z))) d++;
        c = c.map((v2) => v2 * (1.1 - d * 0.07));
      }
      v = [c[0], c[1], c[2], y];
      break;
    }
    if (!v) v = [10, 10, 14, MINY];
    if (m.size > 60000) m.clear();
    m.set(k, v);
    return v;
  }
  // Couleur du haut d'une colonne (carte des terrains du menu G) ; compute : la calculer si besoin.
  C.mapColor = (g, x, z, compute) => {
    const dim = g.playerDim, v = cache[dim].get(x + ',' + z);
    return v || (compute ? column(g.world, dim, x, z, g.player.y) : null);
  };
  C.onEdit = (dim, x, z) => {
    const m = cache[dim];
    if (m && m.size) m.delete(x + ',' + z);
  };
  // Dessine la carte : n blocs de côté, s pixels par bloc, centrée sur le joueur (le nord en haut).
  function drawMap(g, cv, n, s) {
    const ctx = cv.getContext('2d'), p = g.player, w = g.world, dim = g.playerDim;
    const W = cv.width, img = ctx.createImageData(W, W), px = img.data;
    const x0 = Math.floor(p.x) - (n >> 1), z0 = Math.floor(p.z) - (n >> 1);
    let budget = 2500; // colonnes nouvelles à calculer à chaque fois (le reste suit)
    for (let j = 0; j < n; j++) {
      let prevH = null;
      for (let i = 0; i < n; i++) {
        const x = x0 + i, z = z0 + j;
        let v = cache[dim].get(x + ',' + z);
        if (!v && budget > 0) {
          v = column(w, dim, x, z, p.y);
          budget--;
        }
        let r = 18, gg = 20, b = 26;
        if (v) {
          // relief : plus clair si plus haut que la case au nord, plus sombre sinon
          const north = cache[dim].get(x + ',' + (z - 1));
          const dh = north ? v[3] - north[3] : 0;
          const f = dh > 0 ? 1.12 : dh < 0 ? 0.84 : 1;
          r = v[0] * f;
          gg = v[1] * f;
          b = v[2] * f;
        }
        prevH = v;
        for (let dy = 0; dy < s; dy++)
          for (let dx = 0; dx < s; dx++) {
            const o = ((j * s + dy) * W + i * s + dx) * 4;
            px[o] = r;
            px[o + 1] = gg;
            px[o + 2] = b;
            px[o + 3] = 255;
          }
      }
    }
    ctx.putImageData(img, 0, 0);
    // repères
    const toPx = (x, z) => [(x - x0) * s, (z - z0) * s];
    const inside = (a) => a[0] >= 0 && a[1] >= 0 && a[0] < W && a[1] < W;
    const dot = (x, z, col, rad, label) => {
      const a = toPx(x, z);
      if (!inside(a)) return;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(a[0], a[1], rad, 0, TAU);
      ctx.fill();
      if (label) {
        ctx.font = 'bold ' + Math.max(9, s * 5) + 'px sans-serif';
        ctx.fillText(label, a[0] + rad + 1, a[1] + 3);
      }
    };
    for (const m of g.entities.mobs) if (!m.dead && CM.MOBS[m.type].hostile) dot(m.x, m.z, '#ff4040', Math.max(1.5, s * 0.8));
    const bed = p.bed;
    if (bed && dim === 'overworld') dot(bed[0] + 0.5, bed[2] + 0.5, '#ff7b9c', Math.max(2.5, s * 1.2), '🛏');
    const dth = g.lastDeath;
    if (dth && dth.dim === dim) {
      const a = toPx(dth.x, dth.z);
      if (inside(a)) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a[0] - 4, a[1] - 4);
        ctx.lineTo(a[0] + 4, a[1] + 4);
        ctx.moveTo(a[0] + 4, a[1] - 4);
        ctx.lineTo(a[0] - 4, a[1] + 4);
        ctx.stroke();
      }
    }
    for (const rp of g.net.remotes.values()) if (rp.seen && rp.dim === dim) dot(rp.rx, rp.rz, '#5fd0ff', Math.max(2.5, s * 1.3), s >= 2 ? rp.name : '');
    // le joueur : une flèche dans la direction du regard
    const a = toPx(p.x, p.z), fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), sz = Math.max(5, s * 2.5);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a[0] + fx * sz, a[1] + fz * sz);
    ctx.lineTo(a[0] - fx * sz * 0.6 - fz * sz * 0.55, a[1] - fz * sz * 0.6 + fx * sz * 0.55);
    ctx.lineTo(a[0] - fx * sz * 0.3, a[1] - fz * sz * 0.3);
    ctx.lineTo(a[0] - fx * sz * 0.6 + fz * sz * 0.55, a[1] - fz * sz * 0.6 - fx * sz * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // points cardinaux
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('N', W / 2 - 3, 10);
  }
  C.mapT = 0;
  const mode0 = (hudOn, showBig, size) => (hudOn ? 1 : 0) + (showBig ? 2 : 0) + size * 4;
  // Coin en haut à droite : horloge (coordonnées, biome…), puis mini-carte, puis effets, sans se chevaucher
  // (le bloc de l'horloge grandit avec les options affichées).
  function stackHud(g) {
    const clock = $('clock'), mini = $('minimap'), eff = $('effects');
    const par = clock && clock.offsetParent;
    if (!par || !eff) return;
    const top = par.getBoundingClientRect().top, cr = clock.getBoundingClientRect();
    let y = Math.round((cr.height ? cr.bottom - top : 12) + 8);
    // (multijoueur : code de la partie et nombre de joueurs)
    const ni = $('netinfo');
    if (ni && !ni.classList.contains('hidden')) {
      const t = y + 'px';
      if (ni.style.top !== t) ni.style.top = t;
      y += Math.round(ni.getBoundingClientRect().height) + 6;
    }
    if (mini && !mini.classList.contains('hidden')) {
      const t = y + 'px';
      if (mini.style.top !== t) mini.style.top = t;
      y += Math.round(mini.getBoundingClientRect().height) + 8;
    }
    if (g.touch && g.touch.enabled) y = Math.max(y, 150); // (boutons tactiles)
    const t = y + 'px';
    if (eff.style.top !== t) eff.style.top = t;
  }
  C.updateMaps = function (g, dt) {
    const mini = $('minimap'), big = $('bigmap');
    if (!mini || !big) return;
    const held = g.inventory.held(), info = held && CM.itemInfo(held.id);
    const size = g.options.minimap | 0, showBig = !!(info && info.type === 'map') && g.state === 'playing' && !g.ui.invOpen;
    const hudOn = g.state === 'playing' && g.player.alive;
    mini.classList.toggle('hidden', !hudOn || !size || showBig);
    mini.classList.toggle('large', size === 2);
    big.classList.toggle('hidden', !hudOn || !showBig);
    C.stackT = (C.stackT || 0) - dt;
    if (C.stackT <= 0 || mode0(hudOn, showBig, size) !== C.mapMode) {
      C.stackT = 0.2;
      stackHud(g);
    }
    const mode = mode0(hudOn, showBig, size);
    C.mapT -= dt;
    if (C.mapT > 0 && mode === C.mapMode) return;
    C.mapMode = mode;
    C.mapT = 0.25;
    if (hudOn && size && !showBig) drawMap(g, mini, 64, 2);
    if (hudOn && showBig) drawMap(g, big, 128, 2);
  };
  C.cycleMap = function (g) {
    g.options.minimap = ((g.options.minimap | 0) + 1) % 3;
    g.applyOptions();
    g.ui.toast(['🗺 Mini-carte masquée', '🗺 Petite mini-carte', '🗺 Grande mini-carte'][g.options.minimap], 'info', 'minimap');
  };

  // ========================================================= BOUSSOLES ==
  C.compassTarget = function (g, kind) {
    const p = g.player;
    if (kind === 'death') return g.lastDeath ? Object.assign({ label: '✝ Lieu de ta mort' }, g.lastDeath) : null;
    if (p.bed) return { x: p.bed[0] + 0.5, y: p.bed[1], z: p.bed[2] + 0.5, dim: 'overworld', label: '🛏 Ton lit' };
    const sp = g.worlds && g.worlds.overworld ? g.worlds.overworld.spawn : g.world.spawn;
    return { x: sp.x, y: sp.y, z: sp.z, dim: 'overworld', label: '⌂ Point de départ' };
  };
  C.updateCompass = function (g) {
    const el = $('compass');
    if (!el) return;
    const inv = g.inventory, p = g.player;
    const pick = [inv.held(), inv.offhand].find((s) => s && CM.itemInfo(s.id).type === 'compass');
    if (!pick || g.state !== 'playing' || !p.alive) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const t = C.compassTarget(g, CM.itemInfo(pick.id).target);
    const needle = el.querySelector('.needle'), label = el.querySelector('.clabel');
    let ang, txt;
    if (!t) {
      ang = (g.clock * 7) % TAU;
      txt = 'Tu n’es encore jamais mort';
    } else if (t.dim !== g.playerDim) {
      ang = Math.sin(g.clock * 3) * 2 + g.clock * 5; // l'aiguille s'affole dans une autre dimension
      txt = t.label + ' : dans ' + CM.dimLabel(t.dim);
    } else {
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      // angle du but par rapport au regard (0 : droit devant)
      const want = Math.atan2(-dx, -dz);
      ang = -(want - p.yaw);
      txt = t.label + ' : ' + Math.round(d) + ' blocs' + (Math.abs(t.y - p.y) > 4 ? ' (' + (t.y > p.y ? '↑ ' : '↓ ') + Math.round(Math.abs(t.y - p.y)) + ')' : '');
    }
    needle.style.transform = 'rotate(' + ang.toFixed(3) + 'rad)';
    if (label.textContent !== txt) label.textContent = txt;
  };

  // ============================================================= MORT ==
  C.onDeath = function (g, p) {
    g.lastDeath = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, z: Math.round(p.z * 10) / 10, dim: g.playerDim };
    const el = $('death-where');
    if (el) el.textContent = '✝ Tu es mort en X ' + Math.floor(p.x) + ', Y ' + Math.floor(p.y) + ', Z ' + Math.floor(p.z) + CM.dimTag(g.playerDim) + ' — tes objets y restent 20 minutes.';
  };
  C.onRespawn = function (g) {
    const d = g.lastDeath;
    if (!d) return;
    const s = '✝ Lieu de ta mort : X ' + Math.floor(d.x) + ', Y ' + Math.floor(d.y) + ', Z ' + Math.floor(d.z) + CM.dimTag(d.dim) + ' — une boussole de récupération t’y mène.';
    if (g.net && g.net.sys) g.net.sys(s);
    else g.ui.toast(s, 'info', 'death');
  };

  // ============================================================== TRI ==
  const ORDER = (id) => {
    const i = CM.itemInfo(id);
    if (!i) return 9;
    if (i.type === 'tool' || i.type === 'bow' || i.type === 'crossbow' || i.type === 'trident' || i.type === 'shield' || i.type === 'rod') return 0;
    if (i.type === 'armor') return 1;
    if (i.type === 'food') return 2;
    if (i.isBlock) return 4;
    return 3;
  };
  // Regroupe et trie les piles de slots[a..b[.
  C.sortSlots = function (slots, a, b) {
    const list = [];
    for (let i = a; i < b; i++) if (slots[i]) list.push(slots[i]);
    const merged = [];
    for (const s of list) {
      const info = CM.itemInfo(s.id), plain = !s.ench && s.xp === undefined && !s.charged;
      const same = plain && merged.find((m) => m.id === s.id && !m.ench && m.xp === undefined && m.count < info.stack);
      if (same) {
        const room = info.stack - same.count, k = Math.min(room, s.count);
        same.count += k;
        if (s.count > k) merged.push(Object.assign({}, s, { count: s.count - k }));
      } else merged.push(Object.assign({}, s));
    }
    merged.sort((x, y) => ORDER(x.id) - ORDER(y.id) || x.id - y.id || y.count - x.count);
    for (let i = a; i < b; i++) slots[i] = merged[i - a] || null;
  };
  C.sortInventory = function (g) {
    C.sortSlots(g.inventory.slots, 9, 36);
    g.inventory.changed();
    CM.Audio.play('click');
  };
  C.sortChest = function (g) {
    const ch = g.ui.chest;
    if (!ch) return;
    C.sortSlots(ch, 0, ch.length);
    g.ui.renderInventory();
    if (g.net.active) g.net.chestChanged();
    CM.Audio.play('click');
  };

  // ============================================ RECHERCHE DANS LES COFFRES ==
  // Hôte ou solo : coffres (et contenus connus) à moins de 48 blocs de (x, z) qui contiennent l'objet.
  C.searchChests = function (g, q, x, y, z, dim) {
    const n = norm(q), out = [];
    if (n.length < 2) return out;
    for (const [k, slots] of g.chests) {
      if (k[0] === 'C' || CM.dimOfKey(k) !== dim) continue;
      const [cx, cy, cz] = CM.keyXYZ(k);
      if (Math.hypot(cx - x, cz - z) > 48 || Math.abs(cy - y) > 32) continue;
      let cnt = 0;
      for (const s of slots || []) if (s && norm(CM.itemName(s.id)).includes(n)) cnt += s.count;
      if (cnt) out.push([cx, cy, cz, cnt]);
    }
    return out.sort((a, b) => Math.hypot(a[0] - x, a[2] - z) - Math.hypot(b[0] - x, b[2] - z)).slice(0, 12);
  };
  C.highlights = [];
  C.showFound = function (g, q, res) {
    const p = g.player;
    if (!res.length) {
      g.ui.toast('🔍 Aucun coffre proche ne contient « ' + q + ' »', 'info', 'find');
      return;
    }
    const dirName = (dx, dz) => {
      const a = Math.atan2(dx, -dz), k = Math.round(a / (Math.PI / 4));
      return ['au nord', 'au nord-est', 'à l’est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l’ouest', 'au nord-ouest'][((k % 8) + 8) % 8];
    };
    const parts = res.slice(0, 4).map(([x, y, z, c]) => c + ' à ' + Math.round(Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z)) + ' blocs ' + dirName(x + 0.5 - p.x, z + 0.5 - p.z));
    g.ui.toast('🔍 « ' + q + ' » : ' + parts.join(' · ') + (res.length > 4 ? ' …' : ''), 'good', 'find');
    C.highlights = res.map(([x, y, z]) => ({ x, y, z, t: 20 }));
  };
  C.find = function (g, q) {
    q = String(q || '').trim().slice(0, 40);
    if (!q) return;
    const p = g.player;
    if (g.net.isClient) g.net.send({ t: 'cfind', q });
    else C.showFound(g, q, C.searchChests(g, q, p.x, p.y, p.z, g.playerDim));
  };
  // coffres trouvés : des étincelles montent pendant 20 s
  C.updateHighlights = function (g, dt) {
    if (!C.highlights.length) return;
    for (const h of C.highlights) {
      h.t -= dt;
      if (Math.random() < dt * 8) g.entities.burst(CM.Textures.layer.white, h.x + 0.5, h.y + 1.1, h.z + 0.5, 1, { speed: 0.4, grav: -2.5, life: 1.2, size: 0.09, emissive: true, full: true });
    }
    C.highlights = C.highlights.filter((h) => h.t > 0);
  };

  // ============================================================ SUCCÈS ==
  const I = () => CM.I, B = () => CM.B;
  const has = (g, id) => id !== undefined && g.inventory.has(id);
  const mined = (g, test) => Object.keys(g.stats.mined).some((k) => test(+k));
  const crafted = (g, id) => id !== undefined && (g.stats.crafted[id] || 0) > 0;
  const ACH = [
    ['bois', '🪵', 'Ça commence par du bois', 'Couper un tronc', (g) => mined(g, (id) => /_LOG$|^LOG$/.test(CM.blocks[id].key))],
    ['etabli', '🛠', 'Artisan', 'Fabriquer un établi', (g) => crafted(g, B().CRAFTING_TABLE) || crafted(g, B().TABLE) || crafted(g, B().WORKBENCH)],
    ['pierre', '⛏', 'L’âge de pierre', 'Fabriquer une pioche en pierre', (g) => crafted(g, I().PICKAXE_STONE)],
    ['fer', '⚙', 'Âge du fer', 'Obtenir un lingot de fer', (g) => has(g, I().IRON_INGOT) || crafted(g, I().IRON_INGOT)],
    ['diamant', '💎', 'Diamants !', 'Trouver un diamant', (g) => has(g, I().DIAMOND)],
    ['netherite', '🔥', 'Plus dur que le diamant', 'Obtenir un lingot de netherite', (g) => has(g, I().NETHERITE_INGOT)],
    ['armure', '🛡', 'Couvert de diamants', 'Porter une armure complète en diamant', (g) => g.inventory.armor.every((s) => s && CM.itemInfo(s.id).mat === 'DIAMOND')],
    ['nether', '🌋', 'Plus chaud que prévu', 'Entrer dans le Nether', (g) => g.playerDim === 'nether'],
    ['enchant', '✨', 'Enchanteur', 'Posséder un objet enchanté', (g) => g.inventory.slots.some((s) => s && s.ench) || g.inventory.armor.some((s) => s && s.ench)],
    ['potion', '🧪', 'Alchimiste', 'Distiller une potion', (g) => g.inventory.slots.some((s) => s && CM.itemInfo(s.id).potion)],
    ['balise', '🔆', 'Phare dans la nuit', 'Poser une balise', (g) => (g.stats.placed[B().BEACON] || 0) > 0],
    ['peche', '🎣', 'Ça mord !', 'Pêcher un poisson', (g) => (g.stats.fished || 0) >= 1],
    ['pecheur', '🐟', 'Vieux loup de mer', 'Pêcher 25 fois', (g) => (g.stats.fished || 0) >= 25],
    ['bateau', '⛵', 'Moussaillon', 'Monter dans un bateau', (g) => { const c = (g.entities.carts || []).find((o) => o.uid === g.player.riding); return !!c && c.type === 'boat'; }],
    ['cheval', '🐴', 'Cavalier', 'Monter un cheval dressé et sellé', (g) => g.player.mount !== null && g.player.mount !== undefined && g.player.mountTame],
    ['loup', '🐺', 'Le meilleur ami', 'Apprivoiser un loup', (g) => g.entities.mobs.some((m) => m.type === 'wolf' && m.tame && CM.isPetOwner(g, g.player, m))],
    ['planeur', '🪽', 'Comme un oiseau', 'Planer avec des élytres', (g) => !!g.player.gliding],
    ['trident', '🔱', 'Seigneur des mers', 'Obtenir un trident', (g) => has(g, I().TRIDENT)],
    ['musique', '🎵', 'Mélomane', 'Écouter un disque au juke-box', () => CM.Deco && CM.Deco.playing.size > 0],
    ['gateau', '🍰', 'Joyeux anniversaire', 'Préparer un gâteau', (g) => crafted(g, B().CAKE)],
    ['ombres', '👁', 'Chasseur d’Ombres', 'Vaincre 10 Ombres', (g) => (g.stats.kills.ombre || 0) >= 10],
    ['ombres2', '⚔', 'Fléau des Ombres', 'Vaincre 100 Ombres', (g) => (g.stats.kills.ombre || 0) >= 100],
    ['jours', '📅', 'Survivant', 'Survivre 10 jours', (g) => g.dayCount >= 10],
    ['jours2', '🏕', 'Vétéran', 'Survivre 50 jours', (g) => g.dayCount >= 50],
    ['riche', '💰', 'Marchand', 'Avoir 20 émeraudes', (g) => g.inventory.count(I().EMERALD) >= 20],
    ['golem', '🗿', 'Gardien de fer', 'Construire un golem de fer', (g) => (g.golemHomes || []).length > 0],
    ['profond', '🕳', 'Au plus profond', 'Descendre sous Y = −50', (g) => g.player.y < -50],
    ['sommet', '🏔', 'Tout là-haut', 'Monter au-dessus de Y = 90', (g) => g.player.y > 90 && g.playerDim === 'overworld'],
    ['voyage', '🧭', 'Explorateur', 'S’éloigner de 1 000 blocs du départ', (g) => { const s = g.world.spawn; return g.playerDim === 'overworld' && Math.hypot(g.player.x - s.x, g.player.z - s.z) > 1000; }],
    ['mort', '💀', 'Ça arrive à tout le monde', 'Mourir une fois', (g) => (g.stats.deaths || 0) > 0],
    ['aube', '🌅', 'L’aube se lève', 'Terminer l’aventure (Cœur de l’Aube)', (g) => !!g.victory],
  ].map(([k, icon, name, desc, test]) => ({ k, icon, name, desc, test }));
  C.ACH = ACH;
  C.achT = 0;
  C.checkAch = function (g, dt) {
    if (g.state !== 'playing' || !g.player || !g.player.alive) return;
    C.achT -= dt;
    if (C.achT > 0) return;
    C.achT = 1.2;
    g.ach = g.ach || {};
    for (const a of ACH) {
      if (g.ach[a.k] || (a.ext && !CM.extOn(a.ext))) continue;
      let ok = false;
      try {
        ok = a.test(g);
      } catch (e) {}
      if (ok) C.award(g, a);
    }
  };
  C.award = function (g, a) {
    g.ach[a.k] = g.dayCount || 1;
    const el = $('ach-banner');
    if (el) {
      el.innerHTML = '<span class="ai">' + a.icon + '</span><div><div class="at">Succès obtenu !</div><div class="an">' + a.name + '</div><div class="ad">' + a.desc + '</div></div>';
      el.classList.remove('hidden', 'go');
      void el.offsetWidth;
      el.classList.add('go');
      clearTimeout(C.achTimer);
      C.achTimer = setTimeout(() => el.classList.add('hidden'), 5200);
    }
    CM.Audio.play('objective');
    if (g.net.isClient) g.net.send({ t: 'ach', k: a.k });
    else if (g.net.isHost) g.net.sysAll('🏆 ' + g.net.name + ' a obtenu le succès « ' + a.name + ' »');
  };
  C.achHTML = function (g) {
    // (les succès d'une extension n'apparaissent que dans les mondes où elle est active)
    const list = ACH.filter((a) => !a.ext || CM.extOn(a.ext));
    const got = g.ach || {}, n = list.filter((a) => got[a.k]).length;
    return (
      '<div class="ach-head">🏆 Succès : <b>' + n + '</b> / ' + list.length + '</div><div class="ach-grid">' +
      list.map((a) => '<div class="ach ' + (got[a.k] ? 'got' : '') + '" title="' + a.desc.replace(/"/g, '') + '"><span class="ai">' + (got[a.k] ? a.icon : '🔒') + '</span><div><div class="an">' + a.name + '</div><div class="ad">' + a.desc + (got[a.k] ? ' · jour ' + got[a.k] : '') + '</div></div></div>').join('') +
      '</div>'
    );
  };

  // ========================================================= APPARENCE ==
  const COLORS = () => (CM.DYES || []).map((d) => d.key.toLowerCase());
  C.myLook = (g) => {
    const o = g.options;
    return { s: o.lookSkin | 0, h: o.lookHair | 0, t: o.lookShirt || 'blue', p: o.lookPants || 'jeans', c: o.lookCape || 'none' };
  };
  C.cleanLook = (l) => {
    if (!l || typeof l !== 'object') return null;
    const cols = COLORS();
    return {
      s: Math.max(0, Math.min(CM.SKIN_TONES.length - 1, l.s | 0)),
      h: Math.max(0, Math.min(CM.HAIR_COLORS.length - 1, l.h | 0)),
      t: cols.includes(l.t) ? l.t : 'blue',
      p: l.p === 'jeans' || cols.includes(l.p) ? l.p : 'jeans',
      c: l.c === 'none' || cols.includes(l.c) ? l.c : 'none',
    };
  };
  C.lookKey = (l) => (l ? [l.s, l.h, l.t, l.p, l.c].join('|') : '');
  // Options changées : on prévient les autres joueurs.
  C.lookChanged = function (g) {
    const l = C.myLook(g), k = C.lookKey(l);
    if (k === C.lastLook) return;
    C.lastLook = k;
    if (!g.net || !g.net.active) return;
    if (g.net.isClient) g.net.send({ t: 'look', l });
    else g.net.broadcast({ t: 'look', pid: 0, l });
  };
  // Couches de texture d'un joueur (tête, chemise, pantalon, peau, cape).
  C.layers = function (look, fallbackShirt) {
    const L = CM.Textures.layer, l = look || { s: 0, h: 0, t: fallbackShirt || 'blue', p: 'jeans', c: 'none' };
    const skin = L['skin_' + l.s] || L.skin;
    return {
      skin,
      head: [skin, skin, skin, skin, skin, L['face_' + l.s] || L.player_face],
      hair: [L['hair_side_' + l.h], L['hair_side_' + l.h], L['hair_top_' + l.h], -1, L['hair_back_' + l.h], L['hair_side_' + l.h]],
      shirt: L['concrete_' + l.t] || L.sleeve,
      pants: l.p === 'jeans' ? L.player_pants : L['concrete_' + l.p] || L.player_pants,
      cape: l.c !== 'none' ? L['concrete_' + l.c] : null,
    };
  };
  // Aperçu (options) : le personnage de face.
  C.previewEl = function (g) {
    const d = document.createElement('div');
    d.className = 'opt look-prev';
    const cv = document.createElement('canvas');
    cv.width = 120;
    cv.height = 170;
    d.appendChild(cv);
    const ctx = cv.getContext('2d'), l = C.myLook(g);
    const col = (rgb) => 'rgb(' + rgb.map(Math.round).join(',') + ')';
    const dyeRGB = (k) => ((CM.DYES || []).find((x) => x.key.toLowerCase() === k) || { c: [60, 110, 170] }).c;
    const skin = CM.SKIN_TONES[l.s], hair = CM.HAIR_COLORS[l.h];
    if (l.c !== 'none') {
      ctx.fillStyle = col(dyeRGB(l.c).map((v) => v * 0.8));
      ctx.fillRect(34, 44, 52, 86);
    }
    ctx.fillStyle = col(skin);
    ctx.fillRect(40, 8, 40, 36);
    ctx.fillStyle = col(hair);
    ctx.fillRect(38, 4, 44, 10);
    ctx.fillRect(38, 4, 4, 18);
    ctx.fillRect(78, 4, 4, 18);
    ctx.fillStyle = '#fff';
    ctx.fillRect(48, 24, 8, 4);
    ctx.fillRect(64, 24, 8, 4);
    ctx.fillStyle = '#3448a0';
    ctx.fillRect(52, 24, 4, 4);
    ctx.fillRect(64, 24, 4, 4);
    ctx.fillStyle = col(dyeRGB(l.t));
    ctx.fillRect(40, 44, 40, 48);
    ctx.fillRect(26, 44, 14, 20);
    ctx.fillRect(80, 44, 14, 20);
    ctx.fillStyle = col(skin);
    ctx.fillRect(26, 64, 14, 28);
    ctx.fillRect(80, 64, 14, 28);
    ctx.fillStyle = l.p === 'jeans' ? 'rgb(44,62,118)' : col(dyeRGB(l.p));
    ctx.fillRect(40, 92, 19, 58);
    ctx.fillRect(61, 92, 19, 58);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(40, 146, 40, 6);
    return d;
  };
  C.lookOptions = function () {
    const cols = (CM.DYES || []).map((d) => [d.key.toLowerCase(), d.m ? d.m[0].toUpperCase() + d.m.slice(1) : d.key]);
    return [
      { t: 'look' },
      { k: 'lookSkin', t: 'select', label: 'Peau', opts: CM.SKIN_NAMES.map((n, i) => [i, n]) },
      { k: 'lookHair', t: 'select', label: 'Cheveux', opts: CM.HAIR_NAMES.map((n, i) => [i, n]) },
      { k: 'lookShirt', t: 'select', label: 'Haut', opts: cols },
      { k: 'lookPants', t: 'select', label: 'Pantalon', opts: [['jeans', 'Jean']].concat(cols) },
      { k: 'lookCape', t: 'select', label: 'Cape', opts: [['none', 'Aucune']].concat(cols) },
    ];
  };
})();
