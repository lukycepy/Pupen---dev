INSERT INTO storage.buckets (id, name, public)
VALUES ('member_applications', 'member_applications', false)
ON CONFLICT (id) DO NOTHING;

