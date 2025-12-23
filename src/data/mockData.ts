import { Service, TimeSlot, Reservation, Station, Instance } from '@/types';

export const mockServices: Service[] = [
  {
    id: '1',
    name: 'Mycie podstawowe',
    description: 'Zewnętrzne mycie samochodu z suszeniem',
    duration: 30,
    price: 50,
    category: 'mycie',
  },
  {
    id: '2',
    name: 'Mycie premium',
    description: 'Mycie zewnętrzne i wewnętrzne, woskowanie',
    duration: 60,
    price: 120,
    category: 'mycie',
  },
  {
    id: '3',
    name: 'Mycie detailingowe',
    description: 'Pełny detailing pojazdu z polerką',
    duration: 180,
    price: 350,
    category: 'mycie',
  },
  {
    id: '4',
    name: 'Folia ochronna PPF',
    description: 'Aplikacja folii ochronnej PPF na przód pojazdu',
    duration: 480,
    price: 2500,
    category: 'folia',
  },
  {
    id: '5',
    name: 'Folia przyciemniająca',
    description: 'Przyciemnienie szyb folią',
    duration: 180,
    price: 800,
    category: 'folia',
  },
];

export const mockStations: Station[] = [
  { id: 'st1', name: 'Stanowisko 1', type: 'mycie', active: true },
  { id: 'st2', name: 'Stanowisko 2', type: 'mycie', active: true },
  { id: 'st3', name: 'Stanowisko 3', type: 'folia', active: true },
];

export const generateTimeSlots = (date: string, stationId: string): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const startHour = 8;
  const endHour = 18;
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push({
        id: `${date}-${stationId}-${time}`,
        time,
        available: Math.random() > 0.3,
        stationId,
      });
    }
  }
  
  return slots;
};

export const mockReservations: Reservation[] = [
  {
    id: 'res1',
    serviceId: '1',
    serviceName: 'Mycie podstawowe',
    date: '2025-12-24',
    time: '10:00',
    stationId: 'st1',
    customerName: 'Jan Kowalski',
    customerPhone: '+48 123 456 789',
    vehiclePlate: 'GD 12345',
    status: 'confirmed',
    confirmationCode: '123',
    createdAt: '2025-12-23T10:00:00Z',
  },
  {
    id: 'res2',
    serviceId: '2',
    serviceName: 'Mycie premium',
    date: '2025-12-24',
    time: '11:00',
    stationId: 'st2',
    customerName: 'Anna Nowak',
    customerPhone: '+48 987 654 321',
    vehiclePlate: 'GD 54321',
    status: 'pending',
    confirmationCode: '456',
    createdAt: '2025-12-23T11:00:00Z',
  },
];

export const mockInstance: Instance = {
  id: 'inst1',
  name: 'ARM CAR AUTO SPA GDAŃSK',
  phone: '+48 123 456 789',
  address: 'ul. Przykładowa 123, 80-000 Gdańsk',
  website: 'https://armcar.pl',
  socialLinks: {
    facebook: 'https://facebook.com/armcar',
    instagram: 'https://instagram.com/armcar',
  },
  active: true,
  stations: mockStations,
  createdAt: '2025-01-01T00:00:00Z',
};
