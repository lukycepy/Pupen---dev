INSERT INTO storage.buckets (id, name, public)
VALUES
  ('images', 'images', true),
  ('blog', 'blog', true),
  ('events', 'events', true),
  ('gallery', 'gallery', true),
  ('partners', 'partners', true),
  ('receipts', 'receipts', true),
  ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;
