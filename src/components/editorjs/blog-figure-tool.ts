import type { BlockToolConstructorOptions } from '@editorjs/editorjs'

export type BlogFigureToolConfig = {
  stageLocalImage: (file: File) => string
  releaseLocalImage: (blobUrl: string) => void
}

type FigureData = {
  src: string
  alt: string
  caption: string
}

export default class BlogFigureTool {
  private data: FigureData
  private readOnly: boolean
  private config: BlogFigureToolConfig

  static get toolbox() {
    return {
      title: 'Image + caption',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="11" r="2" fill="currentColor"/><path stroke="currentColor" stroke-width="2" d="m21 15-4-4-6 6"/></svg>',
    }
  }

  constructor({
    data,
    readOnly,
    config,
  }: BlockToolConstructorOptions<FigureData> & { config?: BlogFigureToolConfig }) {
    this.data = { src: data?.src ?? '', alt: data?.alt ?? '', caption: data?.caption ?? '' }
    this.readOnly = !!readOnly
    this.config = config ?? {
      stageLocalImage: () => '',
      releaseLocalImage: () => {},
    }
  }

  render(): HTMLElement {
    const wrap = document.createElement('figure')
    wrap.className = this.readOnly
      ? 'blog-article-figure'
      : 'blog-article-figure blog-article-figure--edit'

    const frame = document.createElement('div')
    frame.className = 'blog-figure-frame'

    const img = document.createElement('img')
    img.className = 'blog-figure-img'
    img.draggable = false
    img.src = this.data.src || ''
    img.alt = this.data.alt

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.className = 'sr-only'
    fileInput.setAttribute('aria-hidden', 'true')

    const showImage = () => {
      frame.innerHTML = ''
      frame.appendChild(img)
    }

    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0]
      fileInput.value = ''
      if (!f) return
      const prev = img.getAttribute('src') ?? ''
      if (prev.startsWith('blob:')) {
        this.config.releaseLocalImage(prev)
      }
      img.src = this.config.stageLocalImage(f)
      showImage()
    })

    if (this.data.src) {
      frame.appendChild(img)
    } else if (!this.readOnly) {
      const ph = document.createElement('div')
      ph.className =
        'blog-figure-placeholder flex min-h-[120px] flex-col items-center justify-center gap-2 bg-zinc-900 px-4 text-center text-xs text-zinc-500'
      ph.appendChild(document.createTextNode('No image yet'))
      const choose = document.createElement('button')
      choose.type = 'button'
      choose.className = 'rounded-md bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700'
      choose.textContent = 'Choose image'
      choose.addEventListener('click', () => fileInput.click())
      ph.appendChild(choose)
      frame.appendChild(ph)
    } else {
      frame.appendChild(img)
    }

    wrap.appendChild(frame)

    if (!this.readOnly) {
      wrap.appendChild(fileInput)
      const bar = document.createElement('div')
      bar.className = 'blog-figure-edit-bar'
      bar.contentEditable = 'false'
      const replaceBtn = document.createElement('button')
      replaceBtn.type = 'button'
      replaceBtn.textContent = 'Replace'
      replaceBtn.addEventListener('click', () => fileInput.click())
      const altBtn = document.createElement('button')
      altBtn.type = 'button'
      altBtn.textContent = 'Alt'
      altBtn.addEventListener('click', () => {
        const next = window.prompt('Alt text', img.getAttribute('alt') ?? '')
        if (next !== null) img.setAttribute('alt', next)
      })
      bar.appendChild(replaceBtn)
      bar.appendChild(altBtn)
      wrap.appendChild(bar)
    }

    const cap = document.createElement('figcaption')
    cap.className = 'blog-figure-caption'
    cap.contentEditable = 'false'
    if (this.readOnly) {
      cap.textContent = this.data.caption
    } else {
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'blog-figure-caption-input'
      input.placeholder = 'Caption'
      input.value = this.data.caption
      input.dataset.caption = 'caption'
      cap.appendChild(input)
    }
    wrap.appendChild(cap)

    return wrap
  }

  save(block: HTMLElement): FigureData {
    const img = block.querySelector('img.blog-figure-img') as HTMLImageElement | null
    const cap = block.querySelector('input[data-caption]') as HTMLInputElement | null
    return {
      src: img?.getAttribute('src') ?? '',
      alt: img?.getAttribute('alt') ?? '',
      caption: cap?.value ?? '',
    }
  }

}
