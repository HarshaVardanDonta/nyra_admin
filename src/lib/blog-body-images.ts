import { uploadBlogBodyImage } from './api/blogs'
import { parseEditorJsBody, type EditorJsBlock } from './editorjs-body'

/** Unique blob: URLs referenced by images in blog HTML fragments. */
export function collectBlobImageSrcs(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<div id="__blogBlobScan">${html}</div>`, 'text/html')
  const root = doc.getElementById('__blogBlobScan')
  if (!root) return []
  const seen = new Set<string>()
  for (const img of root.querySelectorAll<HTMLImageElement>('img[src^="blob:"]')) {
    const s = img.getAttribute('src')
    if (s) seen.add(s)
  }
  return [...seen]
}

/**
 * Uploads every img[src^="blob:"] in blog HTML via the admin API, replacing src with the public URL.
 * Does not mutate `blobToFile`.
 */
export async function replaceBlobImagesInBlogHtml(
  html: string,
  token: string,
  blobToFile: ReadonlyMap<string, File>,
): Promise<string> {
  const doc = new DOMParser().parseFromString(`<div id="__blogBody">${html}</div>`, 'text/html')
  const wrap = doc.getElementById('__blogBody')
  if (!wrap) return html

  const imgs = Array.from(wrap.querySelectorAll<HTMLImageElement>('img[src^="blob:"]'))
  const bySrc = new Map<string, HTMLImageElement[]>()
  for (const img of imgs) {
    const src = img.getAttribute('src')
    if (!src) continue
    const list = bySrc.get(src) ?? []
    list.push(img)
    bySrc.set(src, list)
  }

  for (const [blobSrc, elements] of bySrc) {
    const file = blobToFile.get(blobSrc)
    if (!file) {
      throw new Error(
        'A draft image could not be found. Remove that image block, add the file again, then save.',
      )
    }
    const publicUrl = await uploadBlogBodyImage(token, file)
    for (const el of elements) {
      el.setAttribute('src', publicUrl)
    }
  }

  return wrap.innerHTML
}

/** Unique blob: URLs in Editor.js JSON (`blogFigure` blocks). */
export function collectBlobUrlsFromEditorJsJson(body: string): string[] {
  const p = parseEditorJsBody(body)
  if (!p?.blocks) return []
  const seen = new Set<string>()
  for (const b of p.blocks) {
    if (b.type === 'blogFigure' && typeof b.data?.src === 'string' && b.data.src.startsWith('blob:')) {
      seen.add(b.data.src)
    }
  }
  return [...seen]
}

export async function replaceBlobUrlsInEditorJsJson(
  body: string,
  token: string,
  blobToFile: ReadonlyMap<string, File>,
): Promise<string> {
  const p = parseEditorJsBody(body)
  if (!p?.blocks) return body
  const blocks = structuredClone(p.blocks) as EditorJsBlock[]
  for (const b of blocks) {
    if (b.type === 'blogFigure' && typeof b.data?.src === 'string' && b.data.src.startsWith('blob:')) {
      const blobSrc = b.data.src
      const file = blobToFile.get(blobSrc)
      if (!file) {
        throw new Error(
          'A draft image could not be found. Remove that image block, add the file again, then save.',
        )
      }
      const publicUrl = await uploadBlogBodyImage(token, file)
      b.data.src = publicUrl
    }
  }
  return JSON.stringify({ ...p, blocks, time: Date.now() })
}
