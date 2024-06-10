using Simulateur;
using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;
using System.Windows.Input;
using static System.Math;
using System.Collections.ObjectModel;

namespace PedaFlotta
{

    internal class Model: INotifyPropertyChanged
    {
        /// /////////////////
        #region INotifyPropertyChanged

        public event PropertyChangedEventHandler PropertyChanged;
    protected virtual void OnPropertyChanged([System.Runtime.CompilerServices.CallerMemberName] string propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    #endregion
        /// /////////////////
        
        // booléen
        internal bool isSport = false;
        internal bool isPurgeRapide = false;
        internal bool isPurge = false;
        internal bool isGilet = false;


        // Constantes Physiques
        internal double DensiteEau = 1; //sans unité
        internal const double Gravitation = 9.81;// comme à l'école
        
        // Variables de calcul observables
        private double amplitudeRespiration;
        public double AmplitudeRespiration // En litre
        {
            get { return amplitudeRespiration; }
            set
            {
                if (value != amplitudeRespiration)
                {
                    amplitudeRespiration = value;
                    OnPropertyChanged();
                }
            }
        }

        private double offsetRespiration;
        public double OffsetRespiration //// Poumon de 5L avec volume mort de 1 Litre
        {
            get { return offsetRespiration; }
            set
            {
                if (value != offsetRespiration)
                {
                    offsetRespiration = value;
                    OnPropertyChanged();
                }
            }
        }

        private double volumePoumonInstant;
        public double VolumePoumonInstant
        {
            get { return volumePoumonInstant; }
            set
            {
                if (value != volumePoumonInstant)
                {
                    volumePoumonInstant = value;
                    OnPropertyChanged();
                }
            }
        }

        internal double time;
        internal double TransitionSport; // en pourcentage entre 0 et 100%
        internal double PressionAbsolue; //bar / Atm / 1kgs/cm²
        internal double ZPP; //Acceleration sur l'axeZ(en pseudo pixel)
        internal double ZP; //Vitesse sur l'axeZ (en pseudo pixel) 
        internal double Z; //Position sur l'axeZ en m(en pseudo pixel)
        internal double Profondeur; //Position sur l'axeZ en m(en pseudo pixel)
        internal double MasseApparentePlongeur; //en kgs
        internal double Vitesse; // en m/min
        internal double VolumeNormolLitresGilet; // Litre
        internal double VolumeFlottaisonDuGilet; // Litre
        internal ObservableCollection<Sample> CollectionSample;

        //Paramètres modifiables PLONGEUR
        internal double MassePlongeur = 77; //en kilogramme
        internal double VolumePlongeur = 76; //en litres
        internal double LestPlongeur = 6; //en kgs
        internal double CoefficientFrottement = 150;

        //Paramètres modifiables RESPIRATION
        internal double AmplitudeRespirationNominal = 0.5; // En litre
        internal double VolumeMaxPoumon = 5; // En litre
        internal double PeriodeRespiration = 15; //Cycle par minute soit un cycle en 4s
        internal double DureeTransitionSport = 1; // en seconde
        
        //Paramètres modifiables STAB
        internal double VitesseDePurge = 200; // L/min
        internal double VitesseDePurgeRapide = 400; // L/min
        internal double VolumeMaxDuGilet = 20; //L
        internal double VitesseDeRemplissage = 400; // L/min

        // Paramètres affichages
        internal double tempsPlongee = 300; //En secondes
        internal double PeriodeEchantillonnage = 0.1;// en s soit 10 points par seconde
        internal double LargeurScope = 16; // En secondes

        public Model()
        {
            time = -16;
            TransitionSport = 0;
            PressionAbsolue = 1;
            ZPP = ZP = Z = Vitesse = Profondeur = 0;
            MasseApparentePlongeur = 0;
            VolumeNormolLitresGilet = 10;
            VolumeFlottaisonDuGilet = 0;
            AmplitudeRespiration = 0.5;
            VolumePoumonInstant = 3;
            OffsetRespiration = 3;
            CollectionSample = new ObservableCollection<Sample>();
            for (int i = 0; i < LargeurScope / PeriodeEchantillonnage; i++)
            {
                VolumePoumon(time);
                CollectionSample.Add(new Sample(time, VolumePoumonInstant, VolumeNormolLitresGilet));
                time += PeriodeEchantillonnage;
            }
        }

        public void VolumePoumon(double time)
        {
            VolumePoumonInstant = AmplitudeRespiration * Math.Sin(time * PeriodeRespiration / 60 * 2 * PI) + OffsetRespiration;
            VolumePoumonInstant = Min(VolumePoumonInstant, 5);
            VolumePoumonInstant =  Max(VolumePoumonInstant, 0);
        }

        public int Actif(bool monbool)
        {
            if (monbool) { return 1; }
            else { return 0; }
        }

        public void Compute(double DeltaT)
        {
            time += DeltaT; // on fait avancer l'horloge du pas de calcul.
            VolumePoumon(time); // on calcul le volume instantané des poumons.
            VolumeNormolLitresGilet = VolumeNormolLitresGilet
                                    - VitesseDePurge / 60.0 * DeltaT * Actif(isPurge)
                                    - VitesseDePurgeRapide / 60.0 * DeltaT * Actif(isPurgeRapide)
                                    + VitesseDeRemplissage / 60.0 * DeltaT * Actif(isGilet);
            VolumeNormolLitresGilet = Max(VolumeNormolLitresGilet, 0); // Pas de dépression dans un gilet.
            if (VolumeFlottaisonDuGilet > VolumeMaxDuGilet) // lors de la remontée, l'air se détend et le gilet s'autopurge pour ne pas éclater
            {
                VolumeNormolLitresGilet = VolumeMaxDuGilet * PressionAbsolue;
            }
            VolumeFlottaisonDuGilet = VolumeNormolLitresGilet / PressionAbsolue; // Le gilet est comprimé par le poids de la colonne d'eau
            
            CollectionSample.Add(new Sample(time, VolumePoumonInstant, VolumeFlottaisonDuGilet)); // On fait une base de donnés des variables principales.
            for (int i = 0; i < CollectionSample.Count - 1; i += 1)
            {
                if (CollectionSample[0].Time < time - LargeurScope)// on efface les points qui sortent de la fenetre des oscilloscopes.
                {
                    CollectionSample.RemoveAt(0);
                }
                else
                {
                    break;
                }
            }

            if (isSport) // on passe en respiration ample en cas d'effort
            {
                TransitionSport += DeltaT / DureeTransitionSport;
                TransitionSport = Min(TransitionSport, 1);
                if (OffsetRespiration > 3)
                {
                    OffsetRespiration -= 0.02; 
                }
                if (OffsetRespiration < 3)
                { 
                    OffsetRespiration += 0.02; 
                }
                if (OffsetRespiration > 2.95 && OffsetRespiration < 3.05)
                { 
                    OffsetRespiration = 3; 
                }
            }
            else // retour à la normale.
            {
                TransitionSport -= DeltaT / DureeTransitionSport;
                TransitionSport = Max(TransitionSport, 0);
            }
            AmplitudeRespiration = AmplitudeRespirationNominal + 1.5 * TransitionSport;
            
            // Inventaires des forces projetées sur un axe Z orienté vers le haut.
            MasseApparentePlongeur = (MassePlongeur + LestPlongeur) - (VolumePoumonInstant + VolumeFlottaisonDuGilet + VolumePlongeur) * DensiteEau;
            // Principe Fondamentale de la dynamique. ici l'accélération (Z dérivée 2 fois)
            ZPP = (-MasseApparentePlongeur * Gravitation - Sign(ZP) * ZP * ZP * CoefficientFrottement)  / (MassePlongeur + LestPlongeur); 
            ZP = ZPP * DeltaT + ZP;// Intégration pour avoir la vitesse (qui est la dérivé de l'altitude)
            Z = ZP * DeltaT + Z;// Intégration pour avoir l'altitude (ici négative)

            if (Z> 0) // on ne peut sortir de l'eau
            { 
                Z = 0;
                ZP = 0; // du coup la vitesse s'annule
            }
            if (Z < -20) // on ne peut rentrer dans le sable
            {
                Z = -20;
                ZP = 0; // du coup la vitesse s'annule
            }
            Vitesse = ZP * 60; // Variable d'observation au nom plus explicite et en unité "plongeur"
            Profondeur = -Z; // Variable d'observation au nom plus explicite
            PressionAbsolue = 1 + Profondeur / 10; // Calcul de la pression ambiante pour l'écrasement du gilet et de la combinaison.
        }
    }
}