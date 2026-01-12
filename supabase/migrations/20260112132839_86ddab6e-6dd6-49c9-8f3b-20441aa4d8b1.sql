-- Add columns to track when confirmation and pickup SMS were sent
ALTER TABLE reservations 
ADD COLUMN confirmation_sms_sent_at TIMESTAMPTZ,
ADD COLUMN pickup_sms_sent_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN reservations.confirmation_sms_sent_at IS 'Timestamp when confirmation SMS was sent to customer';
COMMENT ON COLUMN reservations.pickup_sms_sent_at IS 'Timestamp when pickup notification SMS was sent to customer';