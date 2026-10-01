CREATE TABLE IF NOT EXISTS wheel_redraw_exclusions (
  segment_id uuid NOT NULL REFERENCES wheel_segments(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES wheel_entries(id) ON DELETE CASCADE,
  prize_rank int NOT NULL CHECK (prize_rank BETWEEN 1 AND 3),
  excluded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(segment_id, entry_id)
);
