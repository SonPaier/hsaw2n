-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'reservation_new', 'reservation_cancelled', 'reservation_edited', 'offer_approved', 'offer_modified'
  title TEXT NOT NULL,
  description TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  entity_type TEXT, -- 'reservation', 'offer'
  entity_id UUID, -- ID of the reservation or offer
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_notifications_instance_id ON public.notifications(instance_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications(read);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view notifications for their instance"
ON public.notifications
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

CREATE POLICY "Admins can update notifications for their instance"
ON public.notifications
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

CREATE POLICY "Admins can delete notifications for their instance"
ON public.notifications
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;