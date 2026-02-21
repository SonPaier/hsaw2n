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
  customerName: string;
  totalNet: number;
  totalGross: number;
  products: SalesOrderProduct[];
  comment?: string;
  status: 'nowy' | 'wysłany';
}

export const mockSalesOrders: SalesOrder[] = [
  {
    id: '1',
    orderNumber: '45/12/25',
    createdAt: '2025-12-18',
    customerName: 'Auto Detailing Kraków Sp. z o.o.',
    totalNet: 4200,
    totalGross: 5166,
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
    customerName: 'Wrap Studio Warszawa',
    totalNet: 1800,
    totalGross: 2214,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Matte 152cm', quantity: 1, priceNet: 1800, priceGross: 2214 },
    ],
    status: 'wysłany',
  },
  {
    id: '3',
    orderNumber: '43/12/25',
    createdAt: '2025-12-12',
    customerName: 'PPF Master Poznań',
    totalNet: 7650,
    totalGross: 9409.50,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 4, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia ochronna PPF ULTRAFIT Gloss 76cm', quantity: 3, priceNet: 650, priceGross: 799.50 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', quantity: 2, priceNet: 475, priceGross: 584.25 },
    ],
    comment: 'Stały klient – rabat 5% uwzględniony',
    status: 'wysłany',
  },
  {
    id: '4',
    orderNumber: '42/11/25',
    createdAt: '2025-11-28',
    customerName: 'FolioTech Wrocław',
    totalNet: 2400,
    totalGross: 2952,
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
    customerName: 'CarWrap Pro Gdańsk',
    totalNet: 3600,
    totalGross: 4428,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 3, priceNet: 1200, priceGross: 1476 },
    ],
    status: 'wysłany',
  },
  {
    id: '6',
    orderNumber: '40/11/25',
    createdAt: '2025-11-20',
    customerName: 'Detailing Center Łódź',
    totalNet: 5100,
    totalGross: 6273,
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
    customerName: 'Auto Spa Premium Katowice',
    totalNet: 950,
    totalGross: 1168.50,
    products: [
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', quantity: 2, priceNet: 475, priceGross: 584.25 },
    ],
    status: 'wysłany',
  },
  {
    id: '8',
    orderNumber: '38/10/25',
    createdAt: '2025-10-30',
    customerName: 'Shield Car Studio Lublin',
    totalNet: 6200,
    totalGross: 7626,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 3, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia przyciemniająca ULTRAFIT IR Nano 76cm', quantity: 2, priceNet: 500, priceGross: 615 },
      { name: 'Folia przyciemniająca ULTRAFIT Hybrid 50cm', quantity: 2, priceNet: 350, priceGross: 430.50 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 130cm', quantity: 1, priceNet: 675, priceGross: 830.25 },
    ],
    status: 'wysłany',
  },
  {
    id: '9',
    orderNumber: '37/10/25',
    createdAt: '2025-10-22',
    customerName: 'MaxProtect Szczecin',
    totalNet: 2600,
    totalGross: 3198,
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
    customerName: 'Wrap Studio Warszawa',
    totalNet: 4750,
    totalGross: 5842.50,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Matte 152cm', quantity: 2, priceNet: 1800, priceGross: 2214 },
      { name: 'Folia przyciemniająca ULTRAFIT IR Nano 50cm', quantity: 3, priceNet: 300, priceGross: 369 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', quantity: 1, priceNet: 475, priceGross: 584.25 },
    ],
    status: 'wysłany',
  },
  {
    id: '11',
    orderNumber: '35/10/25',
    createdAt: '2025-10-10',
    customerName: 'PPF Expert Rzeszów',
    totalNet: 1400,
    totalGross: 1722,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Gloss 152cm', quantity: 1, priceNet: 1400, priceGross: 1722 },
    ],
    status: 'nowy',
  },
  {
    id: '12',
    orderNumber: '34/09/25',
    createdAt: '2025-09-28',
    customerName: 'Auto Detailing Kraków Sp. z o.o.',
    totalNet: 3500,
    totalGross: 4305,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 2, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia przyciemniająca ULTRAFIT Hybrid 76cm', quantity: 2, priceNet: 550, priceGross: 676.50 },
    ],
    comment: 'Faktura na firmę – dane jak poprzednio',
    status: 'wysłany',
  },
  {
    id: '13',
    orderNumber: '33/09/25',
    createdAt: '2025-09-20',
    customerName: 'ProWrap Bydgoszcz',
    totalNet: 1950,
    totalGross: 2398.50,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Gloss 76cm', quantity: 3, priceNet: 650, priceGross: 799.50 },
    ],
    status: 'nowy',
  },
  {
    id: '14',
    orderNumber: '32/09/25',
    createdAt: '2025-09-15',
    customerName: 'Elite Detailing Białystok',
    totalNet: 4100,
    totalGross: 5043,
    products: [
      { name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', quantity: 2, priceNet: 1200, priceGross: 1476 },
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 130cm', quantity: 1, priceNet: 675, priceGross: 830.25 },
      { name: 'Folia przyciemniająca ULTRAFIT IR Nano 50cm', quantity: 3, priceNet: 300, priceGross: 369 },
    ],
    comment: 'Wysyłka kurierem na adres warsztatu',
    status: 'wysłany',
  },
  {
    id: '15',
    orderNumber: '31/08/25',
    createdAt: '2025-08-30',
    customerName: 'GlassGuard Opole',
    totalNet: 2850,
    totalGross: 3505.50,
    products: [
      { name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', quantity: 2, priceNet: 475, priceGross: 584.25 },
      { name: 'Folia ochronna PPF ULTRAFIT Matte 152cm', quantity: 1, priceNet: 1800, priceGross: 2214 },
    ],
    status: 'nowy',
  },
];
