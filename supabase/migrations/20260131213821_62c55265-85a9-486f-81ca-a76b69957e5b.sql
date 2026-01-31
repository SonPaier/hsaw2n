-- Add soft delete column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for filtering active employees
CREATE INDEX IF NOT EXISTS idx_employees_active_not_deleted 
ON public.employees (instance_id, active) 
WHERE deleted_at IS NULL;