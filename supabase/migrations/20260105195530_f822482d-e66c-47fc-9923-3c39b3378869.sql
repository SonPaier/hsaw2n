-- Add parameters column to instance_features for storing feature-specific configuration
ALTER TABLE public.instance_features 
ADD COLUMN parameters JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.instance_features.parameters IS 'JSON parameters for feature configuration, e.g., allowed phone numbers for SMS edit link';