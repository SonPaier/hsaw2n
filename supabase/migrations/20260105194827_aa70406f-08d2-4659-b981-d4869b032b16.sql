-- Add portfolio URL field to instances table
ALTER TABLE public.instances 
ADD COLUMN offer_portfolio_url TEXT;