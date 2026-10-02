ALTER TABLE users
  ADD COLUMN reset_password_token VARCHAR(255) DEFAULT NULL,
  ADD COLUMN reset_password_expires DATETIME DEFAULT NULL;
