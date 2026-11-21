CREATE TABLE IF NOT EXISTS wheel_presets (
  segment_id uuid NOT NULL REFERENCES wheel_segments(id) ON DELETE CASCADE,
  prize_rank int NOT NULL CHECK (prize_rank BETWEEN 1 AND 3),
  entry_id uuid NOT NULL REFERENCES wheel_entries(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(segment_id, prize_rank),
  UNIQUE(segment_id, entry_id)
);
