import DOMPurify from 'dompurify'

const INLINE = {
  ALLOWED_TAGS: ['a', 'b', 'br', 'code', 'em', 'i', 'mark', 's', 'strong', 'u', 'span', 'sub', 'sup'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
}

const LEGACY = {
  ALLOWED_TAGS: [
    'a',
    'aside',
    'b',
    'blockquote',
    'br',
    'code',
    'div',
    'em',
    'figcaption',
    'figure',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'i',
    'img',
    'li',
    'mark',
    'ol',
    'p',
    'pre',
    's',
    'strong',
    'u',
    'ul',
    'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'data-type'],
}

export function sanitizeBlogInlineHtml(html: string): string {
  return DOMPurify.sanitize(html, INLINE) as string
}

export function sanitizeBlogLegacyHtml(html: string): string {
  return DOMPurify.sanitize(html, LEGACY) as string
}
