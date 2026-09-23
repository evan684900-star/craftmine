# CraftMine — L'Aube des Éclats

Un jeu de type **Minecraft en 3D** qui tourne directement dans le navigateur. Le principe reste le même : un monde en cubes à miner, des ressources à récolter, des outils à fabriquer, la faim à gérer et des nuits dangereuses. Certaines mécaniques changent : grappin, ruée, combos de minage, outils qui progressent, Ombres qui craignent la lumière, îles célestes…

Aucune image ni aucun son externe : le moteur WebGL2, les textures pixel-art (plus de 600) et les effets sonores sont générés par le code. Seul le multijoueur utilise une bibliothèque, PeerJS (fournie dans `js/vendor/`, chargée seulement quand on joue à plusieurs).

## Lancer le jeu

- **Le plus simple** : ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari 15+).
- Ou via un petit serveur local :
  ```bash
  npx serve .        # puis ouvrir l'adresse affichée
  # ou
  python3 -m http.server 8000
  ```

Sur ordinateur, il faut un clavier et une souris (le jeu utilise le verrouillage du pointeur). Sur **téléphone ou tablette**, des contrôles tactiles s'affichent automatiquement (voir plus bas). La partie est sauvegardée automatiquement dans le navigateur (localStorage).

### Nouveau monde

Le bouton **Nouveau monde** ouvre un écran de création :

| Réglage | Choix |
| --- | --- |
| Graine | vide = vraiment aléatoire ; un nombre ou un texte donne toujours le même monde |
| Mode de jeu | Survie ou **Créatif** (blocs infinis, vol, pas de dégâts) |
| Difficulté | Paisible (ni Ombres ni faim), Facile, Normale, Difficile |
| Type de monde | Normal, Amplifié (reliefs géants), Plat, Archipel (beaucoup d'océan) |
| Taille des biomes | Petits, Normaux, Grands |
| Coffre de départ, cycle jour/nuit | activables |

La graine du monde est affichée dans le menu pause et avec **F3**.

### Changer d'appareil

La partie est enregistrée dans le navigateur. Pour la transférer :

1. **Exporter la sauvegarde** (menu principal ou menu pause) télécharge un fichier `.zip` (par exemple `craftmine-sauvegarde-jour5-2026-09-23.zip`).
2. Copie ce fichier sur l'autre appareil (clé USB, e-mail, cloud…).
3. Sur l'autre appareil, ouvre le jeu et clique sur **Importer une sauvegarde** dans le menu principal, choisis le `.zip`, puis **Continuer**.

Les sauvegardes des versions précédentes restent compatibles : leur paysage est généré avec l'ancien générateur, pour que les constructions ne soient pas déplacées.

## Commandes

Toutes les touches se changent dans **Options > Contrôles**.

| Touche | Action |
| --- | --- |
| **ZQSD / WASD** | Se déplacer (les touches suivent la position physique, donc AZERTY et QWERTY marchent) |
| **Espace** | Sauter, nager, double saut (avec l'amulette), monter en vol (créatif, double appui pour voler) |
| **Maj** | Courir |
| **C** | S'accroupir (on ne tombe pas du bord) / descendre en vol |
| **F** | Ruée : une accélération fulgurante, brièvement invulnérable |
| **Clic gauche** (maintenu) | Miner / frapper |
| **Clic droit** | Poser un bloc, manger, utiliser un outil (écorcer, labourer), lancer le grappin, ouvrir un coffre |
| **Clic molette** | Prendre le bloc visé |
| **E** | Inventaire, fabrication, inventaire créatif, journal, aide |
| **1–9 / molette** | Choisir l'objet en main |
| **Q** (touche A en AZERTY) | Jeter l'objet en main (Ctrl+Q : toute la pile) |
| **Échap** | Pause · **F1** : masquer l'interface · **F3** : informations de débogage |

### Sur téléphone ou tablette

Tiens l'appareil en **mode paysage** (un message le rappelle en mode portrait).

| Geste / bouton | Action |
| --- | --- |
| Pouce en bas à gauche de l'écran | Joystick : il apparaît sous le doigt, plus on pousse plus on va vite |
| Glisser ailleurs | Regarder autour |
| Toucher un bloc | Poser un bloc contre lui, l'utiliser (coffre, établi…), manger, ou frapper la créature touchée |
| Garder le doigt appuyé sur un bloc | Le casser (on peut glisser pour tourner la caméra sans lâcher) |
| ⤒ / ⤓ | Sauter (deux fois pour voler en créatif) / s'accroupir ou descendre en vol |
| » / ⚡ | Courir (bascule) / ruée |
| ✋ | Poser ou utiliser au centre de l'écran |
| 🎒 · 🗑 · ⏸ | Inventaire · jeter l'objet en main · pause |
| Barre rapide | Toucher une case pour la choisir |

Dans l'inventaire, les boutons **Rapide** (comme Maj+clic) et **Moitié** (comme le clic droit) remplacent les raccourcis de la souris. Au premier lancement sur téléphone, le jeu choisit des réglages plus légers (distance d'affichage 5, résolution 75 %) et active le saut automatique. **Options > Contrôles** permet de forcer ou désactiver les contrôles tactiles, de régler leur sensibilité et la taille des boutons, et de choisir la visée : *au doigt* (par défaut, on agit sur le bloc touché) ou *au centre de l'écran* (réticule). **Disposer les boutons tactiles…** ouvre un éditeur : on fait glisser chaque bouton où on veut, on règle sa taille (50 à 200 %) et son opacité, on peut le masquer, et un curseur règle l'opacité de tous les boutons. La disposition est gardée dans le navigateur. Sur iPhone, *Partager > Sur l'écran d'accueil* ouvre le jeu en plein écran.

### Multijoueur (gratuit, sans serveur)

Jusqu'à 8 joueurs dans le même monde, sur ordinateur comme sur téléphone.

1. **L'hôte** lance son monde (Nouveau monde ou Continuer), ouvre le menu **Pause** et clique sur **« Ouvrir aux amis »**. Il choisit un pseudo, autorise ou non les combats entre joueurs, et reçoit un **code de 5 caractères** (bouton pour partager le lien d'invitation `…/?join=CODE`).
2. **Les invités** cliquent sur **Multijoueur** dans le menu principal, choisissent un pseudo et tapent le code.

| Touche | Action |
| --- | --- |
| **T** ou **Entrée** (💬 sur téléphone) | Tchat |

- Les navigateurs se connectent **directement entre eux** (WebRTC). Le serveur public et gratuit de [PeerJS](https://peerjs.com) sert seulement à les mettre en relation ; aucun compte, aucun serveur à payer.
- **L'hôte fait autorité** : il garde le monde, les créatures, les objets au sol, les coffres, l'heure et les réglages (mode de jeu, difficulté, durée des journées, « garder l'inventaire »). Chaque invité gère ses déplacements, son inventaire, sa faim et sa santé.
- Les autres joueurs sont visibles avec leur pseudo au-dessus de la tête et **l'objet qu'ils tiennent en main**. Les coffres sont partagés (un seul joueur à la fois), les blocs posés et cassés, les explosions et les créatures sont vus par tous.
- **Sauvegarde** : la progression de chaque invité (position, inventaire, statistiques) est rangée dans la sauvegarde de l'hôte, sous son pseudo, et retrouvée quand il revient. La partie solo de l'invité sur son propre appareil n'est pas touchée.
- **Limites** : la partie n'existe que tant que l'hôte a le jeu ouvert et au premier plan (sur téléphone, verrouiller l'écran met la partie en pause pour tout le monde). Certains réseaux très fermés (Wi-Fi d'école ou d'entreprise) peuvent bloquer la connexion directe ; PeerJS fournit un relais de secours, sinon essaie un autre réseau (la 4G par exemple).

## Mécaniques

| Mécanique | Dans CraftMine |
| --- | --- |
| 🍗 **Faim** | Comme dans Minecraft : 10 cuisses, saturation et épuisement. Courir, sauter, nager, miner, se battre et la ruée font baisser la faim. Faim presque pleine : la vie remonte seule. Faim à zéro : on perd de la vie. Sous 3 cuisses, plus de course ni de ruée. Sous l'eau, des bulles d'air remplacent l'ancien souffle. |
| 🌾 **Cultures** | Des graines dans les herbes hautes, une houe pour labourer, du blé qui pousse au soleil, du pain. La poudre d'os fait pousser instantanément blé, pousses d'arbre et fleurs. |
| 🪝 **Grappin** | 3 lingots de fer + 2 cordes. Clic droit sur un bloc jusqu'à 34 blocs : tu es tiré vers lui en gardant ton élan. |
| 💨 **Ruée et double saut** | `F` lance une ruée (plus de dégâts si tu frappes pendant). Elle se dirige en direct : tourne la caméra ou change de touche pendant la ruée, et même l'élan en l'air qui suit prend le virage. L'*Amulette de plume* donne un double saut. |
| 🔥 **Combo de minage** | Casser des blocs à la suite accélère le minage. À partir de x5, les minerais peuvent donner un double butin. |
| ⭐ **Maîtrise des outils** | Les outils ne s'usent jamais : ils gagnent de l'expérience et montent jusqu'à ★★★★★. 7 matériaux (bois, pierre, or, fer, cristal, diamant, netherite) et 5 types (pioche, hache, pelle, épée, houe). Hache en fer : abat l'arbre entier. Pioche de cristal : mine tout le filon. |
| 📖 **Fabrication sans grille** | Un livre de plus de 400 recettes, avec recherche et catégories (Outils, Blocs, Déco, Objets, Nourriture). Certaines demandent un **établi**, une **forge / un fourneau** ou une **table de forgeron** à moins de 4 blocs. |
| 🌑 **Les Ombres** | La nuit et dans les grottes sombres. Une vague apparaît à la tombée de la nuit ; leur nombre dépend de la difficulté et des jours passés. Elles brûlent au soleil et refusent d'entrer dans la lumière des torches. |
| 🎨 **Mode créatif** | Vol, blocs infinis, minage instantané, onglet *Créatif* avec tous les blocs et objets (recherche + catégories). Changeable en pause > Options > Jeu. |
| 💥 **TNT** | S'allume au briquet (ou avec une torche) et explose en réaction en chaîne. |
| ☀ **Objectif final** | Forger le **Cœur d'aube** (4 éclats célestes, 4 essences d'ombre, 4 cristaux, 2 lingots de fer) et le poser : il chasse définitivement les Ombres alentour. |

Un **journal de quêtes** guide la progression (désactivable dans les Options) :
bois → établi → pioche → pierre → torches → forge → fer → grappin → cristal → essence d'ombre → îles célestes → Cœur d'aube.

## Contenu

- **503 blocs**, 98 objets et 413 recettes, dont :
  - 16 couleurs de laine, tapis, béton, poudre de béton (devient du béton au contact de l'eau), terre cuite, terre cuite émaillée et verre teinté ;
  - 12 essences de bois (chêne, bouleau, sapin, acacia, acajou, saule, bois cristallin, chêne noir, cerisier, palétuvier, carmin, biscornu) avec bûches écorcées, bois, planches, feuilles et pousses, plus le bambou ;
  - pierres : pierre lisse, taillée, fissurée, sculptée, granite/diorite/andésite polis, ardoise des abîmes (et ses briques, tuiles…), tuf, calcite, spéléothème, pierre noire, basalte, obsidienne ;
  - Nether et End : roche et briques du Nether, quartz, sable et terre des âmes, pierre lumineuse, magma, nylium, pierre de l'End, purpur, prismarine, lanterne aquatique ;
  - 55 dalles (deux dalles l'une sur l'autre redonnent le bloc plein) ;
  - minerais de charbon, fer, cuivre, or, lapis-lazuli, redstone, diamant, émeraude, rubis, cristal, quartz, or du Nether, débris antiques et éclats célestes (et leurs versions dans l'ardoise des abîmes), blocs de métal et de minerai brut, cuivre oxydé ;
  - décoration : bibliothèque, TNT, fourneau, haut fourneau, fumoir, tonneau, ruche, juke-box, bloc musical (joue des notes), cible, tables de cartographie/d'archerie/de forgeron, métier à tisser, grenouillampes, champilampe, lampe à redstone, lanterne des âmes, éponge, blocs de slime et de miel, coraux, sculk, champignons géants ;
  - plantes : 19 fleurs, fougère, herbes, canne à sucre, bambou, azalées, racines du Nether, gorgones, blé.
- **Monde infini** (graine au choix, 96 blocs de haut) avec **25 biomes** : plaines, prairie fleurie, forêt, forêt de bouleaux, forêt de chênes noirs, bosquet de cerisiers, taïga, taïga enneigée, toundra, pics de glace, savane, jungle, bambouseraie, marais, mangrove, désert, canyon rouge, montagnes, champignonnière, terres volcaniques, forêt fongique, Sylve cristalline, océan, océan chaud (récifs de corail) et lacs.
- Géodes d'améthyste, sculk dans les profondeurs, ruines (en pierre, en grès, en pierre noire ou en prismarine sous l'océan) avec un coffre de butin, îles célestes et îles de l'End avec un sanctuaire de purpur.
- Éclairage par propagation (ciel + blocs), occlusion ambiante, cycle jour/nuit, nuages, eau animée, glace et verre translucides, feuillage qui ondule.
- Créatures : *Mouflons* (viande, laine, cuir), *Sangliers* (viande, cuir ; ils chargent si on les attaque), *Pingouins* (plumes) et *Ombres* (essence d'ombre).
- Amulettes : plume (double saut), satiété (la faim baisse deux fois moins vite), rubis (+2 cœurs).
- Le monde est découpé en tronçons de 16 × 16 blocs, générés à la volée autour du joueur. Chaque modification est enregistrée et réappliquée quand on revient.

## Paramètres

**Options** (menu principal ou pause) est organisé en onglets :

- **Graphismes** : distance d'affichage (3 à 16 tronçons), champ de vision, luminosité, résolution de rendu, limite d'images par seconde, particules, éclairage doux, feuillage qui ondule, nuages, balancement de la vue, champ de vision dynamique, main visible.
- **Contrôles** : sensibilité, axe inversé, course en un appui, saut automatique, contrôles tactiles (auto / activés / désactivés), sensibilité tactile, taille et opacité des boutons, visée au doigt ou au centre, **éditeur de disposition des boutons tactiles**, **réaffectation de toutes les touches**.
- **Jeu** : mode de jeu et difficulté du monde en cours, durée d'une journée, garder l'inventaire à la mort, objectifs à l'écran, fréquence de sauvegarde automatique.
- **Audio** : volume général, blocs et actions, créatures, interface.
- **Interface** : taille de l'interface, réticule, notifications, coordonnées, images par seconde, nom du biome, nom de l'objet en main.

## Structure du code

```
index.html        page, interface (HUD, inventaire, menus)
style.css         styles de l'interface
js/util.js        maths, bruit simplex, matrices
js/zip.js         lecture/écriture de fichiers .zip (export/import des sauvegardes)
js/blocks.js      blocs, objets, outils, recettes (identifiants 16 bits)
js/textures.js    textures pixel-art générées + icônes
js/world.js       monde infini par tronçons : génération, biomes, lumière, lancer de rayon
js/mesher.js      maillage des sections 16×16×16 (AO, lumière douce, dalles, translucides)
js/renderer.js    rendu WebGL2 (monde, ciel, entités, eau)
js/entities.js    physique, créatures, TNT, objets au sol, particules
js/player.js      joueur : déplacements, faim, minage, combat, grappin, mode créatif…
js/touch.js       contrôles tactiles : joystick, caméra au doigt, boutons
js/net.js         multijoueur pair à pair : hôte, invités, synchronisation, tchat
js/vendor/        PeerJS 1.5.5 (licence MIT), chargé seulement en multijoueur
js/inventory.js   inventaire et fabrication
js/ui.js          interface, inventaire créatif, options, journal, aide
js/audio.js       effets sonores WebAudio
js/main.js        boucle de jeu, jour/nuit, sauvegarde, entrées
```
