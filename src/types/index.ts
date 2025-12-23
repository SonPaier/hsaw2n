export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number;
  category: 'mycie' | 'folia' | 'inne';
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  stationId: string;
}

export interface Reservation {
  id: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  stationId: string;
  customerName: string;
  customerPhone: string;
  vehiclePlate: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  confirmationCode: string;
  createdAt: string;
}

export interface Station {
  id: string;
  name: string;
  type: 'mycie' | 'folia';
  active: boolean;
}

export interface Instance {
  id: string;
  name: string;
  logo?: string;
  phone: string;
  address: string;
  website?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
  };
  active: boolean;
  stations: Station[];
  createdAt: string;
}
