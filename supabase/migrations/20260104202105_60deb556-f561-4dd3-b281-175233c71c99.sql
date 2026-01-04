-- Allow reservations without a service (needed for PPF/folia stations)
ALTER TABLE public.reservations ALTER COLUMN service_id DROP NOT NULL;