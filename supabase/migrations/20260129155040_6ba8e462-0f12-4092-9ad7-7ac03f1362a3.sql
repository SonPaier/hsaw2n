-- Add 'hall' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hall';

-- Update has_role function to handle the new role (no changes needed, it works with any enum value)

-- Create user tablet1 with hall role (will be done after migration via edge function)