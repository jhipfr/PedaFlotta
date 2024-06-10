using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;
using System.Windows.Input;
using static System.Math;

namespace PedaFlotta
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window, INotifyPropertyChanged
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
        string lastTime = "0";
        double xPlongeur;
        double Periode = 0;
        long Previous = 0;
        Random Random = new Random();
        int vitesseAscension = 4;
        double Grossissement = .3;
        long Date;
        DispatcherTimer timer;
        double score;
        Point myPoint;
        Polyline TrajPlongeur;
        Polyline TrajGuide;
        PointCollection DrawPoumonCollection;
        PointCollection DrawGiletCollection;
        Polygon VolumeAirPoumon;
        Polygon VolumeAirGilet;
        Model MyModel;
        int a = 0;
        int b = 1;

        public MainWindow()
        {
            InitializeComponent();
            timer = new DispatcherTimer();
            timer.Interval = new TimeSpan(0, 0, 0, 0, 10);
            timer.Tick += new EventHandler(timer1_tick);
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            timer.Start();
            Go();
        }

        private void Go()
        {
            MyModel = new Model();
            DataContext = MyModel;
            CanvasPoumon.Children.Clear();
            InitCollection();
            Previous = DateTime.Now.Ticks;
        }

        private void timer1_tick(object? sender, EventArgs e)
        {
            Date = DateTime.Now.Ticks;
            Periode = (Date - Previous) / 10000000.0;
            Previous = Date;
            MyModel.Compute(Periode);

            FpsLabel.Content = Periode.ToString("0.000");
            TimeLabel.Content = "Temps : " + MyModel.time.ToString("0.00") + "s";
            VitesseLabel.Content = "Vitesse : " + (MyModel.Vitesse).ToString("0.00") + "m/min";
            GiletAbsLabel.Content = "GiletAbs: " + (MyModel.VolumeNormolLitresGilet).ToString("0.00") + "L";
            GiletRelLabel.Content = "GiletRel: " + (MyModel.VolumeFlottaisonDuGilet).ToString("0.00") + "L";
            if (Keyboard.IsKeyDown(Key.S))
            {
                MyModel.isSport = true;
                BtnSport.Background = Brushes.Green;
            }
            else
            {
                if (!MyModel.isSport)
                { BtnSport.Background = Brushes.Gray; }
            }
            PoidsApparentLabel.Content = "Masse apparente : " + MyModel.MasseApparentePlongeur.ToString("0.00") + "kgs";
            ProfondeurLabel.Content = "Profondeur : " + MyModel.Profondeur.ToString("0.00") + "m";
            DrawPoumonCollection = new PointCollection();
            DrawGiletCollection = new PointCollection();

            myPoint = new Point(CanvasPoumon.ActualWidth, 0);
            DrawPoumonCollection.Add(myPoint);
            myPoint = new Point(0, 0);
            DrawPoumonCollection.Add(myPoint);
            myPoint = new Point(CanvasGilet.ActualWidth, 0);
            DrawGiletCollection.Add(myPoint);
            myPoint = new Point(0, 0);
            DrawGiletCollection.Add(myPoint);
            for (int i = 0; i < MyModel.CollectionSample.Count; i++)
            {
                Point newpoint = new Point();
                newpoint.X = (MyModel.CollectionSample[i].Time - MyModel.CollectionSample[0].Time) / (MyModel.CollectionSample[MyModel.CollectionSample.Count - 1].Time - MyModel.CollectionSample[0].Time) * CanvasPoumon.ActualWidth;
                newpoint.Y = MyModel.CollectionSample[i].Poumon / MyModel.VolumeMaxPoumon * CanvasPoumon.ActualHeight;
                DrawPoumonCollection.Add(newpoint);
                Point newpoint1 = new Point();
                newpoint1.X = (MyModel.CollectionSample[i].Time - MyModel.CollectionSample[0].Time) / (MyModel.CollectionSample[MyModel.CollectionSample.Count - 1].Time - MyModel.CollectionSample[0].Time) * CanvasPoumon.ActualWidth;
                newpoint1.Y = MyModel.CollectionSample[i].Gilet / MyModel.VolumeMaxDuGilet * CanvasGilet.ActualHeight;
                DrawGiletCollection.Add(newpoint1);
            }
            VolumeAirPoumon.Points = DrawPoumonCollection;
            VolumeAirGilet.Points = DrawGiletCollection;

            #region Les bulles
            if (BulleCanvas.Children.Count < 10) // Apparition des bulles
            {
                circle(BulleCanvas, Random.Next(0, (int)BulleCanvas.ActualWidth), Random.Next(0, (int)BulleCanvas.ActualHeight), 4);
            }
            for (int i = 0; i < BulleCanvas.Children.Count; i++) //Croissance et remonté des bulles.
            {
                double tmp = (double)((Ellipse)BulleCanvas.Children[i]).GetValue(Canvas.TopProperty);
                ((Ellipse)BulleCanvas.Children[i]).SetValue(Canvas.TopProperty, tmp - vitesseAscension);
                ((Ellipse)BulleCanvas.Children[i]).Height += Grossissement;
                ((Ellipse)BulleCanvas.Children[i]).Width += Grossissement;
                if (Canvas.GetTop(BulleCanvas.Children[i]) + ((Ellipse)BulleCanvas.Children[i]).Height < 0) // disparition des bulles
                {
                    BulleCanvas.Children.Remove(BulleCanvas.Children[i]);
                    i--;
                }
            }
            #endregion

            if (xPlongeur >= CanvasTraj.ActualWidth)
            {
                Go();
            }
            else
            {
                lastTime = MyModel.time.ToString("0");
                myPoint = new Point();
                myPoint.X = xPlongeur;
                myPoint.Y = MyModel.Profondeur / 20 * CanvasTraj.ActualHeight;
                TrajPlongeur.Points.Add(myPoint);
                xPlongeur = MyModel.time / MyModel.tempsPlongee * CanvasTraj.ActualWidth;
                if (TrajPlongeur.Points[a].X > TrajGuide.Points[b].X)
                { b++; }
                CalculScore(a, b);
                a++;
            }
            VitesseBarre.SetValue(Canvas.TopProperty, CanvasVitesse.ActualHeight / 2 - CanvasVitesse.ActualHeight * MyModel.Vitesse / 60 - VitesseBarre.Height / 2);
            Plongeur.SetValue(Canvas.TopProperty, (double)-Plongeur.ActualHeight / 2 + (PlongeurCanvas.ActualHeight - Plongeur.ActualHeight * 3 / 2) * MyModel.Profondeur / 20);
        }

        public void CalculScore(int a, int b)
        {
            score += Math.Sqrt(Math.Pow(RegLin(a, b) - TrajPlongeur.Points[a].Y, 2));
            ScoreLabel.Content = "Score : " + score.ToString("0");
        }

        public double RegLin(int i, int j)
        {
            return ((TrajGuide.Points[j].Y - TrajGuide.Points[j - 1].Y) * (TrajPlongeur.Points[i].X - TrajGuide.Points[j - 1].X) / (TrajGuide.Points[j].X - TrajGuide.Points[j - 1].X)) + TrajGuide.Points[j - 1].Y;
        }
        public void InitCollection()
        {
            CanvasTraj.Children.Clear();
            CanvasGilet.Children.Clear();
            a = 0;
            b = 1;
            score = 0;
            Line myLine;
            Point myPoint;
            for (int i = 1; i < 4; i++)
            {
                myLine = new Line();
                myLine.StrokeThickness = 1;
                myLine.Stroke = Brushes.White;
                myLine.Opacity = 1;
                myLine.X1 = CanvasPoumon.ActualWidth * i / 4;
                myLine.Y1 = CanvasPoumon.ActualHeight;
                myLine.X2 = CanvasPoumon.ActualWidth * i / 4;
                myLine.Y2 = 0;
                CanvasPoumonGrid.Children.Add(myLine);  // Dessine la Polylinemain
                myLine = new Line();
                myLine.StrokeThickness = 1;
                myLine.Stroke = Brushes.White;
                myLine.Opacity = 1;
                myLine.X1 = CanvasGilet.ActualWidth * i / 4;
                myLine.Y1 = CanvasGilet.ActualHeight;
                myLine.X2 = CanvasGilet.ActualWidth * i / 4;
                myLine.Y2 = 0;
                CanvasGiletGrid.Children.Add(myLine);  // Dessine la Polylinemain
            }
            for (int i = 1; i < 5; i++)
            {
                myLine = new Line();
                myLine.StrokeThickness = 1;
                myLine.Stroke = Brushes.White;
                myLine.Opacity = 1;
                myLine.X1 = 0;
                myLine.Y1 = CanvasPoumon.ActualHeight * i / 5;
                myLine.X2 = CanvasPoumon.ActualWidth;
                myLine.Y2 = CanvasPoumon.ActualHeight * i / 5;
                CanvasPoumonGrid.Children.Add(myLine);  // Dessine la Polylinemain
            }
            TrajPlongeur = new Polyline();
            TrajPlongeur.StrokeThickness = 5;
            TrajPlongeur.Stroke = Brushes.Cyan;
            TrajPlongeur.Opacity = 1;
            TrajGuide = new Polyline();
            TrajGuide.StrokeThickness = 1;
            TrajGuide.Stroke = Brushes.Red;
            TrajGuide.Opacity = 1;
            myPoint = new Point();
            myPoint.X = 0;
            myPoint.Y = 20;
            TrajGuide.Points.Add(myPoint);
            myPoint = new Point();
            myPoint.X = CanvasTraj.ActualWidth * 1 / 15;
            myPoint.Y = 20;
            TrajGuide.Points.Add(myPoint);
            myPoint = new Point();
            myPoint.X = CanvasTraj.ActualWidth * 1 / 6;
            myPoint.Y = (19 * (CanvasTraj.ActualHeight - 50) / 20) + 20;
            TrajGuide.Points.Add(myPoint);
            myPoint = new Point();
            myPoint.X = CanvasTraj.ActualWidth * 2 / 6;
            myPoint.Y = (19 * (CanvasTraj.ActualHeight - 50) / 20) + 20;
            TrajGuide.Points.Add(myPoint);
            myPoint = new Point();
            myPoint.X = CanvasTraj.ActualWidth * 3 / 6;
            myPoint.Y = (3 * (CanvasTraj.ActualHeight - 50) / 20) + 20;
            TrajGuide.Points.Add(myPoint);
            myPoint = new Point();
            myPoint.X = CanvasTraj.ActualWidth * 4 / 6;
            myPoint.Y = (3 * (CanvasTraj.ActualHeight - 50) / 20) + 20;
            TrajGuide.Points.Add(myPoint);
            myPoint = new Point();
            myPoint.X = CanvasTraj.ActualWidth * 5 / 6;
            myPoint.Y = 20;
            TrajGuide.Points.Add(myPoint);
            myPoint = new Point();
            myPoint.X = CanvasTraj.ActualWidth;
            myPoint.Y = 20;
            TrajGuide.Points.Add(myPoint);
            CanvasTraj.Children.Add(TrajPlongeur);
            CanvasTraj.Children.Add(TrajGuide);  // Dessine la Polylinemain


            DrawPoumonCollection = new PointCollection();
            myPoint = new Point(CanvasPoumon.ActualWidth, 0);
            DrawPoumonCollection.Add(myPoint);
            myPoint = new Point(0, 0);
            DrawPoumonCollection.Add(myPoint);
            // Le PoumonCanvas fait LargeurScope(s) de large
            for (int i = 0; i < MyModel.CollectionSample.Count; i += 1)
            {

                myPoint.X = (MyModel.CollectionSample[i].Time - MyModel.CollectionSample[0].Time) / (MyModel.CollectionSample[MyModel.CollectionSample.Count - 1].Time - MyModel.CollectionSample[0].Time) * CanvasPoumon.ActualWidth;
                myPoint.Y = MyModel.CollectionSample[i].Poumon / MyModel.VolumeMaxPoumon * CanvasPoumon.ActualHeight;
                DrawPoumonCollection.Add(myPoint);
            }
            VolumeAirPoumon = new Polygon(); // Créer la Polyline
            VolumeAirPoumon.Fill = Brushes.Blue;
            VolumeAirPoumon.Opacity = 1;
            VolumeAirPoumon.Points = DrawPoumonCollection; // Remplie la Polyline de points
            CanvasPoumon.Children.Add(VolumeAirPoumon);     // Dessine la Polyline

            DrawGiletCollection = new PointCollection();
            myPoint = new Point(CanvasPoumon.ActualWidth, 0);
            DrawGiletCollection.Add(myPoint);
            myPoint = new Point(0, 0);
            DrawGiletCollection.Add(myPoint);

            // Le PoumonCanvas fait LargeurScope(s) de large
            for (double i = 0; i <= MyModel.LargeurScope; i += MyModel.LargeurScope / CanvasGilet.ActualWidth)
            {
                myPoint.X = i / 16 * CanvasGilet.ActualWidth;
                myPoint.Y = MyModel.VolumeFlottaisonDuGilet / MyModel.VolumeMaxDuGilet * CanvasGilet.ActualHeight;
                DrawGiletCollection.Add(myPoint);
            }
            VolumeAirGilet = new Polygon(); // Créer la Polyline
            VolumeAirGilet.Fill = Brushes.Blue;
            VolumeAirGilet.Opacity = 1;
            VolumeAirGilet.Points = DrawGiletCollection; // Remplie la Polyline de points
            CanvasGilet.Children.Add(VolumeAirGilet);     // Dessine la Polyline

            VitesseBarre.Height = 5;
            VitesseBarre.Width = CanvasVitesse.ActualWidth;
            xPlongeur = 0;
        }

        public void circle(Canvas cv, int x, int y, int width, int height = 0)
        {
            if (height == 0)
            {
                height = width;
            }
            Ellipse circle = new Ellipse()
            {
                Width = width,
                Height = height,
                Fill = Brushes.White,
                Opacity = 0.5
            };
            cv.Children.Add(circle);
            circle.SetValue(Canvas.LeftProperty, (double)x);
            circle.SetValue(Canvas.TopProperty, (double)y);
        }

        private void ResizeEvent(object sender, SizeChangedEventArgs e)
        {
            CanvasPoumon.Children.Clear();
            InitCollection();
        }

        private void BtnSport_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = true;
            BtnSport.Background = Brushes.Green;
        }

        private void BtnSport_MouseUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = false;
            BtnSport.Background = Brushes.Gray;
        }
        private void BtnPurge_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isPurge = true;
            BtnPurge.Background = Brushes.Green;
        }

        private void BtnPurge_MouseUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isPurge = false;
            BtnPurge.Background = Brushes.Gray;
        }
        private void BtnPurgeRapide_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isPurgeRapide = true;
            BtnPurgeRapide.Background = Brushes.Green;
        }

        private void BtnPurgeRapide_MouseUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isPurgeRapide = false;
            BtnPurgeRapide.Background = Brushes.Gray;
        }
        private void BtnGilet_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isGilet = true;
            BtnGilet.Background = Brushes.Green;
        }

        private void BtnGilet_MouseUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isGilet = false;
            BtnGilet.Background = Brushes.Gray;
        }
        private void BtnMontée_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = true;
            BtnSport.Background = Brushes.Green;
        }

        private void BtnMontée_MouseUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = false;
            BtnSport.Background = Brushes.Gray;
        }
        private void BtnDescente_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = true;
            BtnSport.Background = Brushes.Green;
        }

        private void BtnDescente_MouseUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = false;
            BtnSport.Background = Brushes.Gray;
        }
        private void BtnExpiré_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = true;
            BtnSport.Background = Brushes.Green;
        }

        private void BtnExpiré_MouseUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = false;
            BtnSport.Background = Brushes.Gray;
        }
        private void BtnBloqué_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = true;
            BtnSport.Background = Brushes.Green;
        }

        private void BtnBloqué_MouseUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            MyModel.isSport = false;
            BtnSport.Background = Brushes.Gray;
        }

        private void DoubleSlider(object sender, MouseButtonEventArgs e)
        {
            OffsetPoumonSlider.Value = (OffsetPoumonSlider.Maximum - OffsetPoumonSlider.Minimum) / 2 + OffsetPoumonSlider.Minimum;
        }
    }
}