-- Add send_at_time column to sms_message_settings for scheduled sending
ALTER TABLE public.sms_message_settings 
ADD COLUMN send_at_time TIME DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.sms_message_settings.send_at_time IS 'For reminder_1day: the specific time of day to send the reminder (e.g., 19:00). If NULL, uses default 24h before logic.';