import type { AffineAnalysis, ConicAnalysis, ConicCoefficients, LinearAnalysis, LinearMapData, Vec2 } from './math2d'

export interface LinearReportInput {
  linearPoints: {
    b1: Vec2
    b2: Vec2
    tb1: Vec2
    tb2: Vec2
  }
  linearData: LinearMapData | null
  linearAnalysis: LinearAnalysis | null
}

export interface AffineReportInput {
  affineSource: {
    p0: Vec2
    p1: Vec2
    p2: Vec2
  }
  affineImages: {
    q0: Vec2
    q1: Vec2
    q2: Vec2
  }
  affineDraftValid: boolean
  affineDraftArea: number
  affineAnalysis: AffineAnalysis | null
}

export interface ConicReportInput {
  conicCoefficients: ConicCoefficients
  conicAnalysis: ConicAnalysis
  normalMode: 'affine' | 'euclidean'
}

export interface ReportFact {
  label: string
  labelType?: 'text' | 'math'
  value: string
  valueType?: 'text' | 'math'
  displayMode?: boolean
}

export type ReportBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'math'; tex: string }
  | { type: 'facts'; items: ReportFact[] }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'note'; text: string; tone?: 'info' | 'warning' }

export interface ReportSection {
  id: string
  eyebrow?: string
  title: string
  summary?: string
  blocks: ReportBlock[]
}

export interface PrintableReportDocument {
  kind: 'linear' | 'affine' | 'conic'
  title: string
  subtitle: string
  statusLabel: string
  generatedAt: string
  highlights: ReportFact[]
  sections: ReportSection[]
  closingFacts?: ReportFact[]
  texDownload?: ReportTexDownload
}

export interface StoredReportRecord {
  savedAt: number
  document: PrintableReportDocument
}

export interface ReportTexDownload {
  filename: string
  content: string
}
