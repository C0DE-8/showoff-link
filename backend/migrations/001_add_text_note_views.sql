ALTER TABLE text_notes
  ADD COLUMN current_views INT NOT NULL DEFAULT 0 AFTER allowed_views;