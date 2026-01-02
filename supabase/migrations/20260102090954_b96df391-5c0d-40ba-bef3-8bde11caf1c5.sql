-- Add started_at column to reservations table for tracking when work started
ALTER TABLE public.reservations 
ADD COLUMN started_at timestamp with time zone DEFAULT NULL;