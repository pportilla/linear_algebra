import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './report.css'
import { MissingReportPage, PrintableReportPage } from './components/PrintableReportPage'
import { loadStoredReportDocument } from './lib/reportExport'

const reportId = new URLSearchParams(window.location.search).get('report')
const reportDocument = reportId ? loadStoredReportDocument(reportId) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>{reportDocument ? <PrintableReportPage document={reportDocument} /> : <MissingReportPage />}</StrictMode>,
)