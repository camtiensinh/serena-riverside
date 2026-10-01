CREATE TABLE IF NOT EXISTS wheel_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wheel_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL REFERENCES wheel_segments(id) ON DELETE CASCADE,
  name text NOT NULL,
  team text NOT NULL,
  facebook_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(segment_id, facebook_url)
);

CREATE TABLE IF NOT EXISTS wheel_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL REFERENCES wheel_segments(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES wheel_entries(id) ON DELETE CASCADE,
  prize_rank int NOT NULL CHECK (prize_rank BETWEEN 1 AND 3),
  selected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(segment_id, prize_rank),
  UNIQUE(segment_id, entry_id)
);

CREATE TABLE IF NOT EXISTS wheel_state (
  id int PRIMARY KEY DEFAULT 1 CHECK(id=1),
  segment_id uuid REFERENCES wheel_segments(id) ON DELETE SET NULL,
  phase text NOT NULL DEFAULT 'waiting' CHECK(phase IN ('waiting','spinning','result')),
  prize_rank int CHECK(prize_rank BETWEEN 1 AND 3),
  winner_entry_id uuid REFERENCES wheel_entries(id) ON DELETE SET NULL,
  spin_nonce uuid,
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wheel_state(id) VALUES(1) ON CONFLICT DO NOTHING;
