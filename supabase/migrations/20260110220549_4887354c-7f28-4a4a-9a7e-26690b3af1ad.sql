-- Add RLS policies for employee role on key tables

-- reservations: employees can view, insert, and update
CREATE POLICY "Employees can view reservations"
ON reservations FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can insert reservations"
ON reservations FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can update reservations"
ON reservations FOR UPDATE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- customers: employees can view, insert, and update
CREATE POLICY "Employees can view customers"
ON customers FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can insert customers"
ON customers FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can update customers"
ON customers FOR UPDATE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- customer_vehicles: employees can manage
CREATE POLICY "Employees can view customer_vehicles"
ON customer_vehicles FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can insert customer_vehicles"
ON customer_vehicles FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can update customer_vehicles"
ON customer_vehicles FOR UPDATE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- breaks: employees can manage
CREATE POLICY "Employees can view breaks"
ON breaks FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can insert breaks"
ON breaks FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can update breaks"
ON breaks FOR UPDATE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can delete breaks"
ON breaks FOR DELETE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- notifications: employees can view and update
CREATE POLICY "Employees can view notifications"
ON notifications FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can update notifications"
ON notifications FOR UPDATE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- yard_vehicles: employees can manage
CREATE POLICY "Employees can view yard_vehicles"
ON yard_vehicles FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can insert yard_vehicles"
ON yard_vehicles FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can update yard_vehicles"
ON yard_vehicles FOR UPDATE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employees can delete yard_vehicles"
ON yard_vehicles FOR DELETE
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- stations: employees can view (needed for calendar)
CREATE POLICY "Employees can view stations"
ON stations FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- services: employees can view (needed for reservations)
CREATE POLICY "Employees can view services"
ON services FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- service_categories: employees can view
CREATE POLICY "Employees can view service_categories"
ON service_categories FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- instances: employees can view their instance
CREATE POLICY "Employees can view their instance"
ON instances FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, id));

-- closed_days: employees can view
CREATE POLICY "Employees can view closed_days"
ON closed_days FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));