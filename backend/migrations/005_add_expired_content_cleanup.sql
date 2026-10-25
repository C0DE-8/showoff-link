ALTER TABLE text_notes
  ADD COLUMN expired_at timestamp NULL DEFAULT NULL,
  ADD KEY idx_text_notes_expired_at (expired_at);

ALTER TABLE images
  ADD COLUMN expired_at timestamp NULL DEFAULT NULL,
  ADD KEY idx_images_expired_at (expired_at);

ALTER TABLE voice_notes
  ADD COLUMN expired_at timestamp NULL DEFAULT NULL,
  ADD KEY idx_voice_notes_expired_at (expired_at);

UPDATE text_notes
SET expired_at = CURRENT_TIMESTAMP
WHERE current_views >= allowed_views;

UPDATE images
SET expired_at = CURRENT_TIMESTAMP
WHERE allowed_views <= 0;

UPDATE voice_notes
SET expired_at = CURRENT_TIMESTAMP
WHERE current_plays >= allowed_plays;