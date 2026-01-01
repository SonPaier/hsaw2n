-- Add 'released' status to reservation_status enum
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'released';

-- Add comment explaining the status
COMMENT ON TYPE public.reservation_status IS 'Reservation status: pending (waiting for confirmation), confirmed (confirmed by admin), in_progress (work started), completed (work done, ready for pickup), released (vehicle handed over to customer), cancelled (reservation cancelled)';