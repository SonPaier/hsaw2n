-- Add is_extras_scope field to offer_scopes
-- When true, this scope is treated as "Dodatki" - each option is independently addable
ALTER TABLE public.offer_scopes 
ADD COLUMN is_extras_scope boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.offer_scopes.is_extras_scope IS 'When true, this scope is treated as "Dodatki" - each option within can be independently added/removed, no variant selection';