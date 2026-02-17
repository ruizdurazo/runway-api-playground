# Runway API Playground

This is a playground for the [Runway API](https://docs.dev.runwayml.com/).

It's a simple web app that allows users to create and edit prompts that will generate images and videos with Runway's different AI models.

## Tools

- [Runway API](https://runwayml.com/) ([Docs](https://docs.dev.runwayml.com/))
- [Supabase](https://supabase.com/)
- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Sass](https://sass-lang.com/)
- [Sonner](https://sonner.emilkowal.ski/)

## Local Development

1. Clone the repository
2. Set up the Supabase project and database tables as described in the Supabase Setup sections below
3. Run `npm install` or `pnpm install`
4. Run `npm run dev` or `pnpm dev`
5. Open `http://localhost:3000` in your browser
6. Add your Runway API key in the settings page
7. You can now start creating and editing prompts

## Supabase Setup

After creating a new Supabase project, you need to add the following environment variables to your `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Supabase Database Setup

To set up the necessary database tables in your Supabase project, run the following SQL queries in the SQL Editor.

### Chats Table

```sql
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
```

### Prompts Table

```sql
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
```

### Triggers for Timestamps

After creating the tables, set up triggers to automatically update the `updated_at` timestamps:

```sql
-- Create shared trigger function for setting updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updates on chats
CREATE OR REPLACE TRIGGER update_chats_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger for updates on prompts
CREATE OR REPLACE TRIGGER update_prompts_updated_at
BEFORE UPDATE ON public.prompts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create function to update chat's updated_at on prompt changes
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inserts on prompts
CREATE OR REPLACE TRIGGER update_chat_on_prompt_insert
AFTER INSERT ON public.prompts
FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

-- Trigger for updates on prompts
CREATE OR REPLACE TRIGGER update_chat_on_prompt_update
AFTER UPDATE ON public.prompts
FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();
```

### Media Table

```sql
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
```

### Storage Bucket

Create a new storage bucket named "media" in your Supabase project.

Set the bucket to private (not public).

Then, apply the following RLS policy via SQL Editor:

```sql
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
```

This policy assumes files are stored in user-specific folders like `{user_id}/filename.ext`.

### Realtime Subscriptions

```sql
-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prompts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media;

-- Enable full replica identity for DELETE events (to receive old records)
ALTER TABLE public.prompts REPLICA IDENTITY FULL;
ALTER TABLE public.media REPLICA IDENTITY FULL;
ALTER TABLE public.chats REPLICA IDENTITY FULL;
```
