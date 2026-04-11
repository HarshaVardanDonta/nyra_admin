import { useEffect, useId, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import Paragraph from '@editorjs/paragraph'
import EditorjsList from '@editorjs/list'
import Checklist from '@editorjs/checklist'
import Quote from '@editorjs/quote'
import Delimiter from '@editorjs/delimiter'
import InlineCode from '@editorjs/inline-code'
import Marker from '@editorjs/marker'
import createGenericInlineTool, {
  ItalicInlineTool,
  StrongInlineTool,
  UnderlineInlineTool,
} from 'editorjs-inline-tool'
import Undo from 'editorjs-undo'
import { useBlogLocalImages } from '../contexts/blog-local-images-context'
import type { EditorJsOutput } from '../lib/editorjs-body'
import BlogCalloutTool from './editorjs/blog-callout-tool'
import BlogFigureTool from './editorjs/blog-figure-tool'

const StrikeInlineTool = createGenericInlineTool({
  tagName: 'S',
  shortcut: 'CMD+SHIFT+X',
  toolboxIcon:
    '<svg width="14" height="14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 12h12M8 8l8 8M8 16l8-8"/></svg>',
})

type BlogEditorJsProps = {
  initialData: EditorJsOutput
  onChange: (json: string) => void
  placeholder?: string
}

/**
 * editorjs-undo observes `.codex-editor__redactor`. That node may not exist yet when Editor.js
 * fires `onReady`, which causes MutationObserver.observe to throw. Wait until the redactor is present.
 */
function installEditorJsUndo(editor: EditorJS, holder: HTMLElement, isCancelled: () => boolean): void {
  let attempts = 0
  const maxAttempts = 60

  const tick = () => {
    if (isCancelled()) return
    if (holder.querySelector('.codex-editor__redactor')) {
      try {
        new Undo({ editor })
      } catch {
        /* ignore */
      }
      return
    }
    if (attempts++ < maxAttempts) {
      requestAnimationFrame(tick)
    }
  }
  requestAnimationFrame(tick)
}

/** After layout, focus first contenteditable — avoids Editor.js autofocus racing Strict Mode teardown. */
function focusHolderContentEditable(
  holder: HTMLElement,
  epoch: number,
  instanceEpochRef: MutableRefObject<number>,
  isStale: () => boolean,
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (isStale() || instanceEpochRef.current !== epoch) return
      if (!holder.isConnected || !document.contains(holder)) return
      holder.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
    })
  })
}

export function BlogEditorJs({ initialData, onChange, placeholder }: BlogEditorJsProps) {
  const reactId = useId().replace(/:/g, '')
  const holderId = `blog-editorjs-${reactId}`
  const holderRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorJS | null>(null)
  /** Bumps on each useLayoutEffect run so async work from a torn-down instance is ignored (React Strict Mode). */
  const instanceEpochRef = useRef(0)
  const onChangeRef = useRef(onChange)
  const { stageLocalImage, releaseLocalImage } = useBlogLocalImages()

  const initialDataJson = useMemo(() => JSON.stringify({ ...initialData, blocks: initialData.blocks ?? [] }), [initialData])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const tools = useMemo(
    () => ({
      bold: StrongInlineTool,
      italic: ItalicInlineTool,
      underline: UnderlineInlineTool,
      strike: StrikeInlineTool,
      marker: Marker,
      inlineCode: InlineCode,
      header: {
        class: Header,
        config: {
          levels: [1, 2, 3],
          defaultLevel: 2,
        },
      },
      paragraph: {
        class: Paragraph,
        inlineToolbar: ['bold', 'italic', 'underline', 'strike', 'link', 'marker', 'inlineCode'],
        config: {
          placeholder: placeholder ?? 'Write your article…',
        },
      },
      list: {
        class: EditorjsList,
        inlineToolbar: true,
      },
      checklist: {
        class: Checklist,
        inlineToolbar: ['bold', 'italic', 'link', 'marker'],
      },
      quote: {
        class: Quote,
        inlineToolbar: ['bold', 'italic', 'link', 'marker'],
      },
      delimiter: Delimiter,
      blogCallout: BlogCalloutTool,
      blogFigure: {
        class: BlogFigureTool,
        config: {
          stageLocalImage,
          releaseLocalImage,
        },
      },
    }),
    [placeholder, stageLocalImage, releaseLocalImage],
  )

  /**
   * Editor.js + React 18 Strict Mode: effects mount → cleanup → mount. Init is async (`isReady`).
   * Use an epoch per effect run so stale onChange/onReady never touch state after cleanup, destroy
   * after `isReady`, then clear the holder. Pass the holder element so Editor binds to React’s node.
   */
  useLayoutEffect(() => {
    const holder = holderRef.current
    if (!holder) return

    const epoch = ++instanceEpochRef.current
    let cancelled = false

    holder.innerHTML = ''

    const dataObj = JSON.parse(initialDataJson) as EditorJsOutput

    const editor = new EditorJS({
      holder,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Editor.js tool union is wider than our map
      tools: tools as any,
      data: { ...dataObj, blocks: dataObj.blocks ?? [] },
      minHeight: 280,
      placeholder: placeholder ?? 'Write your article…',
      autofocus: false,
      defaultBlock: 'paragraph',
      onChange: async () => {
        if (cancelled || instanceEpochRef.current !== epoch) return
        const data = await editor.save()
        if (cancelled || instanceEpochRef.current !== epoch) return
        onChangeRef.current(JSON.stringify(data))
      },
      onReady: () => {
        if (cancelled || instanceEpochRef.current !== epoch) return
        installEditorJsUndo(editor, holder, () => cancelled || instanceEpochRef.current !== epoch)
        focusHolderContentEditable(holder, epoch, instanceEpochRef, () => cancelled)
      },
    })
    editorRef.current = editor

    return () => {
      cancelled = true
      const ed = editor
      const epochAtUnmount = epoch
      void ed.isReady
        .then(() => {
          if (instanceEpochRef.current !== epochAtUnmount) return
          if (typeof ed.destroy === 'function') ed.destroy()
        })
        .catch(() => {})
        .finally(() => {
          // Stale async cleanup (e.g. React Strict Mode remount) must not clear the holder: a newer
          // Editor.js instance may already own this node; clearing would wipe its DOM and body content.
          if (holderRef.current !== holder) return
          if (instanceEpochRef.current !== epochAtUnmount) return
          holder.innerHTML = ''
        })
      editorRef.current = null
    }
  }, [tools, placeholder, initialDataJson, holderId])

  return (
    <div className="blog-rich-editor overflow-visible rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      {/*
        Do not put overflow-y-auto / max-h on a wrapper around the holder: Editor.js renders
        toolboxes and popovers inside the editor tree with position:absolute; any scroll container
        ancestor clips those menus (including keyboard-opened ones).
        Page scroll (admin layout outlet) handles long articles.
      */}
      <div
        id={holderId}
        ref={holderRef}
        className="blog-editor-js-holder relative z-[2] min-h-[280px] w-full cursor-text rounded-b-lg border-t border-slate-200/60 bg-[#0a0a0a] text-zinc-300 dark:border-slate-700/60"
      />
    </div>
  )
}
