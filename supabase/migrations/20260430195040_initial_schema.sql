-- App schema aligned with README.md (remote SQL editor instructions).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chats"
ON public.chats
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.prompts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  model text,
  generation_type text,
  ratio text,
  PRIMARY KEY (id)
);

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage prompts in their own chats"
ON public.prompts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE public.chats.id = public.prompts.chat_id
    AND public.chats.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE public.chats.id = public.prompts.chat_id
    AND public.chats.user_id = auth.uid()
  )
);

CREATE TABLE public.media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'output',
  tag text,
  position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own media"
ON public.media
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_chats_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER update_prompts_updated_at
BEFORE UPDATE ON public.prompts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_chat_on_prompt_insert
AFTER INSERT ON public.prompts
FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

CREATE OR REPLACE TRIGGER update_chat_on_prompt_update
AFTER UPDATE ON public.prompts
FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can manage their own media files"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'media'
  AND (auth.uid()::text = (storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id = 'media'
  AND (auth.uid()::text = (storage.foldername(name))[1])
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prompts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media;

ALTER TABLE public.prompts REPLICA IDENTITY FULL;
ALTER TABLE public.media REPLICA IDENTITY FULL;
ALTER TABLE public.chats REPLICA IDENTITY FULL;
