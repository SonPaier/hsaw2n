-- Add duration columns for different car sizes
ALTER TABLE public.services
ADD COLUMN duration_small integer DEFAULT NULL,
ADD COLUMN duration_medium integer DEFAULT NULL,
ADD COLUMN duration_large integer DEFAULT NULL;