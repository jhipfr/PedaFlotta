// Portage JavaScript de Model.cs (PedaFlotta V2.6).
// La physique est reprise ligne à ligne ; les commentaires d'origine sont conservés.
"use strict";

// Équivalent minimal de System.Diagnostics.Stopwatch (temps réel, pas temps simulé).
class Stopwatch {
  constructor() { this._start = 0; this._acc = 0; this.isRunning = false; }
  static startNew() { const s = new Stopwatch(); s.start(); return s; }
  start() { if (!this.isRunning) { this._start = performance.now(); this.isRunning = true; } }
  stop() { if (this.isRunning) { this._acc += performance.now() - this._start; this.isRunning = false; } }
  reset() { this._acc = 0; this.isRunning = false; }
  get elapsedSeconds() { return (this._acc + (this.isRunning ? performance.now() - this._start : 0)) / 1000; }
}

class Model {
  constructor() {
    // booléen
    this.isSport = false; // jamais activé dans la V2.6 (code clavier "S" commenté)

    // Constantes Physiques
    this.DensiteEau = 1; // sans unité
    this.Gravitation = 9.81; // comme à l'école

    this._isInflateur = false;
    this._isPurge = false;
    this._isPurgeRapide = false;
    this.ChronoInflateur = new Stopwatch();
    this.ChronoPurge = new Stopwatch();
    this.ChronoPurgeRapide = new Stopwatch();

    // Paramètres modifiables (valeurs par défaut de Model.cs)
    this._pressionGonflage = 200;   // bars
    this._volumeBouteille = 15;     // Litre
    this._massePlongeur = 80;       // kg (V2.6 : 81)
    this.VolumePlongeur = 80;       // L (V2.6 : 77)
    this.LestPlongeur = 4;          // kg
    this.CoefficientFrottement = 5;
    this.CoefficientFrottementVisqueux = 8;
    this.AmplitudeRespirationNominal = 0.5; // L
    this.VolumeMaxPoumon = 5;       // L : échelle de l'oscilloscope et volume pulmonaire maximal
    this.PeriodeRespiration = 15;   // cycles par minute
    this.DureeTransitionSport = 1;  // s
    this.VitesseDeRemplissage = 200; // L/min
    this.VitesseDePurge = 200;       // L/min
    this.VitesseDePurgeRapide = 400; // L/min
    this.VolumeMaxDuGilet = 20;      // L
    this.VolumeCombinaison = 6;      // L (V2.6 : 10 L en dur ; paramétrable, 6 L par défaut)

    // Paramètres affichages
    this.Filtrage = 0.05;            // (coefficient du filtre de l'oscilloscope gilet)
    this.TempsPlongee = 360;         // s
    this.ProfondeurMax = 30;         // m
    this.HauteurCiel = 5;            // m
    this.PeriodeEchantillonnage = 0.1; // s
    this.LargeurScope = 16;          // s

    // Constructeur Model()
    this.MasseApparentePlongeur = 0;
    this.AmplitudeRespiration = 0.5;
    this.VolumePoumonInstant = 3;
    this._offsetRespiration = 0;
    this.OffsetRespiration = 3;
    this.initModel();
  }

  // --- Propriétés avec logique dans les setters ---
  get IsInflateur() { return this._isInflateur; }
  set IsInflateur(v) {
    if (v !== this._isInflateur) {
      this._isInflateur = v;
      if (v) this.ChronoInflateur = Stopwatch.startNew(); else this.ChronoInflateur.stop();
    }
  }
  get IsPurge() { return this._isPurge; }
  set IsPurge(v) {
    if (v !== this._isPurge) {
      this._isPurge = v;
      if (v) this.ChronoPurge = Stopwatch.startNew(); else this.ChronoPurge.stop();
    }
  }
  get IsPurgeRapide() { return this._isPurgeRapide; }
  set IsPurgeRapide(v) {
    if (v !== this._isPurgeRapide) {
      this._isPurgeRapide = v;
      if (v) this.ChronoPurgeRapide = Stopwatch.startNew(); else this.ChronoPurgeRapide.stop();
    }
  }
  // Poumon de 5L avec volume mort de 1 Litre
  // Plage du volume moyen : [1 L + amplitude ; VolumeMaxPoumon - amplitude] (V2.6 : [1,5 ; 4,5] en dur)
  get OffsetMin() { return 1 + this.AmplitudeRespirationNominal; }
  get OffsetMax() { return Math.max(this.OffsetMin, this.VolumeMaxPoumon - this.AmplitudeRespirationNominal); }
  get OffsetRespiration() { return this._offsetRespiration; }
  set OffsetRespiration(v) {
    if (v !== this._offsetRespiration) {
      this._offsetRespiration = Math.max(Math.min(v, this.OffsetMax), this.OffsetMin);
    }
  }
  get PressionGonflage() { return this._pressionGonflage; }
  set PressionGonflage(v) { if (v > 300) v = 300; this._pressionGonflage = v; }
  get VolumeBouteille() { return this._volumeBouteille; }
  set VolumeBouteille(v) { if (v > 18) v = 18; this._volumeBouteille = v; }
  get MassePlongeur() { return this._massePlongeur; }
  set MassePlongeur(v) { if (v > 150) v = 150; this._massePlongeur = v; }

  initModel() {
    this.Expiration = false;
    // VolumeBouteille et PressionGonflage ne sont plus réinitialisés ici : les valeurs des paramètres sont prises en compte.
    this.DensiteAir = 0.0012;    // kgs/L
    this.PoidsAirBloc = this.PressionGonflage * this.VolumeBouteille * this.DensiteAir;
    // Néoprène : fraction solide incompressible + gaz suivant Boyle. 0,1 => 40 % du volume restant à 3 bar (20 m),
    // soit 60 % de perte (valeur choisie, cf. Potočić Matković 2025 : -64 % d'épaisseur à 200 kPa). V2.6 : 10 % par bar linéaire.
    this.FractionSolideNeoprene = 0.1;
    this.ChronoInflateur = new Stopwatch();
    this.ChronoPurge = new Stopwatch();
    this.ChronoPurgeRapide = new Stopwatch();
    this.OffsetRespiration = (this.OffsetMin + this.OffsetMax) / 2; // 3 L avec les valeurs par défaut
    this.time = -16;
    this.TransitionSport = 0;
    this.PressionAbsolue = 1;
    this.VolumeNormoLitresGilet = this.VolumeMaxDuGilet;
    this.VolumeFlottaisonDuGilet = 0;
    this.FlottaCombi = 0;
    this.PressionBloc = 0;
    this.ResistanceHydroDynamique = 0;

    this.ZPP = this.ZP = this.Z = this.Vitesse = this.Profondeur = 0;
    this.CollectionSample = [];
    for (let i = 0; i < this.LargeurScope / this.PeriodeEchantillonnage; i++) {
      this.volumePoumon(this.time);
      this.CollectionSample.push({ time: this.time, poumon: this.VolumePoumonInstant, gilet: this.VolumeNormoLitresGilet, combi: this.VolumeCombinaison });
      this.time += this.PeriodeEchantillonnage;
    }
    // Profil guide : X en s, Y en m
    this.GuideCollection = [
      { x: 0, y: 0 }, { x: 15, y: 0 },
      { x: 75, y: 20 },  // 20m/min
      { x: 100, y: 20 }, { x: 110, y: 19 }, { x: 134, y: 19 }, { x: 144, y: 20 }, { x: 160, y: 20 },
      { x: 250, y: 5 },  // 10m/min
      { x: 300, y: 5 },  // 6m/min
      { x: 350, y: 0 },
      { x: this.TempsPlongee, y: 0 },
    ];
  }

  volumePoumon(time) {
    this.VolumePoumonInstant = this.AmplitudeRespiration * Math.sin(time * this.PeriodeRespiration / 60 * 2 * Math.PI) + this.OffsetRespiration;
    this.VolumePoumonInstant = Math.min(this.VolumePoumonInstant, this.VolumeMaxPoumon);
    this.VolumePoumonInstant = Math.max(this.VolumePoumonInstant, 1);
    const m = time % (60 / this.PeriodeRespiration); // même sémantique que % en C# (signe du dividende)
    this.Expiration = !(m < 4 && m > 2);
  }

  static actif(b) { return b ? 1 : 0; }

  compute(DeltaT) {
    const A = Model.actif;
    this.time += DeltaT; // on fait avancer l'horloge du pas de calcul.
    this.VolumeNormoLitresGilet = this.VolumeNormoLitresGilet
      - this.VitesseDePurge / 60.0 * DeltaT * A(this._isPurge)
      - this.VitesseDePurgeRapide / 60.0 * DeltaT * A(this._isPurgeRapide)
      + this.VitesseDeRemplissage / 60.0 * DeltaT * A(this._isInflateur);
    this.VolumeNormoLitresGilet = Math.max(this.VolumeNormoLitresGilet, 0); // Pas de dépression dans un gilet.
    this.VolumeFlottaisonDuGilet = this.VolumeNormoLitresGilet / this.PressionAbsolue; // Le gilet est comprimé par le poids de la colonne d'eau
    if (this.VolumeFlottaisonDuGilet > this.VolumeMaxDuGilet) { // lors de la remontée, l'air se détend et le gilet s'autopurge
      this.VolumeNormoLitresGilet = this.VolumeMaxDuGilet * this.PressionAbsolue;
      this.VolumeFlottaisonDuGilet = this.VolumeNormoLitresGilet / this.PressionAbsolue;
    }
    // Compression Combinaison
    const pCombi = Math.max(1, this.PressionAbsolue);
    this.FlottaCombi = this.VolumeCombinaison * (this.FractionSolideNeoprene + (1 - this.FractionSolideNeoprene) / pCombi);
    // Vidange bouteille
    this.PressionBloc = this.PressionGonflage * (0.75 * (1 - this.time / 360) + 0.25);
    this.PoidsAirBloc = this.PressionBloc * this.VolumeBouteille * this.DensiteAir;

    if (this.isSport) { // on passe en respiration ample en cas d'effort
      this.TransitionSport += DeltaT / this.DureeTransitionSport;
      this.TransitionSport = Math.min(this.TransitionSport, 1);
      if (this.OffsetRespiration > 3) this.OffsetRespiration -= 0.02;
      if (this.OffsetRespiration < 3) this.OffsetRespiration += 0.02;
      if (this.OffsetRespiration > 2.95 && this.OffsetRespiration < 3.05) this.OffsetRespiration = 3;
    } else { // retour à la normale.
      this.TransitionSport -= DeltaT / this.DureeTransitionSport;
      this.TransitionSport = Math.max(this.TransitionSport, 0);
    }
    this.AmplitudeRespiration = this.AmplitudeRespirationNominal + 1.5 * this.TransitionSport;
    this.volumePoumon(this.time); // on calcul le volume instantané des poumons.

    const cs = this.CollectionSample;
    cs.push({ time: this.time, poumon: this.VolumePoumonInstant,
      gilet: cs[cs.length - 1].gilet * this.Filtrage + (1 - this.Filtrage) * this.VolumeFlottaisonDuGilet, combi: this.FlottaCombi });
    for (let i = 0; i < cs.length - 1; i++) { // on efface les points qui sortent de la fenêtre des oscilloscopes.
      if (cs[0].time < this.time - this.LargeurScope) cs.shift(); else break;
    }

    // VolumePlongeur inclut déjà la moitié du volume pulmonaire maximal : seul l'écart à cette moitié
    // s'ajoute (variation prise à 100 %).
    // Inventaire des forces projetées sur un axe Z orienté vers le haut.
    this.MasseApparentePlongeur = (this.MassePlongeur + this.LestPlongeur + this.PoidsAirBloc)
      - (this.FlottaCombi + (this.VolumePoumonInstant - this.VolumeMaxPoumon / 2) + this.VolumeFlottaisonDuGilet + this.VolumePlongeur) * this.DensiteEau;
    const absZP = Math.abs(this.ZP);
    this.ResistanceHydroDynamique = -Math.sign(this.ZP) * (absZP * (this.CoefficientFrottementVisqueux + absZP * this.CoefficientFrottement));
    // Principe fondamental de la dynamique. ici l'accélération (Z dérivée 2 fois)
    this.ZPP = (-this.MasseApparentePlongeur + this.ResistanceHydroDynamique) * this.Gravitation / (this.MassePlongeur + this.LestPlongeur);
    this.ZP = this.ZPP * DeltaT + this.ZP; // Intégration pour avoir la vitesse
    this.Z = this.ZP * DeltaT + this.Z;    // Intégration pour avoir l'altitude (ici négative)

    if (this.Z > 0) { this.Z = 0; this.ZP = 0; }       // on ne peut sortir de l'eau
    if (this.Z < -25) { this.Z = -25; this.ZP = 0; }   // on ne peut rentrer dans le sable
    this.Vitesse = this.ZP * 60;      // m/min
    this.Profondeur = -this.Z;
    this.PressionAbsolue = 1 + this.Profondeur / 10; // pression ambiante pour l'écrasement du gilet et de la combinaison.
  }
}

if (typeof module !== "undefined") module.exports = { Model, Stopwatch };
