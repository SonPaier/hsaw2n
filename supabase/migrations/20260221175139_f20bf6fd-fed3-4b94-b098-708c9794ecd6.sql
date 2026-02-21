
ALTER TABLE public.customers
  -- Sales info fields
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS sales_notes text,

  -- International fields
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS contact_phone_country_code text,
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'PLN',
  ADD COLUMN IF NOT EXISTS vat_eu_number text,

  -- Billing address (structured)
  ADD COLUMN IF NOT EXISTS billing_street text,
  ADD COLUMN IF NOT EXISTS billing_street_line2 text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_region text,
  ADD COLUMN IF NOT EXISTS billing_country_code text,

  -- Shipping address (structured)
  ADD COLUMN IF NOT EXISTS shipping_street text,
  ADD COLUMN IF NOT EXISTS shipping_street_line2 text,
  ADD COLUMN IF NOT EXISTS shipping_postal_code text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_region text,
  ADD COLUMN IF NOT EXISTS shipping_country_code text;
