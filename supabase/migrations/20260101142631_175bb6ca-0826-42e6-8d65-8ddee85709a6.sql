-- Change default value for auto_confirm_reservations to false
ALTER TABLE public.instances 
ALTER COLUMN auto_confirm_reservations SET DEFAULT false;

-- Add subdomain field for custom subdomain routing
ALTER TABLE public.instances 
ADD COLUMN subdomain text UNIQUE;

-- Add index for subdomain lookups
CREATE INDEX idx_instances_subdomain ON public.instances(subdomain) WHERE subdomain IS NOT NULL;

COMMENT ON COLUMN public.instances.subdomain IS 'Custom subdomain for the instance, e.g., "armcar" for armcar.n2wash.com';