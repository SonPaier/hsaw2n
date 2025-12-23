import { Helmet } from 'react-helmet-async';
import ClientLayout from '@/components/layout/ClientLayout';
import BookingWizard from '@/components/booking/BookingWizard';
import { Sparkles, Shield, Clock, Star } from 'lucide-react';

const features = [
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Profesjonalna obsługa',
    description: 'Doświadczony zespół specjalistów',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Gwarancja jakości',
    description: 'Najwyższa jakość usług',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'Szybka rezerwacja',
    description: 'Zarezerwuj w kilka minut',
  },
  {
    icon: <Star className="w-5 h-5" />,
    title: 'Zadowoleni klienci',
    description: 'Setki pozytywnych opinii',
  },
];

const Index = () => {
  return (
    <>
      <Helmet>
        <title>ARM CAR AUTO SPA Gdańsk - Rezerwacja online</title>
        <meta name="description" content="Profesjonalna myjnia samochodowa i studio oklejania folią w Gdańsku. Zarezerwuj wizytę online w kilka minut." />
      </Helmet>

      <ClientLayout>
        {/* Hero Section */}
        <section className="relative overflow-hidden hero-gradient">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(195_100%_50%_/_0.15),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(280_100%_60%_/_0.1),_transparent_60%)]" />
          
          <div className="container relative py-12 md:py-20">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                Rezerwacja online 24/7
              </div>
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight">
                Zarezerwuj wizytę w{' '}
                <span className="gradient-text">ARM CAR AUTO SPA</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                Profesjonalna myjnia samochodowa i studio oklejania folią w Gdańsku. 
                Wybierz usługę i zarezerwuj termin w kilka minut.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container -mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="glass-card p-4 text-center space-y-2 card-elevated"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto text-primary">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-sm text-foreground">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Booking Section */}
        <section className="container py-12">
          <div className="max-w-xl mx-auto">
            <div className="glass-card p-6 md:p-8 card-elevated">
              <BookingWizard />
            </div>
          </div>
        </section>
      </ClientLayout>
    </>
  );
};

export default Index;
