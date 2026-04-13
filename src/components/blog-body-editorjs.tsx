import EditorJS, { type OutputData } from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import ImageTool from '@editorjs/image'
import editorJsHtml from 'editorjs-html'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useBlogLocalImages } from '../contexts/blog-local-images-context'
import { convertHtmlToBlocks } from 'html-to-editorjs'

type BlogBodyEditorJsProps = {
  initialBody: string
  onReady?: (api: { getHtml: () => Promise<string>; getData: () => Promise<OutputData> }) => void
}

function looksLikeEditorJsJson(s: string): boolean {
  const t = s.trim()
  if (!t.startsWith('{') || !t.includes('"blocks"')) return false
  try {
    const parsed = JSON.parse(t) as { blocks?: unknown }
    return Array.isArray(parsed.blocks)
  } catch {
    return false
  }
}

type ConvertedHtmlBlock = ReturnType<typeof convertHtmlToBlocks>[number]

function looksLikeHtml(s: string): boolean {
  const t = s.trim()
  return t.startsWith('<') && /<\/[a-z][\s>]|<br\s*\/?>/i.test(t)
}

function safeParseOutputData(json: string): OutputData | null {
  try {
    const parsed = JSON.parse(json) as OutputData
    if (!parsed || !Array.isArray(parsed.blocks)) return null
    return parsed
  } catch {
    return null
  }
}

export function BlogBodyEditorJs({ initialBody, onReady }: BlogBodyEditorJsProps) {
  const baseId = useId()
  const holderId = useMemo(() => `blog-body-editorjs-${baseId.replace(/:/g, '')}`, [baseId])
  const { stageLocalImage } = useBlogLocalImages()
  const editorRef = useRef<EditorJS | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setBootError(null)

    const init = async () => {
      // In dev (React Strict Mode), effects can mount/unmount twice.
      // If a previous instance exists for any reason, destroy it before creating a new one.
      const existing = editorRef.current as unknown as { destroy?: () => void } | null
      if (existing?.destroy) {
        try {
          existing.destroy()
        } catch {
          // ignore
        }
        editorRef.current = null
      }

      const body = initialBody ?? ''
      let data: OutputData = { blocks: [] }

      if (looksLikeEditorJsJson(body)) {
        const parsed = safeParseOutputData(body)
        if (parsed) data = parsed
      } else if (looksLikeHtml(body)) {
        try {
          // Convert existing HTML blogs so edit mode still works.
          const doc = new DOMParser().parseFromString(`<div id="__blogHtml">${body}</div>`, 'text/html')
          const wrap = doc.getElementById('__blogHtml')
          const blocks = wrap ? convertHtmlToBlocks(wrap) : []
          data = {
            blocks: blocks.map((b: ConvertedHtmlBlock) => {
              if (b.type === 'image') {
                const img = b as { type: 'image'; data: { url: string; caption: string } }
                return {
                  type: 'image',
                  data: { file: { url: img.data.url }, caption: img.data.caption ?? '' },
                }
              }
              return b as unknown as OutputData['blocks'][number]
            }),
          }
        } catch {
          data = { blocks: [{ type: 'paragraph', data: { text: '' } }] }
        }
      } else if (body.trim()) {
        // Plain text fallback.
        data = { blocks: [{ type: 'paragraph', data: { text: body } }] }
      } else {
        data = { blocks: [{ type: 'paragraph', data: { text: '' } }] }
      }

      // If this instance unmounted (e.g. key changed), never try to mount Editor.js.
      if (cancelled) return

      // React can unmount/remount quickly; ensure the holder exists before creating the editor.
      const ensureHolder = async () => {
        if (document.getElementById(holderId)) return true
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        return Boolean(document.getElementById(holderId))
      }
      if (!(await ensureHolder())) {
        if (!cancelled) throw new Error(`Editor holder missing: ${holderId}`)
        return
      }

      // If we were unmounted while waiting for the holder, do nothing.
      if (cancelled) return

      const ed = new EditorJS({
        holder: holderId,
        placeholder: 'Write your article…',
        data,
        autofocus: false,
        inlineToolbar: true,
        tools: {
          header: {
            class: Header as unknown as EditorJS.ToolConstructable,
            inlineToolbar: true,
            config: { levels: [1, 2, 3], defaultLevel: 2 },
          },
          list: {
            class: List as unknown as EditorJS.ToolConstructable,
            inlineToolbar: true,
            config: { defaultStyle: 'unordered' },
          },
          image: {
            class: ImageTool as unknown as EditorJS.ToolConstructable,
            config: {
              captionPlaceholder: 'Caption',
              uploader: {
                uploadByFile: async (file: File) => {
                  const url = stageLocalImage(file)
                  return { success: 1, file: { url } }
                },
              },
            },
          },
        },
        onReady: () => {
          if (cancelled) return
          onReady?.({
            getData: async () => {
              const out = await ed.save()
              return out
            },
            getHtml: async () => {
              const out = await ed.save()
              const parser = editorJsHtml()
              const rendered = parser.parse(out) as unknown
              if (typeof rendered === 'string') return rendered
              if (Array.isArray(rendered)) return rendered.join('')
              if (rendered && typeof rendered === 'object') {
                const values = Object.values(rendered as Record<string, string | string[]>)
                return values
                  .flatMap((v) => (Array.isArray(v) ? v : [v]))
                  .filter((v) => typeof v === 'string')
                  .join('')
              }
              return ''
            },
          })
        },
      })

      editorRef.current = ed
    }

    void init().catch((e) => {
      if (cancelled) return
      setBootError(e instanceof Error ? e.message : 'Failed to start Editor.js')
    })

    return () => {
      cancelled = true
      const ed = editorRef.current
      editorRef.current = null
      if (!ed) return
      // Some builds / init races can leave a partial instance in dev/HMR.
      const anyEd = ed as unknown as { destroy?: () => void; isReady?: Promise<unknown> }
      const doDestroy = () => {
        try {
          anyEd.destroy?.()
        } catch {
          // ignore
        }
      }
      if (anyEd.isReady && typeof anyEd.isReady.then === 'function') {
        void anyEd.isReady.then(doDestroy).catch(() => doDestroy())
      } else {
        doDestroy()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holderId, initialBody])

  if (bootError) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
        Could not load the editor. {bootError}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
      <div id={holderId} className="blog-article-prose" />
    </div>
  )
}

