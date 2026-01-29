-- 1. Add photo_urls column to reservations
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT NULL;

-- 2. Add reservation_id column to vehicle_protocols
ALTER TABLE public.vehicle_protocols ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.reservations(id);

-- 3. Create storage bucket for reservation photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('reservation-photos', 'reservation-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS policies for reservation-photos bucket
CREATE POLICY "Authenticated users can upload reservation photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reservation-photos');

CREATE POLICY "Public read access for reservation photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'reservation-photos');

CREATE POLICY "Authenticated users can delete reservation photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reservation-photos');