import type { BlockToolConstructorOptions } from '@editorjs/editorjs'

type CalloutData = {
  text: string
}

export default class BlogCalloutTool {
  private data: CalloutData
  private readOnly: boolean

  static get toolbox() {
    return {
      title: 'Callout',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" d="M7 9h10M7 13h7"/></svg>',
    }
  }

  constructor({ data, readOnly }: BlockToolConstructorOptions<CalloutData>) {
    this.data = { text: data?.text ?? '' }
    this.readOnly = !!readOnly
  }

  render(): HTMLElement {
    const el = document.createElement('aside')
    el.className = 'blog-callout'
    el.setAttribute('data-type', 'callout')
    el.contentEditable = this.readOnly ? 'false' : 'true'
    el.innerHTML = this.data.text || '<p></p>'
    return el
  }

  save(block: HTMLElement): CalloutData {
    return { text: block.innerHTML }
  }

  static get sanitize() {
    return {
      text: {
        br: true,
        b: true,
        strong: true,
        i: true,
        em: true,
        a: true,
        mark: true,
        u: true,
        s: true,
        p: true,
      },
    }
  }
}
