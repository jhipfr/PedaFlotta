// PedaFlotta niveau 2 : remontée assistée. On tient un plongeur face à nous (vue subjective).
// Les deux plongeurs utilisent model.js ; ils sont accrochés : même profondeur, même vitesse.
// Le mouvement commun vient de la somme des deux masses apparentes, avec des frottements doublés
// (deux fois plus de surface face à l'eau). L'écart de flottabilité entre lui et moi décale son image
// verticalement : 2 kg plus léger, son front sort par le haut ; 2 kg plus lourd, on ne voit que le haut de sa tête.
"use strict";

const STEP = 0.01;           // pas de calcul (s), comme le niveau 1
const DEPART = 20;           // profondeur de départ (m)
const ECART_MAX = 2;         // kg : écart de flottabilité qui amène la tête en butée haute ou basse
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
  vMax = 0; tHorsVert = 0; bulles = [];
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
  vMax = Math.max(vMax, moi.Vitesse);
  if (moi.Vitesse > 4.8) tHorsVert += dt; // 4,8 m/min : haut de la zone verte de la jauge (comme le niveau 1)
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
  const actif = m[champ];
  boutons.push({ id, x, y, w, h, m, champ });
  ctx.fillStyle = actif ? "#00C000" : couleur; ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
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
  const colG = portrait ? 130 : 230, jaugeW = portrait ? 50 : 70;
  // eau : plus claire près de la surface
  const t = clamp(moi.Profondeur / 25, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, `hsl(205, 80%, ${55 - 30 * t}%)`); g.addColorStop(1, `hsl(215, 85%, ${35 - 22 * t}%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const p of particules) { ctx.beginPath(); ctx.arc(p.x * LW, p.y, p.r, 0, 2 * Math.PI); ctx.fill(); }

  // le plongeur face à nous
  const zone = LW - colG - jaugeW;
  const R = Math.min(110, zone * 0.2);
  const cx = colG + zone / 2;
  const e = clamp(ecartAff / ECART_MAX, -1, 1);   // -1 : lui plus léger ; +1 : lui plus lourd
  const yHaut = 0.3 * R, yBas = LH + 0.2 * R;      // centre de la tête aux deux butées
  const hy = yHaut + (yBas - yHaut) * (e + 1) / 2;
  dessinerBinome(cx, hy, R, colG);

  // ses commandes, attachées à son équipement (gardées à l'écran pour rester utilisables)
  const bw = portrait ? 130 : 190, bh = portrait ? 70 : 80;
  // boutons à côté du corps, reliés par un trait à la tirette et à l'inflateur
  const bx1 = clamp(cx - 1.9 * R - bw, colG + 5, LW - jaugeW - bw - 5);
  const bx2 = clamp(cx + 1.9 * R, colG + 5, LW - jaugeW - bw - 5);
  const by1 = clamp(hy + 1.6 * R - bh / 2, 150, LH - 2 * bh - 20), by2 = clamp(hy + 2.5 * R - bh / 2, 150 + bh + 10, LH - bh - 10);
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(bx1 + bw, by1 + bh / 2); ctx.lineTo(cx - 1.25 * R, hy + 1.6 * R);
  ctx.moveTo(bx2, by2 + bh / 2); ctx.lineTo(cx + 1.3 * R, hy + 2.5 * R); ctx.stroke(); ctx.setLineDash([]);
  bouton("saPurge", "Sa purge", bx1, by1, bw, bh, "#E070E0", lui, "IsPurge");
  bouton("sonInfl", "Son inflateur", bx2, by2, bw, bh, "#FFC0CB", lui, "IsInflateur");

  // mes commandes à gauche
  const mw = colG - 20, mh = portrait ? 120 : 150;
  bouton("monInfl", "Mon inflateur", 10, LH / 2 - mh - 10, mw, mh, "#FFC0CB", moi, "IsInflateur");
  bouton("maPurge", "Ma purge", 10, LH / 2 + 10, mw, mh, "#E070E0", moi, "IsPurge");

  // jauge de vitesse à droite (couleurs et échelle ±30 m/min du niveau 1)
  {
    const gx = LW - jaugeW, gy = 120, gh = LH - 240;
    const gg = ctx.createLinearGradient(0, gy, 0, gy + gh);
    for (const [o, c] of [[0, "#FF0000"], [0.25, "#FF0000"], [0.25, "#FFA500"], [0.339, "#FFA500"], [0.34, "#FFFF00"], [0.419, "#FFFF00"],
      [0.42, "#008000"], [0.5, "#008000"], [0.5, "#90EE90"], [1, "#90EE90"]]) gg.addColorStop(o, c);
    ctx.fillStyle = gg; ctx.fillRect(gx, gy, jaugeW, gh);
    const v = clamp(moi.Vitesse, -30, 30);
    ctx.fillStyle = "#000"; ctx.fillRect(gx, gy + gh / 2 - gh * v / 60 - 5, jaugeW, 10);
  }

  // informations en haut
  const tt = Math.max(0, moi.time);
  const ts = tt < 60 ? Math.trunc(tt) + "s" : String(Math.trunc(tt / 60)).padStart(2, "0") + "m:" + String(Math.trunc(tt) % 60).padStart(2, "0") + "s";
  ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.font = `bold 48px ${FONT}`; ctx.fillText(ts, LW / 2, 12);
  ctx.font = `bold 40px ${FONT}`; ctx.fillText(fr(moi.Profondeur, 1) + " m", LW / 2, 64);
  ctx.textAlign = "left"; ctx.font = `bold 36px ${FONT}`;
  ctx.fillText(moi.Vitesse.toFixed(0) + " m/min", 12, 16);
  ctx.font = `bold 24px ${FONT}`; ctx.fillText("Niveau 2", 12, 60);
  ctx.textAlign = "right"; ctx.font = `bold 24px ${FONT}`;
  ctx.fillText("← Niveau 1", LW - 12, 16);
  boutons.push({ id: "niveau1", x: LW - 160, y: 0, w: 160, h: 56 });

  if (etat === "attente") bandeau(["Remontée assistée depuis " + DEPART + " m", "Appuyer pour commencer"], cx);
  if (etat === "fin") bandeau(["Surface en " + ts, "Vitesse max " + vMax.toFixed(0) + " m/min",
    "Au-dessus du vert : " + tHorsVert.toFixed(0) + " s", "Appuyer pour recommencer"], cx);
}

function bandeau(lignes, cx) {
  const fs = LW < 800 ? 30 : 40, lh = fs * 1.4;
  ctx.font = `bold ${fs}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = Math.min(LW - 20, Math.max(...lignes.map((l) => ctx.measureText(l).width)) + 60), h = lignes.length * lh + 40;
  const x = clamp(cx - w / 2, 10, LW - w - 10);
  ctx.fillStyle = "rgba(0,0,0,0.6)"; rrect(x, LH / 2 - h / 2, w, h, 16); ctx.fill();
  ctx.fillStyle = "#fff";
  lignes.forEach((l, i) => ctx.fillText(l, x + w / 2, LH / 2 - h / 2 + 20 + lh * (i + 0.5)));
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
  if (etat === "attente") { etat = "plongee"; precedent = performance.now(); accu = 0; return; }
  if (etat === "fin") { nouvellePartie(); return; }
  if (b && b.m) { b.m[b.champ] = true; appuis.set(e.pointerId, b); cv.setPointerCapture(e.pointerId); }
});
function relacher(e) { const b = appuis.get(e.pointerId); if (b) { b.m[b.champ] = false; appuis.delete(e.pointerId); } }
cv.addEventListener("pointerup", relacher);
cv.addEventListener("pointercancel", relacher);
cv.addEventListener("contextmenu", (e) => e.preventDefault());
function relacherTout() { appuis.clear(); for (const m of [moi, lui]) m.IsInflateur = m.IsPurge = false; }
// molette : mon volume pulmonaire moyen (±0,1 L), comme le niveau 1
cv.addEventListener("wheel", (e) => { e.preventDefault(); moi.OffsetRespiration += e.deltaY < 0 ? 0.1 : -0.1; }, { passive: false });

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
