// PedaFlotta niveau 2 : remontée assistée. On tient un plongeur face à nous (vue subjective).
// Les deux plongeurs utilisent model.js ; ils sont accrochés : même profondeur, même vitesse.
// Le mouvement commun vient de la somme des deux masses apparentes, avec des frottements doublés
// (deux fois plus de surface face à l'eau). L'écart de flottabilité entre lui et moi décale son image
// verticalement : 2 kg plus léger, son front sort par le haut ; 2 kg plus lourd, on ne voit que le haut de sa tête.
"use strict";

// Niveau 3 : même jeu depuis 40 m. Niveau 4 : comme le 3, avec pénalités de gonflage.
// niveau3.html et niveau4.html définissent NIVEAU avant de charger ce fichier.
const NIV = typeof NIVEAU !== "undefined" ? NIVEAU : 2;
const STEP = 0.01;           // pas de calcul (s), comme le niveau 1
let DEPART = NIV >= 3 ? 40 : 20; // profondeur de départ (m), réglable dans Paramètres
const FOND = NIV >= 3 ? 45 : 25; // m : profondeur maximale (fond) et maximum du paramètre
const ECART_MAX = 5;         // kg : écart de flottabilité qui amène la tête en butée haute ou basse
const LISSAGE = 0.5;         // s : constante de temps de l'affichage de l'écart
const FONT = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
const fr = (x, d) => x.toFixed(d).replace(".", ",");

const moi = new Model(), lui = new Model();

// ---------- état ----------
let etat = "attente";        // attente | plongee | fin
let ecartAff = 0;            // écart lui - moi affiché (kg), lissé
let vMax = 0;                // vitesse de remontée maximale (m/min)
let tHorsVert = 0;           // temps passé au-dessus de la zone verte (s)
// Score : -1 point par seconde et par m/min au-dessus de la vitesse du profil (10 m/min au-delà de 10 m, 5 m/min ensuite),
// -10 points par gonflage à partir du deuxième, +100 points à la surface à l'heure du profil, moins 2 points par seconde de retard.
let score = 0, bonusSurface = 0, gameOver = false, nbGonflages = 0;
// Niveau 4 : gonflages (mon inflateur et le sien confondus) : 1er gratuit, 2e −50, à partir du 3e −200 chacun.
const DUREE_MAX = NIV >= 3 ? 360 : 240; // s : largeur du bandeau ; game over si pas en surface à 4 min (6 min aux niveaux 3 et 4)
const vitesseLimite = (d) => (d > 30 ? 20 : d > 10 ? 10 : 5);
let particules = [], bulles = [];
let vAff = 0;                // vitesse affichée (m/min), filtre passe-bas de demi-vie 1 s
const DEMI_VIE_V = 1;        // s
let traj = [];               // trajectoire réelle {t, d}, un point toutes les 0,2 s
let profil = [];             // profil de remontée cible {t, d}
let tSurfaceProfil = 0;      // date d'arrivée en surface prévue par le profil (s)
const DECOMPTE = 5;          // s de décompte au départ

// Profil cible : décompte à la profondeur de départ, 20 m/min jusqu'à 30 m, 10 m/min jusqu'à 10 m, 5 m/min ensuite,
// palier de 30 s à 3 m, puis 5 m/min jusqu'à la surface, où il reste jusqu'à la fin du bandeau (4 min).
function construireProfil(D) {
  const pts = [{ t: 0, d: D }, { t: DECOMPTE, d: D }];
  let t = DECOMPTE, d = D;
  const vers = (cible, vMin) => { if (d > cible) { t += (d - cible) / vMin * 60; d = cible; pts.push({ t, d }); } };
  vers(30, 20);
  vers(10, 10);
  vers(3, 5);
  if (D >= 3) { t += 30; pts.push({ t, d }); }
  vers(0, 5);
  tSurfaceProfil = t;
  if (t < DUREE_MAX) pts.push({ t: DUREE_MAX, d: 0 });
  return pts;
}

// Équilibre les deux plongeurs à DEPART mètres : gilet gonflé juste ce qu'il faut.
function preparer(m) {
  m.initModel();
  m.time = 0; m.ProfondeurFond = FOND;
  m.Z = -DEPART; m.ZP = 0; m.Profondeur = DEPART; m.PressionAbsolue = 1 + DEPART / 10;
  m.VolumeNormoLitresGilet = 0;
  m.compute(0);              // masse apparente gilet vide, à la profondeur de départ
  m.VolumeNormoLitresGilet = Math.max(0, m.MasseApparentePlongeur) * m.PressionAbsolue;
  m.compute(0);
  m.IsInflateur = m.IsPurge = false;
}
function nouvellePartie() {
  preparer(moi); preparer(lui);
  ecartAff = lui.MasseApparentePlongeur - moi.MasseApparentePlongeur;
  vMax = 0; tHorsVert = 0; bulles = []; vAff = 0; score = 0; bonusSurface = 0; gameOver = false; nbGonflages = 0;
  profil = construireProfil(DEPART); traj = [{ t: 0, d: DEPART }];
  etat = "attente";
}

// ---------- physique couplée ----------
function pas(dt) {
  const z0 = moi.Z, zp0 = moi.ZP;
  moi.compute(dt); lui.compute(dt); // gilets, poumons, combinaisons, masses apparentes
  const ma = moi.MasseApparentePlongeur + lui.MasseApparentePlongeur;
  const a = Math.abs(zp0);
  const r = -Math.sign(zp0) * a * (2 * moi.CoefficientFrottementVisqueux + a * 2 * moi.CoefficientFrottement);
  const masse = moi.MassePlongeur + moi.LestPlongeur + lui.MassePlongeur + lui.LestPlongeur;
  const zpp = (-ma + r) * moi.Gravitation / masse;
  let zp = zp0 + zpp * dt, z = z0 + zp * dt;
  if (z > 0) { z = 0; zp = 0; }
  if (z < -FOND) { z = -FOND; zp = 0; }
  for (const m of [moi, lui]) {
    m.ZPP = zpp; m.ZP = zp; m.Z = z;
    m.Vitesse = zp * 60; m.Profondeur = -z; m.PressionAbsolue = 1 + m.Profondeur / 10;
  }
  const cible = lui.MasseApparentePlongeur - moi.MasseApparentePlongeur;
  ecartAff += (cible - ecartAff) * Math.min(1, dt / LISSAGE);
  vAff += (moi.Vitesse - vAff) * (1 - Math.pow(2, -dt / DEMI_VIE_V));
  vMax = Math.max(vMax, vAff);
  if (moi.time - traj[traj.length - 1].t >= 0.2) traj.push({ t: moi.time, d: moi.Profondeur });
  if (vAff > 4.8) tHorsVert += dt; // 4,8 m/min : haut de la zone verte de la jauge (comme le niveau 1)
  // score par seconde : redescente −10 × vitesse, sous la limite +vitesse, au-dessus −dépassement
  const exces = vAff - vitesseLimite(moi.Profondeur);
  if (vAff < 0) score += 10 * vAff * dt;
  else if (exces < 0) score += vAff * dt;
  else score -= exces * dt;
  // particules : immobiles dans l'eau, elles défilent quand on bouge (100 px par mètre)
  for (const p of particules) {
    p.y += zp * 100 * dt;
    if (p.y > LH) p.y -= LH; else if (p.y < 0) p.y += LH;
  }
  // bulles du détendeur pendant l'expiration
  if (lui.Expiration && Math.random() < 6 * dt) bulles.push({ x: (Math.random() - 0.5) * 0.6, y: 0.55, r: 0.05 + Math.random() * 0.06 });
  for (const b of bulles) { b.y -= 2.5 * dt; b.x += (Math.random() - 0.5) * 0.02; }
  bulles = bulles.filter((b) => b.y > -6);
  if (etat === "plongee" && moi.Profondeur <= 0) {
    const ecart = Math.abs(moi.time - tSurfaceProfil); // avance ou retard : même décroissance
    bonusSurface = Math.max(0, 100 - 2 * ecart);
    score += bonusSurface;
    etat = "fin"; relacherTout();
  } else if (etat === "plongee" && moi.time >= DUREE_MAX) { gameOver = true; etat = "fin"; relacherTout(); }
}

// ---------- affichage ----------
const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
let LW = 1000, LH = 1000, k = 1; // repère logique : hauteur 1000
let boutons = [];
function redim() {
  const vw = window.innerWidth, vh = window.innerHeight;
  LW = 1000 * vw / vh; k = vh / 1000 * (window.devicePixelRatio || 1);
  cv.width = Math.round(vw * (window.devicePixelRatio || 1)); cv.height = Math.round(vh * (window.devicePixelRatio || 1));
  if (!particules.length) for (let i = 0; i < 70; i++) particules.push({ x: Math.random(), y: Math.random() * LH, r: 1 + Math.random() * 2.5 });
}
window.addEventListener("resize", redim);

function bouton(id, label, x, y, w, h, couleur, m, champ) {
  const actif = m ? m[champ] : false;
  boutons.push({ id, x, y, w, h, m, champ });
  ctx.fillStyle = m && actif ? "#00C000" : couleur; ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
  rrect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  let fs = Math.min(30, h * 0.36);
  ctx.font = `bold ${fs}px ${FONT}`;
  const tw = ctx.measureText(label).width;
  if (tw > w - 12) { fs *= (w - 12) / tw; ctx.font = `bold ${fs}px ${FONT}`; }
  ctx.fillText(label, x + w / 2, y + h / 2);
}
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function dessiner() {
  ctx.setTransform(k, 0, 0, k, 0, 0);
  boutons = [];
  const portrait = LW < 800;
  const jaugeW = portrait ? 50 : 70; // jauge de vitesse tout à gauche
  const BH = portrait ? 170 : 200; // hauteur du bandeau de profil
  // eau : plus claire près de la surface
  const t = clamp(moi.Profondeur / 25, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, `hsl(205, 80%, ${55 - 30 * t}%)`); g.addColorStop(1, `hsl(215, 85%, ${35 - 22 * t}%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const p of particules) { ctx.beginPath(); ctx.arc(p.x * LW, p.y, p.r, 0, 2 * Math.PI); ctx.fill(); }

  // le plongeur face à nous
  const curW = portrait ? 46 : 64; // curseur poumon ballast, à droite
  const zone = LW - jaugeW - curW - 20;
  const R = Math.min(220, zone * (portrait ? 0.3 : 0.4)); // plongeur proche
  const cx = jaugeW + 10 + zone / 2;
  const e = clamp(ecartAff / ECART_MAX, -1, 1);   // -1 : lui plus léger ; +1 : lui plus lourd
  // Centre de la tête (hy) : yeux à hy - 0,08R, menton à hy + 0,9R, front à hy - 0,66R.
  // Équilibre : yeux au milieu de l'écran entier. -5 kg : menton sous le bandeau. +5 kg : front en bas de l'écran.
  const yHaut = BH - 0.9 * R, yMilieu = LH / 2 + 0.08 * R, yBas = LH + 0.66 * R;
  const hy = e < 0 ? yMilieu + (yMilieu - yHaut) * e : yMilieu + (yBas - yMilieu) * e;
  dessinerBinome(cx, hy, R, jaugeW + 100); // visible aussi à travers le bandeau, dessiné par-dessus en transparence

  // ses commandes, attachées à son équipement (gardées à l'écran pour rester utilisables)
  const bw = portrait ? 130 : 190, bh = portrait ? 70 : 80;
  // boutons à côté du corps, reliés par un trait à la tirette et à l'inflateur
  const ord = portrait ? { w: 210, h: 150 } : { w: 300, h: 200 }; // ordinateur de plongée, en haut à gauche
  ord.x = jaugeW + 8; ord.y = BH + 8;
  const mh = portrait ? 100 : 120, mw = portrait ? 140 : 220; // mes boutons, en bas
  const yMin = BH + (portrait ? 210 : 230), yMax = LH - mh - bh - 30; // entre l'ordinateur / Paramètres et mes boutons
  const bx1 = clamp(cx - 1.9 * R - bw, jaugeW + 5, LW - curW - bw - 10);
  const bx2 = clamp(cx + 1.75 * R, jaugeW + 5, LW - curW - bw - 10);
  const by2 = clamp(hy + 0.25 * R - bh / 2, yMin, yMax), by1 = by2; // les deux à la hauteur de son inflateur
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(bx1 + bw, by1 + bh / 2); ctx.lineTo(cx - 1.25 * R, hy + 1.6 * R);
  ctx.moveTo(bx2, by2 + bh / 2); ctx.lineTo(cx + 1.45 * R, hy + 0.25 * R); ctx.stroke(); ctx.setLineDash([]);
  bouton("saPurge", "Sa purge", bx1, by1, bw, bh, "#E070E0", lui, "IsPurge");
  bouton("sonInfl", "Son inflateur", bx2, by2, bw, bh, "#FFC0CB", lui, "IsInflateur");

  // mes commandes : inflateur en bas à gauche, purge en bas à droite
  bouton("monInfl", "Mon inflateur", jaugeW + 10, LH - mh - 10, mw, mh, "#FFC0CB", moi, "IsInflateur");
  bouton("maPurge", "Ma purge", LW - mw - 10, LH - mh - 10, mw, mh, "#E070E0", moi, "IsPurge");

  // curseur « poumon ballast » à droite : mon volume pulmonaire moyen (comme le niveau 1)
  {
    const sx = LW - curW - 4, sy = BH + (portrait ? 240 : 260), sh = LH - mh - 30 - sy;
    const gt = ctx.createLinearGradient(sx, 0, sx + curW, 0);
    gt.addColorStop(0, "#888"); gt.addColorStop(0.5, "#ccc"); gt.addColorStop(1, "#888");
    ctx.fillStyle = gt; ctx.strokeStyle = "#333"; ctx.lineWidth = 2; rrect(sx, sy, curW, sh, 8); ctx.fill(); ctx.stroke();
    const th = portrait ? 46 : 54, f = (moi.OffsetRespiration - moi.OffsetMin) / Math.max(0.01, moi.OffsetMax - moi.OffsetMin);
    const ty = sy + (1 - f) * (sh - th);
    ctx.fillStyle = "#00BFFF"; ctx.strokeStyle = "#000"; rrect(sx - 4, ty, curW + 8, th, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold ${portrait ? 18 : 22}px ${FONT}`;
    ctx.fillText(moi.OffsetRespiration.toFixed(2), sx + curW / 2, ty + th / 2);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "bottom"; ctx.font = `bold ${portrait ? 14 : 18}px ${FONT}`;
    ctx.fillText("Poumon", sx + curW / 2, sy - 4);
    boutons.push({ id: "poumon", x: sx - 10, y: sy, w: curW + 20, h: sh, sy: sy + th / 2, sh: sh - th });
  }

  // jauge de vitesse tout à gauche (couleurs et échelle ±30 m/min du niveau 1)
  {
    const gx = 0, gy = BH + 10, gh = LH - BH - 20;
    const gg = ctx.createLinearGradient(0, gy, 0, gy + gh);
    for (const [o, c] of [[0, "#FF0000"], [0.25, "#FF0000"], [0.25, "#FFA500"], [0.339, "#FFA500"], [0.34, "#FFFF00"], [0.419, "#FFFF00"],
      [0.42, "#008000"], [0.5, "#008000"], [0.5, "#90EE90"], [1, "#90EE90"]]) gg.addColorStop(o, c);
    ctx.fillStyle = gg; ctx.fillRect(gx, gy, jaugeW, gh);
    const v = clamp(vAff, -30, 30);
    ctx.fillStyle = "#000"; ctx.fillRect(gx, gy + gh / 2 - gh * v / 60 - 5, jaugeW, 10);
  }

  // informations en haut
  const tt = Math.max(0, moi.time);
  const ts = tt < 60 ? Math.trunc(tt) + "s" : String(Math.trunc(tt / 60)).padStart(2, "0") + "m:" + String(Math.trunc(tt) % 60).padStart(2, "0") + "s";
  dessinerOrdinateur(ord.x, ord.y, ord.w, ord.h, ts);
  // score en haut à droite, Paramètres et retour au niveau 1 dessous
  ctx.fillStyle = "#fff"; ctx.textBaseline = "top"; ctx.textAlign = "right";
  ctx.font = `bold ${portrait ? 22 : 26}px ${FONT}`; ctx.fillText("Score", LW - 12, BH + 8);
  ctx.font = `bold ${portrait ? 44 : 56}px ${FONT}`; ctx.fillText(score.toFixed(0), LW - 12, BH + 34);
  const pw = portrait ? 150 : 210, py = BH + (portrait ? 90 : 100);
  if (etat !== "plongee") bouton("param", "Paramètres", LW - pw - 10, py, pw, 60, "#DDDDDD");
  ctx.fillStyle = "#fff"; ctx.textBaseline = "top"; ctx.textAlign = "right"; ctx.font = `bold ${portrait ? 20 : 24}px ${FONT}`;
  // choix du niveau : 1 à 4, le niveau en cours en jaune
  ctx.fillText("Niveau", LW - 12, py + 68);
  const nb = portrait ? 34 : 40, ng = 6;
  for (let n = 1; n <= 4; n++) {
    const x = LW - 12 - (5 - n) * nb - (4 - n) * ng, y = py + (portrait ? 94 : 98);
    ctx.fillStyle = n === NIV ? "#FFD700" : "rgba(255,255,255,0.85)"; ctx.fillRect(x, y, nb, nb);
    ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(n), x + nb / 2, y + nb / 2 + 1);
    boutons.push({ id: "niveau", n, x, y, w: nb, h: nb });
  }
  dessinerProfil(BH, portrait);
  if (etat === "plongee" && moi.time < DECOMPTE) { // décompte
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.arc(cx, LH / 2, 110, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold 150px ${FONT}`;
    ctx.fillText(String(Math.ceil(DECOMPTE - moi.time)), cx, LH / 2 + 8);
  }

  const ymid = (BH + LH) / 2;
  if (etat === "attente") { bandeau(portrait ? ["Niveau " + NIV, "Remontée assistée", "depuis " + fr(DEPART, 0) + " m"] : ["Niveau " + NIV + " : remontée assistée depuis " + fr(DEPART, 0) + " m"], cx, ymid - (portrait ? 110 : 90)); boutonGo(cx, ymid); }
  if (etat === "fin" && gameOver) { bandeau(["GAME OVER", "Pas en surface à " + DUREE_MAX / 60 + " min", "Score " + score.toFixed(0)], cx, ymid - 130); boutonGo(cx, ymid); }
  else if (etat === "fin") { bandeau(["Score " + score.toFixed(0), "Surface en " + ts + " (profil " + Math.round(tSurfaceProfil) + " s)",
    "Bonus surface +" + bonusSurface.toFixed(0), "Vitesse max " + vMax.toFixed(0) + " m/min"], cx, ymid - 150); boutonGo(cx, ymid); }
}

// Ordinateur de plongée (boîtier gris, écran noir) : profondeur, vitesse de remontée, durée.
// Inspiré de l'aspect d'un ordinateur à grand écran couleur, sans en reproduire la marque.
function dessinerOrdinateur(x, y, w, h, ts) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#b8bdc2"); g.addColorStop(0.5, "#8a9096"); g.addColorStop(1, "#5c6166");
  ctx.fillStyle = g; ctx.strokeStyle = "#2b2e31"; ctx.lineWidth = 3; rrect(x, y, w, h, h * 0.18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#3a3d40"; // 4 boutons sur les flancs
  for (const [bx, by] of [[x - 6, y + h * 0.25], [x - 6, y + h * 0.6], [x + w - 4, y + h * 0.25], [x + w - 4, y + h * 0.6]]) { rrect(bx, by, 10, h * 0.15, 3); ctx.fill(); }
  const m = w * 0.07, sx = x + m, sy = y + m, sw = w - 2 * m, sh = h - 2 * m;
  ctx.fillStyle = "#050607"; rrect(sx, sy, sw, sh, h * 0.08); ctx.fill();
  const u = sh / 100; // unité verticale de l'écran
  ctx.textBaseline = "top"; ctx.textAlign = "left";
  ctx.fillStyle = "#9aa3ad"; ctx.font = `bold ${10 * u}px ${FONT}`; ctx.fillText("PROF.", sx + 6 * u, sy + 5 * u);
  ctx.textAlign = "right"; ctx.fillText("VIT.", sx + sw - 6 * u, sy + 5 * u);
  ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = `bold ${36 * u}px ${FONT}`;
  ctx.fillText(fr(moi.Profondeur, 1), sx + 6 * u, sy + 17 * u);
  const dw = ctx.measureText(fr(moi.Profondeur, 1)).width;
  ctx.font = `bold ${14 * u}px ${FONT}`; ctx.fillText("m", sx + 8 * u + dw, sy + 38 * u);
  // alarme du profil : 10 m/min au-delà de 10 m, 5 m/min de 10 m à la surface
  const v = vAff, limite = vitesseLimite(moi.Profondeur);
  const col = v >= limite ? "#ff3030" : v > -0.5 ? "#30e030" : "#ffffff";
  ctx.textAlign = "right"; ctx.fillStyle = col; ctx.font = `bold ${26 * u}px ${FONT}`;
  ctx.fillText((v >= 0.5 ? "▲" : v <= -0.5 ? "▼" : "") + Math.abs(v).toFixed(0), sx + sw - 6 * u, sy + 20 * u);
  ctx.font = `bold ${11 * u}px ${FONT}`; ctx.fillText("m/min", sx + sw - 6 * u, sy + 52 * u);
  ctx.fillStyle = "#333a42"; ctx.fillRect(sx + 4 * u, sy + 67 * u, sw - 8 * u, 1.5);
  ctx.textAlign = "left"; ctx.fillStyle = "#9aa3ad"; ctx.font = `bold ${10 * u}px ${FONT}`; ctx.fillText("DURÉE", sx + 6 * u, sy + 74 * u);
  ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = `bold ${20 * u}px ${FONT}`; const tt = Math.max(0, Math.trunc(moi.time));
  ctx.fillText(Math.trunc(tt / 60) + ":" + String(tt % 60).padStart(2, "0"), sx + sw - 6 * u, sy + 72 * u);
}

// bandeau du haut : profil de remontée cible (rouge) et trajectoire réelle (blanc)
function dessinerProfil(BH, portrait) {
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, LW, BH); // transparent : on voit le plongeur dessous
  ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = `bold ${portrait ? 18 : 22}px ${FONT}`;
  const titre = NIV >= 3
    ? (portrait ? "20 m/min → 30 m, 10 → 10 m, 5, palier 3 m" : "Profil : 20 m/min jusqu'à 30 m, 10 m/min jusqu'à 10 m, puis 5 m/min, palier de 30 s à 3 m")
    : (portrait ? "10 m/min → 10 m, 5 m/min, palier 30 s à 3 m" : "Profil : 10 m/min jusqu'à 10 m, puis 5 m/min, palier de 30 s à 3 m");
  ctx.fillText(titre, 10, 6);
  const x0 = portrait ? 50 : 60, x1 = LW - 20, y0 = portrait ? 36 : 42, y1 = BH - 26;
  const tFin = DUREE_MAX, D = Math.max(DEPART, 1); // le bandeau couvre 4 minutes
  const X = (t) => x0 + (x1 - x0) * t / tFin, Y = (d) => y0 + (y1 - y0) * Math.min(d, D) / D; // plus profond que le départ : bord bas
  ctx.font = `${portrait ? 16 : 18}px ${FONT}`; ctx.textBaseline = "middle"; ctx.textAlign = "right";
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
  for (const d of [...new Set([0, ...(DEPART > 25 ? [] : [3]), 10, 30, DEPART])].filter((d) => d <= DEPART)) {
    ctx.beginPath(); ctx.moveTo(x0, Y(d)); ctx.lineTo(x1, Y(d)); ctx.stroke();
    ctx.fillStyle = "#ddd"; ctx.fillText(fr(d, 0) + "m", x0 - 6, Y(d));
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let t = 60; t <= tFin; t += 60) {
    ctx.beginPath(); ctx.moveTo(X(t), y0); ctx.lineTo(X(t), y1); ctx.stroke();
    ctx.fillStyle = "#ddd"; ctx.fillText(t / 60 + "min", X(t), y1 + 4);
  }
  ctx.strokeStyle = "#FF3030"; ctx.lineWidth = 4; ctx.beginPath();
  profil.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.d)) : ctx.moveTo(X(p.t), Y(p.d)))); ctx.stroke();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath();
  traj.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.d)) : ctx.moveTo(X(p.t), Y(p.d)))); ctx.stroke();
  ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(X(Math.max(0, moi.time)), Y(moi.Profondeur), 7, 0, 2 * Math.PI); ctx.fill();
}

// bouton Go opaque : lance la remontée
function boutonGo(cx, ymid) {
  const w = LW < 800 ? 200 : 260, h = LW < 800 ? 110 : 130, x = clamp(cx - w / 2, 10, LW - w - 10), y = ymid + 20;
  boutons.push({ id: "go", x, y, w, h });
  ctx.fillStyle = "#00A000"; ctx.strokeStyle = "#000"; ctx.lineWidth = 4; rrect(x, y, w, h, 20); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold 70px ${FONT}`;
  ctx.fillText("Go", x + w / 2, y + h / 2 + 4);
}
function bandeau(lignes, cx, yc) {
  const fs = LW < 800 ? 26 : 40, lh = fs * 1.4;
  ctx.font = `bold ${fs}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = Math.min(LW - 20, Math.max(...lignes.map((l) => ctx.measureText(l).width)) + 60), h = lignes.length * lh + 40;
  const x = clamp(cx - w / 2, 10, LW - w - 10);
  ctx.fillStyle = "rgba(0,0,0,0.6)"; rrect(x, yc - h / 2, w, h, 16); ctx.fill();
  ctx.fillStyle = "#fff";
  lignes.forEach((l, i) => ctx.fillText(l, x + w / 2, yc - h / 2 + 20 + lh * (i + 0.5)));
}

// Plongeur vu de face, tête centrée en (cx, hy), rayon de tête R. colG : départ de mon bras en bas de l'écran.
function dessinerBinome(cx, hy, R, colG) {
  const NOIR = "#16181d", NEO = "#262a33", STAB = "#1f8f96", STAB2 = "#156a70", PEAU = "#f2c9a0";
  // bloc derrière les épaules
  ctx.fillStyle = "#c9ccd1"; rrect(cx - 0.55 * R, hy + 0.5 * R, 1.1 * R, 1.2 * R, 0.3 * R); ctx.fill();
  ctx.fillStyle = "#555"; ctx.fillRect(cx - 0.12 * R, hy + 0.35 * R, 0.24 * R, 0.3 * R);
  // bras (combinaison)
  ctx.strokeStyle = NEO; ctx.lineCap = "round"; ctx.lineWidth = 0.6 * R;
  ctx.beginPath(); ctx.moveTo(cx - 1.4 * R, hy + 1.3 * R); ctx.lineTo(cx - 1.9 * R, hy + 2.8 * R); ctx.lineTo(cx - 1.7 * R, hy + 4.0 * R); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 1.4 * R, hy + 1.3 * R); ctx.lineTo(cx + 1.9 * R, hy + 2.8 * R); ctx.lineTo(cx + 1.7 * R, hy + 4.0 * R); ctx.stroke();
  // torse
  ctx.fillStyle = NEO; ctx.beginPath();
  ctx.moveTo(cx - 1.6 * R, hy + 1.0 * R); ctx.lineTo(cx + 1.6 * R, hy + 1.0 * R);
  ctx.lineTo(cx + 1.2 * R, hy + 5.5 * R); ctx.lineTo(cx + 1.2 * R, LH + R); ctx.lineTo(cx - 1.2 * R, LH + R);
  ctx.lineTo(cx - 1.2 * R, hy + 5.5 * R); ctx.closePath(); ctx.fill();
  // gilet : deux pans et bretelles
  ctx.fillStyle = STAB;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.35 * R, hy + 1.1 * R); ctx.lineTo(cx + s * 1.55 * R, hy + 1.1 * R);
    ctx.lineTo(cx + s * 1.3 * R, hy + 4.4 * R); ctx.lineTo(cx + s * 0.45 * R, hy + 4.4 * R); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = STAB2;
  for (const s of [-1, 1]) { rrect(cx + s * 0.95 * R - 0.25 * R, hy + 0.9 * R, 0.5 * R, 0.5 * R, 0.1 * R); ctx.fill(); }
  ctx.fillStyle = "#111"; ctx.fillRect(cx - 1.25 * R, hy + 3.6 * R, 2.5 * R, 0.22 * R); // sangle ventrale
  ctx.fillStyle = "#999"; ctx.fillRect(cx - 0.2 * R, hy + 3.55 * R, 0.4 * R, 0.32 * R);  // boucle
  // sa purge (épaule droite, à gauche de l'écran) : tirette rouge
  ctx.strokeStyle = "#b00"; ctx.lineWidth = 0.06 * R;
  ctx.beginPath(); ctx.moveTo(cx - 1.2 * R, hy + 1.1 * R); ctx.lineTo(cx - 1.25 * R, hy + 1.55 * R); ctx.stroke();
  ctx.fillStyle = "#e00"; ctx.beginPath(); ctx.arc(cx - 1.25 * R, hy + 1.6 * R, 0.1 * R, 0, 2 * Math.PI); ctx.fill();
  // tête : cagoule, visage, masque, détendeur
  ctx.fillStyle = NOIR; ctx.beginPath(); ctx.arc(cx, hy, R, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = PEAU; ctx.beginPath(); ctx.ellipse(cx, hy + 0.12 * R, 0.68 * R, 0.78 * R, 0, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#111"; ctx.fillRect(cx - R, hy - 0.22 * R, 2 * R, 0.16 * R);             // sangle du masque
  ctx.fillStyle = "#1c1c1c"; rrect(cx - 0.72 * R, hy - 0.42 * R, 1.44 * R, 0.68 * R, 0.22 * R); ctx.fill();
  ctx.fillStyle = "#bfefff"; rrect(cx - 0.62 * R, hy - 0.34 * R, 1.24 * R, 0.52 * R, 0.16 * R); ctx.fill();
  ctx.fillStyle = "#1c1c1c"; ctx.fillRect(cx - 0.04 * R, hy - 0.34 * R, 0.08 * R, 0.52 * R);
  ctx.fillStyle = "#222";
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 0.3 * R, hy - 0.08 * R, 0.09 * R, 0, 2 * Math.PI); ctx.fill(); }
  ctx.strokeStyle = "#333"; ctx.lineWidth = 0.12 * R; ctx.lineCap = "round";                 // flexible du détendeur
  ctx.beginPath(); ctx.moveTo(cx - 0.25 * R, hy + 0.6 * R); ctx.quadraticCurveTo(cx - 0.9 * R, hy + 0.9 * R, cx - 0.6 * R, hy + 1.3 * R); ctx.stroke();
  ctx.fillStyle = "#4a4a4a"; ctx.beginPath(); ctx.arc(cx, hy + 0.58 * R, 0.24 * R, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#777"; ctx.beginPath(); ctx.arc(cx, hy + 0.58 * R, 0.12 * R, 0, 2 * Math.PI); ctx.fill();
  // son inflateur, tenu par MA main droite au niveau de son visage
  const H = { x: cx + 1.45 * R, y: hy + 0.25 * R };
  ctx.strokeStyle = "#0d0f12"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(40, 0.75 * R); // mon bras droit (combinaison noire)
  ctx.beginPath(); ctx.moveTo(LW - 60, LH + 80); ctx.quadraticCurveTo(LW - 0.2 * (LW - H.x) - 60, Math.min(LH, H.y + 2.2 * R), H.x + 0.15 * R, H.y + 0.35 * R); ctx.stroke();
  ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 0.2 * R; ctx.lineCap = "butt"; // annelé de l'épaule à la main
  ctx.beginPath(); ctx.moveTo(cx + 0.9 * R, hy + 0.95 * R); ctx.quadraticCurveTo(cx + 1.15 * R, hy + 1.0 * R, H.x, H.y + 0.3 * R); ctx.stroke();
  ctx.fillStyle = "#3b3b3b"; rrect(H.x - 0.17 * R, H.y - 0.32 * R, 0.34 * R, 0.62 * R, 0.08 * R); ctx.fill(); // inflateur
  ctx.fillStyle = "#f5c400"; ctx.beginPath(); ctx.arc(H.x, H.y - 0.18 * R, 0.09 * R, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#3a3f47"; ctx.beginPath(); ctx.ellipse(H.x + 0.05 * R, H.y + 0.12 * R, 0.3 * R, 0.22 * R, 0.3, 0, 2 * Math.PI); ctx.fill(); // gant
  // bulles d'expiration
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2;
  for (const b of bulles) { ctx.beginPath(); ctx.arc(cx + b.x * R, hy + b.y * R, b.r * R, 0, 2 * Math.PI); ctx.stroke(); }
  // mon bras gauche qui le tient par la bretelle droite
  const hx = cx - 0.95 * R, hyy = hy + 1.2 * R;
  ctx.strokeStyle = "#0d0f12"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(40, 0.75 * R);
  ctx.beginPath(); ctx.moveTo(colG - 40, LH + 80); ctx.quadraticCurveTo(colG + 0.2 * (hx - colG), Math.min(LH, hyy + 2.2 * R), hx, hyy); ctx.stroke();
  ctx.fillStyle = "#3a3f47"; ctx.beginPath(); ctx.ellipse(hx, hyy, 0.42 * R, 0.32 * R, -0.5, 0, 2 * Math.PI); ctx.fill(); // gant
  ctx.strokeStyle = "#2a2e35"; ctx.lineWidth = 0.08 * R;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 0.2 * R + i * 0.13 * R, hyy - 0.2 * R); ctx.lineTo(hx - 0.15 * R + i * 0.13 * R, hyy + 0.15 * R); ctx.stroke(); }
}

// ---------- commandes (multi-touch : un doigt par bouton) ----------
const appuis = new Map(); // pointerId -> bouton
function aPos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.height * 1000, y: (e.clientY - r.top) / r.height * 1000 }; }
function cible(p) { return boutons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h); }
cv.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const b = cible(aPos(e));
  if (b && b.id === "niveau") { if (b.n !== NIV) location.href = b.n === 1 ? "index.html" : "niveau" + b.n + ".html"; return; }
  if (!b) return;
  if (b.id === "poumon") { curseurs.set(e.pointerId, b); cv.setPointerCapture(e.pointerId); reglerPoumon(b, aPos(e).y); return; }
  if (b.id === "param") { ouvrirParams(); return; }
  if (b.id === "go") {
    if (etat === "fin") nouvellePartie();
    etat = "plongee"; precedent = performance.now(); accu = 0; return;
  }
  if (etat === "plongee" && b.m) {
    if (NIV === 4 && b.champ === "IsInflateur" && !b.m.IsInflateur && ++nbGonflages > 1) score -= nbGonflages === 2 ? 50 : 200;
    b.m[b.champ] = true; appuis.set(e.pointerId, b); cv.setPointerCapture(e.pointerId); }
});
function relacher(e) { curseurs.delete(e.pointerId); const b = appuis.get(e.pointerId); if (b) { b.m[b.champ] = false; appuis.delete(e.pointerId); } }
// curseur poumon : glisser pour régler le volume pulmonaire moyen (haut = OffsetMax)
const curseurs = new Map();
function reglerPoumon(b, y) {
  const f = clamp(1 - (y - b.sy) / b.sh, 0, 1);
  moi.OffsetRespiration = Math.round((moi.OffsetMin + f * (moi.OffsetMax - moi.OffsetMin)) * 10) / 10;
}
cv.addEventListener("pointermove", (e) => { const b = curseurs.get(e.pointerId); if (b) reglerPoumon(b, aPos(e).y); });
cv.addEventListener("pointerup", relacher);
cv.addEventListener("pointercancel", relacher);
cv.addEventListener("contextmenu", (e) => e.preventDefault());
function relacherTout() { appuis.clear(); for (const m of [moi, lui]) m.IsInflateur = m.IsPurge = false; }
// molette : mon volume pulmonaire moyen (±0,1 L), comme le niveau 1
cv.addEventListener("wheel", (e) => { e.preventDefault(); moi.OffsetRespiration += e.deltaY < 0 ? 0.1 : -0.1; }, { passive: false });

// ---------- paramètres : profondeur de départ et caractéristiques de chaque plongeur ----------
const PARAMS = [
  ["Profondeur de départ (m)", () => DEPART, (v) => { DEPART = clamp(v, 1, FOND); }],
  ["Ma masse (kg)", () => moi.MassePlongeur, (v) => { moi.MassePlongeur = v; }],
  ["Mon volume (L)", () => moi.VolumePlongeur, (v) => { moi.VolumePlongeur = v; }],
  ["Mon lest (kg)", () => moi.LestPlongeur, (v) => { moi.LestPlongeur = v; }],
  ["Sa masse (kg)", () => lui.MassePlongeur, (v) => { lui.MassePlongeur = v; }],
  ["Son volume (L)", () => lui.VolumePlongeur, (v) => { lui.VolumePlongeur = v; }],
  ["Son lest (kg)", () => lui.LestPlongeur, (v) => { lui.LestPlongeur = v; }],
];
const panneau = document.getElementById("params"), champs = document.getElementById("champs");
// Disposition : profondeur à gauche, colonne « Moi » (masse, volume, lest) puis colonne « Lui ».
for (const [t, col] of [["Moi", 2], ["Lui", 3]]) {
  const h = document.createElement("div"); h.className = "titre"; h.textContent = t;
  h.style.gridColumn = col; h.style.gridRow = 1; champs.appendChild(h);
}
const entrees = PARAMS.map(([label], n) => {
  const l = document.createElement("label"); l.textContent = label;
  const i = document.createElement("input"); i.type = "text"; i.inputMode = "decimal";
  l.style.gridColumn = n === 0 ? 1 : n <= 3 ? 2 : 3;
  l.style.gridRow = n === 0 ? 2 : 2 + (n - 1) % 3;
  l.appendChild(i); champs.appendChild(l); return i;
});
function ouvrirParams() {
  relacherTout(); etat = "attente";
  PARAMS.forEach(([, get], n) => { entrees[n].value = String(get()); });
  panneau.style.display = "flex";
}
document.getElementById("valider").addEventListener("click", () => {
  PARAMS.forEach(([, , set], n) => { const v = parseFloat(entrees[n].value.replace(",", ".")); if (isFinite(v) && v >= 0) set(v); });
  panneau.style.display = "none";
  nouvellePartie();
});

// ---------- horloge : pas fixes de 10 ms ----------
let precedent = performance.now(), accu = 0;
function image(now) {
  accu += Math.min(0.25, Math.max(0, (now - precedent) / 1000)); precedent = now;
  while (etat === "plongee" && accu >= STEP) { accu -= STEP; pas(STEP); }
  if (etat !== "plongee") accu = 0;
  dessiner();
  requestAnimationFrame(image);
}
redim(); nouvellePartie(); requestAnimationFrame(image);

if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
