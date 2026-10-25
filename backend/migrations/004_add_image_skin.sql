ALTER TABLE images
  ADD COLUMN skin_id varchar(36) DEFAULT NULL AFTER recipient_id,
  ADD KEY idx_images_skin_id (skin_id);