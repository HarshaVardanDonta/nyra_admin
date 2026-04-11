/**
 * Kept for branches that still import this path. The blog editor uses Editor.js (`BlogEditorJs`).
 */
import { BlogEditorJs } from './blog-editor-js'
import type { EditorJsOutput } from '../lib/editorjs-body'

export type BlogRichTextEditorProps = {
  initialData: EditorJsOutput
  onChange: (json: string) => void
  placeholder?: string
}

export function BlogRichTextEditor(props: BlogRichTextEditorProps) {
  return <BlogEditorJs {...props} />
}
