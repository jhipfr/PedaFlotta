# PedaFlotta Web (portage de PedaFlotta V2.6)

Portage HTML/CSS/JavaScript du simulateur WPF PedaFlotta V2.6. Aucun serveur, aucune dépendance externe.
Fonctionne en ligne, hors ligne (PWA avec service worker) et en double-cliquant sur `index.html`.

## Fichiers

| Fichier | Rôle | Source d'origine |
|---|---|---|
| `model.js` | Physique (portage ligne à ligne) | `Model.cs` |
| `app.js` | Affichage, souris/tactile, score, paramètres | `MainWindow.xaml(.cs)`, `App.xaml` |
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

1. **Repère 1920 × 1080** : l'écran WPF maximisé est reproduit dans un repère fixe de 1920 × 1080, puis mis à l'échelle de la fenêtre. Le score (calculé en pixels dans l'original) correspond donc à un écran 1920 × 1080 à 100 %. Sur un PC configuré autrement, l'ancien score était différent.
2. **Cadence** : le score, la montée des bulles et leur apparition sont calculés à chaque tick (code d'origine). Le tick web est fixé à 10 ms, la valeur du code. Hypothèse non vérifiée : sous Windows, le DispatcherTimer tourne souvent plus lentement (~15,6 ms), et le score web serait alors plus élevé que celui de l'.exe.
3. **Onglet masqué** : la simulation se met en pause, sinon le pas de temps réel deviendrait énorme au retour (ajout web).
4. **Grille de l'oscilloscope gilet** : tracée sur toute la hauteur. Dans l'original, elle ne couvre que la moitié haute (placement XAML du `CanvasGiletGrid`).
5. **Tactile** : un appui = clic gauche (gonflage). Sans clic droit, la purge passe par le bouton Purge.
6. **Molette** : ±0,1 partout. Dans l'original, la molette au-dessus du curseur est peut-être comptée deux fois (gestionnaire sur le curseur et sur la fenêtre). Non vérifié.
7. **Sons** : les fichiers `.wav` et `.mp3` ne sont pas repris, car aucun n'est joué dans le code V2.6 (le seul `SoundPlayer` pointe vers un chemin d'un autre PC et n'est jamais lancé).
8. **Format des nombres** : virgule décimale dans les étiquettes (on suppose un Windows en français), point dans le curseur et les paramètres (format des bindings WPF).

## Comportements de l'original conservés tels quels (à corriger si souhaité)

- **Taille Bloc** et **Pression Initiale** saisies dans Paramètres sont écrasées par `InitModel()` (15 L / 200 bar) à chaque redémarrage, donc sans effet.
- **Volume Max Poumon** ne sert qu'à l'échelle de l'oscilloscope. Le poumon reste borné en dur entre 1 et 5 L.
- La vidange du bloc suit `PressionGonflage × (0,75 × (1 − t/360) + 0,25)`, avec 360 s codé en dur.
- Le mode « sport » (respiration ample) est présent dans le modèle mais jamais activé (code clavier commenté).
- Le bouton Pause reste actif quand le panneau Paramètres est ouvert.

Aucune formule ni valeur n'a été ajoutée : tout vient de `Model.cs` et `MainWindow.xaml.cs`.

## Publier sur GitHub Pages

1. Créer un dépôt GitHub (par exemple `PedaFlotta`).
2. Y déposer **le contenu** de ce dossier `web` à la racine (Add file → Upload files).
3. Settings → Pages → Source : *Deploy from a branch*, branche `main`, dossier `/ (root)` → Save.
4. Le site est en ligne après une minute environ, à l'adresse `https://<compte>.github.io/PedaFlotta/`.
5. Pour l'utiliser hors ligne : ouvrir le site une fois en ligne. Ensuite, dans Chrome ou Edge, le bouton « Installer » de la barre d'adresse permet de le lancer comme une application.

À chaque nouvelle version, modifier `CACHE` dans `sw.js` (par exemple `-2`) pour que les postes déjà installés récupèrent la mise à jour.

Test local sans Internet : double-cliquer sur `index.html` suffit. Le mode installable demande en revanche http(s), par exemple `python -m http.server` dans ce dossier.
