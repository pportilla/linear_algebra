import { buildAffineReportDocument, buildLinearReportDocument } from './reportContent'
import type {
  AffineReportInput,
  LinearReportInput,
  PrintableReportDocument,
  StoredReportRecord,
} from './reportModels'

const REPORT_STORAGE_PREFIX = 'linear-algebra:report:'
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
  const reportWindow = window.open(reportUrl(reportId), '_blank', 'noopener')

  if (!reportWindow) {
    throw new Error('El navegador bloqueó la nueva pestaña del informe. Permite pop-ups para abrir la vista matemática imprimible.')
  }
}

export function openLinearPrintableReport(input: LinearReportInput) {
  openReportPage(buildLinearReportDocument(input))
}

export function openAffinePrintableReport(input: AffineReportInput) {
  openReportPage(buildAffineReportDocument(input))
}

export function loadStoredReportDocument(reportId: string) {
  const storage = getStorage()

  if (!storage) {
    return null
  }

  const record = parseStoredRecord(storage, `${REPORT_STORAGE_PREFIX}${reportId}`)
  return record?.document ?? null
}