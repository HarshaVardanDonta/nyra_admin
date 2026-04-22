/**
 * Resize and re-encode raster images before upload to reduce R2 bandwidth and storage.
 * SVG and non-image files are returned unchanged.
 */

const MAX_EDGE_PX = 1920
const INVOICE_LOGO_MAX_EDGE_PX = 512
const WEBP_QUALITY = 0.82
const JPEG_QUALITY = 0.85
const INVOICE_LOGO_JPEG_QUALITY = 0.88

function stripExtension(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0) return name
  return name.slice(0, i)
}

function outputName(originalName: string, mime: string): string {
  const base = stripExtension(originalName.trim()) || 'image'
  if (mime === 'image/webp') return `${base}.webp`
  if (mime === 'image/jpeg') return `${base}.jpg`
  return originalName
}

function blobToFile(blob: Blob, name: string, mime: string): File {
  return new File([blob], name, { type: mime, lastModified: Date.now() })
}

/**
 * @returns A smaller (or dimension-reduced) File, or the original if compression isn't worthwhile or fails.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const { width: iw, height: ih } = bitmap
    if (iw < 1 || ih < 1) {
      return file
    }

    const maxEdge = Math.max(iw, ih)
    let w = iw
    let h = ih
    if (maxEdge > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / maxEdge
      w = Math.max(1, Math.round(iw * scale))
      h = Math.max(1, Math.round(ih * scale))
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) {
      return file
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)

    const tryEncode = (type: string, quality?: number) =>
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), type, quality)
      })

    const preferWebp = file.type !== 'image/jpeg'
    const candidates: { type: string; q?: number }[] = preferWebp
      ? [
          { type: 'image/webp', q: WEBP_QUALITY },
          { type: 'image/jpeg', q: JPEG_QUALITY },
        ]
      : [
          { type: 'image/jpeg', q: JPEG_QUALITY },
          { type: 'image/webp', q: WEBP_QUALITY },
        ]

    let best: { blob: Blob; mime: string } | null = null
    for (const { type, q } of candidates) {
      const blob = await tryEncode(type, q)
      if (!blob || blob.size < 1) continue
      if (!best || blob.size < best.blob.size) {
        best = { blob, mime: type }
      }
    }

    if (!best) {
      return file
    }

    const resized = w !== iw || h !== ih
    if (!resized && best.blob.size >= file.size) {
      return file
    }

    return blobToFile(best.blob, outputName(file.name, best.mime), best.mime)
  } finally {
    bitmap.close()
  }
}

/**
 * JPEG-only, modest dimensions — suitable for PDF invoice logos (go-pdf does not support WebP).
 */
export async function compressInvoiceLogoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const { width: iw, height: ih } = bitmap
    if (iw < 1 || ih < 1) {
      return file
    }

    const maxEdge = Math.max(iw, ih)
    let w = iw
    let h = ih
    if (maxEdge > INVOICE_LOGO_MAX_EDGE_PX) {
      const scale = INVOICE_LOGO_MAX_EDGE_PX / maxEdge
      w = Math.max(1, Math.round(iw * scale))
      h = Math.max(1, Math.round(ih * scale))
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) {
      return file
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', INVOICE_LOGO_JPEG_QUALITY)
    })
    if (!blob || blob.size < 1) {
      return file
    }

    const base = stripExtension(file.name.trim()) || 'invoice-logo'
    return blobToFile(blob, `${base}.jpg`, 'image/jpeg')
  } finally {
    bitmap.close()
  }
}
