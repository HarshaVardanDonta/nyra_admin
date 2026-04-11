/** Rich product description stored as JSON in the `description` TEXT field (v1). */

export const PRODUCT_DESCRIPTION_VERSION = 1 as const

export type ApplicationGuideRow = {
  targetContext: string
  dosageDensity: string
  applicationMethod: string
  interval: string
  technicalSpecs: string
}

export type HowToGrowStep = {
  title: string
  detail: string
}

export type TechnicalSpecPair = {
  label: string
  value: string
}

export type ProductDescriptionV1 = {
  version: typeof PRODUCT_DESCRIPTION_VERSION
  detailedDescription: string
  applicationGuide: {
    rows: ApplicationGuideRow[]
  }
  howToGrow: HowToGrowStep[]
  technicalSpecs: TechnicalSpecPair[]
}

export type ParsedProductDescription =
  | { kind: 'structured'; doc: ProductDescriptionV1 }
  | { kind: 'plain'; text: string }

export const APPLICATION_GUIDE_COLUMN_LABELS = [
  'Target Context',
  'Dosage / Density',
  'Application Method',
  'Interval',
  'Technical Specs',
] as const

export function emptyApplicationGuideRow(): ApplicationGuideRow {
  return {
    targetContext: '',
    dosageDensity: '',
    applicationMethod: '',
    interval: '',
    technicalSpecs: '',
  }
}

export function emptyProductDescriptionV1(): ProductDescriptionV1 {
  return {
    version: PRODUCT_DESCRIPTION_VERSION,
    detailedDescription: '',
    applicationGuide: { rows: [] },
    howToGrow: [],
    technicalSpecs: [],
  }
}

function normalizeRow(raw: Record<string, unknown>): ApplicationGuideRow {
  const s = (k: string) => (typeof raw[k] === 'string' ? raw[k] : '')
  return {
    targetContext: s('targetContext'),
    dosageDensity: s('dosageDensity'),
    applicationMethod: s('applicationMethod'),
    interval: s('interval'),
    technicalSpecs: s('technicalSpecs'),
  }
}

function isV1Shape(x: unknown): x is ProductDescriptionV1 {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.version !== PRODUCT_DESCRIPTION_VERSION) return false
  if (typeof o.detailedDescription !== 'string') return false
  if (!o.applicationGuide || typeof o.applicationGuide !== 'object') return false
  const ag = o.applicationGuide as Record<string, unknown>
  if (!Array.isArray(ag.rows)) return false
  if (!Array.isArray(o.howToGrow)) return false
  if (!Array.isArray(o.technicalSpecs)) return false
  return true
}

export function parseProductDescription(raw: string): ParsedProductDescription {
  const t = raw.trim()
  if (!t) return { kind: 'plain', text: '' }
  if (!t.startsWith('{')) return { kind: 'plain', text: raw }

  try {
    const parsed = JSON.parse(t) as unknown
    if (!isV1Shape(parsed)) return { kind: 'plain', text: raw }

    const rows = (parsed.applicationGuide.rows as unknown[])
      .map((r) =>
        r && typeof r === 'object' ? normalizeRow(r as Record<string, unknown>) : emptyApplicationGuideRow(),
      )

    const howToGrow = (parsed.howToGrow as unknown[]).map((s) => {
      if (!s || typeof s !== 'object') return { title: '', detail: '' }
      const h = s as Record<string, unknown>
      return {
        title: typeof h.title === 'string' ? h.title : '',
        detail: typeof h.detail === 'string' ? h.detail : '',
      }
    })

    const technicalSpecs = (parsed.technicalSpecs as unknown[]).map((p) => {
      if (!p || typeof p !== 'object') return { label: '', value: '' }
      const q = p as Record<string, unknown>
      return {
        label: typeof q.label === 'string' ? q.label : '',
        value: typeof q.value === 'string' ? q.value : '',
      }
    })

    return {
      kind: 'structured',
      doc: {
        version: PRODUCT_DESCRIPTION_VERSION,
        detailedDescription: parsed.detailedDescription,
        applicationGuide: { rows },
        howToGrow,
        technicalSpecs,
      },
    }
  } catch {
    return { kind: 'plain', text: raw }
  }
}

export function serializeProductDescriptionV1(doc: ProductDescriptionV1): string {
  const payload: ProductDescriptionV1 = {
    version: PRODUCT_DESCRIPTION_VERSION,
    detailedDescription: doc.detailedDescription,
    applicationGuide: {
      rows: doc.applicationGuide.rows.map((r) => ({ ...r })),
    },
    howToGrow: doc.howToGrow.map((s) => ({ ...s })),
    technicalSpecs: doc.technicalSpecs.map((p) => ({ ...p })),
  }
  return JSON.stringify(payload)
}

/** Single-line friendly excerpt for cards (wishlist, product grid). */
export function getDescriptionPreview(raw: string | undefined, maxLen = 160): string {
  if (raw == null || !String(raw).trim()) return ''
  const parsed = parseProductDescription(String(raw))
  let text: string
  if (parsed.kind === 'plain') {
    text = parsed.text
  } else {
    const d = parsed.doc.detailedDescription.trim()
    if (d) {
      text = d.replace(/\s+/g, ' ')
    } else if (parsed.doc.howToGrow.length > 0) {
      text = parsed.doc.howToGrow.map((s) => s.title || s.detail).filter(Boolean).join(' · ')
    } else {
      text = ''
    }
  }
  const one = text.replace(/\s+/g, ' ').trim()
  if (one.length <= maxLen) return one
  return `${one.slice(0, Math.max(0, maxLen - 1)).trim()}…`
}
