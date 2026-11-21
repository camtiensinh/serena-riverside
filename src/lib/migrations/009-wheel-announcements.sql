ALTER TABLE wheel_state
  DROP CONSTRAINT IF EXISTS wheel_state_prize_rank_check;

ALTER TABLE wheel_state
  ADD CONSTRAINT wheel_state_prize_rank_check
  CHECK (prize_rank BETWEEN 1 AND 5);

ALTER TABLE wheel_state
  ADD COLUMN IF NOT EXISTS presentation_mode text NOT NULL DEFAULT 'spin'
  CHECK (presentation_mode IN ('spin', 'announce'));

CREATE TABLE IF NOT EXISTS wheel_announcements (
  segment_id uuid NOT NULL REFERENCES wheel_segments(id) ON DELETE CASCADE,
  prize_rank int NOT NULL CHECK (prize_rank BETWEEN 1 AND 5),
  entry_id uuid NOT NULL REFERENCES wheel_entries(id) ON DELETE CASCADE,
  announced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(segment_id, prize_rank),
  UNIQUE(segment_id, entry_id)
);
