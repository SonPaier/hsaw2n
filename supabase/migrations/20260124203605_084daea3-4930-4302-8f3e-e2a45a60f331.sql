-- Add reminder_template_id column to unified_services
ALTER TABLE public.unified_services 
ADD COLUMN reminder_template_id UUID REFERENCES public.reminder_templates(id) ON DELETE SET NULL;