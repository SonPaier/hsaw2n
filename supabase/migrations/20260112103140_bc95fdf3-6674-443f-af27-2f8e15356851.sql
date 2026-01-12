-- Enable REPLICA IDENTITY FULL for reservations table
-- This is required for Supabase Realtime to send full row data on UPDATE/DELETE events
ALTER TABLE reservations REPLICA IDENTITY FULL;