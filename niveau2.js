// PedaFlotta niveau 2 : remontée assistée. On tient un plongeur face à nous (vue subjective).
// Les deux plongeurs utilisent model.js ; ils sont accrochés : même profondeur, même vitesse.
// Le mouvement commun vient de la somme des deux masses apparentes, avec des frottements doublés
// (deux fois plus de surface face à l'eau). L'écart de flottabilité entre lui et moi décale son image
// verticalement : 2 kg plus léger, son front sort par le haut ; 2 kg plus lourd, on ne voit que le haut de sa tête.
"use strict";

const STEP = 0.01;           // pas de calcul (s), comme le niveau 1
let DEPART = 20;             // profondeur de départ (m), réglable dans Paramètres
const ECART_MAX = 3;         // kg : écart de flottabilité qui amène la tête en butée haute ou basse
const LISSAGE = 0.5;         // s : constante de temps de l'affichage de l'écart
const FONT = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
const fr = (x, d) => x.toFixed(d).replace(".", ",");

const moi = new Model(), lui = new Model();

// ---------- état ----------
let etat = "attente";        // attente | plongee | fin
let ecartAff = 0;            // écart lui - moi affiché (kg), lissé
let vMax = 0;                // vitesse de remontée maximale (m/min)
let tHorsVert = 0;           // temps passé au-dessus de la zone verte (s)
let particules = [], bulles = [];
let vAff = 0;                // vitesse affichée (m/min), filtre passe-bas de demi-vie 1 s
const DEMI_VIE_V = 1;        // s
let traj = [];               // trajectoire réelle {t, d}, un point toutes les 0,2 s
let profil = [];             // profil de remontée cible {t, d}
const DECOMPTE = 5;          // s de décompte au départ

// Profil cible : décompte à la profondeur de départ, 10 m/min jusqu'à 10 m, 5 m/min ensuite,
// palier de 30 s à 3 m, puis 5 m/min jusqu'à la surface.
function construireProfil(D) {
  const pts = [{ t: 0, d: D }, { t: DECOMPTE, d: D }];
  let t = DECOMPTE, d = D;
  const vers = (cible, vMin) => { if (d > cible) { t += (d - cible) / vMin * 60; d = cible; pts.push({ t, d }); } };
  vers(10, 10);
  vers(3, 5);
  if (D >= 3) { t += 30; pts.push({ t, d }); }
  vers(0, 5);
  return pts;
}

// Équilibre les deux plongeurs à DEPART mètres : gilet gonflé juste ce qu'il faut.
function preparer(m) {
  m.initModel();
  m.time = 0;
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
  vMax = 0; tHorsVert = 0; bulles = []; vAff = 0;
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
  if (z < -25) { z = -25; zp = 0; }
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
  // particules : immobiles dans l'eau, elles défilent quand on bouge (100 px par mètre)
  for (const p of particules) {
    p.y += zp * 100 * dt;
    if (p.y > LH) p.y -= LH; else if (p.y < 0) p.y += LH;
  }
  // bulles du détendeur pendant l'expiration
  if (lui.Expiration && Math.random() < 6 * dt) bulles.push({ x: (Math.random() - 0.5) * 0.6, y: 0.55, r: 0.05 + Math.random() * 0.06 });
  for (const b of bulles) { b.y -= 2.5 * dt; b.x += (Math.random() - 0.5) * 0.02; }
  bulles = bulles.filter((b) => b.y > -6);
  if (etat === "plongee" && moi.Profondeur <= 0) { etat = "fin"; relacherTout(); }
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
  const jaugeW = portrait ? 50 : 70, colG = jaugeW + (portrait ? 120 : 220); // jauge tout à gauche, puis mes boutons
  const BH = portrait ? 170 : 200; // hauteur du bandeau de profil
  // eau : plus claire près de la surface
  const t = clamp(moi.Profondeur / 25, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, `hsl(205, 80%, ${55 - 30 * t}%)`); g.addColorStop(1, `hsl(215, 85%, ${35 - 22 * t}%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const p of particules) { ctx.beginPath(); ctx.arc(p.x * LW, p.y, p.r, 0, 2 * Math.PI); ctx.fill(); }

  // le plongeur face à nous
  const zone = LW - colG - 10;
  const R = Math.min(220, zone * 0.4); // plongeur proche (2x la taille du premier prototype)
  const cx = colG + zone / 2;
  const e = clamp(ecartAff / ECART_MAX, -1, 1);   // -1 : lui plus léger ; +1 : lui plus lourd
  // Centre de la tête (hy) : yeux à hy - 0,08R, menton à hy + 0,9R, front à hy - 0,66R.
  // Équilibre : yeux au milieu de l'écran entier. -3 kg : menton sous le bandeau. +3 kg : front en bas de l'écran.
  const yHaut = BH - 0.9 * R, yMilieu = LH / 2 + 0.08 * R, yBas = LH + 0.66 * R;
  const hy = e < 0 ? yMilieu + (yMilieu - yHaut) * e : yMilieu + (yBas - yMilieu) * e;
  ctx.save(); ctx.beginPath(); ctx.rect(0, BH, LW, LH - BH); ctx.clip();
  dessinerBinome(cx, hy, R, colG);
  ctx.restore();

  // ses commandes, attachées à son équipement (gardées à l'écran pour rester utilisables)
  const bw = portrait ? 130 : 190, bh = portrait ? 70 : 80;
  // boutons à côté du corps, reliés par un trait à la tirette et à l'inflateur
  const ord = portrait ? { w: 210, h: 150 } : { w: 300, h: 200 }; // ordinateur de plongée, en haut à droite
  ord.x = LW - ord.w - 8; ord.y = BH + 8;
  const bx1 = clamp(cx - 1.9 * R - bw, colG + 5, LW - bw - 5);
  const bx2 = clamp(cx + 1.9 * R, colG + 5, LW - bw - 5);
  const by1 = clamp(hy + 1.6 * R - bh / 2, BH + 90, LH - 2 * bh - 20), by2 = clamp(hy + 2.5 * R - bh / 2, ord.y + ord.h + 10, LH - bh - 10);
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(bx1 + bw, by1 + bh / 2); ctx.lineTo(cx - 1.25 * R, hy + 1.6 * R);
  ctx.moveTo(bx2, by2 + bh / 2); ctx.lineTo(cx + 1.3 * R, hy + 2.5 * R); ctx.stroke(); ctx.setLineDash([]);
  bouton("saPurge", "Sa purge", bx1, by1, bw, bh, "#E070E0", lui, "IsPurge");
  bouton("sonInfl", "Son inflateur", bx2, by2, bw, bh, "#FFC0CB", lui, "IsInflateur");

  // mes commandes à gauche
  const mh = portrait ? 120 : 150;
  const mw = colG - jaugeW - 20, ym = (BH + LH) / 2 + 40;
  bouton("monInfl", "Mon inflateur", jaugeW + 10, ym - mh - 10, mw, mh, "#FFC0CB", moi, "IsInflateur");
  bouton("maPurge", "Ma purge", jaugeW + 10, ym + 10, mw, mh, "#E070E0", moi, "IsPurge");

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
  if (etat !== "plongee") bouton("param", "Paramètres", jaugeW + 10, BH + 10, colG - jaugeW - 20, 64, "#DDDDDD");
  ctx.fillStyle = "#fff"; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.font = `bold ${portrait ? 20 : 24}px ${FONT}`;
  ctx.fillText("← Niveau 1", jaugeW + 12, BH + 90);
  boutons.push({ id: "niveau1", x: jaugeW, y: BH + 80, w: 160, h: 50 });
  dessinerProfil(BH, portrait);
  if (etat === "plongee" && moi.time < DECOMPTE) { // décompte
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.arc(cx, LH / 2, 110, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold 150px ${FONT}`;
    ctx.fillText(String(Math.ceil(DECOMPTE - moi.time)), cx, LH / 2 + 8);
  }

  const ymid = (BH + LH) / 2;
  if (etat === "attente") { bandeau(portrait ? ["Remontée assistée", "depuis " + fr(DEPART, 0) + " m"] : ["Remontée assistée depuis " + fr(DEPART, 0) + " m"], cx, ymid - (portrait ? 110 : 90)); boutonGo(cx, ymid); }
  if (etat === "fin") { bandeau(["Surface en " + ts, "Vitesse max " + vMax.toFixed(0) + " m/min",
    "Au-dessus du vert : " + tHorsVert.toFixed(0) + " s"], cx, ymid - 130); boutonGo(cx, ymid); }
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
  const v = vAff, col = v > 15 ? "#ff3030" : v > 9.6 ? "#ffa500" : v > 4.8 ? "#ffff00" : v > -0.5 ? "#30e030" : "#ffffff";
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
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, LW, BH);
  ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = `bold ${portrait ? 18 : 22}px ${FONT}`;
  ctx.fillText(portrait ? "10 m/min → 10 m, 5 m/min, palier 30 s à 3 m" : "Profil : 10 m/min jusqu'à 10 m, puis 5 m/min, palier de 30 s à 3 m", 10, 6);
  const x0 = portrait ? 50 : 60, x1 = LW - 20, y0 = portrait ? 36 : 42, y1 = BH - 26;
  const tFin = profil[profil.length - 1].t + 10, D = Math.max(DEPART, 1);
  const X = (t) => x0 + (x1 - x0) * t / tFin, Y = (d) => y0 + (y1 - y0) * d / D;
  ctx.font = `${portrait ? 16 : 18}px ${FONT}`; ctx.textBaseline = "middle"; ctx.textAlign = "right";
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
  for (const d of [...new Set([0, 3, 10, DEPART])].filter((d) => d <= DEPART)) {
    ctx.beginPath(); ctx.moveTo(x0, Y(d)); ctx.lineTo(x1, Y(d)); ctx.stroke();
    ctx.fillStyle = "#ddd"; ctx.fillText(fr(d, 0) + "m", x0 - 6, Y(d));
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let t = 60; t < tFin; t += 60) {
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

// Plongeur vu de face, tête centrée en (cx, hy), rayon de tête R. colG : bord droit de ma colonne de boutons.
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
  // direct system : annelé de l'épaule gauche (à droite de l'écran) jusqu'à la poitrine
  ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 0.22 * R; ctx.lineCap = "butt";
  ctx.beginPath(); ctx.moveTo(cx + 0.9 * R, hy + 0.9 * R);
  ctx.quadraticCurveTo(cx + 1.6 * R, hy + 1.6 * R, cx + 1.3 * R, hy + 2.3 * R); ctx.stroke();
  ctx.strokeStyle = "#555"; ctx.lineWidth = 0.03 * R;
  for (let i = 1; i < 9; i++) { // anneaux
    const u = i / 9, px = (1 - u) * (1 - u) * 0.9 + 2 * u * (1 - u) * 1.6 + u * u * 1.3, py = (1 - u) * (1 - u) * 0.9 + 2 * u * (1 - u) * 1.6 + u * u * 2.3;
    ctx.beginPath(); ctx.moveTo(cx + (px - 0.11) * R, hy + py * R); ctx.lineTo(cx + (px + 0.11) * R, hy + py * R); ctx.stroke();
  }
  ctx.fillStyle = "#3b3b3b"; rrect(cx + 1.12 * R, hy + 2.25 * R, 0.36 * R, 0.55 * R, 0.08 * R); ctx.fill();
  ctx.fillStyle = "#f5c400"; ctx.beginPath(); ctx.arc(cx + 1.3 * R, hy + 2.42 * R, 0.09 * R, 0, 2 * Math.PI); ctx.fill();
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
  if (b && b.id === "niveau1") { location.href = "index.html"; return; }
  if (!b) return;
  if (b.id === "param") { ouvrirParams(); return; }
  if (b.id === "go") {
    if (etat === "fin") nouvellePartie();
    etat = "plongee"; precedent = performance.now(); accu = 0; return;
  }
  if (etat === "plongee" && b.m) { b.m[b.champ] = true; appuis.set(e.pointerId, b); cv.setPointerCapture(e.pointerId); }
});
function relacher(e) { const b = appuis.get(e.pointerId); if (b) { b.m[b.champ] = false; appuis.delete(e.pointerId); } }
cv.addEventListener("pointerup", relacher);
cv.addEventListener("pointercancel", relacher);
cv.addEventListener("contextmenu", (e) => e.preventDefault());
function relacherTout() { appuis.clear(); for (const m of [moi, lui]) m.IsInflateur = m.IsPurge = false; }
// molette : mon volume pulmonaire moyen (±0,1 L), comme le niveau 1
cv.addEventListener("wheel", (e) => { e.preventDefault(); moi.OffsetRespiration += e.deltaY < 0 ? 0.1 : -0.1; }, { passive: false });

// ---------- paramètres : profondeur de départ et caractéristiques de chaque plongeur ----------
const PARAMS = [
  ["Profondeur de départ (m)", () => DEPART, (v) => { DEPART = clamp(v, 1, 25); }],
  ["Ma masse (kg)", () => moi.MassePlongeur, (v) => { moi.MassePlongeur = v; }],
  ["Mon volume (L)", () => moi.VolumePlongeur, (v) => { moi.VolumePlongeur = v; }],
  ["Mon lest (kg)", () => moi.LestPlongeur, (v) => { moi.LestPlongeur = v; }],
  ["Sa masse (kg)", () => lui.MassePlongeur, (v) => { lui.MassePlongeur = v; }],
  ["Son volume (L)", () => lui.VolumePlongeur, (v) => { lui.VolumePlongeur = v; }],
  ["Son lest (kg)", () => lui.LestPlongeur, (v) => { lui.LestPlongeur = v; }],
];
const panneau = document.getElementById("params"), champs = document.getElementById("champs");
const entrees = PARAMS.map(([label]) => {
  const l = document.createElement("label"); l.textContent = label;
  const i = document.createElement("input"); i.type = "text"; i.inputMode = "decimal";
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
