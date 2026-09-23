# CraftMine — L'Aube des Éclats

Un jeu de type **Minecraft en 3D** qui tourne directement dans le navigateur. Le principe reste le même : un monde en cubes à miner, des ressources à récolter, des outils à fabriquer et des nuits dangereuses. Mais **les mécaniques sont différentes** : endurance au lieu de la faim, grappin, combos de minage, outils qui progressent, Ombres qui craignent la lumière, îles célestes…

Aucune dépendance, aucune image ni aucun son externe : le moteur WebGL2, les textures pixel-art et les effets sonores sont générés par le code.

## Lancer le jeu

- **Le plus simple** : ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari 15+).
- Ou via un petit serveur local :
  ```bash
  npx serve .        # puis ouvrir l'adresse affichée
  # ou
  python3 -m http.server 8000
  ```

Il faut un clavier et une souris (le jeu utilise le verrouillage du pointeur). La partie est sauvegardée automatiquement dans le navigateur (localStorage).

## Commandes

| Touche | Action |
| --- | --- |
| **ZQSD / WASD** | Se déplacer (les touches suivent la position physique, donc AZERTY et QWERTY marchent) |
| **Espace** | Sauter, nager, double saut (avec l'amulette), se décrocher du grappin |
| **Maj** | Courir (consomme de l'endurance) |
| **F** | Ruée : une accélération fulgurante, brièvement invulnérable |
| **Clic gauche** (maintenu) | Miner / frapper |
| **Clic droit** | Poser un bloc, manger, lancer le grappin, ouvrir un coffre ou l'établi |
| **E** | Inventaire, fabrication, journal des quêtes, aide |
| **1–9 / molette** | Choisir l'objet en main |
| **Q** (touche A en AZERTY) | Jeter l'objet en main (Ctrl+Q : toute la pile) |
| **Échap** | Pause · **F3** : informations de débogage |

## Ce qui change par rapport à Minecraft

| Mécanique | Dans CraftMine |
| --- | --- |
| ⚡ **Endurance au lieu de la faim** | Courir, sauter, la ruée, le grappin et le minage consomment de l'endurance, qui remonte vite au repos. À zéro, tu es épuisé (plus de course, minage ralenti). Sous l'eau, l'endurance sert de souffle. La nourriture soigne et recharge l'endurance ; la viande grillée donne *Vigueur* (récupération accélérée). |
| 🪝 **Grappin** | 3 lingots de fer + 2 cordes. Clic droit sur un bloc jusqu'à 34 blocs : tu es tiré vers lui en gardant ton élan. Parfait pour grimper les falaises et atteindre les îles célestes. |
| 💨 **Ruée et double saut** | `F` lance une ruée (plus de dégâts si tu frappes pendant). L'*Amulette de plume* gardée dans l'inventaire donne un double saut. |
| 🔥 **Combo de minage** | Casser des blocs à la suite accélère le minage à chaque niveau de combo. À partir de x5, les minerais peuvent donner un double butin. |
| ⭐ **Maîtrise des outils** | Les outils ne s'usent jamais : ils gagnent de l'expérience et montent jusqu'à ★★★★★ (plus rapides, plus de dégâts). Une hache en fer abat l'arbre entier, une pioche de cristal mine tout un filon. |
| 📖 **Fabrication sans grille** | Un livre de recettes : on choisit ce qu'on veut fabriquer. Certaines recettes demandent un **établi** ou une **forge** à moins de 4 blocs. La forge fond le minerai et cuit la viande avec du charbon. |
| 🌑 **Les Ombres** | La nuit et dans les grottes sombres apparaissent des Ombres. Elles brûlent au soleil, **refusent d'entrer dans la lumière des torches** et y souffrent. Tenir une torche en main éclaire autour de toi (lumière dynamique). |
| 🍄 **Champignons rebond** | Des champignons violets lumineux poussent dans les grottes : on rebondit très haut dessus et ils annulent les dégâts de chute. |
| 🏝 **Îles célestes** | Des îles flottent au-dessus du monde et renferment des *Éclats célestes*. |
| ☀ **Objectif final** | Forger le **Cœur d'aube** (4 éclats célestes, 4 essences d'ombre, 4 cristaux, 2 lingots de fer) et le poser : il chasse définitivement les Ombres alentour. |

Un **journal de quêtes** (en haut à gauche et dans l'onglet *Journal*) guide la progression :
bois → établi → pioche → pierre → torches → forge → fer → grappin → cristal (sous la couche 20) → essence d'ombre → îles célestes → Cœur d'aube.

## Contenu

- Monde procédural de 256 × 256 × 96 blocs (graine au choix) : plaines, forêts, déserts, montagnes enneigées, océan, grottes, cavernes, minerais (charbon, fer, cristal) et 8 îles célestes.
- Éclairage par propagation (ciel + blocs), occlusion ambiante, cycle jour/nuit avec soleil, lune, étoiles et nuages cubiques, eau animée et translucide.
- 32 blocs, 30 objets (dont 16 outils en 4 matériaux), 36 recettes.
- Créatures : *Mouflons* (passifs : viande, laine) et *Ombres* (hostiles : essence d'ombre).
- Coffres, pousses d'arbre qui grandissent, objets à ramasser au sol, particules, sons synthétisés.
- Sauvegarde automatique : seules les modifications du monde sont stockées, le reste est régénéré depuis la graine.

## Structure du code

```
index.html        page, interface (HUD, inventaire, menus)
style.css         styles de l'interface
js/util.js        maths, bruit simplex, matrices
js/blocks.js      blocs, objets, outils, recettes
js/textures.js    textures pixel-art générées + icônes
js/world.js       génération du monde, lumière, lancer de rayon
js/mesher.js      maillage des sections 16×16×16 (AO, lumière douce)
js/renderer.js    rendu WebGL2 (monde, ciel, entités, eau)
js/entities.js    physique, créatures, objets au sol, particules
js/player.js      joueur : déplacements, minage, combat, grappin…
js/inventory.js   inventaire et fabrication
js/ui.js          interface, journal, aide
js/audio.js       effets sonores WebAudio
js/main.js        boucle de jeu, jour/nuit, sauvegarde, entrées
```
