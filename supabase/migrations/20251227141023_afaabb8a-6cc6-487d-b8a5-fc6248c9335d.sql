-- Allow instance admins to upload their own logo
CREATE POLICY "Instance admins can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'instance-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
    AND (storage.foldername(name))[1] = p.instance_id::text
  )
);

-- Allow instance admins to update their own logo
CREATE POLICY "Instance admins can update logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'instance-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
    AND (storage.foldername(name))[1] = p.instance_id::text
  )
);

-- Allow instance admins to delete their own logo
CREATE POLICY "Instance admins can delete logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'instance-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
    AND (storage.foldername(name))[1] = p.instance_id::text
  )
);