'use strict';
// Panneau d'administration (Pause → Administration, ou /panel) : pour l'hôte d'une partie ouverte
// et les administrateurs du serveur CraftMine (/admin mot de passe, ou nommés par un autre).
// Joueurs (aller vers, faire venir, admin, expulser, bannir), bannis, réglages de la partie
// (sur le serveur : enregistrés dans config.json sur la machine), heure, météo, annonce,
// sauvegarde et redémarrage. Tout passe par les commandes de l'hôte (/serveur, /bannir…).
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const q = (s) => '"' + String(s).replace(/"/g, '') + '"';
  const DIM = { nether: 'Nether', end: 'End' };
  const WXN = { clear: 'ciel clair', rain: 'pluie', thunder: 'orage' };
  const DIFF_CFG = { peaceful: 'paisible', easy: 'facile', normal: 'normal', hard: 'difficile' };
  // extensions : nom dans config.json -> clé dans le jeu
  const EXT = [['lumiere', 'light', 'Lumière réaliste'], ['electricite', 'tech', 'Électricité'], ['armes', 'guns', 'Armes à feu'], ['vehicules', 'vehicles', 'Véhicules'], ['gravite', 'gravity', 'Gravité réaliste']];
  const put = (id, html) => {
    const el = $(id);
    if (el._h !== html) el.innerHTML = el._h = html;
  };

  const A = {
    open: false,
    st: null, // dernier état reçu de l'hôte
    asked: false,
    dirty: false, // réglages en cours de modification : on ne les écrase pas
    msg: '',
    kind: 'info',
    tick: 0,
    confirmRestart: 0,

    // Qui peut l'ouvrir : l'hôte, un administrateur, et (serveur) n'importe qui pour se connecter.
    allowed(g) {
      const net = g.net;
      return net.active && (net.isHost || net.admin || net.code === CM.SERVER_CODE);
    },
    isAdmin(g) {
      return g.net.isHost || !!g.net.admin;
    },
    show(g) {
      if (g.state !== 'playing') return;
      if (!this.allowed(g)) {
        g.ui.toast(g.net.active ? 'Réservé à l’hôte et aux administrateurs' : 'Le panneau d’administration sert en multijoueur (serveur, ou partie ouverte aux amis)', 'warn');
        return;
      }
      this.bind(g);
      this.open = true;
      this.msg = '';
      this.dirty = false;
      this.st = null;
      g.ui.modal = true;
      g.releaseMouse();
      g.clearInput();
      $('adminp').classList.remove('hidden');
      this.request(g);
      this.render(g);
    },
    close(g) {
      if (!this.open) return;
      this.open = false;
      g.ui.modal = false;
      $('adminp').classList.add('hidden');
      if (!g.touch.enabled && !g.paused) g.captureMouse();
    },
    keydown(g, e) {
      if (!this.open) return false;
      if (e.code === 'Escape') {
        e.preventDefault();
        this.close(g);
      }
      return true;
    },
    // État de la partie : calculé ici pour l'hôte, demandé à l'hôte pour un administrateur.
    request(g) {
      if (g.net.isHost) {
        this.st = this.state(g);
        this.render(g);
      } else if (g.net.admin) g.net.send({ t: 'admq' });
    },
    gotState(s) {
      this.st = s;
      if (this.open) this.render(CM.game);
    },
    update(g, dt) {
      if (!this.open) return;
      this.tick -= dt;
      if (this.tick > 0) return;
      this.tick = 2;
      if (!g.net.active) return this.close(g);
      this.request(g);
    },
    // Réponse d'une commande (ici ou renvoyée par l'hôte) : dans le panneau aussi.
    onOut(s, kind) {
      this.msg = s;
      this.kind = kind || 'info';
      const m = $('adm-msg');
      if (m) {
        m.textContent = s;
        m.className = 'tp-msg ' + this.kind;
      }
      // (vient de se connecter : on charge le panneau)
      if (/Tu es administrateur/.test(s) && CM.game) setTimeout(() => this.request(CM.game), 300);
    },
    run(g, line) {
      CM.Commands.run(line);
      setTimeout(() => this.open && this.request(g), 600);
    },

    // ---------------------------------------------------------- hôte --
    state(g) {
      const net = g.net, D = CM.Dedicated;
      const players = [...net.links.values()].map((e) => ({ n: e.name, d: e.rp.dim, a: e.admin ? 1 : 0 }));
      if (!D.on) players.unshift({ n: net.name, d: g.playerDim, h: 1 });
      const ext = g.settings.ext || {};
      return {
        srv: D.on ? 1 : 0,
        name: net.name,
        n: net.links.size,
        max: D.on ? D.max : 0,
        pause: D.on ? D.cfg.pauseVide !== false : false,
        mode: g.mode,
        diff: g.difficulty,
        pvp: !!net.rules.pvp,
        keep: !!g.options.keepInventory,
        cheats: !!net.rules.cmds,
        ext: EXT.filter(([, k]) => ext[k]).map(([c]) => c),
        next: D.on && D.extNext ? D.extNext : null,
        persist: D.on ? (D.canPersist() ? 1 : 0) : 1,
        bans: Object.keys(net.bans || {}),
        lim: CM.Social.D.lim,
        sleep: (g.settings && g.settings.sleepNeed) | 0,
        bk: D.on ? (D.canBackup() ? D.bk.slice(0, 40).map((b) => [b.f, b.t, b.n]) : null) : null,
        day: g.dayCount + 1,
        hour: Math.floor(((g.time * 24 + 6) % 24) * 10) / 10,
        wx: (g.weather && g.weather.type) || 'clear',
        players,
      };
    },

    // --------------------------------------------------------- dessin --
    render(g) {
      const admin = this.isAdmin(g), st = this.st;
      $('adm-login').classList.toggle('hidden', admin);
      $('adm-main').classList.toggle('hidden', !admin || !st);
      $('adm-wait').classList.toggle('hidden', !admin || !!st);
      const m = $('adm-msg');
      m.textContent = this.msg;
      m.className = 'tp-msg ' + this.kind;
      if (!admin || !st) return;
      for (const el of document.querySelectorAll('#adminp .adm-srv')) el.classList.toggle('hidden', !st.srv);
      const h = Math.floor(st.hour), mn = Math.round((st.hour - h) * 60);
      put('adm-info', (st.srv ? '🖥 <b>' + esc(st.name) + '</b> · ' + st.n + '/' + st.max + ' joueurs · ' : '👥 ' + (st.n + 1) + ' joueurs · ') + 'jour ' + st.day + ', ' + h + 'h' + String(mn).padStart(2, '0') + ' · ' + (WXN[st.wx] || st.wx));
      // joueurs
      const me = g.net.name;
      put('adm-players', st.players.length
        ? st.players
            .map((p) => {
              const tags = (p.h ? ' <i class="adm-tag host">hôte</i>' : '') + (p.a ? ' <i class="adm-tag">admin</i>' : '') + (DIM[p.d] ? ' <i>' + DIM[p.d] + '</i>' : '') + (p.n === me ? ' <i>(toi)</i>' : '');
              const btns = p.n === me
                ? ''
                : '<button data-a="goto" data-n="' + esc(p.n) + '" title="Te téléporter vers lui">Aller</button><button data-a="bring" data-n="' + esc(p.n) + '" title="Le téléporter vers toi">Faire venir</button>' +
                  (p.h ? '' : (p.a ? '<button data-a="deop" data-n="' + esc(p.n) + '">Retirer admin</button>' : '<button data-a="op" data-n="' + esc(p.n) + '">Nommer admin</button>') +
                    '<button data-a="kick" data-n="' + esc(p.n) + '">Expulser</button><button data-a="ban" data-n="' + esc(p.n) + '" class="adm-danger">Bannir</button>');
              return '<div class="tp-row adm-row"><span class="tp-name"><b>' + esc(p.n) + '</b>' + tags + '</span><span class="adm-acts">' + btns + '</span></div>';
            })
            .join('')
        : '<div class="tp-empty">Personne n’est connecté.</div>');
      if (document.activeElement !== $('adm-lim')) $('adm-lim').placeholder = st.lim || 16;
      put('adm-bans', st.bans.length ? st.bans.map((n) => '<div class="tp-row"><span class="tp-name"><b>' + esc(n) + '</b></span><button data-a="unban" data-n="' + esc(n) + '">Débannir</button></div>').join('') : '<div class="tp-empty">Personne n’est banni.</div>');
      // réglages (pas pendant qu'on les modifie)
      if (!this.dirty) {
        $('adm-name').value = st.name;
        $('adm-mode').value = st.mode === 'creative' ? 'creatif' : 'survie';
        $('adm-diff').value = DIFF_CFG[st.diff] || 'normal';
        $('adm-max').value = st.max || 10;
        $('adm-sleep').value = st.sleep || 0;
        $('adm-pvp').checked = st.pvp;
        $('adm-keep').checked = st.keep;
        $('adm-cheats').checked = st.cheats;
        $('adm-pause').checked = !!st.pause;
        const want = st.next || st.ext;
        for (const [c] of EXT) $('adm-ext-' + c).checked = want.includes(c);
      }
      // copies du monde (serveur)
      if (st.srv) {
        const day = (t) => new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const kind = (f) => (f.startsWith('manuel') ? ' <i>copie faite à la main</i>' : f.startsWith('avant') ? ' <i>avant une restauration</i>' : '');
        put('adm-bk', !st.bk
          ? '<div class="tp-empty">Le programme du serveur est trop ancien : tape une fois « craftmine mettre-a-jour » sur la machine.</div>'
          : st.bk.length
            ? st.bk.map(([f, t, n]) => '<div class="tp-row"><span class="tp-name"><b>' + esc(day(t)) + '</b>' + kind(f) + ' <i>' + Math.max(1, Math.round(n / 1024)) + ' Ko</i></span><button data-a="restore" data-n="' + esc(f) + '" class="adm-danger">' + (this.confirmBk === f && this.confirmBkT > performance.now() ? '⚠ Confirmer' : 'Revenir') + '</button></div>').join('')
            : '<div class="tp-empty">Aucune copie pour l’instant.</div>');
      }
      $('adm-persist').classList.toggle('hidden', !!st.persist);
      $('adm-next').textContent = st.next && st.next.join(',') !== st.ext.join(',') ? 'Au prochain redémarrage : ' + (st.next.join(', ') || 'aucune') : '';
      $('adm-restart').textContent = this.confirmRestart > performance.now() ? '⚠ Confirmer le redémarrage' : '🔄 Redémarrer le serveur';
    },

    // Réglages modifiés : une commande /serveur par réglage changé.
    saveCfg(g) {
      const st = this.st;
      if (!st) return;
      const lines = [];
      const name = $('adm-name').value.trim();
      if (st.srv && name && name !== st.name) lines.push('/serveur nom ' + q(name));
      const mode = $('adm-mode').value;
      if (mode !== (st.mode === 'creative' ? 'creatif' : 'survie')) lines.push('/serveur mode ' + mode);
      const diff = $('adm-diff').value;
      if (diff !== DIFF_CFG[st.diff]) lines.push('/serveur difficulte ' + diff);
      const max = Math.max(2, Math.min(20, +$('adm-max').value | 0));
      if (st.srv && max && max !== st.max) lines.push('/serveur max ' + max);
      const sleep = Math.max(0, Math.min(20, Math.round(+$('adm-sleep').value || 0)));
      if (sleep !== (st.sleep || 0)) lines.push('/regle dormir ' + sleep);
      if (st.srv && $('adm-pause').checked !== !!st.pause) lines.push('/serveur pause ' + ($('adm-pause').checked ? 'on' : 'off'));
      for (const [id, k, cur] of [['adm-pvp', 'pvp', st.pvp], ['adm-keep', 'garder_inventaire', st.keep], ['adm-cheats', 'triches', st.cheats]]) {
        if ($(id).checked !== cur) lines.push('/serveur ' + k + ' ' + ($(id).checked ? 'on' : 'off'));
      }
      if (st.srv) {
        const ext = EXT.map(([c]) => c).filter((c) => $('adm-ext-' + c).checked);
        if (ext.join(',') !== (st.next || st.ext).join(',')) lines.push('/serveur extensions ' + (ext.join(',') || 'aucune'));
      }
      this.dirty = false;
      if (!lines.length) {
        this.onOut('Rien n’a changé', 'info');
        return;
      }
      for (const l of lines) CM.Commands.run(l);
      setTimeout(() => this.open && this.request(g), 700);
    },

    bind(g) {
      const el = $('adminp');
      if (el.dataset.bound) return;
      el.dataset.bound = 1;
      // (à l'appui : la liste se redessine régulièrement, un clic pourrait se perdre)
      el.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('button');
        if (!b) {
          if (e.target === el) this.close(g);
          return;
        }
        e.preventDefault();
        const n = b.dataset.n;
        const act = {
          close: () => this.close(g),
          login: () => {
            const pw = $('adm-pw').value.trim();
            if (!pw) return this.onOut('Tape le mot de passe', 'err');
            $('adm-pw').value = '';
            CM.Commands.run('/admin ' + pw);
          },
          goto: () => this.run(g, '/tp ' + q(n)),
          bring: () => this.run(g, '/tp ' + q(n) + ' moi'),
          op: () => this.run(g, '/nommeradmin ' + q(n)),
          deop: () => this.run(g, '/retireradmin ' + q(n)),
          kick: () => this.run(g, '/expulser ' + q(n)),
          ban: () => this.run(g, '/bannir ' + q(n)),
          unban: () => this.run(g, '/debannir ' + q(n)),
          free: () => {
            const v = $('adm-free').value.trim();
            if (!v) return;
            $('adm-free').value = '';
            this.run(g, '/liberer ' + q(v));
          },
          lim: () => {
            const v = Math.round(+$('adm-lim').value);
            if (v > 0) this.run(g, '/terrain limite ' + v);
          },
          saveCfg: () => this.saveCfg(g),
          time: () => this.run(g, '/temps ' + b.dataset.v),
          wx: () => this.run(g, '/meteo ' + b.dataset.v),
          save: () => this.run(g, '/sauver'),
          bknow: () => this.run(g, '/sauvegardes copier'),
          restore: () => {
            // deux appuis : le serveur redémarre avec le monde d'avant
            if (this.confirmBk === n && this.confirmBkT > performance.now()) {
              this.confirmBk = null;
              this.run(g, '/sauvegardes restaurer ' + n);
            } else {
              this.confirmBk = n;
              this.confirmBkT = performance.now() + 4000;
            }
            this.render(g);
          },
          ann: () => {
            const s = $('adm-ann').value.trim();
            if (!s) return;
            $('adm-ann').value = '';
            this.run(g, '/annonce ' + s);
          },
          restart: () => {
            // deux appuis : le serveur est coupé une minute pour tout le monde
            if (this.confirmRestart > performance.now()) {
              this.confirmRestart = 0;
              this.run(g, '/serveur redemarrer');
            } else this.confirmRestart = performance.now() + 4000;
            this.render(g);
          },
        }[b.dataset.a];
        if (act) act();
      });
      // réglages modifiés : on ne les remplace plus par l'état reçu, jusqu'à « Enregistrer »
      for (const id of ['adm-name', 'adm-mode', 'adm-diff', 'adm-max', 'adm-sleep', 'adm-pvp', 'adm-keep', 'adm-cheats', 'adm-pause', ...EXT.map(([c]) => 'adm-ext-' + c)]) $(id).addEventListener('input', () => (this.dirty = true));
      // champs : Entrée valide, Échap ferme
      for (const [id, a] of [['adm-pw', 'login'], ['adm-ann', 'ann'], ['adm-name', 'saveCfg'], ['adm-max', 'saveCfg'], ['adm-free', 'free'], ['adm-lim', 'lim']]) {
        $(id).addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            el.querySelector('button[data-a="' + a + '"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.close(g);
          }
        });
      }
    },
  };
  A.EXT = EXT;
  CM.Admin = A;
})();
