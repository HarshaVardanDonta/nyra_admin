import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'
import { collectBlobImageSrcs, replaceBlobImagesInBlogHtml } from '../lib/blog-body-images'

export type ResolveBlogBodyResult = {
  html: string
  /** Call only after the blog save API succeeds — revokes blob URLs and clears staging. */
  revokePendingBlobs: () => void
}

type BlogLocalImagesContextValue = {
  /** Register a local file for later upload on save; returns a blob: URL for the editor. */
  stageLocalImage: (file: File) => string
  /** Revoke blob URL and drop from staging (e.g. when replacing a draft image). */
  releaseLocalImage: (blobUrl: string) => void
  /** Upload blob: images to R2 and return HTML with public URLs. Revoke blobs only after a successful save. */
  resolveAndUpload: (html: string, token: string) => Promise<ResolveBlogBodyResult>
}

const BlogLocalImagesContext = createContext<BlogLocalImagesContextValue | null>(null)

export function BlogLocalImagesProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef(new Map<string, File>())

  const stageLocalImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    mapRef.current.set(url, file)
    return url
  }, [])

  const releaseLocalImage = useCallback((blobUrl: string) => {
    if (!blobUrl.startsWith('blob:')) return
    if (mapRef.current.has(blobUrl)) {
      mapRef.current.delete(blobUrl)
      URL.revokeObjectURL(blobUrl)
    }
  }, [])

  const resolveAndUpload = useCallback(async (html: string, token: string) => {
    const blobUrlsUsed = collectBlobImageSrcs(html)
    const out = await replaceBlobImagesInBlogHtml(html, token, mapRef.current)

    const revokePendingBlobs = () => {
      for (const u of blobUrlsUsed) {
        mapRef.current.delete(u)
        URL.revokeObjectURL(u)
      }
      for (const u of [...mapRef.current.keys()]) {
        URL.revokeObjectURL(u)
        mapRef.current.delete(u)
      }
    }

    return { html: out, revokePendingBlobs }
  }, [])

  const value: BlogLocalImagesContextValue = {
    stageLocalImage,
    releaseLocalImage,
    resolveAndUpload,
  }

  return (
    <BlogLocalImagesContext.Provider value={value}>{children}</BlogLocalImagesContext.Provider>
  )
}

export function useBlogLocalImages(): BlogLocalImagesContextValue {
  const ctx = useContext(BlogLocalImagesContext)
  if (!ctx) {
    throw new Error('useBlogLocalImages must be used within BlogLocalImagesProvider')
  }
  return ctx
}
