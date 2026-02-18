
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;
