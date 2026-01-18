-- Add trial columns to instance_subscriptions
ALTER TABLE instance_subscriptions 
ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false;

ALTER TABLE instance_subscriptions
ADD COLUMN IF NOT EXISTS trial_expires_at timestamp with time zone;