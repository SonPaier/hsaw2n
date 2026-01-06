-- Add column to track if category prices are net or gross (default false = gross/brutto)
ALTER TABLE public.service_categories 
ADD COLUMN prices_are_net boolean NOT NULL DEFAULT false;