ALTER TABLE settings ADD COLUMN IF NOT EXISTS time_filter_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_facebook_url_key;
DROP INDEX IF EXISTS unique_post;
CREATE UNIQUE INDEX IF NOT EXISTS live_facebook_url ON submissions(facebook_url) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS live_post ON submissions(post_id) WHERE post_id IS NOT NULL AND deleted_at IS NULL;
UPDATE settings SET auto_scan=false WHERE auto_scan;
UPDATE submissions SET media=raw->'media' WHERE raw IS NOT NULL AND jsonb_typeof(raw->'media')='array' AND media='[]'::jsonb;
