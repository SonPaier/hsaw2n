-- Faza 1: Rozszerzenie systemu użytkowników dla multi-tenant

-- 1. Dodanie nowej roli 'employee' do enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- 2. Dodanie kolumny is_blocked do profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- 3. Usunięcie istniejącego constraintu unikalności username (jeśli istnieje)
-- i dodanie nowego per instancja
DO $$
BEGIN
  -- Próba usunięcia istniejącego constraintu
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_username_key' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_username_key;
  END IF;
END $$;

-- Dodanie constraintu unikalności username per instancja
-- (ten sam username może istnieć w różnych instancjach)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_instance_username_unique 
ON public.profiles (instance_id, username) 
WHERE username IS NOT NULL AND instance_id IS NOT NULL;

-- 4. Tabela uprawnień pracowników do modułów
CREATE TABLE IF NOT EXISTS public.employee_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (instance_id, user_id, feature_key)
);

-- Włączenie RLS na employee_permissions
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

-- Polityki RLS dla employee_permissions
CREATE POLICY "Admins can manage employee permissions"
ON public.employee_permissions
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

CREATE POLICY "Users can view own permissions"
ON public.employee_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- 5. Funkcja pomocnicza do sprawdzania uprawnień pracownika
CREATE OR REPLACE FUNCTION public.has_employee_permission(
  _user_id uuid, 
  _instance_id uuid, 
  _feature_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_permissions
    WHERE user_id = _user_id
      AND instance_id = _instance_id
      AND feature_key = _feature_key
      AND enabled = true
  )
$$;

-- 6. Funkcja do sprawdzania czy użytkownik jest zablokowany
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_blocked FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- 7. Nowa funkcja do sprawdzania roli employee z uwzględnieniem instancji
CREATE OR REPLACE FUNCTION public.has_instance_role(_user_id uuid, _role app_role, _instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (instance_id = _instance_id OR instance_id IS NULL)
  )
$$;

-- 8. Aktualizacja polityk RLS dla profiles - admin instancji może widzieć użytkowników swojej instancji
DROP POLICY IF EXISTS "Instance admins can view instance profiles" ON public.profiles;
CREATE POLICY "Instance admins can view instance profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (
    instance_id IS NOT NULL AND
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  )
);

DROP POLICY IF EXISTS "Instance admins can update instance profiles" ON public.profiles;
CREATE POLICY "Instance admins can update instance profiles"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (
    instance_id IS NOT NULL AND
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  )
);

-- 9. Trigger do aktualizacji updated_at na employee_permissions
CREATE TRIGGER update_employee_permissions_updated_at
BEFORE UPDATE ON public.employee_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();