'use strict';
// Menu du joueur (touche G, ou Pause → Menu du joueur), en onglets :
// - Téléportation : maisons (aller, définir, supprimer) et demandes aux autres joueurs (aller chez
//   lui, l'inviter ici, accepter, refuser). Tout passe par les commandes (/maison, /tpa…), qui
//   refusent la téléportation moins de 10 s après un combat.
// - Terrain, Équipe, Argent, Classements, Compte : voir social.js et social_ui.js ; Gestes : emotes.js.
// Rien ne reste affiché pendant le jeu, sauf le petit bandeau d'une demande de téléportation reçue.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const q = (s) => '"' + String(s).replace(/"/g, '') + '"';
  const DIM = { nether: 'Nether', end: 'End' };
  const put = (id, html) => {
    const el = $(id);
    if (el._h !== html) el.innerHTML = el._h = html;
  };
  const TABS = {
    tp: '🌀 Téléportation',
    terrain: '🏡 Terrain',
    equipe: '🛡 Équipe',
    argent: '🪙 Argent',
    top: '🏆 Classements',
    gestes: '👋 Gestes',
    compte: '👤 Compte',
  };
  const NET_TABS = new Set(['terrain', 'equipe', 'argent', 'top']);

  const T = {
    open: false,
    tab: 'tp',
    msg: '',
    msgKind: 'info',
    tick: 0,
    popT: 0,

    toggle(g) {
      if (this.open) this.close(g);
      else this.show(g);
    },
    show(g, tab) {
      if (g.state !== 'playing' || !g.player.alive) return;
      this.bind(g);
      if (tab && TABS[tab]) this.tab = tab;
      this.open = true;
      this.msg = '';
      g.ui.modal = true;
      g.releaseMouse();
      g.clearInput();
      $('tpmenu').classList.remove('hidden');
      $('tp-pop').classList.add('hidden');
      this.switchTab(g, this.tab);
    },
    close(g) {
      if (!this.open) return;
      this.open = false;
      g.ui.modal = false;
      const a = document.activeElement;
      if (a && $('tpmenu').contains(a)) a.blur();
      $('tpmenu').classList.add('hidden');
      if (!g.touch.enabled) g.captureMouse();
    },
    switchTab(g, tab) {
      this.tab = TABS[tab] ? tab : 'tp';
      this.msg = '';
      if (CM.SocialUI) CM.SocialUI.opened(g, this.tab);
      this.render(g);
    },
    // Touches : G ouvre/ferme, Échap ferme ; menu ouvert, les autres touches ne vont pas au jeu.
    keydown(g, e) {
      const c = e.code;
      if (this.open) {
        if (c === 'Escape' || (c === g.binds.tpmenu && !e.repeat)) {
          e.preventDefault();
          this.close(g);
        }
        return true;
      }
      if (c === g.binds.tpmenu && !e.repeat && !g.ui.invOpen && !g.paused && !g.ui.modal && g.player.alive) {
        this.show(g);
        return true;
      }
      return false;
    },
    // Lance une commande et garde sa réponse pour le menu.
    run(g, line) {
      CM.Commands.run(line, (s, k) => {
        this.msg = s;
        this.msgKind = k;
      });
      this.render(g);
    },
    // Réponse d'une commande (aussi celles que l'hôte renvoie à un invité).
    onOut(s, k) {
      if (!['ok', 'err', 'info'].includes(k || 'info')) return;
      this.msg = String(s);
      this.msgKind = k || 'info';
      if (CM.game) this.render(CM.game);
    },
    // Une demande est arrivée ou a changé (appelé par les commandes).
    changed() {
      const g = CM.game;
      if (!g) return;
      if (this.open) this.render(g);
      else this.popup(g);
    },
    // Bandeau « demande reçue » pendant le jeu.
    popup(g) {
      const st = CM.Commands.tpState();
      const el = $('tp-pop');
      if (!el) return;
      if (!st.inc.length) {
        el.classList.add('hidden');
        return;
      }
      const [, r] = st.inc[st.inc.length - 1];
      const how = g.touch.enabled ? 'touche ici pour répondre' : 'touche ' + esc(g.keyName(g.binds.tpmenu)) + ' pour répondre';
      el.innerHTML = '📨 <b>' + esc(r.name) + '</b> ' + (r.here ? 'te demande de venir' : 'veut venir chez toi') + ' · ' + how;
      el.classList.remove('hidden');
    },
    update(g, dt) {
      if (this.open && CM.SocialUI) CM.SocialUI.tick(g, dt, this.tab);
      this.tick -= dt;
      if (this.tick > 0) return;
      this.tick = 0.5;
      if (this.open) this.render(g);
      else this.popup(g);
    },

    render(g) {
      const tab = this.tab, solo = NET_TABS.has(tab) && !g.net.active;
      $('pm-title').textContent = TABS[tab];
      for (const b of $('pm-tabs').children) {
        b.classList.toggle('on', b.dataset.tab === tab);
        if (b.dataset.tab === 'gestes') b.classList.toggle('hidden', !CM.Emotes);
      }
      const sk = document.querySelector('#pm-compte .ac-skin');
      if (sk) {
        sk.classList.toggle('hidden', !CM.Skins);
        sk.previousElementSibling.classList.toggle('hidden', !CM.Skins);
      }
      for (const el of document.querySelectorAll('#tpmenu .pm-page')) el.classList.toggle('hidden', el.id !== (solo ? 'pm-solo' : 'pm-' + tab));
      const m = $('tp-msg');
      m.textContent = this.msg;
      m.className = 'tp-msg ' + this.msgKind;
      $('tp-key').textContent = g.touch.enabled ? '' : 'Touche ' + g.keyName(g.binds.tpmenu) + ' ou Échap pour fermer · ';
      $('pm-hint').textContent = tab === 'tp' ? 'Impossible pendant un combat (10 s après le dernier coup) · une demande dure 60 s' : '';
      if (tab === 'tp') this.renderTp(g);
      else if (!solo && CM.SocialUI) CM.SocialUI.render(g, tab);
    },
    renderTp(g) {
      const net = g.net, p = g.player;
      const st = CM.Commands.tpState();
      const left = p.combatLeft();
      const cb = $('tp-combat');
      cb.classList.toggle('hidden', left <= 0);
      if (left > 0) cb.textContent = '⚔ En combat : téléportation possible dans ' + Math.ceil(left) + ' s';
      // demandes reçues
      put('tp-req', st.inc
        .map(([pid, r]) => {
          const s = Math.max(0, Math.ceil(st.life - (st.clock - r.t)));
          return '<div class="tp-row req"><span class="tp-name">📨 <b>' + esc(r.name) + '</b> ' + (r.here ? 'te demande de venir' : 'veut venir chez toi') + ' <i>' + s + ' s</i></span>' +
            '<button data-tp="ok" data-n="' + esc(r.name) + '" class="tp-ok">Accepter</button><button data-tp="no" data-n="' + esc(r.name) + '">Refuser</button></div>';
        })
        .join(''));
      // maisons
      const h = CM.Commands.homes(), names = Object.keys(h);
      put('tp-homes', names.length
        ? names
            .map((n) => {
              const v = h[n];
              return '<div class="tp-row"><span class="tp-name"><b>' + esc(n) + '</b> <i>' + Math.floor(v[0]) + ' ' + Math.floor(v[1]) + ' ' + Math.floor(v[2]) + (DIM[v[3]] ? ' · ' + DIM[v[3]] : '') + '</i></span>' +
                '<button data-tp="home" data-n="' + esc(n) + '" class="tp-go"' + (left > 0 ? ' disabled' : '') + '>Y aller</button><button data-tp="del" data-n="' + esc(n) + '" title="Supprimer">✕</button></div>';
            })
            .join('')
        : '<div class="tp-empty">Aucune maison. Donne-lui un nom et clique sur « Définir ici » là où tu veux revenir.</div>');
      $('tp-home-set').disabled = names.length >= 10 && !names.includes(CM.Commands.norm($('tp-home-name').value || 'maison'));
      // joueurs
      const others = net.active ? [...net.remotes.values()] : [];
      const sent = new Map(st.out);
      put('tp-players', !net.active
        ? '<div class="tp-empty">Tu joues seul. En multijoueur (serveur, ou partie ouverte aux amis), tu pourras demander à rejoindre un joueur.</div>'
        : !others.length
          ? '<div class="tp-empty">Personne d’autre n’est connecté.</div>'
          : others
              .map((rp) => {
                const out = sent.get(rp.pid);
                const where = DIM[rp.dim] ? ' <i>' + DIM[rp.dim] + '</i>' : '';
                const btns = out
                  ? '<span class="tp-wait">Demande envoyée · ' + Math.max(0, Math.ceil(st.life - (st.clock - out.t))) + ' s</span>'
                  : '<button data-tp="tpa" data-n="' + esc(rp.name) + '" class="tp-go"' + (left > 0 ? ' disabled' : '') + '>Aller chez lui</button><button data-tp="here" data-n="' + esc(rp.name) + '">L’inviter ici</button>';
                return '<div class="tp-row"><span class="tp-name"><b>' + esc(CM.Social.label(rp.name)) + '</b>' + where + '</span>' + btns + '</div>';
              })
              .join(''));
    },

    bind(g) {
      const el = $('tpmenu');
      if (el.dataset.bound) return;
      el.dataset.bound = 1;
      // (à l'appui : le menu se redessine toutes les demi-secondes, un clic pourrait se perdre)
      el.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('button');
        if (!b) {
          if (e.target === el) this.close(g); // (clic à côté du panneau)
          return;
        }
        if (b.disabled) return;
        const n = b.dataset.n;
        e.preventDefault();
        if (b.dataset.tab) {
          this.switchTab(g, b.dataset.tab);
          return;
        }
        switch (b.dataset.tp) {
          case 'close':
            this.close(g);
            return;
          case 'home':
            this.run(g, '/maison ' + q(n));
            if (this.msgKind === 'ok') this.close(g);
            return;
          case 'del':
            this.run(g, '/suppmaison ' + q(n));
            return;
          case 'set':
            this.run(g, '/defmaison ' + q($('tp-home-name').value.trim() || 'maison'));
            $('tp-home-name').value = '';
            return;
          case 'tpa':
            this.run(g, '/tpa ' + q(n));
            return;
          case 'here':
            this.run(g, '/tpaici ' + q(n));
            return;
          case 'ok':
            this.run(g, '/tpaccepter ' + q(n));
            if (this.msgKind === 'ok') this.close(g);
            return;
          case 'no':
            this.run(g, '/tprefuser ' + q(n));
            return;
        }
        if (CM.SocialUI) CM.SocialUI.click(g, b);
      });
      // champs de saisie : les touches ne vont pas au jeu ; Entrée valide la ligne, Échap ferme
      el.addEventListener('keydown', (e) => {
        if (!e.target.matches('input')) return;
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          const b = e.target.closest('.tp-add') && e.target.closest('.tp-add').querySelector('button[data-tp]');
          if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.close(g);
        }
      });
      el.addEventListener('input', (e) => {
        if (e.target.id === 'tp-home-name') this.render(g);
        else if (CM.SocialUI) CM.SocialUI.input(g, e.target);
      });
      el.addEventListener('change', (e) => {
        if (CM.SocialUI) CM.SocialUI.change(g, e.target);
      });
      $('tp-pop').addEventListener('click', () => this.show(g, 'tp'));
    },
  };
  CM.Teleport = T;
})();
