/** Rich product description stored as JSON in the `description` TEXT field (v2). */

export const PRODUCT_DESCRIPTION_VERSION = 2 as const

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

export type CompositionHazard = '' | 'danger' | 'warning' | 'caution'

type ProductDescriptionV1Legacy = {
  version: 1
  detailedDescription: string
  composition?: {
    text?: string
    hazard?: CompositionHazard
  }
  applicationGuide: {
    rows: ApplicationGuideRow[]
  }
  howToGrow: HowToGrowStep[]
  technicalSpecs: TechnicalSpecPair[]
}

export type ProductDescriptionV2 = {
  version: typeof PRODUCT_DESCRIPTION_VERSION
  detailedDescription: string
  composition: {
    texts: string[]
    hazardKey: string
  }
  applicationGuide: {
    rows: ApplicationGuideRow[]
  }
  howToGrow: HowToGrowStep[]
  technicalSpecs: TechnicalSpecPair[]
}

export type ParsedProductDescription =
  | { kind: 'structured'; doc: ProductDescriptionV2 }
  | { kind: 'plain'; text: string }

// Backwards-compatible alias for older imports.
export type ProductDescriptionV1 = ProductDescriptionV2

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
  return emptyProductDescriptionV2()
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

function isV2Shape(x: unknown): x is ProductDescriptionV2 {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.version !== PRODUCT_DESCRIPTION_VERSION) return false
  if (typeof o.detailedDescription !== 'string') return false
  if (!o.composition || typeof o.composition !== 'object') return false
  const c = o.composition as Record<string, unknown>
  if (!Array.isArray(c.texts)) return false
  if (typeof c.hazardKey !== 'string') return false
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
    if (!parsed || typeof parsed !== 'object') return { kind: 'plain', text: raw }
    const o = parsed as Record<string, unknown>

    // v2 (current)
    if (isV2Shape(parsed)) {
      const rows = (o.applicationGuide as Record<string, unknown>).rows as unknown[]
      const normalizedRows = rows.map((r) =>
        r && typeof r === 'object' ? normalizeRow(r as Record<string, unknown>) : emptyApplicationGuideRow(),
      )

      const howToGrow = (o.howToGrow as unknown[]).map((s) => {
        if (!s || typeof s !== 'object') return { title: '', detail: '' }
        const h = s as Record<string, unknown>
        return {
          title: typeof h.title === 'string' ? h.title : '',
          detail: typeof h.detail === 'string' ? h.detail : '',
        }
      })

      const technicalSpecs = (o.technicalSpecs as unknown[]).map((p) => {
        if (!p || typeof p !== 'object') return { label: '', value: '' }
        const q = p as Record<string, unknown>
        return {
          label: typeof q.label === 'string' ? q.label : '',
          value: typeof q.value === 'string' ? q.value : '',
        }
      })

      const comp = o.composition as Record<string, unknown>
      const textsRaw = Array.isArray(comp.texts) ? (comp.texts as unknown[]) : []
      const texts = textsRaw.map((x) => (typeof x === 'string' ? x : '')).filter((x) => x.trim() !== '')

      return {
        kind: 'structured',
        doc: {
          version: PRODUCT_DESCRIPTION_VERSION,
          detailedDescription: o.detailedDescription as string,
          composition: {
            texts,
            hazardKey: typeof comp.hazardKey === 'string' ? comp.hazardKey : '',
          },
          applicationGuide: { rows: normalizedRows },
          howToGrow,
          technicalSpecs,
        },
      }
    }

    // v1 (legacy) -> normalize to v2
    if (o.version === 1) {
      const v1 = o as unknown as ProductDescriptionV1Legacy

      const rows = (v1.applicationGuide.rows as unknown[]).map((r) =>
        r && typeof r === 'object' ? normalizeRow(r as Record<string, unknown>) : emptyApplicationGuideRow(),
      )

      const howToGrow = (v1.howToGrow as unknown[]).map((s) => {
        if (!s || typeof s !== 'object') return { title: '', detail: '' }
        const h = s as Record<string, unknown>
        return {
          title: typeof h.title === 'string' ? h.title : '',
          detail: typeof h.detail === 'string' ? h.detail : '',
        }
      })

      const technicalSpecs = (v1.technicalSpecs as unknown[]).map((p) => {
        if (!p || typeof p !== 'object') return { label: '', value: '' }
        const q = p as Record<string, unknown>
        return {
          label: typeof q.label === 'string' ? q.label : '',
          value: typeof q.value === 'string' ? q.value : '',
        }
      })

      const compRaw = (o as Record<string, unknown>).composition
      let compText = ''
      let compHazard: CompositionHazard = ''
      if (compRaw && typeof compRaw === 'object') {
        const c = compRaw as Record<string, unknown>
        compText = typeof c.text === 'string' ? c.text : ''
        const hz = typeof c.hazard === 'string' ? c.hazard : ''
        if (hz === 'danger' || hz === 'warning' || hz === 'caution' || hz === '') {
          compHazard = hz
        }
      }

      return {
        kind: 'structured',
        doc: {
          version: PRODUCT_DESCRIPTION_VERSION,
          detailedDescription: String(v1.detailedDescription ?? ''),
          composition: {
            texts: compText.trim() ? [compText] : [],
            hazardKey: compHazard,
          },
          applicationGuide: { rows },
          howToGrow,
          technicalSpecs,
        },
      }
    }

    return { kind: 'plain', text: raw }

  } catch {
    return { kind: 'plain', text: raw }
  }
}

export function emptyProductDescriptionV2(): ProductDescriptionV2 {
  return {
    version: PRODUCT_DESCRIPTION_VERSION,
    detailedDescription: '',
    composition: { texts: [], hazardKey: '' },
    applicationGuide: { rows: [] },
    howToGrow: [],
    technicalSpecs: [],
  }
}

export function serializeProductDescriptionV2(doc: ProductDescriptionV2): string {
  const texts = (doc.composition?.texts ?? []).map((t) => String(t)).map((t) => t.trim()).filter(Boolean)
  const payload: ProductDescriptionV2 = {
    version: PRODUCT_DESCRIPTION_VERSION,
    detailedDescription: doc.detailedDescription,
    composition: {
      texts,
      hazardKey: String(doc.composition?.hazardKey ?? '').trim(),
    },
    applicationGuide: {
      rows: doc.applicationGuide.rows.map((r) => ({ ...r })),
    },
    howToGrow: doc.howToGrow.map((s) => ({ ...s })),
    technicalSpecs: doc.technicalSpecs.map((p) => ({ ...p })),
  }
  return JSON.stringify(payload)
}

// Backwards-compatible alias for older imports.
export function serializeProductDescriptionV1(doc: ProductDescriptionV1): string {
  return serializeProductDescriptionV2(doc)
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
