// Portage JavaScript de MainWindow.xaml / MainWindow.xaml.cs (PedaFlotta V2.6).
// La mise en page est exprimée dans un repère logique 1920 x 1080 (fenêtre WPF maximisée)
// mis à l'échelle de l'écran. Si l'écran est plus haut que 16:9, le ciel est agrandi
// (bande SKY ajoutée en haut) au lieu d'afficher des bandes noires.
// La simulation avance par pas fixes de 10 ms, cadencés par l'horloge réelle : le
// résultat ne dépend plus de la fréquence d'affichage de l'appareil.
"use strict";

const W = 1920, H = 1080;
const R = H / 7;                         // une "ligne" de la grille principale (1* sur 7*)
const C0 = W * 2 / 19.5;                 // colonne gauche (2*)
const C1 = W * 16 / 19.5;                // colonne centrale (16*)
const C2 = W * 1.5 / 19.5;               // colonne droite (1.5*)
const X1 = C0, X2 = C0 + C1;
const TW = C1, TH = H;                   // CanvasTraj
const TVH = 6 * H / 7;                   // CanvasTrajVitesse (RowSpan 2)
const GAUGE = { x: 0, y: R, w: C0, h: 5 * R };          // CanvasVitesse
const SLIDER = { x: X2, y: R, w: C2, h: 5 * R };        // OffsetPoumonSlider
const OSC_X = X1 + TW * 16 / 22, OSC_W = TW * 5 / 22;   // grille "f", colonne 1
// Trois oscilloscopes (poumon, gilet, combinaison) dans la zone qui en contenait deux.
const LUNG_CELL = { x: OSC_X, y: 3 * R, w: OSC_W, h: R };
const GILET_CELL = { x: OSC_X, y: 4 * R, w: OSC_W, h: R };
const COMBI_CELL = { x: OSC_X, y: 5 * R, w: OSC_W, h: R };
const inset = (c, m) => ({ x: c.x + m, y: c.y + m, w: c.w - 2 * m, h: c.h - 2 * m });
const LUNG = inset(LUNG_CELL, 10), GILET = inset(GILET_CELL, 10), COMBI = inset(COMBI_CELL, 10);

const COL = {
  Cyan: "#00FFFF", Beige: "#F5F5DC", Blue: "#0000FF", DarkBlue: "#00008B", Brown: "#A52A2A",
  Purple: "#800080", Pink: "#FFC0CB", DeepSkyBlue: "#00BFFF", LightGreen: "#90EE90", Green: "#008000",
  Yellow: "#FFFF00", Orange: "#FFA500", Red: "#FF0000", Lime: "#00FF00", LightGray: "#D3D3D3",
  DarkGray: "#A9A9A9", Gray: "#808080", White: "#FFFFFF", Black: "#000000",
};
const FONT = "bold 20px 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
const fr = (x, d) => x.toFixed(d).replace(".", ","); // ToString("0.00") en culture fr-FR

const model = new Model();

// ---------- état de la vue (champs de MainWindow) ----------
let xPlongeur = 0, decalageEtiquette = 0, LastEtiquette = -21;
// Valeurs V2.6 par tick de 10 ms converties en valeurs par seconde :
const vitesseAscension = 15, Grossissement = 1, frequenceBulles = 5; // px/s, px/s, bulles/s pendant l'expiration
const STEP = 0.01; // s, pas de calcul fixe
let score = 0, tempo = 0, deltatempo = 0, a = 0, b = 1;
let traj = [], guide = [], markers = [], bubbles = [];
let lungGridX = [], giletGridX = [];
let lastVit = { x: 0, y: 0 }, lastOff = { x: 0, y: 0 };
let speedSegs = [];
let sprite = { x: -75, y: 0 };
let giletFlat = true;          // polygone gilet de InitCollection (avant 1er rafraîchissement)
let oscVisible = true, speedVisible = false, paramsVisible = false;
let sliderEnabled = false;
const enabled = { purge: true, purgeRapide: true, restart: true, gilet: true };

// ---------- éléments DOM ----------
const $ = (id) => document.getElementById(id);
const stage = $("stage"), cv = $("cv"), ctx = cv.getContext("2d");
const speedLayer = document.createElement("canvas"), sctx = speedLayer.getContext("2d");
const imgDiver = new Image(); imgDiver.src = "img/plongeur.png"; imgDiver.onload = () => { dirty = true; };
let PORTRAIT = false, ended = false, sliderH = SLIDER.h;
let scale = 1, k = 1, dirty = true, SKY = 0, SH = H; // SKY : hauteur de ciel ajoutée, SH : hauteur totale

function place(el, x, y, w, h) {
  Object.assign(el.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
}

function layout() {
  place($("timeCell"), 0, 0, C0, R);
  place($("vitCell"), 0, 0, C0, R);
  place($("scoreCell"), X2, 0, C2, R);
  place($("pbCell"), X2, 0, C2, R);
  place($("slider"), SLIDER.x, SLIDER.y, SLIDER.w, SLIDER.h);
  place($("souris"), X2, 6 * R + 10, C2, R - 20);
  place($("lungInfo"), LUNG_CELL.x + 10, LUNG_CELL.y + LUNG_CELL.h * 3 / 4, LUNG_CELL.w - 20, LUNG_CELL.h / 4);
  place($("giletRel"), GILET_CELL.x + 10, GILET_CELL.y + GILET_CELL.h / 2, GILET_CELL.w - 20, GILET_CELL.h / 4);
  place($("giletAbs"), GILET_CELL.x + 10, GILET_CELL.y + GILET_CELL.h * 3 / 4, GILET_CELL.w - 20, GILET_CELL.h / 4);
  place($("combiInfo"), COMBI_CELL.x + 10, COMBI_CELL.y + COMBI_CELL.h * 3 / 4, COMBI_CELL.w - 20, COMBI_CELL.h / 4);
  const u = (2 * R) / 6, iy = 4 * R;
  place($("profLbl"), X1 + 10, iy + 2 * u, TW * 16 / 22, u);
  place($("massLbl"), X1 + 10, iy + 3 * u, TW * 16 / 22, u);
  place($("blocLbl"), X1 + 10, iy + 4 * u, TW * 16 / 22, u);
  // Rangée de boutons (GridButtons) : colonnes 1,3,2,3,...,1 (35 unités), lignes 1:4:1
  const bu = TW / 35, by = 6 * R + R / 6, bh = R * 4 / 6;
  const cell = (start, n) => [X1 + start * bu, by, n * bu, bh];
  place($("wRestart"), ...cell(1, 3));
  place($("wGraph"), ...cell(6, 3));
  place($("wPause"), ...cell(11, 13));
  place($("wGilet"), ...cell(26, 3));
  place($("wPurge"), ...cell(31, 3));
  place($("wParam"), 30, 6 * R + 30, C0 - 60, R - 60);
  place($("wParamClose"), 30, 6 * R + 30, C0 - 60, R - 60);
}

function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const wasPortrait = PORTRAIT;
  PORTRAIT = vh > vw; // téléphone tenu verticalement : vue défilante (portrait.js)
  document.body.classList.toggle("portrait", PORTRAIT);
  if (PORTRAIT) { portraitResize(vw, vh); return; }
  if (wasPortrait) landscapeRestore();
  SH = Math.max(H, W * vh / vw); // écran plus haut que 16:9 : on agrandit le ciel
  SKY = SH - H;
  scale = Math.min(vw / W, vh / SH);
  const ox = (vw - W * scale) / 2, oy = (vh - SH * scale) / 2;
  stage.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  stage.style.height = SH + "px";
  $("inner").style.top = SKY + "px";
  place($("params"), 0, 0, W, SH);
  $("paramsInner").style.top = SKY + "px";
  cv.style.height = SH + "px";
  k = scale * (window.devicePixelRatio || 1);
  cv.width = Math.round(W * k); cv.height = Math.round(SH * k);
  speedLayer.width = cv.width; speedLayer.height = cv.height;
  redrawSpeedLayer();
  dirty = true;
}

// ---------- horloge : pas fixes de 10 ms rattrapant le temps réel ----------
let running = false, previous = 0, accu = 0;
function timerStart() { running = true; previous = performance.now(); accu = 0; }
function timerStop() { running = false; }
function advance(now) {
  // Écart borné à 0,25 s : après une mise en veille ou un onglet masqué, la simulation reprend sans saut.
  accu += Math.min(0.25, Math.max(0, (now - previous) / 1000));
  previous = now;
  while (running && accu >= STEP) {
    accu -= STEP;
    model.compute(STEP);
    refreshAll(STEP);
  }
  updateLabels();
  updateSlider();
  dirty = true;
}
// IsPause : true = simulation en marche (sémantique de l'original)
let isPause = false;
function setIsPause(v) {
  if (v !== isPause) {
    isPause = v;
    if (v) timerStart(); else timerStop();
    updatePauseBtn();
  }
}

// ---------- Go / InitCollection ----------
function go() {
  model.initModel();
  previous = performance.now(); accu = 0; ended = false;
  tempo = 0; decalageEtiquette = 0; deltatempo = 0;
  setOffset(model.OffsetRespiration);
  bubbles = []; markers = []; speedSegs = [];
  sliderEnabled = true;
  oscVisible = true;
  enabled.purge = enabled.purgeRapide = enabled.restart = enabled.gilet = true;
  initCollection();
  updateButtons();
  dirty = true;
}

function initCollection() {
  a = 0; b = 1; score = 0;
  traj = [];
  guide = model.GuideCollection.map((p) => ({
    x: p.x / model.TempsPlongee * TW,
    y: p.y / (model.ProfondeurMax + model.HauteurCiel) * TH + model.HauteurCiel / (model.ProfondeurMax + model.HauteurCiel) * TH,
  }));
  lungGridX = [1, 2, 3, 4].map((i) => LUNG.w * i / 4);
  giletGridX = [1, 2, 3, 4].map((i) => GILET.w * i / 4);
  giletFlat = true;
  xPlongeur = 0;
  sprite = { x: -75, y: TH / 7 - 55 };
  lastVit = { x: 0, y: TH * 3.5 / 7 };
  lastOff = { x: 0, y: TH * 3.5 / 7 };
  redrawSpeedLayer();
}

// ---------- RefreshAll ----------
function updateLabels() {
  const t = model.time;
  let answer = "";
  if (t < 60) answer = Math.trunc(t % 60) + "s";
  else if (t < 3600) answer = String(Math.trunc(t / 60) % 60).padStart(2, "0") + "m:" + String(Math.trunc(t) % 60).padStart(2, "0") + "s";
  $("timeLbl").textContent = "Temps : " + answer;
  $("vitLbl").textContent = "Vitesse : \n" + model.Vitesse.toFixed(0) + "m/min";
  $("lungInfo").firstElementChild.textContent = "V.Instantané : " + fr(model.VolumePoumonInstant, 2) + "L";
  $("blocLbl").firstElementChild.textContent = "Pression : " + fr(model.PressionBloc, 1) + "bars / Poids air : " + fr(model.PoidsAirBloc, 1) + "kgs (accéléré 10x)";
  $("giletAbs").firstElementChild.textContent = "avec " + fr(model.VolumeNormoLitresGilet, 2) + "Normo Litres";
  $("combiInfo").firstElementChild.textContent = "Combinaison : " + fr(model.FlottaCombi, 2) + "L";
  $("giletRel").firstElementChild.textContent = "Volume du Gilet: " + fr(model.VolumeFlottaisonDuGilet, 2) + "L";
  $("massLbl").firstElementChild.textContent = "Masse apparente : " + fr(model.MasseApparentePlongeur, 2) + "kgs";
  $("profLbl").firstElementChild.textContent = "Profondeur : " + fr(model.Profondeur, 2) + "m";
}

function refreshAll(dt) {
  giletFlat = false;

  // Les bulles
  if (model.Expiration && Math.random() < frequenceBulles * dt) {
    bubbles.push({ x: Math.trunc(xPlongeur), y: Math.trunc(TH / 7 + (TH * 6 / 7) * model.Profondeur / 30), w: 4 });
  }
  for (let i = 0; i < bubbles.length; i++) { // Croissance et remontée des bulles.
    const bb = bubbles[i];
    bb.y -= vitesseAscension * dt;
    bb.w += Grossissement * dt;
    if (bb.y < TH / 7) { bubbles.splice(i, 1); i--; } // disparition des bulles
  }

  if (xPlongeur <= TW) {
    traj.push({ x: xPlongeur, y: model.Profondeur / 30 * TH * 6 / 7 + TH / 7 });
    xPlongeur = (model.time / model.TempsPlongee) * TW;
    while (b < guide.length - 1 && traj[a].x > guide[b].x) b++;
    calculScore(a, b, dt);
    a++;

    // Ligne de l'offset poumon (curseur)
    const mid = (model.OffsetMin + model.OffsetMax) / 2, half = Math.max(1e-9, (model.OffsetMax - model.OffsetMin) / 2);
    const offY = TVH / 2 - TVH / 2 * (model.OffsetRespiration - mid) / half * 5 / 7;
    addSpeedSeg(lastOff.x, lastOff.y, xPlongeur, offY, 3, COL.DeepSkyBlue);
    lastOff = { x: xPlongeur, y: offY };

    if (!model.ChronoPurge.isRunning && model.ChronoPurge.elapsedSeconds > 0) {
      addMarker(model.ChronoPurge.elapsedSeconds, model.VitesseDePurge, COL.Purple);
      model.ChronoPurge.reset();
    }
    if (!model.ChronoInflateur.isRunning && model.ChronoInflateur.elapsedSeconds > 0) {
      addMarker(model.ChronoInflateur.elapsedSeconds, model.VitesseDeRemplissage, COL.Pink);
      model.ChronoInflateur.reset();
    }

    const V = model.Vitesse;
    const vY = TVH / 2 - TVH / 2 * 6 / 7 * V / 35;
    let color = COL.Red;
    if (V < 0) color = COL.LightGreen;
    else if (V < (0.5 - 0.42) * 60) color = COL.Green;
    else if (V < (0.5 - 0.34) * 60) color = COL.Yellow;
    else if (V < (0.5 - 0.25) * 60) color = COL.Orange;
    addSpeedSeg(lastVit.x, lastVit.y, xPlongeur, vY, 5, color);
    lastVit = { x: xPlongeur, y: vY };

    tempo = model.time * LUNG.w / model.LargeurScope; // car cela représente 16s
    // Oscilloscopes : lignes verticales défilantes
    for (let i = 0; i < 4; i++) {
      let x = LUNG.w * (i + 1) / 4 - tempo + deltatempo;
      if (x <= 0) { deltatempo += LUNG.w / 4; x = LUNG.w * (i + 1) / 4 - tempo + deltatempo; }
      lungGridX[i] = x;
      let xg = GILET.w * (i + 1) / 4 - tempo + deltatempo;
      if (xg <= 0) { deltatempo += GILET.w / 4; xg = GILET.w * (i + 1) / 4 - tempo + deltatempo; }
      giletGridX[i] = xg;
    }
  } else { // fin de plongée
    ended = true;
    timerStop();
    sliderEnabled = false;
    bubbles = [];
    oscVisible = false;
    updateButtons();
  }
  sprite.x = xPlongeur - 75;
  sprite.y = TH / 7 - 55 + (TH * 6 / 7) * model.Profondeur / 30;
}

function addMarker(seconds, debit, color) {
  if (xPlongeur > LastEtiquette + 25) decalageEtiquette = 0;
  else { decalageEtiquette++; if (decalageEtiquette === 5) decalageEtiquette = 0; }
  markers.push({
    text: fr(seconds, 1), color, lx: xPlongeur, ly: TH / 32 + decalageEtiquette * 20 + 25,
    rx: xPlongeur, rh: Math.abs(TH / 8 * debit / 400), rw: (seconds / model.TempsPlongee) * TW,
  });
  LastEtiquette = xPlongeur;
}

// Score = intégrale de l'écart au profil guide, en mètres x secondes (V2.6 : somme d'écarts en pixels par tick).
const PX_PAR_M = TH / 35;
function calculScore(i, j, dt) {
  score += Math.abs(regLin(i, j) - traj[i].y) / PX_PAR_M * dt;
  $("scoreLbl").textContent = "Score : \n" + score.toFixed(0);
}
function regLin(i, j) {
  return ((guide[j].y - guide[j - 1].y) * (traj[i].x - guide[j - 1].x) / (guide[j].x - guide[j - 1].x)) + guide[j - 1].y;
}

// ---------- calque "Graphique" (CanvasTrajVitesse) ----------
function addSpeedSeg(x1, y1, x2, y2, w, color) {
  const s = { x1, y1, x2, y2, w, color };
  speedSegs.push(s);
  drawSeg(s);
}
function drawSeg(s) {
  sctx.strokeStyle = s.color; sctx.lineWidth = s.w; sctx.lineCap = "butt";
  sctx.beginPath(); sctx.moveTo(X1 + s.x1, s.y1); sctx.lineTo(X1 + s.x2, s.y2); sctx.stroke();
}
function redrawSpeedLayer() {
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, speedLayer.width, speedLayer.height);
  sctx.setTransform(k, 0, 0, k, 0, SKY * k);
  for (const s of speedSegs) drawSeg(s);
}

// ---------- dessin ----------
function vgrad(y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function line(x1, y1, x2, y2, color, w) {
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function text(s, x, y, color, align = "left") {
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "top"; ctx.font = FONT;
  ctx.fillText(s, x, y);
}

function draw() {
  if (PORTRAIT) { drawPortrait(); return; }
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = COL.Cyan; ctx.fillRect(0, 0, W, SKY + 1); // ciel ajouté (écrans plus hauts que 16:9)
  ctx.setTransform(k, 0, 0, k, 0, SKY * k);
  // Fond principal
  ctx.fillStyle = vgrad(0, H, [[0, COL.Cyan], [0.5, COL.Cyan], [0.5, COL.Beige], [1, COL.Beige]]);
  ctx.fillRect(0, 0, W, H);

  // Jauge de vitesse
  ctx.save(); ctx.translate(GAUGE.x, GAUGE.y);
  ctx.fillStyle = vgrad(0, GAUGE.h, [[0, COL.Red], [0.25, COL.Red], [0.25, COL.Orange], [0.339, COL.Orange],
    [0.34, COL.Yellow], [0.419, COL.Yellow], [0.42, COL.Green], [0.5, COL.Green], [0.5, COL.LightGreen], [1, COL.LightGreen]]);
  ctx.fillRect(0, 0, GAUGE.w, GAUGE.h);
  const v = Math.max(-30, Math.min(30, model.Vitesse));
  ctx.fillStyle = COL.Black;
  ctx.fillRect(0, GAUGE.h / 2 - GAUGE.h * v / 60 - 5 / 2, GAUGE.w, 5);
  ctx.restore();

  // Profil de plongée (CanvasTraj)
  ctx.save(); ctx.translate(X1, 0);
  ctx.fillStyle = vgrad(0, TH, [[0, COL.Cyan], [0.142, COL.Cyan], [0.143, COL.Blue], [0.854, COL.DarkBlue], [0.857, COL.Beige], [1, COL.Beige]]);
  ctx.fillRect(0, 0, TW, TH);
  for (let i = 0; i <= model.TempsPlongee / 60; i++) { // Ligne de temps toutes les minutes
    const x = TW * i / (model.TempsPlongee / 60);
    line(x, TH * 6 / 7, x, 0, COL.Gray, 1);
  }
  ctx.fillStyle = COL.Brown; // Récif
  ctx.beginPath();
  ctx.moveTo(TW / 6 * 1.7, TH / 7 * 6); ctx.lineTo(TW / 6 * 1.83, TH / 7 * 4.9);
  ctx.lineTo(TW / 6 * 1.9, TH / 7 * 4.9); ctx.lineTo(TW / 6 * 2.7, TH / 7 * 6);
  ctx.closePath(); ctx.fill();
  for (let i = 1; i < 6; i++) line(0, TH * i / 7, TW, TH * i / 7, COL.Gray, 1); // Lignes de profondeur
  for (let i = 2; i < 6; i++) text(((i - 1) * 5) + "m", TW - 5, TH * i / 7 - 40 + 5, COL.Red, "right");
  for (let i = 1; i < 6; i++) text(i + "min", TW * i / 6 + 5, H * 1 / 7 - 40 + 5, COL.Red);
  ctx.lineJoin = "miter"; ctx.lineCap = "butt";
  if (traj.length > 1) {
    ctx.strokeStyle = COL.White; ctx.lineWidth = 5; ctx.beginPath();
    ctx.moveTo(traj[0].x, traj[0].y);
    for (let i = 1; i < traj.length; i++) ctx.lineTo(traj[i].x, traj[i].y);
    ctx.stroke();
  }
  ctx.strokeStyle = COL.Red; ctx.lineWidth = 4; ctx.beginPath();
  guide.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  if (imgDiver.complete && imgDiver.naturalWidth) { // Image 75x55, Stretch=Uniform
    const r = Math.min(75 / imgDiver.naturalWidth, 55 / imgDiver.naturalHeight);
    const dw = imgDiver.naturalWidth * r, dh = imgDiver.naturalHeight * r;
    // Correction demandée : image centrée verticalement sur le point du profil (l'original la posait
    // au-dessus : boîte 75x55 dont le bas est sur le profil, image de ~27 px centrée dedans).
    ctx.drawImage(imgDiver, sprite.x + (75 - dw) / 2, sprite.y + 55 - dh / 2, dw, dh);
  }
  for (const m of markers) {
    text(m.text, m.lx + 5, m.ly + 5, m.color);
    ctx.fillStyle = m.color; ctx.fillRect(m.rx, 0, m.rw, m.rh);
  }
  ctx.restore();

  // Graphique vitesse / offset
  if (speedVisible) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(speedLayer, 0, 0); ctx.setTransform(k, 0, 0, k, 0, SKY * k); }

  // Bulles
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (const bb of bubbles) {
    ctx.beginPath(); ctx.ellipse(X1 + bb.x + bb.w / 2, bb.y + bb.w / 2, bb.w / 2, bb.w / 2, 0, 0, 2 * Math.PI); ctx.fill();
  }

  // Oscilloscopes poumon / gilet
  if (oscVisible) {
    scope(LUNG, model.CollectionSample.map((s) => s.poumon), model.VolumeMaxPoumon, COL.DarkGray, lungGridX);
    const g = giletFlat ? null : model.CollectionSample.map((s) => s.gilet);
    scope(GILET, g, model.VolumeMaxDuGilet, COL.Purple, giletGridX);
    scope(COMBI, model.CollectionSample.map((s) => s.combi), Math.max(model.VolumeCombinaison, 0.1), COL.Orange, giletGridX);
  }
}

function scope(r, values, vmax, fill, gridX) {
  ctx.save(); ctx.translate(r.x, r.y);
  ctx.fillStyle = "rgba(34,34,34,0.333)"; ctx.fillRect(0, 0, r.w, r.h);
  const cs = model.CollectionSample, t0 = cs[0].time, t1 = cs[cs.length - 1].time;
  ctx.fillStyle = fill; ctx.beginPath();
  ctx.moveTo(r.w, r.h); ctx.lineTo(0, r.h); // ScaleY=-1 : y écran = h - y
  if (values) {
    for (let i = 0; i < cs.length; i++) ctx.lineTo((cs[i].time - t0) / (t1 - t0) * r.w, r.h - values[i] / vmax * r.h);
  } else { // InitCollection : gilet plat au volume de flottaison courant
    const y = r.h - model.VolumeFlottaisonDuGilet / model.VolumeMaxDuGilet * r.h;
    ctx.lineTo(0, y); ctx.lineTo(r.w, y);
  }
  ctx.closePath(); ctx.fill();
  for (let i = 1; i < 5; i++) line(0, r.h * i / 5, r.w, r.h * i / 5, COL.White, 1);
  for (const x of gridX) line(x, 0, x, r.h, COL.White, 1);
  ctx.restore();
}

function frame(now) {
  if (running) advance(now);
  if (dirty) { draw(); dirty = false; }
  requestAnimationFrame(frame);
}

// ---------- visibilité des éléments ----------
function updateButtons() {
  for (const [id, key] of [["btnPurge", "purge"], ["btnRestart", "restart"], ["btnGilet", "gilet"]]) $(id).disabled = !enabled[key];
  for (const id of ["lungInfo", "giletRel", "giletAbs", "combiInfo"]) $(id).style.visibility = oscVisible ? "visible" : "hidden";
  $("params").style.visibility = paramsVisible ? "visible" : "hidden";
}
function updatePauseBtn() { setBg($("btnPause"), isPause ? COL.LightGray : COL.Lime); }
function setBg(btn, c) { btn.style.backgroundColor = c; btn.classList.remove("dflt"); }

// ---------- curseur poumon (OffsetPoumonSlider) ----------
const THUMB_H = 80;
function setOffset(v) { model.OffsetRespiration = v; updateSlider(); }
function updateSlider() {
  const v = model.OffsetRespiration, lo = model.OffsetMin, hi = model.OffsetMax;
  const y = hi > lo ? (hi - v) / (hi - lo) * (sliderH - THUMB_H) : 0;
  $("thumb").style.top = y + "px";
  $("thumbTxt").textContent = v.toFixed(2);
}
function sliderValueAt(clientY, grabDy) {
  const rect = $("slider").getBoundingClientRect();
  const y = (clientY - rect.top) / scale - grabDy;
  return model.OffsetMax - (y / (sliderH - THUMB_H)) * (model.OffsetMax - model.OffsetMin);
}

// ---------- paramètres ----------
const PARAMS = [
  [1, "Plongeur", [["Masse Plongeur (kg)", "MassePlongeur"], ["Volume Plongeur (L)", "VolumePlongeur"], ["Lest Plongeur (kg)", "LestPlongeur"],
    ["CoeffFrottements (N.m-2.s-2)", "CoefficientFrottement"], ["Frottements Visqueux (N.m-2.s-1)", "CoefficientFrottementVisqueux"], ["Volume Combinaison (L)", "VolumeCombinaison"]]],
  [3, "Respiration", [["Amplitude Respiration Nominal (L)", "AmplitudeRespirationNominal"], ["Volume Max Poumon (L)", "VolumeMaxPoumon"],
    ["Periode Respiration (Cycle/min)", "PeriodeRespiration"], ["Taille Bloc (L)", "VolumeBouteille"], ["Pression Initiale (Bars)", "PressionGonflage"]]],
  [5, "Gilet Stabilisation", [["Volume Max Du Gilet (L)", "VolumeMaxDuGilet"], ["Vitesse De Remplissage (L/min)", "VitesseDeRemplissage"],
    ["Vitesse De Purge (L/min)", "VitesseDePurge"]]],
];
function buildParams() {
  const p = $("params").firstElementChild, unit = W / 5, rh = 6 * R / 15;
  const colX = { 1: 0.5 * unit, 3: 2 * unit, 5: 3.5 * unit };
  for (const [col, title, fields] of PARAMS) {
    const mk = (tag, row, cls) => { const e = document.createElement(tag); e.className = cls; place(e, colX[col], row * rh, unit, rh); p.appendChild(e); return e; };
    mk("div", 0, "plabel").textContent = title;
    fields.forEach(([label, prop], i) => {
      mk("div", 2 + 2 * i, "plabel").textContent = label;
      const inp = mk("input", 3 + 2 * i, "pinput");
      inp.type = "text"; inp.inputMode = "decimal"; inp.dataset.prop = prop;
      inp.addEventListener("beforeinput", (e) => { // TextBox_PreviewTextInput : chiffres et "." uniquement
        if (e.data && !/\d/.test(e.data) && e.data !== ".") e.preventDefault();
      });
      inp.addEventListener("input", () => {
        const val = Number(inp.value);
        if (inp.value.trim() !== "" && Number.isFinite(val)) model[prop] = val;
      });
      inp.addEventListener("blur", () => { inp.value = String(model[prop]); });
    });
  }
}
function refreshParamInputs() {
  for (const inp of document.querySelectorAll(".pinput")) inp.value = String(model[inp.dataset.prop]);
}

// ---------- souris / tactile ----------
function isExcluded(target) { // Button, Slider, TextBlock, Rectangle exclus (MouseLeftClick)
  return !!target.closest("button, .slider, .lbl, .params, .btnwrap");
}
stage.addEventListener("pointerdown", (e) => {
  if (PORTRAIT) { // pas de bouton Pause/Restart en portrait : un appui démarre, et relance en fin de plongée
    if (ended) { go(); return; }
    if (!isPause) setIsPause(true);
  }
  if (isExcluded(e.target)) return;
  if (e.button === 0 && enabled.gilet) { model.IsInflateur = true; setBg($("btnGilet"), COL.Green); }
  if (e.button === 2 && enabled.purge) { model.IsPurge = true; setBg($("btnPurge"), COL.Green); }
});
function releaseAll(e) {
  if (e.button === 0 || e.type === "pointercancel") { model.IsInflateur = false; setBg($("btnGilet"), COL.Gray); } // MouseLeftRelease
  if (e.button === 2 || e.type === "pointercancel") { model.IsPurge = false; setBg($("btnPurge"), COL.Gray); }   // MouseRightRelease
}
window.addEventListener("pointerup", releaseAll);
window.addEventListener("pointercancel", releaseAll);
stage.addEventListener("contextmenu", (e) => e.preventDefault());
stage.addEventListener("wheel", (e) => { // MouseWheelChange
  if (e.target.closest(".params")) return;
  e.preventDefault();
  if (sliderEnabled) setOffset(model.OffsetRespiration + (e.deltaY < 0 ? 0.1 : -0.1));
  dirty = true;
}, { passive: false });

function holdButton(id, on, off) {
  const btn = $(id);
  btn.addEventListener("pointerdown", (e) => {
    if (btn.disabled) return;
    if (btn.hasPointerCapture?.(e.pointerId)) btn.releasePointerCapture(e.pointerId); // tactile : comme la souris, quitter le bouton relâche
    on();
  });
  btn.addEventListener("pointerup", off);
  btn.addEventListener("pointerleave", off);
  btn.addEventListener("pointercancel", off);
}
holdButton("btnGilet", () => { model.IsInflateur = true; setBg($("btnGilet"), COL.Green); },
  () => { model.IsInflateur = false; setBg($("btnGilet"), COL.Gray); });
holdButton("btnPurge", () => { model.IsPurge = true; setBg($("btnPurge"), COL.Green); },
  () => { model.IsPurge = false; setBg($("btnPurge"), COL.Gray); });
$("btnRestart").addEventListener("pointerdown", () => {
  if ($("btnRestart").disabled) return;
  paramsVisible = false; updateButtons();
  setBg($("btnRestart"), COL.Green);
  go();
});
for (const ev of ["pointerup", "pointerleave"]) $("btnRestart").addEventListener(ev, () => setBg($("btnRestart"), COL.Gray));
$("btnGraph").addEventListener("pointerdown", () => setBg($("btnGraph"), COL.Green));
$("btnGraph").addEventListener("pointerup", () => {
  speedVisible = !speedVisible;
  setBg($("btnGraph"), speedVisible ? COL.Lime : COL.Gray);
  dirty = true;
});
$("btnPause").addEventListener("pointerdown", () => setIsPause(!isPause));
// Panneau Paramètres : couvre tout l'écran, arrête la simulation ; sa fermeture relance (Restart).
$("btnParam").addEventListener("click", () => {
  paramsVisible = true;
  setIsPause(false);
  refreshParamInputs();
  enabled.purge = enabled.purgeRapide = enabled.restart = enabled.gilet = false;
  sliderEnabled = false;
  updateButtons();
});
$("btnParamClose").addEventListener("click", () => {
  if (document.activeElement) document.activeElement.blur();
  paramsVisible = false;
  speedVisible = false; setBg($("btnGraph"), COL.Gray);
  go();
});

// Curseur : glisser le pouce, double-clic = milieu de la plage (3 L par défaut)
(() => {
  const th = $("thumb"); let drag = null;
  th.addEventListener("pointerdown", (e) => {
    if (!sliderEnabled) return;
    const r = th.getBoundingClientRect();
    drag = (e.clientY - r.top) / scale;
    th.setPointerCapture(e.pointerId);
  });
  th.addEventListener("pointermove", (e) => { if (drag !== null && sliderEnabled) { setOffset(sliderValueAt(e.clientY, drag)); dirty = true; } });
  th.addEventListener("pointerup", () => { drag = null; });
  th.addEventListener("pointercancel", () => { drag = null; });
  $("slider").addEventListener("dblclick", () => { if (sliderEnabled) setOffset((model.OffsetMin + model.OffsetMax) / 2); });
})();


// ---------- démarrage (OnLoaded -> Go) ----------
layout();
buildParams();
resize();
window.addEventListener("resize", resize);
updatePauseBtn();
go();
requestAnimationFrame(frame);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
