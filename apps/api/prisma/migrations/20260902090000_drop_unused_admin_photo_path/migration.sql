-- `photo_path` was carried over from the legacy schema and never wired up:
-- nothing wrote it, no endpoint accepted an upload, and no screen rendered
-- it. It reached every user response through the projection every read goes
-- through, so it read as a feature that existed and did not work.
--
-- Dropping it rather than leaving it: a nullable column nothing populates is
-- indistinguishable from a broken feature, and the API's own nginx config
-- already says in as many words that this application accepts no uploads.
ALTER TABLE "admin_users" DROP COLUMN "photo_path";
