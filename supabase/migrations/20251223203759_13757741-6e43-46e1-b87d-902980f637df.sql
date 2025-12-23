-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN username text UNIQUE;

-- Create index for faster username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Allow reading profiles by username for login lookup (without auth)
CREATE POLICY "Anyone can lookup profile by username" 
ON public.profiles 
FOR SELECT 
USING (username IS NOT NULL);