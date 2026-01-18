import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ClientLayout from '@/components/layout/ClientLayout';
import CustomerBookingWizard from '@/components/booking/CustomerBookingWizard';

interface RezerwacjeProps {
  instanceSubdomain?: string;
}

const Rezerwacje = ({ instanceSubdomain }: RezerwacjeProps) => {
  const [hideHeader, setHideHeader] = useState(false);
  const [hideFooter, setHideFooter] = useState(false);

  const handleLayoutChange = (header: boolean, footer: boolean) => {
    setHideHeader(header);
    setHideFooter(footer);
  };

  return (
    <>
      <Helmet>
        <title>Rezerwacja online</title>
        <meta name="description" content="Zarezerwuj wizytę online. Mycie samochodowe, detailing, PPF - wybierz usługę i termin." />
      </Helmet>

      <ClientLayout hideHeader={hideHeader} hideFooter={hideFooter}>
        <CustomerBookingWizard onLayoutChange={handleLayoutChange} instanceSubdomain={instanceSubdomain} />
      </ClientLayout>
    </>
  );
};

export default Rezerwacje;
