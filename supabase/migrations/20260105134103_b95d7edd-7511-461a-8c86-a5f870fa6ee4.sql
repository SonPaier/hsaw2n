-- Rename existing notes column to customer_notes
ALTER TABLE public.reservations 
  RENAME COLUMN notes TO customer_notes;

-- Add new admin_notes column
ALTER TABLE public.reservations 
  ADD COLUMN admin_notes text;