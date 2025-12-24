-- Add NIP column to instances table
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS nip text;

-- Create storage bucket for instance logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('instance-logos', 'instance-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for logo bucket
CREATE POLICY "Instance logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'instance-logos');

CREATE POLICY "Super admins can upload instance logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'instance-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can update instance logos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'instance-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can delete instance logos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'instance-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);