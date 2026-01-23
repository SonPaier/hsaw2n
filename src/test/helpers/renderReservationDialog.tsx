import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

// Default working hours for tests
export const defaultWorkingHours = {
  monday: { open: '08:00', close: '18:00' },
  tuesday: { open: '08:00', close: '18:00' },
  wednesday: { open: '08:00', close: '18:00' },
  thursday: { open: '08:00', close: '18:00' },
  friday: { open: '08:00', close: '18:00' },
  saturday: { open: '09:00', close: '14:00' },
  sunday: null,
};

// Default props for AddReservationDialogV2
export const defaultDialogProps = {
  open: true,
  onClose: vi.fn(),
  instanceId: 'test-instance-id',
  onSuccess: vi.fn(),
  workingHours: defaultWorkingHours,
  mode: 'reservation' as const,
  currentUsername: 'test-user',
};

// Mock services for testing
export const mockServices = [
  {
    id: 'svc-1',
    name: 'Mycie podstawowe',
    shortcut: 'MP',
    category_id: 'cat-1',
    duration_minutes: 30,
    duration_small: 25,
    duration_medium: 30,
    duration_large: 40,
    price_from: 50,
    price_small: 40,
    price_medium: 50,
    price_large: 70,
    station_type: 'washing',
    is_popular: true,
    category_prices_are_net: false,
  },
  {
    id: 'svc-2',
    name: 'Polerowanie',
    shortcut: 'POL',
    category_id: 'cat-2',
    duration_minutes: 120,
    duration_small: 100,
    duration_medium: 120,
    duration_large: 150,
    price_from: 300,
    price_small: 250,
    price_medium: 300,
    price_large: 400,
    station_type: 'detailing',
    is_popular: false,
    category_prices_are_net: true,
  },
  {
    id: 'svc-3',
    name: 'Woskowanie',
    shortcut: 'WOS',
    category_id: 'cat-1',
    duration_minutes: 45,
    duration_small: 35,
    duration_medium: 45,
    duration_large: 60,
    price_from: 80,
    price_small: 60,
    price_medium: 80,
    price_large: 120,
    station_type: 'washing',
    is_popular: true,
    category_prices_are_net: false,
  },
];

// Mock stations for testing
export const mockStations = [
  { id: 'sta-1', name: 'Stanowisko 1', type: 'washing' },
  { id: 'sta-2', name: 'Stanowisko 2', type: 'washing' },
  { id: 'sta-3', name: 'Stanowisko PPF', type: 'ppf' },
];

// Mock service categories for testing
export const mockServiceCategories = [
  { id: 'cat-1', name: 'Mycie', sort_order: 1, prices_are_net: false },
  { id: 'cat-2', name: 'Detailing', sort_order: 2, prices_are_net: true },
];

// Mock customer vehicles for testing
export const mockCustomerVehicles = [
  {
    id: 'veh-1',
    phone: '123456789',
    model: 'BMW X5',
    plate: 'WA12345',
    customer_id: 'cust-1',
    car_size: 'L',
    customer_name: 'Jan Kowalski',
    last_used_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'veh-2',
    phone: '123456789',
    model: 'Audi A4',
    plate: 'WA54321',
    customer_id: 'cust-1',
    car_size: 'M',
    customer_name: 'Jan Kowalski',
    last_used_at: '2024-01-10T10:00:00Z',
  },
];

// Mock customers for testing
export const mockCustomers = [
  {
    id: 'cust-1',
    name: 'Jan Kowalski',
    phone: '123456789',
    email: 'jan@example.com',
    discount_percent: 10,
  },
  {
    id: 'cust-2',
    name: 'Anna Nowak',
    phone: '987654321',
    email: 'anna@example.com',
    discount_percent: null,
  },
];

// Mock reservation for edit mode testing
export const mockEditingReservation = {
  id: 'res-1',
  customer_name: 'Jan Kowalski',
  customer_phone: '123456789',
  vehicle_plate: 'BMW X5',
  car_size: 'medium' as const,
  reservation_date: '2024-02-01',
  start_time: '10:00:00',
  end_time: '11:30:00',
  station_id: 'sta-1',
  service_ids: ['svc-1', 'svc-3'],
  service_items: [
    { service_id: 'svc-1', custom_price: null },
    { service_id: 'svc-3', custom_price: 100 },
  ],
  customer_notes: 'Proszę o dokładne mycie felg',
  admin_notes: 'Stały klient',
  price: 150,
  confirmation_code: 'ABC123',
  offer_number: null,
};

// Mock yard vehicle for yard mode testing
export const mockYardVehicle = {
  id: 'yard-1',
  customer_name: 'Piotr Wiśniewski',
  customer_phone: '111222333',
  vehicle_plate: 'Mercedes GLE',
  car_size: 'large' as const,
  service_ids: ['svc-2'],
  arrival_date: '2024-01-20',
  pickup_date: '2024-01-25',
  deadline_time: '15:00',
  notes: 'Klient VIP',
  status: 'waiting',
  created_at: '2024-01-20T08:00:00Z',
};

// Wrapper component with necessary providers
interface WrapperProps {
  children: React.ReactNode;
}

export const TestWrapper: React.FC<WrapperProps> = ({ children }) => {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </I18nextProvider>
  );
};

// Helper to render component with all providers
export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<Parameters<typeof render>[1], 'wrapper'>
): RenderResult => {
  return render(ui, { wrapper: TestWrapper, ...options });
};
