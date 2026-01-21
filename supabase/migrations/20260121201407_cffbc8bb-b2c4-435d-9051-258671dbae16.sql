-- Allow instance_id to be NULL for global scopes
ALTER TABLE offer_scopes ALTER COLUMN instance_id DROP NOT NULL;