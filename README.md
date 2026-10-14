# PedaFlotta Web (portage de PedaFlotta V2.6)

Portage HTML/CSS/JavaScript du simulateur WPF PedaFlotta V2.6. Aucun serveur, aucune dépendance externe.
Fonctionne en ligne, hors ligne (PWA avec service worker) et en double-cliquant sur `index.html`.

## Fichiers

| Fichier | Rôle | Source d'origine |
|---|---|---|
| `model.js` | Physique (portage ligne à ligne) | `Model.cs` |
| `app.js` | Affichage, souris/tactile, score, paramètres | `MainWindow.xaml(.cs)`, `App.xaml` |
| `portrait.js` | Mode téléphone vertical | nouveau |
| `index.html`, `style.css` | Page et styles | `MainWindow.xaml`, `App.xaml` |
| `sw.js`, `manifest.webmanifest`, `icons/` | Mode hors ligne / installation | nouveau |
| `img/plongeur.png`, `img/Souris.png` | Images | `Resources/` |

## Commandes (identiques à l'original)

- Clic gauche maintenu (hors boutons) ou bouton **Gilet** : gonflage du gilet.
- Clic droit maintenu ou bouton **Purge** : purge.
- Molette : volume moyen des poumons (±0,1 L, de 1,5 à 4,5 L). Double-clic sur le curseur = 3 L. Le curseur se glisse aussi (utile sur tablette).
- **Pause** : démarre / arrête la simulation (vert = arrêtée, comme l'original).
- **Graphique** : affiche la vitesse et le poumon sur le profil. **Restart**, **Paramètres** : comme l'original.

## Écarts par rapport à l'original

### Modifications demandées (14/10/2026)

- **Masse du plongeur** : 77 kg par défaut (81 kg dans la V2.6).
- **Poumons** : la masse apparente ne compte que la moitié du volume pulmonaire instantané dans la poussée.
- **Volume Max Poumon** : il règle l'échelle de l'oscilloscope et le volume pulmonaire maximal. Le curseur va de 1 L + amplitude à Volume Max − amplitude (1,5 à 4,5 L par défaut, comme avant).
- **Taille Bloc et Pression Initiale** : elles sont prises en compte. Le poids d'air initial vaut pression × volume × 0,0012 kg/L.
- **Combinaison** : volume paramétrable (6 L par défaut, 10 L en dur dans la V2.6). Un troisième oscilloscope (orange) montre son volume de flottaison, qui diminue avec la profondeur (10 % par bar).
- **Paramètres** : le panneau couvre tout l'écran et arrête la simulation. Le bouton « Valider » le ferme et relance la plongée (Restart).
- **Écrans plus hauts que 16:9** (4:3, 16:10…) : le ciel est agrandi au lieu d'afficher des bandes noires. Sur un écran plus large, il reste des bandes sur les côtés.
- **Horloge** : la simulation avance par pas fixes de 10 ms, rattrapés sur l'horloge réelle. Le résultat ne dépend plus de la fréquence d'affichage. Si l'onglet est masqué ou l'appareil en veille, la simulation reprend sans saut.
  - Score = intégrale de l'écart au profil guide, **en mètres × secondes** (la V2.6 additionnait des pixels à chaque tick). Les scores ne sont donc pas comparables à ceux de l'.exe.
  - Bulles : 5 par seconde en moyenne pendant l'expiration, montée de 15 px/s, grossissement de 1 px/s (valeurs V2.6 par tick ramenées à la seconde).
- **Plongeur** : il est centré sur la ligne du profil, au lieu d'être dessiné au-dessus.

- **Téléphone tenu verticalement** (ajout web, fichier `portrait.js`) :
  - L'écran représente 1 minute de plongée. Le plongeur part de la gauche, puis reste à 25 % de la largeur pendant que le fond défile vers la gauche.
  - En bas, seuls les boutons Gilet et Purge. Le curseur poumon est à droite, avec les oscilloscopes à 50 % d'opacité juste à côté.
  - Un appui démarre la plongée. En fin de plongée, un appui la relance.
  - Les paramètres et le graphique de vitesse ne sont accessibles qu'en mode paysage.

### Autres écarts

- Grille de l'oscilloscope gilet sur toute la hauteur (dans la V2.6, seulement la moitié haute).
- Tactile : un appui = gonflage. Sans clic droit, la purge passe par le bouton Purge.
- Molette : ±0,1 L partout.
- Sons non repris (aucun n'est joué dans le code V2.6).
- Virgule décimale dans les étiquettes, point dans le curseur et les paramètres.

### Comportements de la V2.6 conservés

- La vidange du bloc suit `PressionGonflage × (0,75 × (1 − t/360) + 0,25)`, avec 360 s codé en dur.
- Le mode « sport » est présent dans le modèle mais jamais activé.

## Publier sur GitHub Pages

1. Créer un dépôt GitHub (par exemple `PedaFlotta`).
2. Y déposer **le contenu** de ce dossier `web` à la racine (Add file → Upload files).
3. Settings → Pages → Source : *Deploy from a branch*, branche `main`, dossier `/ (root)` → Save.
4. Le site est en ligne après une minute environ, à l'adresse `https://<compte>.github.io/PedaFlotta/`.
5. Pour l'utiliser hors ligne : ouvrir le site une fois en ligne. Ensuite, dans Chrome ou Edge, le bouton « Installer » de la barre d'adresse permet de le lancer comme une application.

À chaque nouvelle version, modifier `CACHE` dans `sw.js` (par exemple `-2`) pour que les postes déjà installés récupèrent la mise à jour.

Test local sans Internet : double-cliquer sur `index.html` suffit. Le mode installable demande en revanche http(s), par exemple `python -m http.server` dans ce dossier.
