ALTER TABLE settings ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'auto' CHECK (display_mode IN ('auto','waiting','results'));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS display_started_at timestamptz;
