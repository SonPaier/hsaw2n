-- Add column for controlling unit prices visibility in offers (default false = hidden)
ALTER TABLE public.instances
ADD COLUMN show_unit_prices_in_offer boolean NOT NULL DEFAULT false;