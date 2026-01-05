-- Add column for section header text color (for scope names on page background)
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS offer_scope_header_text_color TEXT DEFAULT '#1e293b';