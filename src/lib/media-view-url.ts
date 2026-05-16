/**
 * Same-origin URL for loading a private storage object in the browser.
 * Direct Supabase signed URLs often use http:// (e.g. local dev), which an
 * https:// app will refuse to load (mixed content). The API route streams
 * from storage using a server-side signed URL instead.
 */
export function getMediaViewUrl(path: string): string {
  return `/api/media/view?path=${encodeURIComponent(path)}`
}
