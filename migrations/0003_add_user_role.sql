ALTER TABLE users
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'standard' AFTER password_hash;
