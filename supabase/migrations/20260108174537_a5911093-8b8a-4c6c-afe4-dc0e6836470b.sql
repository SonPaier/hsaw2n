-- Add status column to car_models table for proposal workflow
ALTER TABLE public.car_models 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_car_models_status ON public.car_models(status);

-- Update RLS policy - proposals visible only to super_admin
DROP POLICY IF EXISTS "Car models are viewable by everyone" ON public.car_models;

CREATE POLICY "Active car models are viewable by everyone" 
ON public.car_models 
FOR SELECT 
USING (
  active = true AND (
    status = 'active' 
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'super_admin'
    )
  )
);

-- Allow anyone to insert proposals (for reservation flow)
DROP POLICY IF EXISTS "Super admins can insert car models" ON public.car_models;

CREATE POLICY "Anyone can insert car model proposals" 
ON public.car_models 
FOR INSERT 
WITH CHECK (status = 'proposal' OR EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'super_admin'
));