-- Allow the same phone number to exist in both customer bases (myjnia/oferty)
-- Previously: unique (instance_id, phone)
-- Now: unique (instance_id, source, phone)

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_instance_id_phone_key;

-- In case it was created as a standalone unique index
DROP INDEX IF EXISTS public.customers_instance_id_phone_key;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_instance_id_source_phone_key UNIQUE (instance_id, source, phone);
