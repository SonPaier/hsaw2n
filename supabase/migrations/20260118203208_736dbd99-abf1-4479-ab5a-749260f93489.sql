
-- Tabela planów subskrypcyjnych
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  base_price NUMERIC NOT NULL,
  price_per_station NUMERIC NOT NULL DEFAULT 49,
  sms_limit INTEGER NOT NULL DEFAULT 100,
  included_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela subskrypcji instancji
CREATE TABLE instance_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  station_limit INTEGER NOT NULL DEFAULT 1,
  monthly_price NUMERIC,
  starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_at DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id)
);

-- Trigger wymuszający limit stanowisk
CREATE OR REPLACE FUNCTION check_station_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM stations
  WHERE instance_id = NEW.instance_id;

  SELECT COALESCE(station_limit, 2) INTO max_allowed
  FROM instance_subscriptions
  WHERE instance_id = NEW.instance_id;

  IF max_allowed IS NULL THEN
    max_allowed := 2;
  END IF;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limit stanowisk osiągnięty (% z %)', current_count, max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_station_limit
  BEFORE INSERT ON stations
  FOR EACH ROW
  EXECUTE FUNCTION check_station_limit();

-- RLS dla subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (active = true);

-- RLS dla instance_subscriptions
ALTER TABLE instance_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all subscriptions"
  ON instance_subscriptions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Instance admins can view their subscription"
  ON instance_subscriptions FOR SELECT
  USING (
    instance_id IN (
      SELECT instance_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Seed danych: Plan Myjnia
INSERT INTO subscription_plans (name, slug, base_price, price_per_station, sms_limit, included_features, sort_order)
VALUES ('Myjnia', 'myjnia', 129, 49, 100, 
  '["calendar", "online_booking", "sms_notifications", "customer_crm", "team_management", "yard_vehicles", "employee_view", "analytics"]'::jsonb, 1);

-- Seed danych: Plan Detailing
INSERT INTO subscription_plans (name, slug, base_price, price_per_station, sms_limit, included_features, sort_order)
VALUES ('Detailing', 'detailing', 199, 49, 200, 
  '["calendar", "online_booking", "sms_notifications", "customer_crm", "team_management", "yard_vehicles", "employee_view", "analytics", "offers", "vehicle_reception_protocol", "followup", "reminders"]'::jsonb, 2);

-- Subskrypcja ARM CAR - 4 stanowiska, plan Detailing
INSERT INTO instance_subscriptions (instance_id, plan_id, station_limit, monthly_price)
SELECT '4ce15650-76c7-47e7-b5c8-32b9a2d1c321', id, 4, 199 + (3 * 49)
FROM subscription_plans WHERE slug = 'detailing';

-- Subskrypcja DEMO - 3 stanowiska, plan Myjnia
INSERT INTO instance_subscriptions (instance_id, plan_id, station_limit, monthly_price)
SELECT i.id, p.id, 3, 129 + (2 * 49)
FROM instances i, subscription_plans p
WHERE i.slug = 'demo' AND p.slug = 'myjnia';
