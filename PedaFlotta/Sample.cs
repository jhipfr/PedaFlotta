using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace PedaFlotta
{
    internal class Sample : INotifyPropertyChanged
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
       
        private double time;// En s

        public double Time // En s
        {
            get { return time; }
            set
            {
                if (value != time)
                {
                    time = value;
                    OnPropertyChanged();
                }
            }
        }

        private double poumon;// En s

        public double Poumon // En s
        {
            get { return poumon; }
            set
            {
                if (value != poumon)
                {
                    poumon = value;
                    OnPropertyChanged();
                }
            }
        }

        private double gilet;// En s

        public double Gilet // En s
        {
            get { return gilet; }
            set
            {
                if (value != gilet)
                {
                    gilet = value;
                    OnPropertyChanged();
                }
            }
        }

        public Sample(double time, double poumon, double gilet)
        {
            Time = time;
            Poumon = poumon;
            Gilet = gilet;
        }
    }
}
