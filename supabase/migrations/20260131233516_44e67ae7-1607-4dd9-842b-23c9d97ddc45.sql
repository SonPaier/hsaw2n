-- Add time calculation mode column to workers_settings
ALTER TABLE workers_settings 
ADD COLUMN time_calculation_mode TEXT NOT NULL DEFAULT 'start_to_stop';

COMMENT ON COLUMN workers_settings.time_calculation_mode IS 
  'start_to_stop = od kliknięcia start, opening_to_stop = od godziny otwarcia';