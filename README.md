# PedaFlotta Web (portage de PedaFlotta V2.6)

Portage HTML/CSS/JavaScript du simulateur WPF PedaFlotta V2.6. Aucun serveur, aucune dépendance externe.
Fonctionne en ligne, hors ligne (PWA avec service worker) et en double-cliquant sur `index.html`.

## Fichiers

| Fichier | Rôle | Source d'origine |
|---|---|---|
| `model.js` | Physique (portage ligne à ligne) | `Model.cs` |
| `app.js` | Affichage, souris/tactile, score, paramètres | `MainWindow.xaml(.cs)`, `App.xaml` |
| `portrait.js` | Mode téléphone vertical | nouveau |
| `niveau2.html`, `niveau2.js` | Niveau 2 : remontée assistée | nouveau |
| `index.html`, `style.css` | Page et styles | `MainWindow.xaml`, `App.xaml` |
| `sw.js`, `manifest.webmanifest`, `icons/` | Mode hors ligne / installation | nouveau |
| `img/plongeur.png`, `img/Souris.png` | Images | `Resources/` |
| `img/diver_body.png`, `img/diver_up.png`, `img/diver_down.png` | Plongeur découpé pour le palmage | tirés de `plongeur.png` |

## Commandes (identiques à l'original)

- Clic gauche maintenu (hors boutons) ou bouton **Gilet** : gonflage du gilet.
- Clic droit maintenu ou bouton **Purge** : purge.
- Molette : volume moyen des poumons (±0,1 L, de 1,5 à 4,5 L). Double-clic sur le curseur = 3 L. Le curseur se glisse aussi (utile sur tablette).
- **Pause** : démarre / arrête la simulation (vert = arrêtée, comme l'original).
- **Graphique** : affiche la vitesse et le poumon sur le profil. **Restart**, **Paramètres** : comme l'original.

## Écarts par rapport à l'original

### Modifications demandées (14/10/2026)

- **Plongeur** : 80 kg et 80 L par défaut (81 kg / 77 L dans la V2.6). Les coefficients de frottement ne sont plus dans le panneau Paramètres (valeurs V2.6 conservées : 5 et 8).
- **Volume Max Poumon** : il règle l'échelle de l'oscilloscope et le volume pulmonaire maximal. Le curseur va de 1 L + amplitude à Volume Max − amplitude (1,5 à 4,5 L par défaut, comme avant).
- **Taille Bloc et Pression Initiale** : elles sont prises en compte. Le poids d'air initial vaut pression × volume × 0,0012 kg/L.
- **Poumons** : le volume du plongeur inclut la moitié du volume pulmonaire maximal. Seul l'écart du volume instantané à cette moitié s'ajoute à la poussée, à 100 %.
- **Combinaison** : volume paramétrable (6 L par défaut, 10 L en dur dans la V2.6). Un troisième oscilloscope (orange) montre son volume de flottaison, qui diminue avec la profondeur : V = V0 × (0,1 + 0,9 / P absolue), soit −45 % à 10 m et −60 % à 20 m (V2.6 : −10 % par bar). Valeur à 20 m choisie d'après Potočić Matković et al., *Polymers* 2025 (−64 % d'épaisseur à 200 kPa).
- **Paramètres** : le panneau couvre tout l'écran et arrête la simulation. Le bouton « Valider » le ferme et relance la plongée (Restart).
- **Écrans plus hauts que 16:9** (4:3, 16:10…) : le ciel est agrandi au lieu d'afficher des bandes noires. Sur un écran plus large, il reste des bandes sur les côtés.
- **Horloge** : la simulation avance par pas fixes de 10 ms, rattrapés sur l'horloge réelle. Le résultat ne dépend plus de la fréquence d'affichage. Si l'onglet est masqué ou l'appareil en veille, la simulation reprend sans saut.
  - Score : 100 points par seconde jusqu'à 5 cm d'écart au profil guide, puis décroissance linéaire jusqu'à 1 point par seconde à 20,05 m d'écart. Pénalité de −500 points à chaque nouvel appui sur le gonflage du gilet pendant la plongée.
  - Bulles : 5 par seconde en moyenne pendant l'expiration, montée de 15 px/s, grossissement de 1 px/s (valeurs V2.6 par tick ramenées à la seconde).
- **Fonds** : image de sable (rides, galets, algues) et ciel avec nuages légers (`img/sable.png`, `img/ciel.png`, dessinés pour le projet). En portrait, le sable défile avec le plongeur et les nuages plus lentement.
- **Plongeur** : il est centré sur la ligne du profil, au lieu d'être dessiné au-dessus. Il palme pendant la plongée : l'image est découpée en corps et deux jambes (`img/diver_*.png`), les jambes pivotent en opposition de ±6° à 0,8 Hz.

- **Téléphone tenu verticalement** (ajout web, fichier `portrait.js`) :
  - L'écran représente 1 minute de plongée. Le plongeur part de la gauche, puis reste à 25 % de la largeur pendant que le fond défile vers la gauche.
  - En bas, seuls les boutons Gilet et Purge. Jauge de vitesse à gauche, curseur poumon à droite, avec les oscilloscopes à 50 % d'opacité juste à côté.
  - Un appui démarre la plongée. En fin de plongée, un appui la relance.
  - Bouton Paramètres en haut à gauche (libellé et valeur sur la même ligne), vitesse verticale et masse apparente dessous ; horloge et profondeur au centre ; score en haut à droite. Gilet en violet clair pour rester lisible. Le graphique de vitesse n'existe qu'en paysage.

### Autres écarts

- Grille de l'oscilloscope gilet sur toute la hauteur (dans la V2.6, seulement la moitié haute).
- Tactile : un appui = gonflage. Sans clic droit, la purge passe par le bouton Purge.
- Molette : ±0,1 L partout.
- Sons non repris (aucun n'est joué dans le code V2.6).
- Virgule décimale dans les étiquettes, point dans le curseur et les paramètres.

### Comportements de la V2.6 conservés

- La vidange du bloc suit `PressionGonflage × (0,75 × (1 − t/360) + 0,25)`, avec 360 s codé en dur.
- Le mode « sport » est présent dans le modèle mais jamais activé.

## Niveau 2 : remontée assistée (prototype)

Page `niveau2.html` (fichier `niveau2.js`), accessible seulement par son lien : `https://<compte>.github.io/PedaFlotta/niveau2.html`.

- Vue subjective : on tient de la main gauche un plongeur face à nous. Il tient son inflateur en main au niveau du visage (bouton « Son inflateur »), « Sa purge » est sur son épaule droite. « Mon inflateur » en bas à gauche, « Ma purge » en bas à droite, jauge de vitesse tout à gauche (mêmes couleurs que le niveau 1). Profondeur, vitesse et durée dans un ordinateur de plongée dessiné en haut à gauche (boîtier gris, écran noir). Alarme de vitesse du profil : vitesse en rouge si ≥ 10 m/min au-delà de 10 m, ≥ 5 m/min de 10 m à la surface. Le bandeau du profil est transparent : le plongeur reste visible dessous.
- Deux instances de `model.js`, accrochées : même profondeur et même vitesse. Le mouvement vient de la somme des deux masses apparentes, sur la somme des deux masses, avec des frottements doublés (deux surfaces face à l'eau).
- Paramètres : profondeur de départ (20 m par défaut), masse, volume et lest de chacun des deux plongeurs.
- Au départ, les deux plongeurs sont équilibrés à la profondeur choisie (gilets gonflés juste ce qu'il faut). Le bouton **Go** lance la remontée.
- Son image monte ou descend selon l'écart de flottabilité (lui − moi), lissé sur 0,5 s. À l'équilibre, ses yeux sont au milieu de l'écran. 3 kg plus léger que moi : son menton arrive sous le bandeau. 3 kg plus lourd : son front arrive en bas de l'écran. Ses boutons restent à l'écran pour rester utilisables.
- Plongeur vu de près (tête de rayon 220 px logiques, deux fois le premier prototype).
- Bandeau du haut : profil de remontée cible (rouge) et trajectoire réelle (blanc). Profil : 5 s de décompte à la profondeur de départ, 10 m/min jusqu'à 10 m, 5 m/min ensuite, palier de 30 s à 3 m, puis 5 m/min jusqu'à la surface.
- Vitesse affichée (texte et jauge) filtrée par un passe-bas du premier ordre de demi-vie 1 s.
- Son inflateur est tenu par ma main droite (bras en combinaison noire) au niveau de son visage. Butées de l'image à ±5 kg d'écart.
- Score (en haut à droite) : −1 point par seconde et par m/min au-dessus de la vitesse du profil (10 m/min au-delà de 10 m, 5 m/min ensuite, vitesse filtrée) ; −10 points par gonflage à partir du deuxième appui (mon inflateur et le sien confondus) ; à la surface, +100 points si on arrive à l'heure du profil ou après, moins 2 points par seconde de retard, rien si on arrive trop tôt.
- Le bandeau couvre 4 minutes. Pas en surface à 4 min : game over.
- Molette : mon volume pulmonaire moyen. Multi-touch : on peut appuyer sur deux boutons à la fois.
- Fin à la surface : durée, vitesse maximale et temps passé au-dessus de la zone verte (4,8 m/min).

## Publier sur GitHub Pages

1. Créer un dépôt GitHub (par exemple `PedaFlotta`).
2. Y déposer **le contenu** de ce dossier `web` à la racine (Add file → Upload files).
3. Settings → Pages → Source : *Deploy from a branch*, branche `main`, dossier `/ (root)` → Save.
4. Le site est en ligne après une minute environ, à l'adresse `https://<compte>.github.io/PedaFlotta/`.
5. Pour l'utiliser hors ligne : ouvrir le site une fois en ligne. Ensuite, dans Chrome ou Edge, le bouton « Installer » de la barre d'adresse permet de le lancer comme une application.

Le service worker fonctionne en « réseau d'abord » : en ligne, la dernière version publiée est toujours chargée (et mise en cache) ; hors ligne, la copie en cache est servie. Modifier `CACHE` dans `sw.js` à chaque version reste conseillé pour purger les anciens fichiers.

Test local sans Internet : double-cliquer sur `index.html` suffit. Le mode installable demande en revanche http(s), par exemple `python -m http.server` dans ce dossier.
