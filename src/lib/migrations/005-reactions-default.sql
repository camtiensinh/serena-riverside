ALTER TABLE settings ALTER COLUMN metric SET DEFAULT 'reactions';
UPDATE settings SET metric='reactions' WHERE id=1;
