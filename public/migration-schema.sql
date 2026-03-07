-- ============================================================
-- FULL SCHEMA MIGRATION for N2Wash/ArmCar project
-- Run this SQL in the TARGET Supabase SQL Editor
-- Generated: 2026-03-07
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA extensions;

-- 2. ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user', 'employee', 'hall', 'sales');
CREATE TYPE public.car_size AS ENUM ('small', 'medium', 'large');
CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'released', 'no_show', 'change_requested');
CREATE TYPE public.service_category AS ENUM ('car_wash', 'ppf', 'detailing', 'upholstery', 'other');
CREATE TYPE public.station_type AS ENUM ('washing', 'ppf', 'detailing', 'universal');
CREATE TYPE public.training_type AS ENUM ('group_basic', 'individual', 'master');

-- 3. TABLES (ordered by FK dependencies)

-- Level 0: No FK dependencies on other public tables
CREATE TABLE public.instances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  phone text,
  address text,
  email text,
  website text,
  logo_url text,
  primary_color text DEFAULT '#0ea5e9'::text,
  secondary_color text DEFAULT '#06b6d4'::text,
  social_facebook text,
  social_instagram text,
  active boolean DEFAULT true,
  working_hours jsonb DEFAULT '{"friday": {"open": "08:00", "close": "18:00"}, "monday": {"open": "08:00", "close": "18:00"}, "sunday": null, "tuesday": {"open": "08:00", "close": "18:00"}, "saturday": {"open": "09:00", "close": "14:00"}, "thursday": {"open": "08:00", "close": "18:00"}, "wednesday": {"open": "08:00", "close": "18:00"}}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  nip text,
  background_color text DEFAULT '#ffffff'::text,
  sms_limit integer NOT NULL DEFAULT 50,
  sms_used integer NOT NULL DEFAULT 0,
  auto_confirm_reservations boolean DEFAULT false,
  booking_days_ahead integer NOT NULL DEFAULT 90,
  use_global_products boolean NOT NULL DEFAULT true,
  google_maps_url text,
  subdomain text,
  invoice_company_name text,
  show_unit_prices_in_offer boolean NOT NULL DEFAULT false,
  customer_edit_cutoff_hours integer DEFAULT 1,
  offer_branding_enabled boolean NOT NULL DEFAULT false,
  offer_bg_color text DEFAULT '#f8fafc'::text,
  offer_header_bg_color text DEFAULT '#ffffff'::text,
  offer_header_text_color text DEFAULT '#1e293b'::text,
  offer_section_bg_color text DEFAULT '#ffffff'::text,
  offer_section_text_color text DEFAULT '#1e293b'::text,
  offer_primary_color text DEFAULT '#2563eb'::text,
  offer_scope_header_text_color text DEFAULT '#1e293b'::text,
  offer_default_payment_terms text,
  offer_default_notes text,
  offer_default_warranty text,
  offer_default_service_info text,
  offer_email_template text,
  offer_portfolio_url text,
  contact_person text,
  short_name text,
  reservation_phone text,
  offer_google_reviews_url text,
  offer_bank_company_name text,
  offer_bank_account_number text,
  offer_bank_name text,
  offer_trust_header_title text,
  offer_trust_description text,
  offer_trust_tiles jsonb,
  protocol_email_template text,
  timezone text DEFAULT 'Europe/Warsaw'::text,
  public_api_key text,
  widget_config jsonb DEFAULT '{}'::jsonb,
  assign_employees_to_stations boolean DEFAULT false,
  assign_employees_to_reservations boolean DEFAULT false,
  deleted_at timestamp with time zone,
  sms_sender_name text,
  bank_accounts jsonb DEFAULT '[]'::jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE public.car_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  name text NOT NULL,
  size text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'::text,
  PRIMARY KEY (id),
  UNIQUE (brand, name),
  CHECK (size = ANY (ARRAY['S'::text, 'M'::text, 'L'::text]))
);

CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  base_price numeric NOT NULL,
  price_per_station numeric NOT NULL DEFAULT 49,
  sms_limit integer NOT NULL DEFAULT 100,
  included_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.paint_colors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  color_code text,
  paint_type text NOT NULL DEFAULT 'standard'::text,
  color_family text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Level 1: Depend on instances
CREATE TABLE public.stations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  type station_type NOT NULL DEFAULT 'universal'::station_type,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  color text,
  PRIMARY KEY (id)
);

CREATE TABLE public.service_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  prices_are_net boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer DEFAULT 60,
  price_from numeric,
  price_small numeric,
  price_medium numeric,
  price_large numeric,
  requires_size boolean DEFAULT false,
  station_type station_type,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  subcategory text,
  duration_small integer,
  duration_medium integer,
  duration_large integer,
  shortcut text,
  is_popular boolean DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text NOT NULL,
  email text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  phone_verified boolean DEFAULT false,
  source text NOT NULL DEFAULT 'myjnia'::text,
  company text,
  nip text,
  address text,
  discount_percent integer,
  short_name text,
  contact_person text,
  contact_phone text,
  contact_email text,
  sales_notes text,
  country_code text,
  phone_country_code text,
  contact_phone_country_code text,
  default_currency text DEFAULT 'PLN'::text,
  vat_eu_number text,
  billing_street text,
  billing_street_line2 text,
  billing_postal_code text,
  billing_city text,
  billing_region text,
  billing_country_code text,
  shipping_street text,
  shipping_street_line2 text,
  shipping_postal_code text,
  shipping_city text,
  shipping_region text,
  shipping_country_code text,
  has_no_show boolean NOT NULL DEFAULT false,
  sms_consent boolean NOT NULL DEFAULT false,
  is_net_payer boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id),
  UNIQUE (instance_id, source, phone)
);

CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  hourly_rate numeric,
  active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  PRIMARY KEY (id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  phone text,
  instance_id uuid REFERENCES instances(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  username text,
  is_blocked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user'::app_role,
  instance_id uuid REFERENCES instances(id),
  hall_id uuid,
  PRIMARY KEY (id)
);

CREATE TABLE public.customer_vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  phone text NOT NULL,
  model text NOT NULL,
  plate text,
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  car_size text,
  PRIMARY KEY (id)
);
CREATE UNIQUE INDEX idx_customer_vehicles_unique ON public.customer_vehicles (instance_id, phone, model);

CREATE TABLE public.closed_days (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  closed_date date NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (id),
  UNIQUE (instance_id, closed_date)
);

CREATE TABLE public.breaks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  break_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  read boolean NOT NULL DEFAULT false,
  entity_type text,
  entity_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.employee_breaks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  break_date date NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  duration_minutes integer,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.employee_days_off (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date_from date NOT NULL,
  date_to date NOT NULL,
  day_off_type text NOT NULL DEFAULT 'vacation'::text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CHECK (day_off_type = ANY (ARRAY['vacation'::text, 'day_off'::text])),
  CHECK (date_to >= date_from)
);

CREATE TABLE public.employee_edit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_value jsonb,
  new_value jsonb,
  edited_at timestamp with time zone DEFAULT now(),
  edited_by uuid,
  PRIMARY KEY (id),
  CHECK (entity_type = ANY (ARRAY['employee'::text, 'time_entry'::text]))
);

CREATE TABLE public.employee_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (instance_id, user_id, feature_key)
);

CREATE TABLE public.instance_features (
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  parameters jsonb,
  PRIMARY KEY (instance_id, feature_key)
);

CREATE TABLE public.instance_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  station_limit integer NOT NULL DEFAULT 1,
  monthly_price numeric,
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_trial boolean DEFAULT false,
  trial_expires_at timestamp with time zone,
  PRIMARY KEY (id),
  UNIQUE (instance_id)
);

CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  success boolean NOT NULL DEFAULT false,
  ip_hint text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.unified_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  category_type text NOT NULL,
  name text NOT NULL,
  slug text,
  description text,
  sort_order integer DEFAULT 0,
  prices_are_net boolean DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  active boolean DEFAULT true,
  PRIMARY KEY (id)
);

CREATE TABLE public.reminder_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sms_template text NOT NULL DEFAULT '{short_name}: Przypominamy o {service_type} dla {vehicle_info}. {paid_info}. Zadzwon: {reservation_phone}'::text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.unified_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  category_id uuid REFERENCES unified_categories(id),
  name text NOT NULL,
  short_name text,
  description text,
  price_small numeric,
  price_medium numeric,
  price_large numeric,
  default_price numeric DEFAULT 0,
  duration_small integer,
  duration_medium integer,
  duration_large integer,
  requires_size boolean DEFAULT false,
  is_popular boolean DEFAULT false,
  prices_are_net boolean DEFAULT false,
  active boolean DEFAULT true,
  default_validity_days integer,
  default_payment_terms text,
  default_warranty_terms text,
  default_service_info text,
  sort_order integer DEFAULT 0,
  unit text DEFAULT 'szt'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  shortcut text,
  price_from numeric,
  duration_minutes integer,
  station_type text DEFAULT 'washing'::text,
  service_type text DEFAULT 'reservation'::text,
  reminder_template_id uuid REFERENCES reminder_templates(id),
  visibility text DEFAULT 'everywhere'::text,
  photo_urls text[],
  PRIMARY KEY (id)
);

CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id),
  station_id uuid REFERENCES stations(id),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  vehicle_plate text NOT NULL,
  car_size car_size,
  reservation_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  status reservation_status DEFAULT 'pending'::reservation_status,
  confirmation_code text NOT NULL,
  price numeric,
  customer_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  end_date date,
  source text DEFAULT 'admin'::text,
  service_ids jsonb DEFAULT '[]'::jsonb,
  started_at timestamp with time zone,
  created_by uuid,
  confirmed_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  released_at timestamp with time zone,
  no_show_at timestamp with time zone,
  cancelled_by uuid,
  edited_by_customer_at timestamp with time zone,
  original_reservation_id uuid,
  change_request_note text,
  admin_notes text,
  reminder_1day_sent boolean,
  reminder_1hour_sent boolean,
  offer_number text,
  created_by_username text,
  confirmation_sms_sent_at timestamp with time zone,
  pickup_sms_sent_at timestamp with time zone,
  reminder_1hour_last_attempt_at timestamp with time zone,
  reminder_1day_last_attempt_at timestamp with time zone,
  reminder_failure_count integer DEFAULT 0,
  reminder_permanent_failure boolean DEFAULT false,
  reminder_failure_reason text,
  service_items jsonb DEFAULT '[]'::jsonb,
  has_unified_services boolean DEFAULT false,
  photo_urls text[],
  checked_service_ids jsonb DEFAULT '[]'::jsonb,
  assigned_employee_ids jsonb DEFAULT '[]'::jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE public.customer_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  reminder_template_id uuid NOT NULL REFERENCES reminder_templates(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  vehicle_plate text NOT NULL DEFAULT ''::text,
  scheduled_date date NOT NULL,
  months_after integer NOT NULL,
  service_type text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'::text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (instance_id, customer_phone, vehicle_plate, reminder_template_id, months_after)
);

CREATE TABLE public.reservation_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  field_name text,
  old_value jsonb,
  new_value jsonb NOT NULL,
  batch_id uuid NOT NULL,
  changed_by uuid,
  changed_by_username text NOT NULL,
  changed_by_type text NOT NULL DEFAULT 'admin'::text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.reservation_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  instance_id uuid REFERENCES instances(id),
  PRIMARY KEY (id)
);

-- Offers system
CREATE TABLE public.offer_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_scopes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  has_coating_upsell boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_extras_scope boolean NOT NULL DEFAULT false,
  default_payment_terms text,
  default_notes text,
  default_warranty text,
  default_service_info text,
  short_name text,
  source text NOT NULL DEFAULT 'instance'::text,
  has_unified_services boolean DEFAULT false,
  price_from numeric,
  available_durations integer[],
  photo_urls text[],
  PRIMARY KEY (id)
);

CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  offer_number text NOT NULL,
  public_token text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  customer_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  vehicle_data jsonb,
  total_net numeric NOT NULL DEFAULT 0,
  total_gross numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 23,
  notes text,
  payment_terms text,
  valid_until date,
  sent_at timestamp with time zone,
  viewed_at timestamp with time zone,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  hide_unit_prices boolean NOT NULL DEFAULT false,
  approved_at timestamp with time zone,
  approved_by uuid,
  selected_state jsonb,
  rejected_at timestamp with time zone,
  warranty text,
  service_info text,
  completed_at timestamp with time zone,
  completed_by uuid,
  has_unified_services boolean DEFAULT false,
  admin_approved_net numeric,
  admin_approved_gross numeric,
  follow_up_phone_status text,
  budget_suggestion numeric,
  source text DEFAULT 'admin'::text,
  paint_color text,
  paint_finish text,
  planned_date date,
  inquiry_notes text,
  widget_selected_extras uuid[],
  widget_duration_selections jsonb,
  internal_notes text,
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_selected boolean NOT NULL DEFAULT true,
  subtotal_net numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  scope_id uuid REFERENCES offer_scopes(id),
  variant_id uuid REFERENCES offer_variants(id),
  parent_option_id uuid REFERENCES offer_options(id),
  is_upsell boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_option_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES offer_options(id) ON DELETE CASCADE,
  product_id uuid REFERENCES unified_services(id),
  custom_name text,
  custom_description text,
  unit text NOT NULL DEFAULT 'szt'::text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  is_optional boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES offers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id),
  product_id uuid REFERENCES unified_services(id),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  vehicle_info text,
  scheduled_date date NOT NULL,
  months_after integer NOT NULL,
  is_paid boolean NOT NULL DEFAULT true,
  service_type text NOT NULL,
  service_name text NOT NULL,
  sms_template text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'::text,
  sent_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancelled_reason text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_scope_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES offer_scopes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES unified_services(id),
  variant_name text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_scope_extras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES offer_scopes(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_upsell boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_scope_extra_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  extra_id uuid NOT NULL REFERENCES offer_scope_extras(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  product_id uuid REFERENCES unified_services(id),
  custom_name text,
  custom_description text,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'szt'::text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_scope_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES offer_scopes(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES offer_variants(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_scope_variant_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  scope_id uuid NOT NULL REFERENCES offer_scopes(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES offer_variants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES unified_services(id),
  custom_name text,
  custom_description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'szt'::text,
  unit_price numeric NOT NULL DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_text_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  block_id uuid,
  content text NOT NULL,
  block_type text NOT NULL DEFAULT 'general'::text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (id)
);

CREATE TABLE public.offer_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  duration_seconds integer DEFAULT 0,
  is_admin_preview boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Followup system
CREATE TABLE public.followup_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_interval_months integer NOT NULL DEFAULT 12,
  active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.followup_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  followup_service_id uuid REFERENCES followup_services(id),
  next_reminder_date date NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (id)
);

CREATE TABLE public.followup_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES followup_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Halls
CREATE TABLE public.halls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  station_ids uuid[] DEFAULT '{}'::uuid[],
  visible_fields jsonb DEFAULT '{"services": true, "admin_notes": false, "customer_name": true, "vehicle_plate": true, "customer_phone": false}'::jsonb,
  allowed_actions jsonb DEFAULT '{"change_time": false, "add_services": false, "change_station": false}'::jsonb,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- SMS
CREATE TABLE public.sms_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  phone text NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL,
  sent_by uuid,
  reservation_id uuid REFERENCES reservations(id),
  customer_id uuid REFERENCES customers(id),
  status text NOT NULL DEFAULT 'sent'::text,
  error_message text,
  smsapi_response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.sms_message_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  send_at_time time without time zone,
  PRIMARY KEY (id)
);

CREATE TABLE public.sms_verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  reservation_data jsonb NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Workers
CREATE TABLE public.station_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  entry_number integer NOT NULL DEFAULT 1,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  total_minutes integer,
  entry_type text NOT NULL DEFAULT 'startstop'::text,
  is_auto_closed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.workers_settings (
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  start_stop_enabled boolean NOT NULL DEFAULT false,
  breaks_enabled boolean NOT NULL DEFAULT false,
  overtime_enabled boolean NOT NULL DEFAULT false,
  standard_hours_per_day integer NOT NULL DEFAULT 8,
  report_frequency text DEFAULT 'monthly'::text,
  report_email text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  time_calculation_mode text NOT NULL DEFAULT 'start_to_stop'::text,
  PRIMARY KEY (instance_id)
);

-- Training
CREATE TABLE public.training_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_days numeric NOT NULL DEFAULT 1,
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.trainings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  training_type text NOT NULL DEFAULT 'individual'::training_type,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  station_id uuid REFERENCES stations(id),
  status text NOT NULL DEFAULT 'open'::text,
  assigned_employee_ids jsonb DEFAULT '[]'::jsonb,
  photo_urls text[],
  created_by uuid,
  created_by_username text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  training_type_id uuid REFERENCES training_types(id),
  PRIMARY KEY (id)
);

-- Protocols
CREATE TABLE public.vehicle_protocols (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES offers(id),
  offer_number text,
  customer_name text NOT NULL,
  vehicle_model text,
  nip text,
  phone text,
  registration_number text,
  fuel_level integer,
  odometer_reading integer,
  body_type text NOT NULL DEFAULT 'sedan'::text,
  protocol_date date NOT NULL DEFAULT CURRENT_DATE,
  received_by text,
  customer_signature text,
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  protocol_time time without time zone,
  public_token text NOT NULL,
  customer_email text,
  protocol_type text NOT NULL DEFAULT 'reception'::text,
  notes text,
  photo_urls text[] DEFAULT '{}'::text[],
  reservation_id uuid REFERENCES reservations(id),
  PRIMARY KEY (id)
);

CREATE TABLE public.protocol_damage_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES vehicle_protocols(id) ON DELETE CASCADE,
  view text NOT NULL,
  x_percent numeric NOT NULL,
  y_percent numeric NOT NULL,
  damage_type text,
  custom_note text,
  photo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  photo_urls text[],
  PRIMARY KEY (id)
);

-- Push
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  instance_id uuid REFERENCES instances(id),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Price lists & Products
CREATE TABLE public.price_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES instances(id),
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  products_count integer DEFAULT 0,
  extracted_at timestamp with time zone,
  error_message text,
  is_global boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  salesperson_name text,
  salesperson_email text,
  salesperson_phone text,
  PRIMARY KEY (id)
);

CREATE TABLE public.products_library (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES instances(id),
  source text NOT NULL DEFAULT 'instance'::text,
  name text NOT NULL,
  description text,
  category text,
  unit text NOT NULL DEFAULT 'szt'::text,
  default_price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  brand text,
  reminder_template_id uuid REFERENCES reminder_templates(id),
  default_validity_days integer,
  default_payment_terms text,
  default_warranty_terms text,
  default_service_info text,
  short_name text,
  PRIMARY KEY (id)
);

CREATE TABLE public.text_blocks_library (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES instances(id),
  source text NOT NULL DEFAULT 'instance'::text,
  name text NOT NULL,
  content text NOT NULL,
  block_type text NOT NULL DEFAULT 'general'::text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Sales
CREATE TABLE public.sales_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  short_name text NOT NULL,
  description text,
  price_net numeric NOT NULL DEFAULT 0,
  price_unit text NOT NULL DEFAULT 'piece'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category_id uuid,
  PRIMARY KEY (id)
);

CREATE TABLE public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id),
  order_number text NOT NULL,
  customer_name text NOT NULL,
  city text,
  contact_person text,
  total_net numeric NOT NULL DEFAULT 0,
  total_gross numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PLN'::text,
  comment text,
  status text NOT NULL DEFAULT 'nowy'::text,
  tracking_number text,
  shipped_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  vehicle text,
  delivery_type text DEFAULT 'shipping'::text,
  payment_method text NOT NULL DEFAULT 'cod'::text,
  bank_account_number text,
  PRIMARY KEY (id)
);

CREATE TABLE public.sales_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES sales_products(id),
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price_net numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  vehicle text,
  PRIMARY KEY (id)
);

-- Yard
CREATE TABLE public.yard_vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  vehicle_plate text NOT NULL,
  car_size car_size,
  service_ids jsonb DEFAULT '[]'::jsonb,
  arrival_date date NOT NULL DEFAULT CURRENT_DATE,
  deadline_time time without time zone,
  notes text,
  status text NOT NULL DEFAULT 'waiting'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  pickup_date date,
  PRIMARY KEY (id)
);

-- Reservation photos (referenced in export but not in types - creating as standard table)
CREATE TABLE IF NOT EXISTS public.reservation_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- 4. INDEXES
CREATE INDEX idx_breaks_instance_date ON public.breaks (instance_id, break_date);
CREATE INDEX idx_breaks_station ON public.breaks (station_id);
CREATE INDEX idx_car_models_active ON public.car_models (active) WHERE active = true;
CREATE INDEX idx_car_models_status ON public.car_models (status);
CREATE INDEX idx_car_models_brand ON public.car_models (brand);
CREATE INDEX idx_car_models_name_search ON public.car_models USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_car_models_brand_search ON public.car_models USING gin (brand extensions.gin_trgm_ops);
CREATE INDEX idx_customer_reminders_instance_status ON public.customer_reminders (instance_id, status);
CREATE INDEX idx_customer_reminders_scheduled_date ON public.customer_reminders (scheduled_date);
CREATE INDEX idx_customer_reminders_phone ON public.customer_reminders (customer_phone);
CREATE INDEX idx_customer_vehicles_instance_phone ON public.customer_vehicles (instance_id, phone);
CREATE INDEX idx_customers_source ON public.customers (instance_id, source);
CREATE INDEX idx_customers_phone_instance ON public.customers (phone, instance_id);
CREATE INDEX idx_breaks_employee_date ON public.employee_breaks (employee_id, break_date);
CREATE INDEX idx_days_off_employee ON public.employee_days_off (employee_id, date_from, date_to);
CREATE INDEX idx_edit_logs_entity ON public.employee_edit_logs (entity_type, entity_id);
CREATE INDEX idx_employees_active_not_deleted ON public.employees (instance_id, active) WHERE deleted_at IS NULL;
CREATE INDEX idx_reservations_instance_date ON public.reservations (instance_id, reservation_date);
CREATE INDEX idx_reservations_instance_status ON public.reservations (instance_id, status);
CREATE INDEX idx_reservations_confirmation_code ON public.reservations (confirmation_code);
CREATE INDEX idx_notifications_unread ON public.notifications (instance_id) WHERE read = false;
CREATE INDEX idx_offers_instance ON public.offers (instance_id);
CREATE INDEX idx_offers_token ON public.offers (public_token);
CREATE INDEX idx_sms_logs_instance ON public.sms_logs (instance_id, created_at);

-- 5. FUNCTIONS (all from source)

-- Helper: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Helper: has_instance_role
CREATE OR REPLACE FUNCTION public.has_instance_role(_user_id uuid, _role app_role, _instance_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND (instance_id = _instance_id OR instance_id IS NULL)
  )
$$;

-- Helper: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role)
$$;

-- Helper: can_access_instance
CREATE OR REPLACE FUNCTION public.can_access_instance(_instance_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    public.is_super_admin() 
    OR public.has_instance_role(auth.uid(), 'admin'::app_role, _instance_id)
    OR public.has_instance_role(auth.uid(), 'employee'::app_role, _instance_id)
    OR public.has_instance_role(auth.uid(), 'hall'::app_role, _instance_id)
    OR public.has_instance_role(auth.uid(), 'sales'::app_role, _instance_id)
$$;

-- Helper: is_user_blocked
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_blocked FROM public.profiles WHERE id = _user_id), false)
$$;

-- Helper: has_employee_permission
CREATE OR REPLACE FUNCTION public.has_employee_permission(_user_id uuid, _instance_id uuid, _feature_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_permissions
    WHERE user_id = _user_id AND instance_id = _instance_id AND feature_key = _feature_key AND enabled = true
  )
$$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- generate_public_api_key
CREATE OR REPLACE FUNCTION public.generate_public_api_key()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.public_api_key IS NULL THEN
    NEW.public_api_key := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$$;

-- generate_short_token
CREATE OR REPLACE FUNCTION public.generate_short_token()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _token TEXT; _attempts INT := 0;
BEGIN
  LOOP
    _token := LEFT(gen_random_uuid()::TEXT, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.offers WHERE public_token = _token);
    _attempts := _attempts + 1;
    IF _attempts > 100 THEN RAISE EXCEPTION 'Could not generate unique token'; END IF;
  END LOOP;
  RETURN _token;
END;
$$;

-- generate_protocol_token
CREATE OR REPLACE FUNCTION public.generate_protocol_token()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _token TEXT; _attempts INT := 0;
BEGIN
  LOOP
    _token := LEFT(gen_random_uuid()::TEXT, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.vehicle_protocols WHERE public_token = _token);
    _attempts := _attempts + 1;
    IF _attempts > 100 THEN RAISE EXCEPTION 'Could not generate unique protocol token'; END IF;
  END LOOP;
  RETURN _token;
END;
$$;

-- handle_new_user (creates profile on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

-- check_sms_available
CREATE OR REPLACE FUNCTION public.check_sms_available(_instance_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sms_used < sms_limit FROM public.instances WHERE id = _instance_id;
$$;

-- increment_sms_usage
CREATE OR REPLACE FUNCTION public.increment_sms_usage(_instance_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_limit integer; current_used integer;
BEGIN
  SELECT sms_limit, sms_used INTO current_limit, current_used FROM public.instances WHERE id = _instance_id FOR UPDATE;
  IF current_used >= current_limit THEN RETURN false; END IF;
  UPDATE public.instances SET sms_used = sms_used + 1, updated_at = now() WHERE id = _instance_id;
  RETURN true;
END;
$$;

-- check_station_limit
CREATE OR REPLACE FUNCTION public.check_station_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_count INTEGER; max_allowed INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count FROM stations WHERE instance_id = NEW.instance_id;
  SELECT COALESCE(station_limit, 2) INTO max_allowed FROM instance_subscriptions WHERE instance_id = NEW.instance_id;
  IF max_allowed IS NULL THEN max_allowed := 2; END IF;
  IF current_count >= max_allowed THEN RAISE EXCEPTION 'Limit stanowisk osiągnięty (% z %)', current_count, max_allowed; END IF;
  RETURN NEW;
END;
$$;

-- get_offer_instance_id
CREATE OR REPLACE FUNCTION public.get_offer_instance_id(p_offer_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT instance_id FROM offers WHERE id = p_offer_id
$$;

-- get_option_instance_id
CREATE OR REPLACE FUNCTION public.get_option_instance_id(p_option_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.instance_id FROM offers o JOIN offer_options oo ON oo.offer_id = o.id WHERE oo.id = p_option_id
$$;

-- get_reservation_instance_id
CREATE OR REPLACE FUNCTION public.get_reservation_instance_id(p_reservation_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT instance_id FROM public.reservations WHERE id = p_reservation_id
$$;

-- 6. TRIGGERS
CREATE TRIGGER update_instances_updated_at BEFORE UPDATE ON public.instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_generate_public_api_key BEFORE INSERT ON public.instances FOR EACH ROW EXECUTE FUNCTION generate_public_api_key();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER enforce_station_limit BEFORE INSERT ON public.stations FOR EACH ROW EXECUTE FUNCTION check_station_limit();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_breaks_updated_at BEFORE UPDATE ON public.breaks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_vehicles_updated_at BEFORE UPDATE ON public.customer_vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_instance_features_updated_at BEFORE UPDATE ON public.instance_features FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_library_updated_at BEFORE UPDATE ON public.products_library FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_text_blocks_library_updated_at BEFORE UPDATE ON public.text_blocks_library FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_options_updated_at BEFORE UPDATE ON public.offer_options FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_option_items_updated_at BEFORE UPDATE ON public.offer_option_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. ENABLE RLS ON ALL TABLES
ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closed_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_days_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_option_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_scope_extra_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_scope_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_scope_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_scope_variant_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_scope_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_text_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paint_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_damage_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_message_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_blocks_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yard_vehicles ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES (abbreviated - key policies only, add more as needed)
-- For initial data migration, you may want to temporarily disable RLS:
-- ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
-- Then re-enable after migration.

-- NOTE: The full set of ~150 RLS policies is available in the source schema.
-- For data migration via service_role_key, RLS is bypassed automatically.
-- Add policies later as needed for your use case.

-- 9. AUTH TRIGGER (create profile on user signup)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. REALTIME (enable for tables that need it)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Done! Now run the data migration edge function to transfer data.
