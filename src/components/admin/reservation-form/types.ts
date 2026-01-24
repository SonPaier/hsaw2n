import { DateRange } from 'react-day-picker';

export type CarSize = 'small' | 'medium' | 'large';
export type DialogMode = 'reservation' | 'yard';

export interface Service {
  id: string;
  name: string;
  short_name?: string | null;
  category_id?: string | null;
  duration_minutes: number | null;
  duration_small: number | null;
  duration_medium: number | null;
  duration_large: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  station_type: string | null;
  is_popular?: boolean | null;
}

export interface ServiceItem {
  service_id: string;
  custom_price: number | null;
}

export interface CustomerVehicle {
  id: string;
  phone: string;
  model: string;
  plate: string | null;
  customer_id: string | null;
  customer_name?: string;
  car_size?: string | null;
  last_used_at?: string | null;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string | null;
}

export interface Station {
  id: string;
  name: string;
  type: string;
}

export interface WorkingHours {
  open: string;
  close: string;
}

export interface EditingReservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  car_size?: CarSize | null;
  reservation_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  station_id: string | null;
  service_ids?: string[];
  service_id?: string;
  service_items?: ServiceItem[] | null;
  customer_notes?: string | null;
  admin_notes?: string | null;
  price?: number | null;
  confirmation_code?: string;
  offer_number?: string | null;
}

export interface YardVehicle {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  car_size: CarSize | null;
  service_ids: string[];
  arrival_date: string;
  pickup_date: string | null;
  deadline_time: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface ValidationErrors {
  phone?: string;
  carModel?: string;
  services?: string;
  time?: string;
  dateRange?: string;
}

export interface ReservationFormState {
  customerName: string;
  phone: string;
  carModel: string;
  carSize: CarSize;
  selectedServices: string[];
  serviceItems: ServiceItem[];
  adminNotes: string;
  finalPrice: string;
  offerNumber: string;
  dateRange: DateRange | undefined;
  manualStartTime: string;
  manualEndTime: string;
  manualStationId: string | null;
  arrivalDate: Date;
  pickupDate: Date | null;
  deadlineTime: string;
  validationErrors: ValidationErrors;
}
