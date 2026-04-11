import { Fragment, type ReactNode } from 'react'
import { sanitizeBlogInlineHtml, sanitizeBlogLegacyHtml } from '../lib/blog-body-sanitize'
import { parseEditorJsBody, type EditorJsBlock } from '../lib/editorjs-body'

function looksLikeLegacyHtml(body: string): boolean {
  const t = body.trim()
  return t.startsWith('<') && /<\/[a-z][\s>]|<br\s*\/?>/i.test(t)
}

type ListItemV2 = {
  content: string
  meta?: unknown
  items?: ListItemV2[]
}

function isListItemV2(x: unknown): x is ListItemV2 {
  return typeof x === 'object' && x !== null && 'content' in x && typeof (x as ListItemV2).content === 'string'
}

function renderListItemNodes(
  items: ListItemV2[],
  sanitize: (h: string) => string,
  keyPrefix: string,
): ReactNode {
  return items.map((item, i) => (
    <li key={`${keyPrefix}-${i}`}>
      <span dangerouslySetInnerHTML={{ __html: sanitize(item.content || '') }} />
      {item.items && item.items.length > 0 ? (
        <ul>{renderListItemNodes(item.items, sanitize, `${keyPrefix}-${i}-sub`)}</ul>
      ) : null}
    </li>
  ))
}

function renderOrderedListNodes(
  items: ListItemV2[],
  sanitize: (h: string) => string,
  keyPrefix: string,
): ReactNode {
  return items.map((item, i) => (
    <li key={`${keyPrefix}-${i}`}>
      <span dangerouslySetInnerHTML={{ __html: sanitize(item.content || '') }} />
      {item.items && item.items.length > 0 ? (
        <ol>{renderOrderedListNodes(item.items, sanitize, `${keyPrefix}-${i}-sub`)}</ol>
      ) : null}
    </li>
  ))
}

function renderListBlock(
  data: Record<string, unknown>,
  sanitize: (h: string) => string,
  keyPrefix: string,
): ReactNode {
  const style = typeof data.style === 'string' ? data.style : 'unordered'
  const rawItems = data.items
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null

  if (typeof rawItems[0] === 'string') {
    const items = rawItems as string[]
    if (style === 'ordered') {
      return (
        <ol>
          {items.map((t, i) => (
            <li key={`${keyPrefix}-o-${i}`}>
              <span dangerouslySetInnerHTML={{ __html: sanitize(t) }} />
            </li>
          ))}
        </ol>
      )
    }
    if (style === 'checklist') {
      return (
        <ul className="blog-check-list">
          {items.map((t, i) => (
            <li key={`${keyPrefix}-c-${i}`}>
              <span dangerouslySetInnerHTML={{ __html: sanitize(t) }} />
            </li>
          ))}
        </ul>
      )
    }
    return (
      <ul>
        {items.map((t, i) => (
          <li key={`${keyPrefix}-u-${i}`}>
            <span dangerouslySetInnerHTML={{ __html: sanitize(t) }} />
          </li>
        ))}
      </ul>
    )
  }

  const items = rawItems.filter(isListItemV2)
  if (style === 'ordered') {
    return <ol>{renderOrderedListNodes(items, sanitize, keyPrefix)}</ol>
  }
  if (style === 'checklist') {
    return (
      <ul className="blog-check-list">
        {items.map((item, i) => (
          <li key={`${keyPrefix}-cv2-${i}`}>
            <span dangerouslySetInnerHTML={{ __html: sanitize(item.content || '') }} />
            {item.items && item.items.length > 0 ? (
              <ul>{renderListItemNodes(item.items, sanitize, `${keyPrefix}-cv2-${i}-sub`)}</ul>
            ) : null}
          </li>
        ))}
      </ul>
    )
  }
  return <ul>{renderListItemNodes(items, sanitize, keyPrefix)}</ul>
}

function renderChecklistBlock(
  data: Record<string, unknown>,
  sanitize: (h: string) => string,
  keyPrefix: string,
): ReactNode {
  const raw = data.items
  if (!Array.isArray(raw)) return null
  return (
    <ul className="blog-check-list">
      {raw.map((row, i) => {
        const o = row as { text?: string; checked?: boolean }
        const text = typeof o.text === 'string' ? o.text : ''
        const checked = o.checked === true
        return (
          <li
            key={`${keyPrefix}-chk-${i}`}
            style={checked ? undefined : { opacity: 0.85 }}
          >
            <span dangerouslySetInnerHTML={{ __html: sanitize(text) }} />
          </li>
        )
      })}
    </ul>
  )
}

function renderBlock(
  block: EditorJsBlock,
  sanitize: (h: string) => string,
  i: number,
): ReactNode {
  const d = block.data
  const key = block.id ?? `b-${i}`

  switch (block.type) {
    case 'header': {
      const text = typeof d.text === 'string' ? d.text : ''
      const level = typeof d.level === 'number' ? Math.min(6, Math.max(1, d.level)) : 2
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return (
        <Tag key={key} dangerouslySetInnerHTML={{ __html: sanitize(text) }} />
      )
    }
    case 'paragraph': {
      const text = typeof d.text === 'string' ? d.text : ''
      if (!text.trim()) {
        return <p key={key} className="blog-empty-paragraph" />
      }
      return <p key={key} dangerouslySetInnerHTML={{ __html: sanitize(text) }} />
    }
    case 'list':
      return (
        <Fragment key={key}>{renderListBlock(d, sanitize, key)}</Fragment>
      )
    case 'checklist':
      return (
        <Fragment key={key}>{renderChecklistBlock(d, sanitize, key)}</Fragment>
      )
    case 'quote': {
      const text = typeof d.text === 'string' ? d.text : ''
      const caption = typeof d.caption === 'string' ? d.caption : ''
      return (
        <blockquote key={key}>
          <div dangerouslySetInnerHTML={{ __html: sanitize(text) }} />
          {caption.trim() ? (
            <cite dangerouslySetInnerHTML={{ __html: sanitize(caption) }} />
          ) : null}
        </blockquote>
      )
    }
    case 'delimiter':
      return <hr key={key} />
    case 'blogCallout': {
      const text = typeof d.text === 'string' ? d.text : ''
      return (
        <aside key={key} className="blog-callout" data-type="callout">
          <div dangerouslySetInnerHTML={{ __html: sanitize(text) }} />
        </aside>
      )
    }
    case 'blogFigure': {
      const src = typeof d.src === 'string' ? d.src : ''
      const alt = typeof d.alt === 'string' ? d.alt : ''
      const caption = typeof d.caption === 'string' ? d.caption : ''
      if (!src.trim()) return null
      return (
        <figure key={key} className="blog-article-figure">
          <div className="blog-figure-frame">
            <img className="blog-figure-img" src={src} alt={alt} loading="lazy" />
          </div>
          {caption.trim() ? (
            <figcaption className="blog-figure-caption">{caption}</figcaption>
          ) : null}
        </figure>
      )
    }
    case 'code': {
      const code = typeof d.code === 'string' ? d.code : ''
      return (
        <pre key={key}>
          <code>{code}</code>
        </pre>
      )
    }
    default:
      return null
  }
}

export type BlogBodyRendererProps = {
  body: string
  sanitize?: boolean
  className?: string
}

export function BlogBodyRenderer({ body, sanitize = true, className }: BlogBodyRendererProps) {
  const inline = sanitize ? sanitizeBlogInlineHtml : (h: string) => h
  const legacy = sanitize ? sanitizeBlogLegacyHtml : (h: string) => h

  const parsed = parseEditorJsBody(body)
  if (parsed?.blocks?.length) {
    return (
      <div className={['blog-article-prose', className].filter(Boolean).join(' ')}>
        {parsed.blocks.map((b, i) => renderBlock(b, inline, i))}
      </div>
    )
  }

  const t = body.trim()
  if (!t) {
    return null
  }

  if (looksLikeLegacyHtml(body)) {
    return (
      <div
        className={['blog-body-html blog-article-prose', className].filter(Boolean).join(' ')}
        dangerouslySetInnerHTML={{ __html: legacy(body) }}
      />
    )
  }

  return (
    <div className={['whitespace-pre-wrap break-words text-base leading-relaxed', className].filter(Boolean).join(' ')}>
      {body}
    </div>
  )
}
