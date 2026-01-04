-- Add new status value to reservation_status enum
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'no_show';

-- Add tracking columns to reservations table
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS released_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS no_show_at timestamp with time zone;

-- Add rejected_at to offers table
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;