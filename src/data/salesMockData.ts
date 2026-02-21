export interface SalesOrderProduct {
  name: string;
  quantity: number;
  priceNet: number;
  priceGross: number;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  createdAt: string; // ISO date
  shippedAt?: string; // ISO date
  customerName: string;
  totalNet: number;
  totalGross: number;
  currency: 'PLN' | 'EUR';
  products: SalesOrderProduct[];
  comment?: string;
  status: 'nowy' | 'wysłany';
  trackingNumber?: string;
}

export const mockSalesOrders: SalesOrder[] = [
  {
    id: '1',
    orderNumber: '45/12/25',
    createdAt: '2025-12-18',
    customerName: 'Auto Detailing Kraków Sp. z o.o.',
    totalNet: 4200,
    totalGross: 5166,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 3, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia przyciemniająca ULTRAFIT IR Nano 50cm', quantity: 2, priceNet: 300, priceGross: 369 },
    ],
    comment: 'Klient prosi o dostawę przed świętami',
    status: 'nowy',
  },
  {
    id: '2',
    orderNumber: '44/12/25',
    createdAt: '2025-12-15',
    shippedAt: '2025-12-17',
    customerName: 'Wrap Studio Warszawa',
    totalNet: 1800,
    totalGross: 2214,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Matte 152cm', quantity: 1, priceNet: 1800, priceGross: 2214 },
    ],
    status: 'wysłany',
    trackingNumber: '0015900773312345678',
  },
  {
    id: '3',
    orderNumber: '43/12/25',
    createdAt: '2025-12-12',
    shippedAt: '2025-12-14',
    customerName: 'PPF Master Poznań',
    totalNet: 7650,
    totalGross: 9409.50,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 4, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia ochronna PPF ULTRAFIT Gloss 76cm', quantity: 3, priceNet: 650, priceGross: 799.50 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', quantity: 2, priceNet: 475, priceGross: 584.25 },
    ],
    comment: 'Stały klient – rabat 5% uwzględniony',
    status: 'wysłany',
    trackingNumber: '0015900773398765432',
  },
  {
    id: '4',
    orderNumber: '42/11/25',
    createdAt: '2025-11-28',
    customerName: 'FolioTech Wrocław',
    totalNet: 2400,
    totalGross: 2952,
    currency: 'EUR',
    products: [
      { name: 'Folia przyciemniająca ULTRAFIT Hybrid 50cm', quantity: 4, priceNet: 350, priceGross: 430.50 },
      { name: 'Folia przyciemniająca ULTRAFIT IR Nano 76cm', quantity: 2, priceNet: 500, priceGross: 615 },
    ],
    status: 'nowy',
  },
  {
    id: '5',
    orderNumber: '41/11/25',
    createdAt: '2025-11-25',
    shippedAt: '2025-11-27',
    customerName: 'CarWrap Pro Gdańsk',
    totalNet: 3600,
    totalGross: 4428,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 3, priceNet: 1200, priceGross: 1476 },
    ],
    status: 'wysłany',
    trackingNumber: '0015900773356789012',
  },
  {
    id: '6',
    orderNumber: '40/11/25',
    createdAt: '2025-11-20',
    customerName: 'Detailing Center Łódź',
    totalNet: 5100,
    totalGross: 6273,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Gloss 152cm', quantity: 2, priceNet: 1400, priceGross: 1722 },
      { name: 'Folia ochronna PPF ULTRAFIT Matte 76cm', quantity: 1, priceNet: 950, priceGross: 1168.50 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 130cm', quantity: 2, priceNet: 675, priceGross: 830.25 },
    ],
    comment: 'Zamówienie pilne – montaż u klienta w piątek',
    status: 'nowy',
  },
  {
    id: '7',
    orderNumber: '39/11/25',
    createdAt: '2025-11-15',
    shippedAt: '2025-11-17',
    customerName: 'Auto Spa Premium Katowice',
    totalNet: 950,
    totalGross: 1168.50,
    currency: 'EUR',
    products: [
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', quantity: 2, priceNet: 475, priceGross: 584.25 },
    ],
    status: 'wysłany',
    trackingNumber: '0015900773323456789',
  },
  {
    id: '8',
    orderNumber: '38/10/25',
    createdAt: '2025-10-30',
    shippedAt: '2025-11-02',
    customerName: 'Shield Car Studio Lublin',
    totalNet: 6200,
    totalGross: 7626,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 3, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia przyciemniająca ULTRAFIT IR Nano 76cm', quantity: 2, priceNet: 500, priceGross: 615 },
      { name: 'Folia przyciemniająca ULTRAFIT Hybrid 50cm', quantity: 2, priceNet: 350, priceGross: 430.50 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 130cm', quantity: 1, priceNet: 675, priceGross: 830.25 },
    ],
    status: 'wysłany',
    trackingNumber: '0015900773387654321',
  },
  {
    id: '9',
    orderNumber: '37/10/25',
    createdAt: '2025-10-22',
    customerName: 'MaxProtect Szczecin',
    totalNet: 2600,
    totalGross: 3198,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Gloss 76cm', quantity: 4, priceNet: 650, priceGross: 799.50 },
    ],
    comment: 'Nowy klient – pierwszy zakup',
    status: 'nowy',
  },
  {
    id: '10',
    orderNumber: '36/10/25',
    createdAt: '2025-10-15',
    shippedAt: '2025-10-18',
    customerName: 'Wrap Studio Warszawa',
    totalNet: 4750,
    totalGross: 5842.50,
    currency: 'EUR',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Matte 152cm', quantity: 2, priceNet: 1800, priceGross: 2214 },
      { name: 'Folia przyciemniająca ULTRAFIT IR Nano 50cm', quantity: 3, priceNet: 300, priceGross: 369 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', quantity: 1, priceNet: 475, priceGross: 584.25 },
    ],
    status: 'wysłany',
    trackingNumber: '0015900773345678901',
  },
  {
    id: '11',
    orderNumber: '35/10/25',
    createdAt: '2025-10-10',
    customerName: 'PPF Expert Rzeszów',
    totalNet: 1400,
    totalGross: 1722,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Gloss 152cm', quantity: 1, priceNet: 1400, priceGross: 1722 },
    ],
    status: 'nowy',
  },
  {
    id: '12',
    orderNumber: '34/09/25',
    createdAt: '2025-09-28',
    shippedAt: '2025-09-30',
    customerName: 'Auto Detailing Kraków Sp. z o.o.',
    totalNet: 3500,
    totalGross: 4305,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 2, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia przyciemniająca ULTRAFIT Hybrid 76cm', quantity: 2, priceNet: 550, priceGross: 676.50 },
    ],
    comment: 'Faktura na firmę – dane jak poprzednio',
    status: 'wysłany',
    trackingNumber: '0015900773367890123',
  },
  {
    id: '13',
    orderNumber: '33/09/25',
    createdAt: '2025-09-20',
    customerName: 'ProWrap Bydgoszcz',
    totalNet: 1950,
    totalGross: 2398.50,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Gloss 76cm', quantity: 3, priceNet: 650, priceGross: 799.50 },
    ],
    status: 'nowy',
  },
  {
    id: '14',
    orderNumber: '32/09/25',
    createdAt: '2025-09-15',
    shippedAt: '2025-09-18',
    customerName: 'Elite Detailing Białystok',
    totalNet: 4100,
    totalGross: 5043,
    currency: 'EUR',
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 2, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 130cm', quantity: 1, priceNet: 675, priceGross: 830.25 },
      { name: 'Folia przyciemniająca ULTRAFIT IR Nano 50cm', quantity: 3, priceNet: 300, priceGross: 369 },
    ],
    comment: 'Wysyłka kurierem na adres warsztatu',
    status: 'wysłany',
    trackingNumber: '0015900773378901234',
  },
  {
    id: '15',
    orderNumber: '31/08/25',
    createdAt: '2025-08-30',
    customerName: 'GlassGuard Opole',
    totalNet: 2850,
    totalGross: 3505.50,
    currency: 'PLN',
    products: [
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', quantity: 2, priceNet: 475, priceGross: 584.25 },
      { name: 'Folia ochronna PPF ULTRAFIT Matte 152cm', quantity: 1, priceNet: 1800, priceGross: 2214 },
    ],
    status: 'nowy',
  },
];
