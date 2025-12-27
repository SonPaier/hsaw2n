-- First drop the foreign key constraint from followup_tasks
ALTER TABLE followup_tasks DROP CONSTRAINT IF EXISTS followup_tasks_event_service_id_fkey;

-- Now we can safely drop the junction table
DROP TABLE IF EXISTS followup_event_services;

-- Drop offer_id column (not using offers for now)
ALTER TABLE followup_events DROP COLUMN IF EXISTS offer_id;

-- Drop event_service_id from followup_tasks (no longer needed)
ALTER TABLE followup_tasks DROP COLUMN IF EXISTS event_service_id;

-- Add direct reference to followup service in followup_events
ALTER TABLE followup_events 
  ADD COLUMN followup_service_id UUID REFERENCES followup_services(id) ON DELETE CASCADE,
  ADD COLUMN next_reminder_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_followup_events_reminder ON followup_events(instance_id, next_reminder_date, status);
CREATE INDEX IF NOT EXISTS idx_followup_events_service ON followup_events(followup_service_id);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_due ON followup_tasks(instance_id, due_date, status);