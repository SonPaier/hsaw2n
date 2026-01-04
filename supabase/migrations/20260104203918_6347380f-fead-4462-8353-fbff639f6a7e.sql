-- Add 'change_requested' status to reservation_status enum
ALTER TYPE reservation_status ADD VALUE 'change_requested';

-- Add columns for linking change requests to original reservations
ALTER TABLE public.reservations 
  ADD COLUMN IF NOT EXISTS original_reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_request_note TEXT;

-- Create index for faster lookup of change requests
CREATE INDEX IF NOT EXISTS idx_reservations_original_reservation_id 
  ON public.reservations(original_reservation_id) 
  WHERE original_reservation_id IS NOT NULL;