-- Create reminder_templates table
CREATE TABLE public.reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sms_template TEXT NOT NULL DEFAULT '{short_name}: Przypominamy o {service_type} dla {vehicle_info}. {paid_info}. Zadzwon: {reservation_phone}',
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create offer_reminders table
CREATE TABLE public.offer_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products_library(id) ON DELETE SET NULL,
  
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  vehicle_info TEXT,
  
  scheduled_date DATE NOT NULL,
  months_after INTEGER NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  service_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  
  sms_template TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add reminder_template_id to products_library
ALTER TABLE public.products_library 
ADD COLUMN reminder_template_id UUID REFERENCES public.reminder_templates(id) ON DELETE SET NULL;

-- Add completed fields to offers
ALTER TABLE public.offers 
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN completed_by UUID;

-- Create indexes
CREATE INDEX idx_reminder_templates_instance ON public.reminder_templates(instance_id);
CREATE INDEX idx_offer_reminders_instance ON public.offer_reminders(instance_id);
CREATE INDEX idx_offer_reminders_offer ON public.offer_reminders(offer_id);
CREATE INDEX idx_offer_reminders_scheduled ON public.offer_reminders(scheduled_date, status);
CREATE INDEX idx_products_reminder_template ON public.products_library(reminder_template_id);

-- Enable RLS
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for reminder_templates
CREATE POLICY "Users can view reminder templates of their instance"
ON public.reminder_templates FOR SELECT
USING (
  is_super_admin() OR can_access_instance(instance_id)
);

CREATE POLICY "Users can create reminder templates for their instance"
ON public.reminder_templates FOR INSERT
WITH CHECK (
  is_super_admin() OR can_access_instance(instance_id)
);

CREATE POLICY "Users can update reminder templates of their instance"
ON public.reminder_templates FOR UPDATE
USING (
  is_super_admin() OR can_access_instance(instance_id)
);

CREATE POLICY "Users can delete reminder templates of their instance"
ON public.reminder_templates FOR DELETE
USING (
  is_super_admin() OR can_access_instance(instance_id)
);

-- RLS policies for offer_reminders
CREATE POLICY "Users can view offer reminders of their instance"
ON public.offer_reminders FOR SELECT
USING (
  is_super_admin() OR can_access_instance(instance_id)
);

CREATE POLICY "Users can update offer reminders of their instance"
ON public.offer_reminders FOR UPDATE
USING (
  is_super_admin() OR can_access_instance(instance_id)
);

-- Function to create reminders when offer is marked as completed
CREATE OR REPLACE FUNCTION public.create_offer_reminders(
  p_offer_id UUID,
  p_completed_at TIMESTAMP WITH TIME ZONE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer RECORD;
  v_option RECORD;
  v_item RECORD;
  v_template RECORD;
  v_reminder_item JSONB;
  v_customer_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Get offer data
  SELECT * INTO v_offer FROM offers WHERE id = p_offer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;
  
  -- Try to find customer by phone
  SELECT id INTO v_customer_id 
  FROM customers 
  WHERE instance_id = v_offer.instance_id 
    AND phone = (v_offer.customer_data->>'phone')
  LIMIT 1;
  
  -- Iterate through selected options
  FOR v_option IN 
    SELECT oo.* FROM offer_options oo 
    WHERE oo.offer_id = p_offer_id 
      AND oo.is_selected = true
  LOOP
    -- Iterate through option items
    FOR v_item IN 
      SELECT ooi.*, pl.reminder_template_id, pl.name as product_name
      FROM offer_option_items ooi
      LEFT JOIN products_library pl ON pl.id = ooi.product_id
      WHERE ooi.option_id = v_option.id
        AND ooi.product_id IS NOT NULL
        AND pl.reminder_template_id IS NOT NULL
    LOOP
      -- Get reminder template
      SELECT * INTO v_template FROM reminder_templates WHERE id = v_item.reminder_template_id;
      
      IF FOUND AND v_template.items IS NOT NULL THEN
        -- Create reminders for each template item
        FOR v_reminder_item IN SELECT * FROM jsonb_array_elements(v_template.items)
        LOOP
          INSERT INTO offer_reminders (
            instance_id,
            offer_id,
            customer_id,
            product_id,
            customer_name,
            customer_phone,
            vehicle_info,
            scheduled_date,
            months_after,
            is_paid,
            service_type,
            service_name,
            sms_template,
            status
          ) VALUES (
            v_offer.instance_id,
            p_offer_id,
            v_customer_id,
            v_item.product_id,
            COALESCE(v_offer.customer_data->>'name', 'Klient'),
            COALESCE(v_offer.customer_data->>'phone', ''),
            COALESCE(v_offer.vehicle_data->>'brandModel', v_offer.vehicle_data->>'plate', ''),
            (p_completed_at + ((v_reminder_item->>'months')::INTEGER || ' months')::INTERVAL)::DATE,
            (v_reminder_item->>'months')::INTEGER,
            COALESCE((v_reminder_item->>'is_paid')::BOOLEAN, true),
            COALESCE(v_reminder_item->>'service_type', 'serwis'),
            COALESCE(v_item.custom_name, v_item.product_name, 'Usługa'),
            v_template.sms_template,
            'scheduled'
          );
          v_count := v_count + 1;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Trigger for updated_at on reminder_templates
CREATE TRIGGER update_reminder_templates_updated_at
BEFORE UPDATE ON public.reminder_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();