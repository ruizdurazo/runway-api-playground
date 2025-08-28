"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"

interface Prompt {
  id: string
  prompt_text: string
  created_at: string
  model?: "gen2" | "gen3a" | "gen4_aleph" | "gen4_turbo" | "gen4_image" | "act_two"
  generation_type?: "image" | "video"
  media?: { id: string; path: string; url: string; type: 'image' | 'video'; category: 'input' | 'output' }[]
}

export default function ChatPage() {
  const { id } = useParams()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [newPrompt, setNewPrompt] = useState("")
  const [generationType, setGenerationType] = useState<"image" | "video">("video")
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState<"gen2" | "gen3a" | "gen4_aleph" | "gen4_turbo" | "gen4_image" | "act_two" | "upscale_v1">("gen4_turbo")
  const [inputFiles, setInputFiles] = useState<File[]>([])
  const [editingText, setEditingText] = useState("")
  const [editingModel, setEditingModel] = useState<"gen2" | "gen3a" | "gen4_aleph" | "gen4_turbo" | "gen4_image" | "act_two">("gen4_turbo")
  const [editingGenerationType, setEditingGenerationType] = useState<"image" | "video">("video")
  const [editingExistingMedia, setEditingExistingMedia] = useState<{ id: string; path: string; url: string; type: 'image' | 'video' }[]>([])
  const [editingNewFiles, setEditingNewFiles] = useState<File[]>([])

  useEffect(() => {
    const fetchPrompts = async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*, media(path, type, category)")
        .eq("chat_id", id)
        .order("created_at", { ascending: true })
      if (error) {
        console.error(error)
        setPrompts([])
      } else {
        const processed = await Promise.all(data.map(async (prompt) => ({
          ...prompt,
          media: await Promise.all((prompt.media || []).map(async (m: {path: string, type: 'image' | 'video', category: 'input' | 'output'}) => ({
            ...m,
            url: (await supabase.storage.from('media').createSignedUrl(m.path, 3600)).data?.signedUrl
          })))
        })))
        setPrompts(processed)
      }
    }
    fetchPrompts()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPrompt) return

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error("You must be logged in to generate media")
      setLoading(false)
      return
    }

    const apiKey = user.user_metadata.runway_api_key
    if (!apiKey) {
      toast.error("Runway API key not set in settings")
      setLoading(false)
      return
    }
    if (model === "upscale_v1") {
      if (inputFiles.length !== 1 || !inputFiles[0].type.startsWith("video/")) {
        toast.error("Upscale requires exactly one video file.")
        setLoading(false)
        return
      }
      if (generationType !== "video") {
        toast.error("Upscale can only generate videos.")
        setLoading(false)
        return
      }
    }

    const { data: promptData, error: promptError } = await supabase
      .from("prompts")
      .insert({ chat_id: id, prompt_text: newPrompt, model, generation_type: generationType })
      .select()
    if (promptError) {
      toast.error(promptError.message)
      setLoading(false)
      return
    }

    const promptId = promptData[0].id

    const assetUrls: string[] = [];
    for (const file of inputFiles) {
      const filename = `${user.id}/inputs/${promptId}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filename, file);
      if (uploadError) {
        toast.error(uploadError.message);
        setLoading(false);
        return;
      }
      const { data: signedData, error: signError } = await supabase.storage
        .from('media')
        .createSignedUrl(filename, 3600); // 1 hour
      if (signError) {
        toast.error(signError.message);
        setLoading(false);
        return;
      }
      assetUrls.push(signedData.signedUrl);
    }

    for (const file of inputFiles) {
      const filename = `${user.id}/inputs/${promptId}-${file.name}`
      const type = file.type.startsWith('image/') ? 'image' : 'video'
      const { error: insertError } = await supabase.from('media').insert({
        prompt_id: promptId,
        user_id: user.id,
        path: filename,
        type,
        category: 'input'
      })
      if (insertError) {
        toast.error(insertError.message)
        setLoading(false)
        return
      }
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, model, generationType, assetUrls }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      // Refresh prompts
      const { data: refreshData, error: refreshError } = await supabase
        .from("prompts")
        .select("*, media(path, type, category)")
        .eq("chat_id", id)
        .order("created_at", { ascending: true })

      if (refreshError) {
        console.error(refreshError)
      } else {
        const processed = await Promise.all(refreshData.map(async (prompt) => ({
          ...prompt,
          media: await Promise.all((prompt.media || []).map(async (m: {path: string, type: 'image' | 'video', category: 'input' | 'output'}) => ({
            ...m,
            url: (await supabase.storage.from('media').createSignedUrl(m.path, 3600)).data?.signedUrl
          })))
        })))
        setPrompts(processed)
      }
    } catch (err) {
      toast.error((err as Error).message);
    }

    setNewPrompt("")
    setInputFiles([]) // Reset input files after submission
    setLoading(false)
  }

  const handleEdit = async (promptId: string, text: string, model: "gen2" | "gen3a" | "gen4_aleph" | "gen4_turbo" | "gen4_image" | "act_two", genType: "image" | "video", existingMedia: { id: string; path: string; url: string; type: 'image' | 'video' }[], newFiles: File[]) => {
    setLoading(true)
    await supabase.from("prompts").update({ prompt_text: text, model, generation_type: genType }).eq("id", promptId)

    const { data: currentInputs } = await supabase.from('media').select('id, path').eq('prompt_id', promptId).eq('category', 'input')

    const keptIds = existingMedia.map(m => m.id)
    const toDelete = currentInputs?.filter(ci => !keptIds.includes(ci.id)) || []

    for (const del of toDelete) {
      await supabase.storage.from('media').remove([del.path])
      await supabase.from('media').delete().eq('id', del.id)
    }

    const { data: { user } } = await supabase.auth.getUser()
    const newAssetUrls: string[] = []
    for (const file of newFiles) {
      const filename = `${user?.id}/inputs/${promptId}-${file.name}`
      const { error } = await supabase.storage.from('media').upload(filename, file)
      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }
      const type = file.type.startsWith('image/') ? 'image' : 'video'
      const { error: insertErr } = await supabase.from('media').insert({
        prompt_id: promptId,
        user_id: user?.id,
        path: filename,
        type,
        category: 'input'
      })
      if (insertErr) {
        toast.error(insertErr.message)
        setLoading(false)
        return
      }
      const { data: signed } = await supabase.storage.from('media').createSignedUrl(filename, 3600)
      if (signed) newAssetUrls.push(signed.signedUrl)
    }

    const keptAssetUrls = await Promise.all(existingMedia.map(async (m) => {
      const { data } = await supabase.storage.from('media').createSignedUrl(m.path, 3600)
      return data?.signedUrl || ''
    }))

    const allAssetUrls = [...keptAssetUrls, ...newAssetUrls]

    const { data: oldOutputs } = await supabase.from('media').select('path').eq('prompt_id', promptId).eq('category', 'output')
    for (const out of oldOutputs || []) {
      await supabase.storage.from('media').remove([out.path])
    }
    await supabase.from('media').delete().eq('prompt_id', promptId).eq('category', 'output')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, model, generationType: genType, assetUrls: allAssetUrls }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message)
      }

      const { data: refreshData, error: refreshError } = await supabase
        .from("prompts")
        .select("*, media(path, type, category)")
        .eq("chat_id", id)
        .order("created_at", { ascending: true })

      if (refreshError) {
        console.error(refreshError)
      } else {
        const processed = await Promise.all(refreshData.map(async (prompt) => ({
          ...prompt,
          media: await Promise.all((prompt.media || []).map(async (m: {path: string, type: 'image' | 'video', category: 'input' | 'output'}) => ({
            ...m,
            url: (await supabase.storage.from('media').createSignedUrl(m.path, 3600)).data?.signedUrl
          })))
        })))
        setPrompts(processed)
      }
    } catch (err) {
      toast.error((err as Error).message)
    }

    setEditingPromptId(null)
    setLoading(false)
  }

  const handleDelete = async (promptId: string) => {
    const { data: mediaToDelete } = await supabase.from("media").select("path").eq("prompt_id", promptId)
    for (const m of mediaToDelete || []) {
      await supabase.storage.from('media').remove([m.path])
    }
    await supabase.from("media").delete().eq("prompt_id", promptId)
    await supabase.from("prompts").delete().eq("id", promptId)
    setPrompts(prompts.filter((p) => p.id !== promptId))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {prompts.map((prompt) => (
          <Card key={prompt.id}>
            <CardContent className="p-4">
              {editingPromptId === prompt.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleEdit(prompt.id, editingText, editingModel, editingGenerationType, editingExistingMedia, editingNewFiles)
                  }}
                  className="space-y-4"
                >
                  <Select value={editingModel} onValueChange={(v: "gen2" | "gen3a" | "gen4_aleph" | "gen4_turbo" | "gen4_image" | "act_two") => setEditingModel(v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gen2">Gen-2</SelectItem>
                      <SelectItem value="gen3a">Gen-3 Alpha</SelectItem>
                      <SelectItem value="gen4_aleph">Gen-4 Aleph</SelectItem>
                      <SelectItem value="gen4_turbo">Gen-4 Turbo</SelectItem>
                      <SelectItem value="gen4_image">Gen-4 Image</SelectItem>
                      <SelectItem value="act_two">Act-Two</SelectItem>
                      <SelectItem value="upscale_v1">Upscale V1</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={editingGenerationType} onValueChange={(v: "image" | "video") => setEditingGenerationType(v)}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} placeholder="Edit your prompt..." />
                  <div>
                    <p>Existing Inputs:</p>
                    {editingExistingMedia.map((media, index) => (
                      <div key={index} className="flex items-center space-x-2 mt-2">
                        {media.type === 'image' ? (
                          <img src={media.url} alt="Input" className="max-w-[100px]" />
                        ) : (
                          <video src={media.url} controls className="max-w-[100px]" />
                        )}
                        <Button variant="destructive" size="sm" onClick={() => setEditingExistingMedia((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
                      </div>
                    ))}
                  </div>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => setEditingNewFiles(Array.from(e.target.files || []))}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>Save and Re-generate</Button>
                    <Button variant="outline" onClick={() => setEditingPromptId(null)} disabled={loading}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  {prompt.media?.some((m) => m.category === 'input') && (
                    <div className="mt-2 space-y-2">
                      <p className="font-semibold">Inputs:</p>
                      {(prompt.media?.filter((m) => m.category === 'input') ?? []).map((m, index) => (
                        <div key={index}>
                          {m.type === "image" ? (
                            <img src={m.url} alt="Input" className="max-w-full" />
                          ) : (
                            <video src={m.url} controls className="max-w-full" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="font-semibold mt-2">{prompt.prompt_text}</p>
                  <div className="mt-2 space-y-2">
                    {(prompt.media?.filter((m) => m.category === 'output') ?? []).map((m, index) => (
                      <div key={index}>
                        {m.type === "image" ? (
                          <img src={m.url} alt="Generated" className="max-w-full" />
                        ) : (
                          <video src={m.url} controls className="max-w-full" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPromptId(prompt.id)
                        setEditingText(prompt.prompt_text)
                        setEditingModel((prompt.model || "gen4_turbo") as "gen2" | "gen3a" | "gen4_aleph" | "gen4_turbo" | "gen4_image" | "act_two")
                        setEditingGenerationType((prompt.generation_type || "video") as "image" | "video")
                        setEditingExistingMedia(
                          prompt.media?.filter((m) => m.category === 'input').map((m) => ({
                            id: m.id,
                            path: m.path,
                            url: m.url,
                            type: m.type,
                          })) || []
                        )
                        setEditingNewFiles([])
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(prompt.id)}>Delete</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Select value={model} onValueChange={(v: "gen2" | "gen3a" | "gen4_aleph" | "gen4_turbo" | "gen4_image" | "act_two") => setModel(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gen2">Gen-2</SelectItem>
              <SelectItem value="gen3a">Gen-3 Alpha</SelectItem>
              <SelectItem value="gen4_aleph">Gen-4 Aleph</SelectItem>
              <SelectItem value="gen4_turbo">Gen-4 Turbo</SelectItem>
              <SelectItem value="gen4_image">Gen-4 Image</SelectItem>
              <SelectItem value="act_two">Act-Two</SelectItem>
              <SelectItem value="upscale_v1">Upscale V1</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => setInputFiles(Array.from(e.target.files || []))}
          />
          <Select value={generationType} onValueChange={(v: "image" | "video") => setGenerationType(v)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            {/* Select generation type */}
            <SelectContent>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="Enter your prompt..." />
          <Button type="submit" disabled={loading}>Generate</Button>
        </form>
      </div>
    </div>
  )
}
