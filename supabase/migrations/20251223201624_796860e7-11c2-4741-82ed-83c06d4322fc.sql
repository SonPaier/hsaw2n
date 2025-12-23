-- Enum dla ról użytkowników
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- Enum dla kategorii usług
CREATE TYPE public.service_category AS ENUM ('car_wash', 'ppf', 'detailing', 'upholstery', 'other');

-- Enum dla wielkości auta
CREATE TYPE public.car_size AS ENUM ('small', 'medium', 'large');

-- Enum dla typu stanowiska
CREATE TYPE public.station_type AS ENUM ('washing', 'ppf', 'detailing', 'universal');

-- Enum dla statusu rezerwacji
CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- Tabela instancji (firm)
CREATE TABLE public.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0ea5e9',
  secondary_color TEXT DEFAULT '#06b6d4',
  social_facebook TEXT,
  social_instagram TEXT,
  active BOOLEAN DEFAULT true,
  working_hours JSONB DEFAULT '{"monday": {"open": "08:00", "close": "18:00"}, "tuesday": {"open": "08:00", "close": "18:00"}, "wednesday": {"open": "08:00", "close": "18:00"}, "thursday": {"open": "08:00", "close": "18:00"}, "friday": {"open": "08:00", "close": "18:00"}, "saturday": {"open": "09:00", "close": "14:00"}, "sunday": null}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela profili użytkowników
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  instance_id UUID REFERENCES public.instances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela ról użytkowników (bezpieczna, oddzielna od profili)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  instance_id UUID REFERENCES public.instances(id) ON DELETE CASCADE,
  UNIQUE(user_id, role, instance_id)
);

-- Tabela stanowisk
CREATE TABLE public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type station_type NOT NULL DEFAULT 'universal',
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela kategorii usług (per instancja)
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela usług ze standaryzowaną strukturą
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  price_from DECIMAL(10,2),
  price_small DECIMAL(10,2),
  price_medium DECIMAL(10,2),
  price_large DECIMAL(10,2),
  requires_size BOOLEAN DEFAULT false,
  station_type station_type,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela rezerwacji
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  vehicle_plate TEXT NOT NULL,
  car_size car_size,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status reservation_status DEFAULT 'pending',
  confirmation_code TEXT NOT NULL,
  price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Funkcja sprawdzająca rolę (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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
  )
$$;

-- Funkcja sprawdzająca rolę w instancji
CREATE OR REPLACE FUNCTION public.has_instance_role(_user_id UUID, _role app_role, _instance_id UUID)
RETURNS BOOLEAN
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

-- Funkcja do automatycznego tworzenia profilu użytkownika
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Trigger do tworzenia profilu
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Funkcja do aktualizacji updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggery do updated_at
CREATE TRIGGER update_instances_updated_at BEFORE UPDATE ON public.instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Instances: publiczne do odczytu, super_admin może wszystko
CREATE POLICY "Instances are viewable by everyone" ON public.instances FOR SELECT USING (active = true);
CREATE POLICY "Super admins can manage instances" ON public.instances FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Profiles: użytkownik widzi swój profil
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- User roles: super_admin zarządza, user może tylko czytać swoją rolę
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Stations: publiczne do odczytu, admin/super_admin zarządza
CREATE POLICY "Stations are viewable by everyone" ON public.stations FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage stations" ON public.stations FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_instance_role(auth.uid(), 'admin', instance_id)
);

-- Service categories: publiczne do odczytu
CREATE POLICY "Categories are viewable by everyone" ON public.service_categories FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage categories" ON public.service_categories FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_instance_role(auth.uid(), 'admin', instance_id)
);

-- Services: publiczne do odczytu
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage services" ON public.services FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_instance_role(auth.uid(), 'admin', instance_id)
);

-- Reservations: klient tworzy, admin zarządza
CREATE POLICY "Anyone can create reservations" ON public.reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Reservations viewable by admins" ON public.reservations FOR SELECT USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_instance_role(auth.uid(), 'admin', instance_id)
);
CREATE POLICY "Admins can manage reservations" ON public.reservations FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_instance_role(auth.uid(), 'admin', instance_id)
);

-- Indeksy
CREATE INDEX idx_reservations_date ON public.reservations(reservation_date);
CREATE INDEX idx_reservations_instance ON public.reservations(instance_id);
CREATE INDEX idx_reservations_station ON public.reservations(station_id);
CREATE INDEX idx_services_instance ON public.services(instance_id);
CREATE INDEX idx_stations_instance ON public.stations(instance_id);