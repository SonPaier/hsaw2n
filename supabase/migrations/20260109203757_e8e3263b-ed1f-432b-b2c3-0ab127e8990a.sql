-- Add Google reviews URL to instances
ALTER TABLE instances 
ADD COLUMN IF NOT EXISTS offer_google_reviews_url TEXT;

-- Add default values per scope
ALTER TABLE offer_scopes
ADD COLUMN IF NOT EXISTS default_payment_terms TEXT,
ADD COLUMN IF NOT EXISTS default_notes TEXT,
ADD COLUMN IF NOT EXISTS default_warranty TEXT,
ADD COLUMN IF NOT EXISTS default_service_info TEXT;

-- Add contact_person to instances if not exists (for public offer view)
ALTER TABLE instances 
ADD COLUMN IF NOT EXISTS contact_person TEXT;