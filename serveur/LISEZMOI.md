# Serveur CraftMine

Un monde CraftMine ouvert **24 h/24** sur une machine louée (VPS). Les joueurs le rejoignent avec le
bouton **« Serveur »** du menu principal : pas de code à taper, et chacun retrouve ses constructions
et son inventaire à chaque visite.

Le jeu tourne sur la machine dans un navigateur invisible (Chromium), sans image ni son. Il est
l'hôte permanent de la partie : tout le multijoueur de CraftMine marche comme d'habitude. La mise en
relation passe par le même service que les parties entre amis, donc **aucun port à ouvrir et aucun
nom de domaine** ne sont nécessaires.

Pour les joueurs en 4G/5G (les opérateurs empêchent souvent la connexion directe), l'installation
ajoute un **relais** sur la machine (coturn, port 443 en TCP et 3478) : il ne relaie que vers le
serveur. Si un joueur en 4G n'arrive toujours pas à se connecter, vérifie dans le panneau IONOS que
le pare-feu de la machine laisse passer le port **443 (TCP)**, et si possible **3478 (UDP et TCP)**.

## Installation (Ubuntu 22.04 ou 24.04, 1 cœur et 2 Go de mémoire suffisent)

1. Connecte-toi à la machine depuis ton ordinateur (Windows : ouvre **PowerShell**) :

   ```
   ssh root@ADRESSE_IP_DE_LA_MACHINE
   ```

   Tape `yes` à la première connexion, puis le mot de passe (il ne s'affiche pas pendant la frappe,
   c'est normal).

2. Colle cette commande et appuie sur Entrée :

   ```
   curl -fsSL https://craftmine16.vercel.app/serveur/installer.sh | bash
   ```

   L'installation prend 5 à 10 minutes. À la fin, elle affiche le **mot de passe administrateur**.

3. C'est tout : le serveur démarre, et redémarre tout seul si la machine redémarre ou si le jeu
   plante. Il se met aussi à jour tout seul quand une nouvelle version de CraftMine sort.

## Les commandes de la machine

| Commande | Ce qu'elle fait |
| --- | --- |
| `craftmine journal` | Voir ce qui se passe : arrivées, tchat, erreurs (Ctrl+C pour quitter) |
| `craftmine etat` | En marche ? Qui est connecté ? |
| `craftmine cmd /annonce Salut !` | Taper une commande du jeu en tant que serveur (`/bannir`, `/temps midi`, `/meteo clair`…) |
| `craftmine config` | Changer les réglages (voir ci-dessous), puis redémarrage automatique |
| `craftmine motdepasse` | Afficher le mot de passe administrateur |
| `craftmine redemarrer` · `arreter` · `demarrer` | Contrôler le serveur |
| `craftmine sauvegardes` | Copies du monde (une par heure, 3 jours gardés) |
| `craftmine nouveau-monde` | Recommencer avec un nouveau monde (l'ancien est gardé) |
| `craftmine mettre-a-jour` | Réinstaller la dernière version du serveur |

## Réglages (`craftmine config`)

Dans l'éditeur : flèches pour se déplacer, **Ctrl+O** puis **Entrée** pour enregistrer, **Ctrl+X** pour
quitter (le serveur redémarre alors tout seul). Garde les guillemets autour des textes, et une virgule à
la fin de chaque ligne sauf la dernière.

| Réglage | Valeurs |
| --- | --- |
| `nom` | Nom du serveur dans le tchat |
| `graine` | Graine du monde (vide : au hasard). Seulement pour un nouveau monde |
| `type` | `normal`, `ville`, `plat`, `archipel`, `amplifie`. Seulement pour un nouveau monde |
| `mode` | `survie` ou `creatif` |
| `difficulte` | `paisible`, `facile`, `normal`, `difficile` |
| `extensions` | Liste parmi `lumiere`, `electricite`, `armes`, `vehicules`, `gravite`, par exemple `["lumiere", "vehicules", "armes"]`. S'applique aussi au monde déjà créé, au redémarrage (les minerais de l'Électricité apparaissent partout, sauf là où des blocs ont été modifiés) |
| `triches` | `true` : tout le monde peut utiliser les commandes de triche |
| `pvp` | `true` : combats entre joueurs |
| `garderInventaire` | `true` : on garde son inventaire à la mort |
| `maxJoueurs` | Nombre de joueurs en même temps (10 par défaut, 20 au plus) |
| `pauseVide` | `true` (par défaut) : au bout d'une minute sans joueur, le monde se fige (heure, cultures, créatures) et la machine se repose ; il repart dès qu'un joueur arrive. `false` : il tourne tout le temps |
| `motDePasseAdmin` | Mot de passe de `/admin` (4 caractères au moins) |

`graine` et `type` servent seulement à la création du monde (`craftmine nouveau-monde`). Tous les
autres s'appliquent au redémarrage, même sur le monde déjà créé (le journal affiche les extensions
actives, et prévient si un nom est mal écrit).

Ces réglages (sauf le mot de passe, la graine et le type) se changent aussi **depuis le jeu**, dans le
panneau d'administration : ils sont alors écrits dans `config.json`. En revanche, un `/mode` ou
`/difficulte` tapé dans le tchat ne dure que jusqu'au prochain redémarrage.

## Administrateurs

Dans le jeu, ouvre **Pause → 🛡 Administration** et tape le mot de passe (ou tape
**`/admin MOT_DE_PASSE`** dans le tchat). Personne d'autre ne voit le mot de passe. Après 3 essais
faux, il faut attendre une minute.

Le panneau d'administration permet ensuite, sans passer par la machine :

- **Joueurs connectés** : aller vers eux, les faire venir, les nommer administrateurs (ils le
  restent aux connexions suivantes), les expulser ou les bannir ; **débannir** ;
- **Pseudos et terrains** : chaque pseudo est réservé à l'appareil qui l'a utilisé en premier (ou à
  son mot de passe, menu G → Compte) ; **libérer** celui d'un joueur qui a changé d'appareil sans
  mot de passe ; nombre de tronçons protégés par joueur ;
- **Réglages** : nom du serveur, mode, difficulté, nombre de joueurs, joueurs couchés pour passer
  la nuit (0 = tout le monde), PvP, garder l'inventaire,
  triches pour tous, extensions (au prochain redémarrage). Ils sont enregistrés dans `config.json` ;
- **Monde** : heure, météo, annonce à tous, sauvegarde, **redémarrage du serveur** ;
- **Copies du monde** : la liste des copies (une par heure, gardées 3 jours), **faire une copie
  maintenant**, et **revenir** à une copie (deux appuis) : le serveur redémarre avec le monde de ce
  moment-là, et le monde d'avant est gardé (`sauvegardes/avant-restauration-…`). En commande :
  `/sauvegardes`, `/sauvegardes copier`, `/sauvegardes restaurer <numéro>`.

Les commandes de l'hôte marchent aussi dans le tchat : `/serveur` (réglages), `/nommeradmin`,
`/retireradmin`, `/expulser`, `/bannir`, `/debannir`, `/liberer`, `/donnerpieces`, `/triche`, `/regle`…

Le programme du serveur (`serveur.js`) se met à jour tout seul avec le jeu. S'il date d'avant le
panneau d'administration, lance une fois `craftmine mettre-a-jour` pour que les réglages changés
depuis le jeu soient enregistrés.

## Fichiers (dans `/opt/craftmine`)

- `config.json` : les réglages
- `monde.json` : le monde et la progression de chaque joueur (enregistré chaque minute et à l'arrêt)
- `sauvegardes/` : une copie par heure
- `serveur.js` : le programme du serveur
