# Runway API Playground

This is a playground for the Runway API. It will be a simple web app that allows users to create and edit prompts that will generate images and videos.

## Technical Requirements

- [x] create a new next.js project with typescript
- [x] setup .gitignore
- [x] setup env variables for supabase
- [x] setup login page
- [x] setup dashboard layout (with sidebar)
- [x] setup main page (chat page)
- [x] setup user media gallery page
- [x] setup user settings page

## Requirements

- [x] be able to sign up and create a new account with supabase
- [x] be able to login
- [x] be able to logout
- [x] be able to change the user's name
- [x] be able to set the user's runway api key
- [x] be able to see a media gallery of all the images and videos uploaded by the user
- [x] be able to create a new chat and prompt that will generate a video or image
- [x] be able to edit and re-run a prompt with the same chat
- [x] be able to delete a prompt from a chat and all the media generated from it
- [x] be able to see a list/history of chats

## Tools

- Node.js
- TypeScript
- React
- Next.js
- Shadcn UI
- Runway API
- Supabase

## Supabase Database Setup

To set up the necessary database tables in your Supabase project, run the following SQL queries in the SQL Editor.

### Chats Table

```sql
CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
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
  model text,
  generation_type text,
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

### Media Table

```sql
CREATE TABLE public.media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'output',
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
