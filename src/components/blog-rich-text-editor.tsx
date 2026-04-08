import Highlight from '@tiptap/extension-highlight'
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useReducer, useRef, type ChangeEvent, type ReactNode } from 'react'
import { useBlogLocalImages } from '../contexts/blog-local-images-context'
import {
  BlogCallout,
  BlogFigure,
  CheckBulletList,
  StandardBulletList,
} from './blog-tiptap-extensions'

type BlogRichTextEditorProps = {
  initialHTML: string
  onChange: (html: string) => void
  placeholder?: string
}

const fontOptions: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: 'Sans (Inter)', value: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif (Georgia)', value: 'Georgia, ui-serif, serif' },
  { label: 'Classic', value: '"Times New Roman", Times, serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
]

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded px-2 py-1 text-sm font-medium transition',
        active
          ? 'bg-blue-600 text-white dark:bg-blue-500'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
        disabled ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function BlogRichTextEditor({ initialHTML, onChange, placeholder }: BlogRichTextEditorProps) {
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const { stageLocalImage } = useBlogLocalImages()
  const toolbarImageInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'blog-article-link',
          },
        },
        heading: { levels: [1, 2, 3] },
        listKeymap: {
          listTypes: [
            { itemName: 'listItem', wrapperNames: ['bulletList', 'orderedList', 'checkBulletList'] },
          ],
        },
      }),
      StandardBulletList,
      CheckBulletList,
      BlogCallout,
      BlogFigure,
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Write your article…',
      }),
    ],
    content: initialHTML || '<p></p>',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
      tick()
    },
    onSelectionUpdate: () => tick(),
  })

  useEffect(() => {
    if (!editor) return
    const bump = () => tick()
    editor.on('transaction', bump)
    return () => {
      editor.off('transaction', bump)
    }
  }, [editor])

  if (!editor) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50" />
    )
  }

  const openToolbarImagePicker = () => {
    toolbarImageInputRef.current?.click()
  }

  const onToolbarImageSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = stageLocalImage(file)
    editor.chain().focus().insertBlogFigure({ src: url, alt: '', caption: '' }).run()
  }

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev ?? 'https://')
    if (url === null) return
    const t = url.trim()
    if (t === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: t }).run()
  }

  return (
    <div className="blog-rich-editor overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      <input
        ref={toolbarImageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        onChange={onToolbarImageSelected}
      />
      <div
        className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900/80"
        onMouseDown={(e) => e.preventDefault()}
        role="toolbar"
        aria-label="Formatting"
      >
        <ToolbarButton
          title="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" aria-hidden />
        <ToolbarButton
          title="Highlight"
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
        >
          Hi
        </ToolbarButton>
        <label className="flex items-center gap-1 rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800" title="Text color">
          <span className="sr-only">Text color</span>
          <input
            type="color"
            className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
            onInput={(e) => {
              const c = (e.target as HTMLInputElement).value
              editor.chain().focus().setColor(c).run()
            }}
          />
        </label>
        <ToolbarButton title="Clear text color" onClick={() => editor.chain().focus().unsetColor().run()}>
          ∅
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" aria-hidden />
        <ToolbarButton
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          title="Paragraph"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          ¶
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" aria-hidden />
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolbarButton>
        <ToolbarButton
          title="Check list (feature bullets)"
          active={editor.isActive('checkBulletList')}
          onClick={() => editor.chain().focus().toggleCheckBulletList().run()}
        >
          ✓
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          title="Blockquote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          “
        </ToolbarButton>
        <ToolbarButton
          title="Callout (green box)"
          active={editor.isActive('blogCallout')}
          onClick={() => editor.chain().focus().toggleBlogCallout().run()}
        >
          ▤
        </ToolbarButton>
        <ToolbarButton
          title="Insert image — file stays local until you click Save (then uploads to Cloudflare R2)"
          onClick={openToolbarImagePicker}
        >
          Img
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" aria-hidden />
        <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          ↺
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          ↻
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" aria-hidden />
        <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <span className="whitespace-nowrap">Font</span>
          <select
            className="select-tail max-w-[140px] rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
            value={
              fontOptions.find((f) => f.value === editor.getAttributes('textStyle').fontFamily)?.value ?? ''
            }
            onChange={(e) => {
              const v = e.target.value
              if (v === '') {
                editor.chain().focus().unsetFontFamily().run()
              } else {
                editor.chain().focus().setFontFamily(v).run()
              }
            }}
          >
            {fontOptions.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <EditorContent
        editor={editor}
        className="blog-rich-editor-content blog-article-prose max-h-[min(60vh,560px)] overflow-y-auto rounded-b-lg"
      />
    </div>
  )
}
