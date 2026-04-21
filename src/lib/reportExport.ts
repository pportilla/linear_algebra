import { buildAffineReportDocument, buildLinearReportDocument } from './reportContent'
import { buildAffineTex, buildLinearTex } from './reportTex'
import type {
  AffineReportInput,
  LinearReportInput,
  PrintableReportDocument,
  ReportTexDownload,
  StoredReportRecord,
} from './reportModels'

const REPORT_STORAGE_PREFIX = 'linear-algebra:report:v3:'
const REPORT_QUERY_PARAM = 'report'
const MAX_STORED_REPORTS = 12
const REPORT_RETENTION_MS = 1000 * 60 * 60 * 24 * 3

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function createReportId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function parseStoredRecord(storage: Storage, key: string) {
  try {
    const raw = storage.getItem(key)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as StoredReportRecord

    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.document) {
      storage.removeItem(key)
      return null
    }

    return parsed
  } catch {
    storage.removeItem(key)
    return null
  }
}

function pruneStoredReports(storage: Storage) {
  const now = Date.now()
  const candidates: Array<{ key: string; savedAt: number }> = []

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)

    if (!key || !key.startsWith(REPORT_STORAGE_PREFIX)) {
      continue
    }

    const record = parseStoredRecord(storage, key)

    if (!record) {
      continue
    }

    if (now - record.savedAt > REPORT_RETENTION_MS) {
      storage.removeItem(key)
      continue
    }

    candidates.push({ key, savedAt: record.savedAt })
  }

  candidates.sort((left, right) => right.savedAt - left.savedAt)

  for (const stale of candidates.slice(MAX_STORED_REPORTS)) {
    storage.removeItem(stale.key)
  }
}

function storeReportDocument(document: PrintableReportDocument) {
  const storage = getStorage()

  if (!storage) {
    throw new Error('El navegador no permite almacenar el informe. Revisa la configuracion del almacenamiento local e intentalo de nuevo.')
  }

  const reportId = createReportId()
  const storageKey = `${REPORT_STORAGE_PREFIX}${reportId}`
  const record: StoredReportRecord = {
    savedAt: Date.now(),
    document,
  }

  storage.setItem(storageKey, JSON.stringify(record))
  pruneStoredReports(storage)

  return reportId
}

function reportUrl(reportId: string) {
  const url = new URL(`${import.meta.env.BASE_URL}report.html`, window.location.origin)
  url.searchParams.set(REPORT_QUERY_PARAM, reportId)
  return url.toString()
}

function openReportPage(document: PrintableReportDocument) {
  const reportId = storeReportDocument(document)
  const url = reportUrl(reportId)
  const link = window.document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  window.document.body.appendChild(link)
  link.click()
  window.document.body.removeChild(link)
}

function withTexDownload(document: PrintableReportDocument, texDownload?: ReportTexDownload) {
  if (!texDownload) {
    return document
  }

  return { ...document, texDownload }
}

export function openLinearPrintableReport(input: LinearReportInput) {
  const document = buildLinearReportDocument(input)
  const texDownload =
    input.linearData && input.linearAnalysis
      ? {
          filename: 'forma-jordan-r2-detallada.tex',
          content: buildLinearTex({
            basis: { b1: input.linearPoints.b1, b2: input.linearPoints.b2 },
            imageBasis: { tb1: input.linearPoints.tb1, tb2: input.linearPoints.tb2 },
          }),
        }
      : undefined

  openReportPage(withTexDownload(document, texDownload))
}

export function openAffinePrintableReport(input: AffineReportInput) {
  const document = buildAffineReportDocument(input)
  const texDownload =
    input.affineDraftValid && input.affineAnalysis
      ? {
          filename: 'forma-normal-afin-detallada.tex',
          content: buildAffineTex({
            source: input.affineSource,
            image: input.affineImages,
          }),
        }
      : undefined

  openReportPage(withTexDownload(document, texDownload))
}

export function loadStoredReportDocument(reportId: string) {
  const storage = getStorage()

  if (!storage) {
    return null
  }

  const record = parseStoredRecord(storage, `${REPORT_STORAGE_PREFIX}${reportId}`)
  return record?.document ?? null
}