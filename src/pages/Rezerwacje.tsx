import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ClientLayout from '@/components/layout/ClientLayout';
import CustomerBookingWizard from '@/components/booking/CustomerBookingWizard';

interface RezerwacjeProps {
  instanceSubdomain?: string;
}

const Rezerwacje = ({ instanceSubdomain }: RezerwacjeProps) => {
  const [hideLayout, setHideLayout] = useState(false);

  return (
    <>
      <Helmet>
        <title>Rezerwacja online - ARM CAR AUTO SPA Gdańsk</title>
        <meta name="description" content="Zarezerwuj wizytę w ARM CAR AUTO SPA Gdańsk. Mycie samochodowe, detailing, PPF - wybierz usługę i termin online." />
      </Helmet>

      <ClientLayout hideHeader={hideLayout} hideFooter={hideLayout}>
        <CustomerBookingWizard onLayoutChange={setHideLayout} instanceSubdomain={instanceSubdomain} />
      </ClientLayout>
    </>
  );
};

export default Rezerwacje;
