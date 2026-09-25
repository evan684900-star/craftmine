'use strict';
// Inventaire (36 cases dont 9 dans la barre rapide) et fabrication par recettes.
(function () {
  class Inventory {
    constructor() {
      this.slots = new Array(36).fill(null);
      this.armor = [null, null, null, null]; // casque, plastron, jambières, bottes
      this.offhand = null; // main secondaire (bouclier, torche, blocs…)
      this.selected = 0;
      this.onChange = null;
    }
    // Protection totale (points d'armure, comme dans Minecraft : 20 au maximum) et robustesse.
    armorPoints() {
      let n = 0;
      for (const s of this.armor) if (s) n += CM.itemInfo(s.id).armor;
      return n;
    }
    armorToughness() {
      let n = 0;
      for (const s of this.armor) if (s) n += CM.itemInfo(s.id).tough;
      return n;
    }
    // Pièce tenue en main -> portée (échange avec celle déjà portée). Renvoie true si c'est fait.
    equipHeld() {
      const s = this.slots[this.selected];
      const info = s && CM.itemInfo(s.id);
      if (!info || info.type !== 'armor') return false;
      this.slots[this.selected] = this.armor[info.slot];
      this.armor[info.slot] = s;
      this.changed();
      return true;
    }
    changed() {
      if (this.onChange) this.onChange();
    }
    maxStack(id) {
      return CM.itemInfo(id).stack;
    }
    // Ajoute des objets ; renvoie la quantité qui n'a pas pu être rangée.
    add(id, count, extra) {
      const max = this.maxStack(id);
      if (max > 1) {
        for (let i = 0; i < 36 && count > 0; i++) {
          const s = this.slots[i];
          if (s && s.id === id && s.count < max) {
            const n = Math.min(max - s.count, count);
            s.count += n;
            count -= n;
          }
        }
      }
      for (let i = 0; i < 36 && count > 0; i++) {
        if (!this.slots[i]) {
          const n = Math.min(max, count);
          this.slots[i] = Object.assign({ id, count: n }, extra || {});
          if (CM.hasWear(id) && this.slots[i].xp === undefined) this.slots[i].xp = 0;
          count -= n;
        }
      }
      this.changed();
      return count;
    }
    // id peut être un identifiant ou un groupe ('planks', 'logs'…).
    count(id) {
      if (typeof id === 'string') return CM.tagMembers(id).reduce((n, m) => n + this.count(m), 0);
      let n = 0;
      for (const s of this.slots) if (s && s.id === id) n += s.count;
      return n;
    }
    has(id) {
      return this.count(id) > 0;
    }
    remove(id, n) {
      if (this.count(id) < n) return false;
      if (typeof id === 'string') {
        // on consomme d'abord l'essence dont on a le plus
        const members = CM.tagMembers(id).slice().sort((a, b) => this.count(b) - this.count(a));
        for (const m of members) {
          const k = Math.min(n, this.count(m));
          if (k > 0) this.remove(m, k);
          n -= k;
        }
        return true;
      }
      for (let i = 35; i >= 0 && n > 0; i--) {
        const s = this.slots[i];
        if (s && s.id === id) {
          const k = Math.min(s.count, n);
          s.count -= k;
          n -= k;
          if (s.count <= 0) this.slots[i] = null;
        }
      }
      this.changed();
      return true;
    }
    held() {
      return this.slots[this.selected];
    }
    // Échange l'objet en main et celui de la main secondaire.
    swapHands() {
      const s = this.slots[this.selected];
      this.slots[this.selected] = this.offhand;
      this.offhand = s;
      this.changed();
    }
    consumeHeld(n) {
      const s = this.slots[this.selected];
      if (!s) return;
      s.count -= n || 1;
      if (s.count <= 0) this.slots[this.selected] = null;
      this.changed();
    }
    canCraft(r, stations) {
      if (r.station && !stations[r.station]) return false;
      for (const [id, n] of r.ing) if (this.count(id) < n) return false;
      return true;
    }
    // Nombre maximal de fabrications possibles.
    maxCrafts(r) {
      let m = 64;
      for (const [id, n] of r.ing) m = Math.min(m, Math.floor(this.count(id) / n));
      return m;
    }
    craft(r) {
      for (const [id, n] of r.ing) this.remove(id, n);
      return this.add(r.out, r.n);
    }

    serialize() {
      const copy = (s) => (s ? Object.assign({}, s) : null);
      return { slots: this.slots.map(copy), selected: this.selected, armor: this.armor.map(copy), offhand: copy(this.offhand) };
    }
    load(data, v) {
      if (!data || !Array.isArray(data.slots)) return;
      this.slots = data.slots.map((s) => {
        if (!s) return null;
        const id = CM.migrateId(s.id, v || 4);
        return CM.itemInfo(id) ? Object.assign({}, s, { id }) : null;
      });
      while (this.slots.length < 36) this.slots.push(null);
      this.armor = [0, 1, 2, 3].map((k) => {
        const s = Array.isArray(data.armor) && data.armor[k];
        const info = s && CM.itemInfo(s.id);
        return info && info.type === 'armor' && info.slot === k ? Object.assign({ xp: 0 }, s, { count: 1 }) : null;
      });
      const oh = data.offhand;
      this.offhand = oh && CM.itemInfo(CM.migrateId(oh.id, v || 4)) ? Object.assign({}, oh, { id: CM.migrateId(oh.id, v || 4) }) : null;
      this.selected = data.selected || 0;
      this.changed();
    }
  }
  CM.Inventory = Inventory;
})();
