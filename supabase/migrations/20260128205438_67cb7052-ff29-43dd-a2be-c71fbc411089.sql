-- Add columns for widget data persistence
ALTER TABLE offers ADD COLUMN IF NOT EXISTS widget_selected_extras uuid[];
ALTER TABLE offers ADD COLUMN IF NOT EXISTS widget_duration_selections jsonb;

-- Add available_durations to offer_scopes (computed, for caching)
ALTER TABLE offer_scopes ADD COLUMN IF NOT EXISTS available_durations integer[];