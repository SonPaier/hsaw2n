import { Helmet } from 'react-helmet-async';
import ClientLayout from '@/components/layout/ClientLayout';
import CustomerBookingWizard from '@/components/booking/CustomerBookingWizard';

const Rezerwacje = () => {
  return (
    <>
      <Helmet>
        <title>Rezerwacja online - ARM CAR AUTO SPA Gdańsk</title>
        <meta name="description" content="Zarezerwuj wizytę w ARM CAR AUTO SPA Gdańsk. Mycie samochodowe, detailing, PPF - wybierz usługę i termin online." />
      </Helmet>

      <ClientLayout>
        <CustomerBookingWizard />
      </ClientLayout>
    </>
  );
};

export default Rezerwacje;
