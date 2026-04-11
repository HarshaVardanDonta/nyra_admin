/** Same shape as Editor.js `OutputData`. */
export type EditorJsOutput = {
  time?: number
  blocks?: EditorJsBlock[]
  version?: string
}

export type EditorJsBlock = {
  id?: string
  type: string
  data: Record<string, unknown>
}

export function parseEditorJsBody(body: string): EditorJsOutput | null {
  const t = body.trim()
  if (!t.startsWith('{')) return null
  try {
    const o = JSON.parse(t) as EditorJsOutput
    if (o && Array.isArray(o.blocks)) return o
  } catch {
    return null
  }
  return null
}

export function emptyEditorOutput(): EditorJsOutput {
  return {
    time: Date.now(),
    blocks: [
      {
        type: 'paragraph',
        data: { text: '' },
      },
    ],
  }
}

export function isLegacyHtmlBody(body: string): boolean {
  const t = body.trim()
  if (!t) return false
  if (parseEditorJsBody(body)) return false
  return t.startsWith('<') && /<\/[a-z][\s>]|<br\s*\/?>/i.test(t)
}

export function hasEditorJsMeaningfulContent(body: string): boolean {
  const p = parseEditorJsBody(body)
  if (!p?.blocks?.length) return false
  return p.blocks.some((b) => {
    const d = b.data
    switch (b.type) {
      case 'paragraph':
        return typeof d.text === 'string' && d.text.replace(/<[^>]+>/g, '').trim().length > 0
      case 'header':
        return typeof d.text === 'string' && d.text.trim().length > 0
      case 'list':
        return Array.isArray(d.items) && d.items.length > 0
      case 'checklist':
        return (
          Array.isArray(d.items) &&
          d.items.some((row: { text?: string }) => (row.text ?? '').replace(/<[^>]+>/g, '').trim().length > 0)
        )
      case 'quote':
        return typeof d.text === 'string' && d.text.replace(/<[^>]+>/g, '').trim().length > 0
      case 'blogCallout':
        return typeof d.text === 'string' && d.text.replace(/<[^>]+>/g, '').trim().length > 0
      case 'blogFigure':
        return typeof d.src === 'string' && d.src.trim().length > 0
      case 'delimiter':
        return true
      case 'code':
        return typeof d.code === 'string' && d.code.trim().length > 0
      default:
        return false
    }
  })
}
