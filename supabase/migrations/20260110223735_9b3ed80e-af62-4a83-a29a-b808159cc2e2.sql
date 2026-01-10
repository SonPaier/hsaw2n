ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS created_by_username TEXT;