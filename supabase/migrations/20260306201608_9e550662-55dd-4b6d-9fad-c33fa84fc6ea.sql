ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cod';
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS bank_account_number text;