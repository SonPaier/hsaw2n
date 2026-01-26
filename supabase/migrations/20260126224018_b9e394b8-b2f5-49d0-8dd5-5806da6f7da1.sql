-- Add follow_up_phone_status column to offers table
ALTER TABLE public.offers 
ADD COLUMN follow_up_phone_status TEXT DEFAULT NULL;

COMMENT ON COLUMN public.offers.follow_up_phone_status IS 
'Status follow-up telefonicznego: called_discussed, call_later, called_no_answer';