/**
 * Downloads an Innovation study export (Word / PowerPoint). A large study's
 * translation does not fit in one request: the API answers 202 "PREPARING"
 * (keeping every finished part) and this asks again until the file is ready.
 * Each request resumes the work, so nothing is ever translated twice.
 */
export interface ExportProgress { translated: number; total: number }

export const EXPORT_RETRY_MS = 3000
const MAX_WAIT_MS = 20 * 60 * 1000

export async function fetchStudyExport(
  url: string,
  token: string | null,
  opts: { onPreparing?: (p: ExportProgress) => void; retryMs?: number; maxWaitMs?: number; fallbackMessage?: string } = {},
): Promise<Blob> {
  const started = Date.now()
  const retryMs = opts.retryMs ?? EXPORT_RETRY_MS
  const maxWait = opts.maxWaitMs ?? MAX_WAIT_MS
  for (;;) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token || ''}` } })
    if (res.status === 202) {
      const body = await res.json().catch(() => ({}))
      opts.onPreparing?.({ translated: Number(body.translated) || 0, total: Number(body.total) || 0 })
      if (Date.now() - started > maxWait) throw new Error(opts.fallbackMessage || 'The export is taking longer than expected. Please try again later - the work done so far is kept.')
      await new Promise(resolve => setTimeout(resolve, retryMs))
      continue
    }
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(typeof error.message === 'string' ? error.message : opts.fallbackMessage || 'Export failed')
    }
    return res.blob()
  }
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
