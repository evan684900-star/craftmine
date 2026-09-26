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
| **Clic droit** | Poser un bloc, ouvrir la table d'enchantement ou l'enclume, allumer un feu (briquet), enfiler une armure, manger (maintenir 1 s), utiliser un outil (écorcer, labourer), semer, nourrir un animal, lancer le grappin, ouvrir un coffre |
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
| Toucher un bloc | Poser un bloc contre lui, l'utiliser (coffre, établi…), manger (le repas continue tout seul pendant 1 s), ou frapper la créature touchée |
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
| 🌾 **Agriculture** | Houe pour labourer, puis blé, carottes, pommes de terre, betteraves, citrouilles et pastèques. La terre labourée à 4 blocs ou moins d'une eau devient **irriguée** (plus sombre) : les cultures y poussent 2,5 fois plus vite ; sèche et vide, elle redevient de la terre. Le **seau** (3 lingots de fer) ramasse et verse l'eau ; versée juste avant de toucher le sol, elle annule les dégâts de chute (**MLG**). Les tiges adultes font pousser leur citrouille ou pastèque sur une case voisine. Poudre d'os pour accélérer. Nouvelles recettes : pomme de terre cuite, soupe de betterave, carotte dorée, graines, bloc de pastèque, teintures. |
| 🐑 **Élevage** | Clic droit sur un animal avec sa nourriture (blé : mouflon ; carotte, pomme de terre ou betterave : sanglier) : il devient amoureux, rejoint un autre animal nourri et ils ont un petit, qui grandit en 5 minutes. Les animaux suivent le joueur qui tient leur nourriture. Les animaux nourris ne disparaissent plus et sont gardés dans la sauvegarde. |
| 🛡 **Armures** | Cuir, or, fer, diamant et netherite : casque, plastron, jambières et bottes (5 / 8 / 7 / 4 matériaux à l'Établi ; netherite = pièce en diamant + lingot de netherite à la table de forgeron). On les enfile par clic droit en main, Maj+clic ou dans les 4 cases d'armure de l'inventaire. Protection et robustesse comme dans Minecraft (jusqu'à 80 % de dégâts en moins contre les créatures, les explosions et les autres joueurs ; rien contre la chute, la faim ou la noyade). L'armure **s'use** à chaque coup reçu et casse à 0 (avertissement à 10 %). Au-dessus des cœurs, des icônes montrent la protection ; en bas à droite, un panneau liste les pièces portées avec leur durabilité. Visible sur les autres joueurs en multijoueur. En vente chez le forgeron et le boucher des villages, et dans certains coffres. |
| ✨ **Expérience** | Une barre verte avec le niveau, au-dessus de la barre d'objets (comme dans Minecraft). On en gagne en minant charbon, diamant, émeraude, lapis, redstone, quartz, cristal et rubis (pas avec Toucher de soie), en tuant des Ombres et des animaux, en échangeant avec les villageois, en faisant naître des petits et en fondant à la forge. Perdue à la mort, sauf si l'inventaire est conservé. |
| 📚 **Enchantements** | **Table d'enchantement** (1 livre + 2 diamants + 4 obsidiennes à l'Établi), avec un livre qui flotte et s'ouvre quand on approche. On y pose un outil, une épée ou une pièce d'armure : 3 offres tirées comme dans Minecraft, qui coûtent 1 à 3 lapis-lazuli et autant de niveaux (il faut au moins le niveau affiché). Jusqu'à 15 **bibliothèques** autour (à 2 blocs, avec de l'air entre) donnent des offres jusqu'au niveau 30. Les plus importants de Minecraft, sur les mêmes objets : **Efficacité**, **Fortune**, **Toucher de soie** (pioche, hache, pelle, houe) ; **Tranchant**, **Recul**, **Aura de feu** (viande cuite), **Butin** (épée ; Tranchant aussi sur la hache) ; **Protection**, **Solidité**, **Épines** (plastron), **Chute amortie** (bottes), **Apnée** (casque). Les outils ne s'usant jamais, Solidité ne concerne que les armures. Objets enchantés : reflet violet, liste dans l'info-bulle, synchronisés en multijoueur ; parfois dans les coffres des ruines. |
| 🔨 **Enclume** | 3 blocs de fer + 4 lingots de fer à l'Établi. Répare une armure avec son matériau (cuir, or, fer, diamant, netherite : 25 % de durabilité par unité) ou fusionne deux objets identiques (durabilités additionnées + 12 %, enchantements réunis : deux niveaux égaux donnent le niveau au-dessus). Coûte des niveaux d'expérience ; 40 ou plus : « Trop cher ! ». |
| 💧 **Eau qui coule** | Comme dans Minecraft : l'eau s'étale sur 7 blocs, tombe sans limite, va vers le trou le plus proche (4 blocs) ; deux sources voisines en créent une nouvelle. Elle emporte plantes et torches, éteint le feu, et son courant entraîne joueurs, créatures et objets. Seules les sources se ramassent au seau. Les lacs et océans existants ne bougent que si l'on touche à leurs bords. |
| 🌋 **Lave** | Elle coule comme l'eau mais lentement, sur 3 blocs (7 dans le Nether), éclaire, brûle (4 points par demi-seconde, puis 15 s en feu), ralentit, détruit les objets (sauf la netherite) et peut mettre le feu au bois voisin. Source + eau = **obsidienne** ; lave qui coule + eau = galets ; lave qui tombe dans l'eau = pierre. Le seau la ramasse et la reverse. Lacs de lave au fond des cavernes (y ≤ −55), mares dans les terres volcaniques (mondes récents), océan de lave dans le Nether. |
| 🌀 **Nether** | Cadre d'obsidienne (intérieur de 2 × 3 à 21 × 21, coins facultatifs) allumé au briquet ; rester 3,5 s dans le portail (1 s en créatif) pour voyager. Coordonnées ÷ 8 : le portail d'arrivée est retrouvé (16 blocs autour dans le Nether, 128 dans le monde normal) ou construit, avec une plateforme si besoin. Le Nether : cavernes entre un sol et un plafond de bedrock, océan de lave sous y = 31, 5 biomes (désolation, forêts carmin et biscornue, vallée des âmes, deltas de basalte), brume colorée, pierre lumineuse, quartz, or du Nether, débris antiques, **forteresses** (donjon + ponts, coffre de butin) et **Ombres ardentes** (insensibles au feu, sans peur de la lumière, elles enflamment). Casser le cadre éteint le portail ; l'eau s'évapore, les lits explosent. Mort dans le Nether : retour au lit ou au départ du monde normal. Sauvegarde des deux mondes. En multijoueur, chacun voyage seul, comme dans Minecraft : l'hôte fait vivre les deux mondes en même temps (créatures, lave, feu) tant qu'un joueur s'y trouve, on ne voit que les joueurs de sa dimension, et un invité qui se reconnecte revient dans la dimension où il était. |
| 🔥 **Feu** | Le briquet allume un feu sur n'importe quel bloc solide (et amorce toujours la TNT). Le feu brûle et se propage dans le bois, les feuilles, la laine, les tapis, les herbes, les bibliothèques et le foin (Options > Jeu pour désactiver la propagation), s'éteint seul sur un bloc qui ne brûle pas, brûle éternellement sur la roche du Nether et le magma. Il enflamme joueurs et créatures (l'eau les éteint ; viande cuite avec Aura de feu), détruit les objets au sol et amorce la TNT voisine. |
| 🍞 **Manger** | Tout aliment se mange en 1 seconde (clic droit maintenu ; sur téléphone un toucher suffit). On avance lentement pendant le repas ; relâcher avant la fin annule. |
| 🪝 **Grappin** | 3 lingots de fer + 2 cordes. Clic droit sur un bloc jusqu'à 34 blocs : tu es tiré vers lui en gardant ton élan. |
| 💨 **Ruée et double saut** | `F` lance une ruée (plus de dégâts si tu frappes pendant). Elle se dirige en direct : tourne la caméra ou change de touche pendant la ruée, et même l'élan en l'air qui suit prend le virage. L'*Amulette de plume* donne un double saut. |
| 🔥 **Combo de minage** | Casser des blocs à la suite accélère le minage. À partir de x5, les minerais peuvent donner un double butin. |
| ⭐ **Maîtrise des outils** | Les outils ne s'usent jamais : ils gagnent de l'expérience et montent jusqu'à ★★★★★. 7 matériaux (bois, pierre, or, fer, cristal, diamant, netherite) et 5 types (pioche, hache, pelle, épée, houe). Hache en fer : abat l'arbre entier. Pioche de cristal : mine tout le filon. |
| 📖 **Fabrication sans grille** | Un livre de plus de 400 recettes, avec recherche et catégories (Outils, Blocs, Déco, Objets, Nourriture). Certaines demandent un **établi**, une **forge / un fourneau** ou une **table de forgeron** à moins de 4 blocs. |
| 🌑 **Les Ombres** | La nuit et dans les grottes sombres. Une vague apparaît à la tombée de la nuit ; leur nombre dépend de la difficulté et des jours passés. Elles brûlent au soleil et refusent d'entrer dans la lumière des torches. |
| 🎨 **Mode créatif** | Vol, blocs infinis, minage instantané, onglet *Créatif* avec tous les blocs et objets (recherche + catégories). Changeable en pause > Options > Jeu. |
| 💥 **TNT** | S'allume au briquet (ou avec une torche) et explose en réaction en chaîne. |
| 🔴 **Redstone** | Tout comme dans Minecraft, simulé à 20 ticks par seconde : poudre (15 blocs), torches (inverseurs, grillent si on les fait clignoter trop vite), leviers, boutons, plaques de pression (4 sortes), répéteurs (délai, verrouillage), comparateurs (comparer / soustraire, lecture des conteneurs), observateurs, pistons et pistons collants (12 blocs, slime et miel), distributeurs, droppers, entonnoirs, lampes, ampoules de cuivre, capteurs de lumière du jour, crochets et fils de déclenchement, cibles, capteurs de sculk, coffres piégés, portes et trappes en fer, bloc musical et TNT. |
| 🛤 **Rails et wagonnets** | Rails qui se raccordent tout seuls (virages, montées), rails de propulsion, détecteurs et activateurs ; wagonnets (on monte dedans), de stockage, de TNT et à entonnoir. Les entonnoirs et les comparateurs communiquent avec les wagonnets. |
| 🏹 **Arc et flèches** | Arc à bander (1 s pour la pleine puissance), flèches qui se plantent et se ramassent, qui activent les cibles et les boutons en bois ; les distributeurs tirent aussi des flèches. |
| ⚡ **Extension Électricité** | À cocher en créant le monde (inspirée du mod Create, en plus simple). Minerais de zinc, d'étain, de bauxite et de lithium ; laiton, bronze, silicium, circuits, moteurs. Câbles, panneaux solaires, éoliennes (plus hautes = plus de vent), roues à eau, générateurs à charbon, manivelle, batteries, lampes électriques et néons de 8 couleurs, broyeur (double les minerais), four électrique, foreuse qui avance en creusant un tunnel (elle ramasse sa récolte et pose des câbles derrière elle), tapis roulants, ventilateurs (ascenseurs à air vers le haut), multimètre et clé à molette. Aussi : panneau solaire avancé, générateur géothermique, bobine Tesla (foudroie les Ombres), ascenseur électrique, aspirateur, moissonneuse automatique, lampadaire, et des outils rechargeables au Chargeur (perceuse électrique, tronçonneuse, lampe torche, pistolet laser). Un signal de redstone arrête les machines. |
| 🧱 **Extension Gravité réaliste** | À cocher en créant le monde. **Tous** les blocs obéissent à la gravité, terrain naturel compris : chaque matériau supporte un porte-à-faux limité (métal 7 blocs, roche naturelle et minerais 6, bois et feuilles 5, pierre taillée, pavés et briques 4, glace 3, terre, neige et laine 2, verre 1 ; sable, gravier et poudre de béton : aucun) et chaque couche peut dépasser un peu plus que celle du dessous. Ce qui ne tient plus tombe **d'un seul morceau** jusqu'au premier appui (un arbre dont on creuse le pied tombe entier dans le trou, un plafond trop large s'écroule, un pont perd son pilier…), en chaîne, blesse ce qu'il écrase ; le verre, la glace et les feuilles se brisent, un coffre garde son contenu. Les arbres sont d'un seul tenant (troncs coudés, feuilles pendantes). Le terrain généré qui ne tiendrait pas reste en place tant qu'on n'y touche pas. Les extensions sont toutes décochées par défaut. |
| ✋ **Deuxième main et 🛡 bouclier** | Case « main secondaire » dans l'inventaire (touche X pour échanger les mains) : une torche y éclaire en permanence, et avec un outil en main le clic droit pose le bloc de la main secondaire. Bouclier (6 planches + 1 fer) : clic droit maintenu pour le lever, il arrête les coups venus de devant (créatures, flèches, joueurs, explosions) et s'use. Visible par les autres joueurs. |
| 🔥 **Flammes animées** | Le feu et les flammes des torches (normales, des âmes, de redstone) sont animés sur 8 images. |
| 💡 **Extension Lumière réaliste** | Lumière colorée (torches orangées, redstone rouge, néons, lanternes des âmes…), flammes qui vacillent, halos la nuit, fumée des torches, lumière des torches qui s'ajoute à celle du jour, lumière tenue en main colorée. Cochée par défaut à la création du monde, désactivable dans les Options. |
| ☀ **Objectif final** | Forger le **Cœur d'aube** (4 éclats célestes, 4 essences d'ombre, 4 cristaux, 2 lingots de fer) et le poser : il chasse définitivement les Ombres alentour. |

Un **journal de quêtes** guide la progression ; on le masque (et on le remet) avec le bouton « Masquer le guide » du menu Pause, la croix du panneau ou les Options :
bois → établi → pioche → pierre → torches → forge → fer → grappin → cristal → essence d'ombre → îles célestes → Cœur d'aube.

## Contenu

- **584 blocs**, 163 objets et 546 recettes (dont 42 blocs et 64 recettes de l’extension Électricité), dont :
  - 16 couleurs de laine, tapis, béton, poudre de béton (devient du béton au contact de l'eau), terre cuite, terre cuite émaillée et verre teinté ;
  - 12 essences de bois (chêne, bouleau, sapin, acacia, acajou, saule, bois cristallin, chêne noir, cerisier, palétuvier, carmin, biscornu) avec bûches écorcées, bois, planches, feuilles et pousses, plus le bambou ;
  - pierres : pierre lisse, taillée, fissurée, sculptée, granite/diorite/andésite polis, ardoise des abîmes (et ses briques, tuiles…), tuf, calcite, spéléothème, pierre noire, basalte, obsidienne ;
  - Nether et End : roche et briques du Nether, quartz, sable et terre des âmes, pierre lumineuse, magma, nylium, pierre de l'End, purpur, prismarine, lanterne aquatique ;
  - 55 dalles (deux dalles l'une sur l'autre redonnent le bloc plein) ;
  - minerais de charbon, fer, cuivre, or, lapis-lazuli, redstone, diamant, émeraude, rubis, cristal, quartz, or du Nether, débris antiques et éclats célestes (et leurs versions dans l'ardoise des abîmes), blocs de métal et de minerai brut, cuivre oxydé ;
  - décoration : bibliothèque, TNT, fourneau, haut fourneau, fumoir, tonneau, ruche, juke-box, bloc musical (joue des notes), cible, tables de cartographie/d'archerie/de forgeron, métier à tisser, grenouillampes, champilampe, lampe à redstone, lanterne des âmes, éponge, blocs de slime et de miel, coraux, sculk, champignons géants ;
  - plantes : 19 fleurs, fougère, herbes, canne à sucre, bambou, azalées, racines du Nether, gorgones, blé.
- **Monde infini** (graine au choix, 160 blocs de haut : de y = −64, le socle, à y = 95) avec **25 biomes** : plaines, prairie fleurie, forêt, forêt de bouleaux, forêt de chênes noirs, bosquet de cerisiers, taïga, taïga enneigée, toundra, pics de glace, savane, jungle, bambouseraie, marais, mangrove, désert, canyon rouge, montagnes, champignonnière, terres volcaniques, forêt fongique, Sylve cristalline, océan, océan chaud (récifs de corail) et lacs — plus le **Nether** et ses 5 biomes, derrière un portail d'obsidienne.
- **Profondeurs** (sous y = 0, comme dans Minecraft) : ardoise des abîmes et tuf, grandes cavernes, diamants et redstone plus fréquents, lapis, or, fer, cristal, un peu de cuivre, de rares débris antiques, zones de sculk, géodes profondes et sol de magma près du socle. Les anciens mondes gagnent aussi ces couches : seul leur socle en y = 0 disparaît, tout le reste (constructions comprises) reste en place.
- Géodes d'améthyste, sculk dans les profondeurs, ruines (en pierre, en grès, en pierre noire ou en prismarine sous l'océan) avec un coffre de butin, îles célestes et îles de l'End avec un sanctuaire de purpur.
- **Villages** (plaines, prairies, forêts, bouleaux, cerisiers, taïga, taïga enneigée, toundra, savane, désert) : un puits sur la place, des chemins, des lampadaires, des maisons dans le bois du biome (grès à toits plats dans le désert, toits enneigés dans le froid), des grandes maisons, des champs irrigués (blé, et dans les mondes récents carottes, pommes de terre et betteraves), une forge et une bibliothèque. Certaines maisons ont un coffre (celui du forgeron est mieux garni). L'indicateur de biome affiche « · Village » quand on y entre. Les villages apparaissent dans les mondes créés à partir de cette version (les anciens mondes ne changent pas, pour ne pas abîmer les constructions).
- **Villageois** : ils vivent autour de leur village et y reviennent s'ils s'en éloignent. Clic droit (ou toucher sur téléphone) pour **échanger** : chacun a un métier (fermier, forgeron, bibliothécaire, berger, boucher, prêtre) et achète tes récoltes, ta viande, ton charbon, ton papier, ta laine ou tes essences d'ombre contre des **émeraudes**, qu'il échange ensuite contre du pain, des outils en fer, une pioche en diamant, des lanternes, de la laine colorée, un rubis…
- **Torches** posées au sol ou accrochées au mur visé, penchées comme dans Minecraft ; une torche murale tombe si on casse son mur.
- **Hitbox précises** : torches, fleurs, herbes, cultures, portes, lits, dalles et tapis ont une boîte de visée et de collision à leur vraie taille (on vise le bloc derrière une fleur, on passe à côté d'une porte ouverte, on s'arrête contre le battant d'une porte fermée).
- **Portes** (chêne, sapin, bouleau, acacia ; 6 planches → 3 portes à l'Établi) : clic droit pour ouvrir ou fermer. Une porte se pose sur deux blocs de haut et s'oriente selon ton regard ; les maisons des villages en ont une.
- **Lit** (3 laines + 3 planches à l'Établi) : clic droit dessus pour en faire ton **point de réapparition** ; la nuit, tu t'y couches et passes directement au matin. En multijoueur, le jour se lève quand tous les joueurs sont couchés. Impossible de dormir si des Ombres rôdent tout près. Chaque maison de village a un lit.
- **Golem de fer** : il garde les villages assez peuplés et chasse les Ombres alentour. Tu peux en construire un : 4 blocs de fer en forme de T (deux l'un sur l'autre, un de chaque côté en haut), puis une citrouille (sculptée, lanterne-citrouille ou normale) posée dessus. Il reste près de l'endroit où il a été construit (même après avoir quitté la partie). Il est costaud (100 PV) et se venge si on le frappe, lui ou un villageois !
- Éclairage par propagation (ciel + blocs), occlusion ambiante, cycle jour/nuit, nuages, eau animée, glace et verre translucides, feuillage qui ondule.
- Créatures : *Mouflons* (viande, laine, cuir), *Sangliers* (viande, cuir ; ils chargent si on les attaque), *Pingouins* (plumes), *Villageois* (échanges), *Golems de fer* (protecteurs, lingots de fer), *Ombres* (essence d'ombre) et, dans le Nether, *Ombres ardentes* (quartz, or, poudre lumineuse).
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
js/world.js       monde infini par tronçons : génération (monde normal et Nether), biomes, lumière, lancer de rayon
js/blockticks.js  blocs qui évoluent seuls : eau et lave qui coulent, feu, portails cassés
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
js/main.js        boucle de jeu, jour/nuit, dimensions et portails, sauvegarde, entrées
```
