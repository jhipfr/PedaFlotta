// Mode téléphone vertical (ajout web, pas dans la V2.6).
// - Seuls les boutons Gilet et Purge sont en bas ; le curseur poumon reste à droite.
// - Le fond défile horizontalement : l'écran représente 1 minute de plongée. Le plongeur part
//   à gauche, puis reste à 25 % de la largeur et c'est le fond qui défile vers la gauche.
// - Les oscilloscopes poumon/gilet sont affichés à droite avec une opacité de 50 %.
// Ce fichier réutilise l'état de app.js (trajectoire, bulles, marqueurs…) en le convertissant
// des pixels du mode paysage vers des secondes et des mètres.
"use strict";

const PW = 1080;                 // largeur logique en portrait
const P_BTN_H = 260;             // zone des boutons en bas
const P_SLIDER_W = 120;          // curseur poumon à droite
const P_GAUGE_W = 90;            // jauge de vitesse à gauche
const P_VIOLET = "#C060FF";       // violet du gilet éclairci pour rester lisible à 50 % d'opacité
const P_SPRITE_W = 150, P_SPRITE_H = 110;
const P_FONT = "bold 40px 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
let PH = 1920, P_SC = PH - P_BTN_H; // hauteur totale, hauteur de la scène

// conversions paysage -> (s, m)
const tOfX = (x) => x / TW * model.TempsPlongee;
const dOfY = (y) => (y - TH / 7) / (TH * 6 / 7) * 30;
// scène portrait
const pxPerS = () => PW / 60;
const yOfD = (d) => P_SC / 7 + P_SC * 6 / 7 * d / 30;

function portraitResize(vw, vh) {
  PH = PW * vh / vw;
  P_SC = PH - P_BTN_H;
  SKY = 0; SH = PH;
  scale = vw / PW;
  stage.style.transform = `scale(${scale})`;
  stage.style.width = PW + "px"; stage.style.height = PH + "px";
  cv.style.width = PW + "px"; cv.style.height = PH + "px";
  k = scale * (window.devicePixelRatio || 1);
  cv.width = Math.round(PW * k); cv.height = Math.round(PH * k);
  const ui = $("portraitUI");
  for (const id of ["slider", "wGilet", "wPurge", "wParam"]) ui.appendChild($(id));
  place(ui, 0, 0, PW, PH);
  const top = P_SC / 7;
  place($("slider"), PW - P_SLIDER_W, top, P_SLIDER_W, P_SC - top);
  sliderH = P_SC - top;
  const bw = PW / 2 - 60;
  place($("wGilet"), 40, P_SC + 30, bw, P_BTN_H - 60);
  place($("wPurge"), PW / 2 + 20, P_SC + 30, bw, P_BTN_H - 60);
  place($("wParam"), 10, 10, 300, 90);                 // Paramètres en haut à gauche
  place($("params"), 0, 0, PW, PH);
  place($("wParamClose"), PW / 2 - 200, PH - 200, 400, 140);
  layoutParams();
  updateSlider();
  dirty = true;
}

function landscapeRestore() {
  const inner = $("inner");
  for (const id of ["slider", "wGilet", "wPurge", "wParam"]) inner.appendChild($(id));
  stage.style.width = W + "px";
  cv.style.width = W + "px";
  layout();
  sliderH = SLIDER.h;
  updateSlider();
}

function drawPortrait() {
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const ps = pxPerS();
  const xd = Math.max(0, model.time) * ps;            // position du plongeur dans le monde
  const camX = Math.max(0, xd - 0.25 * PW);          // défilement à partir de 25 % de l'écran
  const X = (t) => t * ps - camX;
  const sceneW = PW - P_SLIDER_W;

  // fonds : ciel, eau, sable, zone boutons
  const g = ctx.createLinearGradient(0, 0, 0, P_SC);
  g.addColorStop(0, COL.Cyan); g.addColorStop(1 / 7 - 0.001, COL.Cyan); g.addColorStop(1 / 7, COL.Blue);
  g.addColorStop(6 / 7 - 0.002, COL.DarkBlue); g.addColorStop(6 / 7, COL.Beige); g.addColorStop(1, COL.Beige);
  ctx.fillStyle = g; ctx.fillRect(0, 0, PW, P_SC);
  ctx.fillStyle = COL.Beige; ctx.fillRect(0, P_SC, PW, PH - P_SC);
  tileH(imgCiel, 0, PW, 0, P_SC / 7, camX * 0.3);              // nuages en parallaxe
  tileH(imgSable, 0, PW, P_SC * 6 / 7, PH - P_SC * 6 / 7, camX); // fond défilant avec le plongeur

  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, sceneW, P_SC); ctx.clip();
  // lignes de temps (chaque minute) et de profondeur (tous les 5 m)
  const t0 = camX / ps, t1 = t0 + PW / ps;
  for (let m = Math.ceil(t0 / 60); m * 60 <= t1; m++) {
    const x = X(m * 60);
    line(x, yOfD(25), x, P_SC / 7, COL.Gray, 2);
    if (m > 0) ptext(m + "min", x + 8, P_SC / 7 - 50, COL.Red);
  }
  for (let d = 0; d <= 20; d += 5) {
    line(0, yOfD(d), sceneW, yOfD(d), COL.Gray, 2);
    if (d > 0) ptext(d + "m", P_GAUGE_W + 10, yOfD(d) - 48, COL.Red);
  }
  // récif (mêmes coordonnées que la V2.6 : 1,7 à 2,7 min, sommet à 19,5 m)
  ctx.fillStyle = COL.Brown; ctx.beginPath();
  ctx.moveTo(X(102), yOfD(25)); ctx.lineTo(X(109.8), yOfD(19.5));
  ctx.lineTo(X(114), yOfD(19.5)); ctx.lineTo(X(162), yOfD(25)); ctx.closePath(); ctx.fill();
  // profil guide
  ctx.strokeStyle = COL.Red; ctx.lineWidth = 6; ctx.lineJoin = "miter"; ctx.beginPath();
  model.GuideCollection.forEach((p, i) => (i ? ctx.lineTo(X(p.x), yOfD(p.y)) : ctx.moveTo(X(p.x), yOfD(p.y))));
  ctx.stroke();
  // trajectoire
  if (traj.length > 1) {
    ctx.strokeStyle = COL.White; ctx.lineWidth = 7; ctx.beginPath();
    let started = false;
    for (const p of traj) {
      const t = tOfX(p.x);
      if (t < t0 - 2) continue;
      const x = X(t), y = yOfD(dOfY(p.y));
      if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
    }
    ctx.stroke();
  }
  // marqueurs gilet / purge (durée en haut de l'écran)
  for (const m of markers) {
    const x = X(tOfX(m.rx));
    const bw = tOfX(m.rw) * ps, my = 205 + Math.round((m.ly - (TH / 32 + 25)) / 20) * 8;
    ctx.fillStyle = m.color; ctx.fillRect(x, my, bw, 22); // sous les informations, pour ne pas passer sous « Paramètres »
    ptext(m.text, x + bw + 6, my - 4, m.color, 30);
  }
  // bulles
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (const bb of bubbles) {
    const r = bb.w; // diamètre paysage x2 -> rayon
    ctx.beginPath(); ctx.arc(X(tOfX(bb.x)), yOfD(dOfY(bb.y)), r, 0, 2 * Math.PI); ctx.fill();
  }
  // plongeur : tête au point courant, image centrée verticalement sur le profil
  if (imgDiver.complete && imgDiver.naturalWidth) {
    const r = Math.min(P_SPRITE_W / imgDiver.naturalWidth, P_SPRITE_H / imgDiver.naturalHeight);
    const dw = imgDiver.naturalWidth * r, dh = imgDiver.naturalHeight * r;
    ctx.drawImage(imgDiver, xd - camX - dw, yOfD(model.Profondeur) - dh / 2, dw, dh);
  }
  ctx.restore();

  // jauge de vitesse à gauche (mêmes couleurs et échelle ±30 m/min que la V2.6)
  {
    const gy = P_SC / 7, gh = P_SC * 5 / 7;
    const gg = ctx.createLinearGradient(0, gy, 0, gy + gh);
    for (const [o, c] of [[0, COL.Red], [0.25, COL.Red], [0.25, COL.Orange], [0.339, COL.Orange], [0.34, COL.Yellow], [0.419, COL.Yellow],
      [0.42, COL.Green], [0.5, COL.Green], [0.5, COL.LightGreen], [1, COL.LightGreen]]) gg.addColorStop(o, c);
    ctx.fillStyle = gg; ctx.fillRect(0, gy, P_GAUGE_W, gh);
    const v = Math.max(-30, Math.min(30, model.Vitesse));
    ctx.fillStyle = COL.Black; ctx.fillRect(0, gy + gh / 2 - gh * v / 60 - 5, P_GAUGE_W, 10);
  }

  // oscilloscopes à droite, opacité 50 %
  if (oscVisible) {
    const w = 400, h = 240, x = sceneW - w - 20;
    const yl = P_SC / 2 - 1.5 * h - 20, yg = P_SC / 2 - h / 2, yc = P_SC / 2 + h / 2 + 20;
    ctx.save(); ctx.globalAlpha = 0.5;
    scope({ x, y: yl, w, h }, model.CollectionSample.map((s) => s.poumon), model.VolumeMaxPoumon, COL.DarkGray, [1, 2, 3, 4].map((i) => w * i / 4));
    scope({ x, y: yg, w, h }, giletFlat ? null : model.CollectionSample.map((s) => s.gilet), model.VolumeMaxDuGilet, P_VIOLET, [1, 2, 3, 4].map((i) => w * i / 4));
    scope({ x, y: yc, w, h }, model.CollectionSample.map((s) => s.combi), Math.max(model.VolumeCombinaison, 0.1), COL.Orange, [1, 2, 3, 4].map((i) => w * i / 4));
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.8;
    ptext("Poumon " + fr(model.VolumePoumonInstant, 2) + "L", x + 10, yl + h - 52, COL.Black, 32);
    ptext("Gilet " + fr(model.VolumeFlottaisonDuGilet, 2) + "L", x + 10, yg + h - 52, COL.White, 32);
    ptext("Combinaison " + fr(model.FlottaCombi, 2) + "L", x + 10, yc + h - 52, COL.Black, 32);
    ctx.restore();
  }

  // informations en haut (dans le ciel)
  const tt = model.time, ts = tt < 60 ? Math.trunc(Math.max(0, tt)) + "s"
    : String(Math.trunc(tt / 60)).padStart(2, "0") + "m:" + String(Math.trunc(tt) % 60).padStart(2, "0") + "s";
  ptext(ts + "   " + fr(model.Profondeur, 1) + "m   " + model.Vitesse.toFixed(0) + "m/min", 20, 112, COL.Black);
  ptext("Masse app. " + fr(model.MasseApparentePlongeur, 1) + "kg", 20, 162, COL.Black, 34);
  ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillStyle = COL.Black; // score en haut à droite
  ctx.font = P_FONT.replace("40px", "34px"); ctx.fillText("Score", PW - 20, 18);
  ctx.font = P_FONT.replace("40px", "56px"); ctx.fillText(score.toFixed(0), PW - 20, 56);
  if (!isPause && !ended) centerText("Appuyer pour démarrer", P_SC / 2 - 200);
  if (ended) centerText("Fin de plongée : appuyer pour recommencer", P_SC / 2 - 200);
}

function ptext(s, x, y, color, size = 40) {
  ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.font = P_FONT.replace("40px", size + "px");
  ctx.fillText(s, x, y);
}
function centerText(s, y) {
  ctx.font = P_FONT.replace("40px", "44px"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(s).width + 60;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect((PW - P_SLIDER_W) / 2 - w / 2, y - 45, w, 90);
  ctx.fillStyle = COL.White; ctx.fillText(s, (PW - P_SLIDER_W) / 2, y);
}
