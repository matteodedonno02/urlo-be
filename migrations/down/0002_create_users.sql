ALTER TABLE short_urls DROP FOREIGN KEY fk_short_urls_user;
ALTER TABLE short_urls DROP COLUMN user_id;
DROP TABLE IF EXISTS users;
