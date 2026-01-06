-- Add offer_number column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN offer_number TEXT;

-- Migrate existing offer numbers from admin_notes
UPDATE public.reservations 
SET offer_number = substring(admin_notes from 'Oferta:\s*([^\n]+)'),
    admin_notes = regexp_replace(admin_notes, 'Oferta:\s*[^\n]+\n?', '')
WHERE admin_notes LIKE '%Oferta:%';