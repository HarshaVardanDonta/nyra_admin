import { mergeAttributes, Node } from '@tiptap/core'
import { BulletList } from '@tiptap/extension-list'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { useRef, type ChangeEvent } from 'react'
import { useBlogLocalImages } from '../contexts/blog-local-images-context'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    checkBulletList: {
      toggleCheckBulletList: () => ReturnType
    }
    blogCallout: {
      toggleBlogCallout: () => ReturnType
    }
    blogFigure: {
      insertBlogFigure: (attrs: { src: string; alt?: string; caption?: string }) => ReturnType
    }
  }
}

/** Normal bullets: ignores `ul.blog-check-list` (owned by check list). */
export const StandardBulletList = BulletList.extend({
  name: 'bulletList',
  parseHTML() {
    return [
      {
        tag: 'ul',
        getAttrs: (element) => {
          const el = element as HTMLElement
          if (el.classList.contains('blog-check-list')) return false
          return {}
        },
      },
    ]
  },
})

/** Feature list with green check bullets (reference layout). */
export const CheckBulletList = BulletList.extend({
  name: 'checkBulletList',

  parseHTML() {
    return [
      {
        tag: 'ul',
        getAttrs: (element) => {
          const el = element as HTMLElement
          if (!el.classList.contains('blog-check-list')) return false
          return {}
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'ul',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'blog-check-list',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleCheckBulletList:
        () =>
        ({ commands }) => {
          return commands.toggleList(this.name, this.options.itemTypeName, this.options.keepMarks)
        },
    }
  },

  addKeyboardShortcuts() {
    return {}
  },

  addInputRules() {
    return []
  },
})

export interface BlogCalloutOptions {
  HTMLAttributes: Record<string, unknown>
}

export const BlogCallout = Node.create<BlogCalloutOptions>({
  name: 'blogCallout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      {
        tag: 'aside',
        getAttrs: (element) => {
          const el = element as HTMLElement
          if (!el.classList.contains('blog-callout')) return false
          return {}
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(
        { class: 'blog-callout', 'data-type': 'callout' },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ]
  },

  addCommands() {
    return {
      toggleBlogCallout:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name)
        },
    }
  },
})

function BlogFigureView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = (node.attrs.src as string) || ''
  const alt = (node.attrs.alt as string) || ''
  const caption = (node.attrs.caption as string) || ''
  const fileRef = useRef<HTMLInputElement>(null)
  const { stageLocalImage, releaseLocalImage } = useBlogLocalImages()

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (src.startsWith('blob:')) {
      releaseLocalImage(src)
    }
    const url = stageLocalImage(f)
    updateAttributes({ src: url })
  }

  return (
    <NodeViewWrapper as="figure" className="blog-article-figure blog-article-figure--edit">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFileChange}
      />
      <div className="blog-figure-frame" data-drag-handle>
        {src ? (
          <img src={src} alt={alt} className="blog-figure-img" draggable={false} />
        ) : (
          <div className="blog-figure-placeholder flex min-h-[120px] flex-col items-center justify-center gap-2 bg-zinc-900 px-4 text-center text-xs text-zinc-500">
            <span>No image yet</span>
            <button
              type="button"
              className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
              contentEditable={false}
              onClick={() => fileRef.current?.click()}
            >
              Choose image
            </button>
          </div>
        )}
      </div>
      {selected ? (
        <div className="blog-figure-edit-bar" contentEditable={false}>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Replace
          </button>
          <button
            type="button"
            onClick={() => {
              const a = window.prompt('Alt text', alt)
              if (a != null) updateAttributes({ alt: a })
            }}
          >
            Alt
          </button>
        </div>
      ) : null}
      <figcaption className="blog-figure-caption" contentEditable={false}>
        <input
          className="blog-figure-caption-input"
          type="text"
          placeholder="Caption"
          value={caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
      </figcaption>
    </NodeViewWrapper>
  )
}

export const BlogFigure = Node.create({
  name: 'blogFigure',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure.blog-article-figure',
        priority: 60,
        getAttrs: (node) => {
          const el = node as HTMLElement
          const img = el.querySelector('img.blog-figure-img, img')
          if (!img || !(img instanceof HTMLImageElement)) return false
          const s = img.getAttribute('src')
          if (!s) return false
          const cap = el.querySelector('figcaption.blog-figure-caption, figcaption')
          return {
            src: s,
            alt: img.getAttribute('alt') ?? '',
            caption: cap?.textContent?.trim() ?? '',
          }
        },
      },
    ]
  },

  renderHTML({ node }) {
    const src = node.attrs.src as string
    const alt = (node.attrs.alt as string) || ''
    const caption = (node.attrs.caption as string) || ''
    return [
      'figure',
      { class: 'blog-article-figure' },
      [
        'div',
        { class: 'blog-figure-frame' },
        ['img', { class: 'blog-figure-img', src, alt: alt || undefined }],
      ],
      ['figcaption', { class: 'blog-figure-caption' }, caption || '\u200b'],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlogFigureView)
  },

  addCommands() {
    return {
      insertBlogFigure:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              alt: attrs.alt ?? '',
              caption: attrs.caption ?? '',
            },
          })
        },
    }
  },
})
