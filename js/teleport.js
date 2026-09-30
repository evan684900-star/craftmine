'use strict';
// Menu Téléportation (touche G, ou Pause → Téléportation) : maisons (aller, définir, supprimer)
// et demandes de téléportation aux autres joueurs (aller chez lui, l'inviter ici, accepter,
// refuser). Tout passe par les commandes (/maison, /defmaison, /tpa, /tpaici, /tpaccepter…),
// qui refusent la téléportation moins de 10 s après un combat.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const q = (s) => '"' + String(s).replace(/"/g, '') + '"';
  const DIM = { nether: 'Nether', end: 'End' };
  const put = (id, html) => {
    const el = $(id);
    if (el._h !== html) el.innerHTML = el._h = html;
  };

  const T = {
    open: false,
    msg: '',
    msgKind: 'info',
    tick: 0,
    popT: 0,

    toggle(g) {
      if (this.open) this.close(g);
      else this.show(g);
    },
    show(g) {
      if (g.state !== 'playing' || !g.player.alive) return;
      this.bind(g);
      this.open = true;
      this.msg = '';
      g.ui.modal = true;
      g.releaseMouse();
      g.clearInput();
      $('tpmenu').classList.remove('hidden');
      $('tp-pop').classList.add('hidden');
      this.render(g);
    },
    close(g) {
      if (!this.open) return;
      this.open = false;
      g.ui.modal = false;
      $('tpmenu').classList.add('hidden');
      if (!g.touch.enabled) g.captureMouse();
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
      this.tick -= dt;
      if (this.tick > 0) return;
      this.tick = 0.5;
      if (this.open) this.render(g);
      else this.popup(g);
    },

    render(g) {
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
                return '<div class="tp-row"><span class="tp-name"><b>' + esc(rp.name) + '</b>' + where + '</span>' + btns + '</div>';
              })
              .join(''));
      const m = $('tp-msg');
      m.textContent = this.msg;
      m.className = 'tp-msg ' + this.msgKind;
      $('tp-key').textContent = g.touch.enabled ? '' : 'Touche ' + g.keyName(g.binds.tpmenu) + ' ou Échap pour fermer · ';
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
        const n = b.dataset.n;
        e.preventDefault();
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
      });
      const inp = $('tp-home-name');
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          $('tp-home-set').click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.close(g);
        }
      });
      inp.addEventListener('input', () => this.render(g));
      $('tp-pop').addEventListener('click', () => this.show(g));
    },
  };
  CM.Teleport = T;
})();
