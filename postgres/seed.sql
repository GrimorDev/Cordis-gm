-- Cordis Seed Data
-- Konto administratora systemu: Grimor

INSERT INTO users (username, email, password_hash, banner_color, bio, custom_status, status)
VALUES (
  'Grimor',
  'grimor@cordis.app',
  '$2a$12$Cpy0VyndtconFOwaAeoeQuefj9MUopM4BLDw.c1FOUrD/BX5gzH1G',
  'from-violet-600 via-indigo-600 to-blue-600',
  'Cordis Developer – twórca systemu.',
  'Building Cordis 🚀',
  'offline'
) ON CONFLICT (username) DO NOTHING;
