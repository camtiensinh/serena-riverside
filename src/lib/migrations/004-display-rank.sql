ALTER TABLE settings ADD COLUMN IF NOT EXISTS display_rank integer CHECK (display_rank BETWEEN 1 AND 5);
