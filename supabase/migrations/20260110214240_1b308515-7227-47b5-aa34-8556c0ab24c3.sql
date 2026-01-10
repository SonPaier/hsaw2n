-- Add discount_percent column to customers table
ALTER TABLE customers ADD COLUMN discount_percent integer DEFAULT NULL;