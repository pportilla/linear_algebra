import { useEffect, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './App.css'
import { CartesianPlane } from './components/CartesianPlane'
import {
  applyAffine,
  canonicalizeAffineMap,
  classifyLinearMap,
  formatMatrixEntry,
  isAffineConfigurationValid,
  linearMapFromBasis,
  matrixToRows,
  pointAreaTwice,
  subtractVectors,
} from './lib/math2d'
import { openAffinePrintableReport, openLinearPrintableReport } from './lib/reportExport'
import type { LinearPointId, PointId, Vec2 } from './lib/math2d'

const initialLinearPoints: Record<LinearPointId, Vec2> = {
  b1: { x: 2, y: 0.5 },
  b2: { x: -0.75, y: 2.25 },
  tb1: { x: 2.75, y: 1.25 },
  tb2: { x: -1.5, y: 2 },
}

const initialAffineSource: Record<'p0' | 'p1' | 'p2', Vec2> = {
  p0: { x: -2.5, y: -1.5 },
  p1: { x: 1.25, y: -1 },
  p2: { x: -1, y: 2.5 },
}

const initialAffineImages: Record<'q0' | 'q1' | 'q2', Vec2> = {
  q0: { x: -1, y: 1 },
  q1: { x: 2.25, y: 1.25 },
  q2: { x: -0.25, y: 3.25 },
}

type TabId = 'lineal' | 'afin'

function renderMath(tex: string) {
  return {
    __html: katex.renderToString(tex, {
      throwOnError: false,
      strict: 'ignore',
    }),
  }
}

function MathText({ tex, ariaLabel, className }: { tex: string; ariaLabel: string; className?: string }) {
  return <span className={className} aria-label={ariaLabel} dangerouslySetInnerHTML={renderMath(tex)} />
}

function MatrixBlock({ title, rows }: { title: string; rows: number[][] }) {
  return (
    <div className="matrix-block">
      <span className="eyebrow">{title}</span>
      <div className="matrix-grid" aria-label={title}>
        {rows.map((row, rowIndex) => (
          <div className="matrix-row" key={`${title}-${rowIndex}`}>
            {row.map((value, valueIndex) => (
              <span key={`${title}-${rowIndex}-${valueIndex}`}>{formatMatrixEntry(value)}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function CoordinateCard({
  label,
  point,
  isActive,
  onFocus,
  onChange,
}: {
  label: string
  point: Vec2
  isActive: boolean
  onFocus: () => void
  onChange: (next: Vec2) => void
}) {
  return (
    <div className={`coordinate-card ${isActive ? 'is-active' : ''}`} onClick={onFocus}>
      <div className="coordinate-fields">
        <button type="button" className="coordinate-name" onClick={onFocus}>
          {label}
        </button>
        <label className="coordinate-input">
          <span>x</span>
          <input
            type="number"
            step="0.25"
            value={point.x}
            onFocus={onFocus}
            onChange={(event) => onChange({ x: Number(event.target.value), y: point.y })}
          />
        </label>
        <label className="coordinate-input">
          <span>y</span>
          <input
            type="number"
            step="0.25"
            value={point.y}
            onFocus={onFocus}
            onChange={(event) => onChange({ x: point.x, y: Number(event.target.value) })}
          />
        </label>
      </div>
    </div>
  )
}

function App() {
  const pdfApiBaseUrl = (import.meta.env.VITE_PDF_API_BASE_URL ?? '').trim()
  const localHostname = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const [hasServerPdfExport, setHasServerPdfExport] = useState(() => pdfApiBaseUrl.length > 0 || localHostname)

  const [activeTab, setActiveTab] = useState<TabId>('lineal')
  const [linearPoints, setLinearPoints] = useState<Record<LinearPointId, Vec2>>(initialLinearPoints)
  const [activeLinearPoint, setActiveLinearPoint] = useState<LinearPointId>('b1')
  const [linearPdfStatus, setLinearPdfStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [linearPdfMessage, setLinearPdfMessage] = useState('')

  const [affineSource, setAffineSource] = useState<Record<'p0' | 'p1' | 'p2', Vec2>>(initialAffineSource)
  const [affineImages, setAffineImages] = useState<Record<'q0' | 'q1' | 'q2', Vec2>>(initialAffineImages)
  const [activeAffinePoint, setActiveAffinePoint] = useState<PointId>('p0')
  const [affinePdfStatus, setAffinePdfStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [affinePdfMessage, setAffinePdfMessage] = useState('')

  const linearData = linearMapFromBasis(linearPoints.b1, linearPoints.b2, linearPoints.tb1, linearPoints.tb2)
  const linearAnalysis = linearData ? classifyLinearMap(linearData.matrix) : null
  const affineDraftValid = isAffineConfigurationValid(affineSource.p0, affineSource.p1, affineSource.p2)
  const affineDraftArea = pointAreaTwice(affineSource.p0, affineSource.p1, affineSource.p2)
  const affineSide1 = subtractVectors(affineSource.p1, affineSource.p0)
  const affineSide2 = subtractVectors(affineSource.p2, affineSource.p0)
  const affineAnalysis = affineDraftValid ? canonicalizeAffineMap(affineSource, affineImages) : null

  useEffect(() => {
    if (pdfApiBaseUrl.length > 0) {
      return undefined
    }

    const controller = new AbortController()

    const checkPdfServer = async () => {
      try {
        const response = await fetch('/api/health', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!controller.signal.aborted) {
          setHasServerPdfExport(response.ok)
        }
      } catch {
        if (!controller.signal.aborted) {
          setHasServerPdfExport(false)
        }
      }
    }

    void checkPdfServer()

    return () => {
      controller.abort()
    }
  }, [pdfApiBaseUrl])

  const getPdfEndpoint = (path: string) => {
    if (!pdfApiBaseUrl) {
      return path
    }

    return new URL(path, pdfApiBaseUrl).toString()
  }

  const updateLinearPoint = (target: LinearPointId, point: Vec2) => {
    setLinearPoints((current) => ({ ...current, [target]: point }))
  }

  const updateAffinePoint = (target: PointId, point: Vec2) => {
    if (target.startsWith('p')) {
      setAffineSource((current) => ({ ...current, [target]: point }))
      return
    }
    setAffineImages((current) => ({ ...current, [target]: point }))
  }

  const resetLinearState = () => {
    setLinearPoints(initialLinearPoints)
    setActiveLinearPoint('b1')
    setLinearPdfStatus('idle')
    setLinearPdfMessage('')
  }

  const resetAffineState = () => {
    setAffineSource(initialAffineSource)
    setAffineImages(initialAffineImages)
    setActiveAffinePoint('p0')
    setAffinePdfStatus('idle')
    setAffinePdfMessage('')
  }

  const downloadLinearPdf = async () => {
    if (!linearData) {
      setLinearPdfStatus('error')
      setLinearPdfMessage('La base elegida no es válida. Debe estar formada por dos vectores linealmente independientes.')
      return
    }

    if (!hasServerPdfExport) {
      try {
        await openLinearPrintableReport({ linearPoints, linearData, linearAnalysis })
        setLinearPdfStatus('idle')
        setLinearPdfMessage('')
      } catch (error) {
        setLinearPdfStatus('error')
        setLinearPdfMessage(error instanceof Error ? error.message : 'No se pudo abrir el informe imprimible.')
      }
      return
    }

    setLinearPdfStatus('loading')
    setLinearPdfMessage('')

    try {
      const response = await fetch(getPdfEndpoint('/api/linear-pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basis: { b1: linearPoints.b1, b2: linearPoints.b2 },
          imageBasis: { tb1: linearPoints.tb1, tb2: linearPoints.tb2 },
          matrix: linearData.matrix,
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ error: 'No se pudo generar el PDF lineal.' }))
        throw new Error(errorPayload.error ?? 'No se pudo generar el PDF lineal.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'forma-jordan-r2-detallada.pdf'
      link.click()
      URL.revokeObjectURL(url)
      setLinearPdfStatus('idle')
    } catch (error) {
      setLinearPdfStatus('error')
      setLinearPdfMessage(error instanceof Error ? error.message : 'No se pudo generar el PDF lineal.')
    }
  }

  const downloadAffinePdf = async () => {
    if (!affineDraftValid) {
      setAffinePdfStatus('error')
      setAffinePdfMessage('Los puntos origen no son afínmente independientes. Corrige p0, p1 y p2 antes de generar el PDF.')
      return
    }

    if (!hasServerPdfExport) {
      try {
        await openAffinePrintableReport({
          affineSource,
          affineImages,
          affineDraftValid,
          affineDraftArea,
          affineAnalysis,
        })
        setAffinePdfStatus('idle')
        setAffinePdfMessage('')
      } catch (error) {
        setAffinePdfStatus('error')
        setAffinePdfMessage(error instanceof Error ? error.message : 'No se pudo abrir el informe imprimible.')
      }
      return
    }

    setAffinePdfStatus('loading')
    setAffinePdfMessage('')

    try {
      const response = await fetch(getPdfEndpoint('/api/affine-pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: affineSource, image: affineImages }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ error: 'No se pudo generar el PDF afín.' }))
        throw new Error(errorPayload.error ?? 'No se pudo generar el PDF afín.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'forma-normal-afin-detallada.pdf'
      link.click()
      URL.revokeObjectURL(url)
      setAffinePdfStatus('idle')
    } catch (error) {
      setAffinePdfStatus('error')
      setAffinePdfMessage(error instanceof Error ? error.message : 'No se pudo generar el PDF afín.')
    }
  }

  const canonicalLinearItems = linearAnalysis
    ? [
        { id: 'u1', label: 'u1', point: { x: 1, y: 0 }, color: '#62656d', kind: 'vector' as const, lineDash: '7 6' },
        { id: 'u2', label: 'u2', point: { x: 0, y: 1 }, color: '#8f949e', kind: 'vector' as const, lineDash: '7 6' },
        { id: 'ju1', label: 'J(u1)', point: { x: linearAnalysis.canonicalMatrix[0][0], y: linearAnalysis.canonicalMatrix[1][0] }, color: '#b55233', kind: 'vector' as const },
        { id: 'ju2', label: 'J(u2)', point: { x: linearAnalysis.canonicalMatrix[0][1], y: linearAnalysis.canonicalMatrix[1][1] }, color: '#127b75', kind: 'vector' as const },
      ]
    : [
        { id: 'u1', label: 'u1', point: { x: 1, y: 0 }, color: '#62656d', kind: 'vector' as const, lineDash: '7 6' },
        { id: 'u2', label: 'u2', point: { x: 0, y: 1 }, color: '#8f949e', kind: 'vector' as const, lineDash: '7 6' },
      ]

  const canonicalAffineImages = affineAnalysis
    ? [
        { id: 'cp0', label: 'F(O)', point: applyAffine(affineAnalysis.canonicalLinearPart, affineAnalysis.canonicalTranslation, { x: 0, y: 0 }), color: '#dd8b18' },
        { id: 'cp1', label: 'F(e1)', point: applyAffine(affineAnalysis.canonicalLinearPart, affineAnalysis.canonicalTranslation, { x: 1, y: 0 }), color: '#309f69' },
        { id: 'cp2', label: 'F(e2)', point: applyAffine(affineAnalysis.canonicalLinearPart, affineAnalysis.canonicalTranslation, { x: 0, y: 1 }), color: '#5b48a3' },
      ]
    : []

  const affineFixedSetItems =
    affineAnalysis?.fixedSet.kind === 'point' && affineAnalysis.fixedSet.point
      ? [{ id: 'fixed-source', label: 'P fijo', point: affineAnalysis.fixedSet.point, color: '#c62828', kind: 'point' as const, interactive: false }]
      : []

  const affineFixedSetOverlays =
    affineAnalysis?.fixedSet.kind === 'line' && affineAnalysis.fixedSet.anchor && affineAnalysis.fixedSet.direction
      ? [{ id: 'fixed-line-source', kind: 'line' as const, anchor: affineAnalysis.fixedSet.anchor, direction: affineAnalysis.fixedSet.direction, color: '#c62828', label: 'Recta fija' }]
      : affineAnalysis?.fixedSet.kind === 'plane'
        ? [{ id: 'fixed-plane-source', kind: 'plane' as const, color: 'rgba(198, 40, 40, 0.12)', label: 'Todo ℝ² es fijo' }]
        : []

  const canonicalFixedSetItems =
    affineAnalysis?.canonicalFixedSet.kind === 'point' && affineAnalysis.canonicalFixedSet.point
      ? [{ id: 'fixed-canonical', label: 'P fijo', point: affineAnalysis.canonicalFixedSet.point, color: '#c62828', kind: 'point' as const, interactive: false }]
      : []

  const canonicalFixedSetOverlays =
    affineAnalysis?.canonicalFixedSet.kind === 'line' && affineAnalysis.canonicalFixedSet.anchor && affineAnalysis.canonicalFixedSet.direction
      ? [{ id: 'fixed-line-canonical', kind: 'line' as const, anchor: affineAnalysis.canonicalFixedSet.anchor, direction: affineAnalysis.canonicalFixedSet.direction, color: '#c62828', label: 'Recta fija' }]
      : affineAnalysis?.canonicalFixedSet.kind === 'plane'
        ? [{ id: 'fixed-plane-canonical', kind: 'plane' as const, color: 'rgba(198, 40, 40, 0.12)', label: 'Todo ℝ² es fijo' }]
        : []

  return (
    <main className="app-shell">
      <header className="hero-panel">
        <div>
          <h1 className="hero-title">
            <span>Transformaciones de</span>{' '}
            <span aria-label="R cuadrado" dangerouslySetInnerHTML={renderMath('\\mathbb{R}^2')} />
          </h1>
          <p className="hero-copy">
            Aplicaciones lineales y afines, forma canónica y puntos fijos en <MathText tex={"\\mathbb{R}^2"} ariaLabel="R cuadrado" />.
          </p>
        </div>
      </header>

      <section className="tabs-card">
        <div className="tabs-row" role="tablist" aria-label="Secciones principales">
          <button type="button" role="tab" aria-selected={activeTab === 'lineal'} className={`tab-button ${activeTab === 'lineal' ? 'is-selected' : ''}`} onClick={() => setActiveTab('lineal')}>
            Lineal
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'afin'} className={`tab-button ${activeTab === 'afin' ? 'is-selected' : ''}`} onClick={() => setActiveTab('afin')}>
            Afín
          </button>
        </div>
      </section>

      {activeTab === 'lineal' ? (
        <section className="module-card">
          <div className="module-head">
            <div>
              <span className="eyebrow">Aplicación lineal</span>
              <h2>
                Determinación por una base de <MathText tex={"\\mathbb{R}^2"} ariaLabel="R cuadrado" />
              </h2>
            </div>
            <div className="actions-row">
              <button type="button" className="ghost-button" onClick={resetLinearState}>
                Restablecer ejemplo
              </button>
              <button type="button" className="secondary-button" onClick={downloadLinearPdf} disabled={linearPdfStatus === 'loading'}>
                {linearPdfStatus === 'loading'
                  ? 'Generando PDF...'
                  : hasServerPdfExport
                    ? 'Generar PDF detallado'
                    : 'Abrir informe detallado'}
              </button>
            </div>
          </div>

          <div className="module-layout">
            <aside className="control-panel">
              <div className="group-card">
                <span className="eyebrow">Base</span>
                <CoordinateCard label="b1" point={linearPoints.b1} isActive={activeLinearPoint === 'b1'} onFocus={() => setActiveLinearPoint('b1')} onChange={(point) => updateLinearPoint('b1', point)} />
                <CoordinateCard label="b2" point={linearPoints.b2} isActive={activeLinearPoint === 'b2'} onFocus={() => setActiveLinearPoint('b2')} onChange={(point) => updateLinearPoint('b2', point)} />
              </div>
              <div className="group-card">
                <span className="eyebrow">Imagen de la base</span>
                <CoordinateCard label="T(b1)" point={linearPoints.tb1} isActive={activeLinearPoint === 'tb1'} onFocus={() => setActiveLinearPoint('tb1')} onChange={(point) => updateLinearPoint('tb1', point)} />
                <CoordinateCard label="T(b2)" point={linearPoints.tb2} isActive={activeLinearPoint === 'tb2'} onFocus={() => setActiveLinearPoint('tb2')} onChange={(point) => updateLinearPoint('tb2', point)} />
              </div>
              <div className={`summary-card ${linearData ? '' : 'warning-card'}`}>
                <span className="eyebrow">Validez de la base</span>
                <p>Determinante de la base: <strong>{formatMatrixEntry(linearData?.basisDeterminant ?? 0)}</strong></p>
                <p>
                  {linearData ? 'La base es válida y determina una única aplicación lineal.' : 'Los vectores b1 y b2 son dependientes. Ajusta la base para poder reconstruir la aplicación.'}
                </p>
              </div>
              {linearPdfMessage ? <p className="error-text">{linearPdfMessage}</p> : null}
            </aside>

            <div className="visual-panel">
              <div className="plane-stack">
                <CartesianPlane
                  title={
                    <>
                      <span>Aplicación lineal en </span>
                      <MathText tex={"\\mathbb{R}^2"} ariaLabel="R cuadrado" />
                    </>
                  }
                  subtitle="Base elegida y sus imágenes."
                  ariaLabel="Aplicación lineal en R cuadrado"
                  range={5}
                  activeId={activeLinearPoint}
                  onActivate={(id) => setActiveLinearPoint(id as LinearPointId)}
                  onChange={(id, point) => updateLinearPoint(id as LinearPointId, point)}
                  items={[
                    { id: 'b1', label: 'b1', point: linearPoints.b1, color: '#62656d', kind: 'vector', lineDash: '7 6' },
                    { id: 'b2', label: 'b2', point: linearPoints.b2, color: '#8f949e', kind: 'vector', lineDash: '7 6' },
                    { id: 'tb1', label: 'T(b1)', point: linearPoints.tb1, color: '#b55233', kind: 'vector' },
                    { id: 'tb2', label: 'T(b2)', point: linearPoints.tb2, color: '#127b75', kind: 'vector' },
                  ]}
                />
                <CartesianPlane
                  title={
                    <>
                      <span>Forma canónica en </span>
                      <MathText tex={"\\mathbb{R}^2"} ariaLabel="R cuadrado" />
                    </>
                  }
                  subtitle={linearAnalysis ? 'Representación en la base estándar.' : 'La base elegida no forma una base de ℝ².'}
                  ariaLabel="Forma canónica lineal en R cuadrado"
                  range={5}
                  items={canonicalLinearItems}
                />
              </div>

              {linearData ? (
                <div className="results-grid linear-results-grid">
                  <MatrixBlock title="Matriz de A" rows={matrixToRows(linearData.matrix)} />
                  <MatrixBlock title={linearAnalysis?.canonicalTitle ?? 'Forma canónica'} rows={matrixToRows(linearAnalysis?.canonicalMatrix ?? [[1, 0], [0, 1]])} />
                </div>
              ) : null}

              <div className="steps-card">
                <span className="eyebrow">Clasificación lineal</span>
                <h3>{linearAnalysis ? linearAnalysis.caseLabel : 'Base no válida'}</h3>
                <p>
                  {linearAnalysis ? linearAnalysis.shortText : 'La aplicación lineal queda indeterminada mientras b1 y b2 no formen una base de ℝ².'}
                </p>
                <ol>
                  {linearAnalysis
                    ? linearAnalysis.steps.map((step) => <li key={step}>{step}</li>)
                    : [
                        'Primero se comprueba si los vectores b1 y b2 forman una base de R².',
                        'Eso equivale a pedir que el determinante de la matriz [b1 b2] no sea nulo.',
                        'Si el determinante es nulo, no existe una única aplicación lineal que cumpla simultáneamente los datos fijados.',
                      ].map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="module-card">
          <div className="module-head">
            <div>
              <span className="eyebrow">Aplicación afín</span>
              <h2>
                Determinación por tres puntos de <MathText tex={"\\mathbb{R}^2"} ariaLabel="R cuadrado" />
              </h2>
            </div>
            <div className="actions-row">
              <button type="button" className="ghost-button" onClick={resetAffineState}>
                Restablecer ejemplo
              </button>
              <button type="button" className="secondary-button" onClick={downloadAffinePdf} disabled={affinePdfStatus === 'loading'}>
                {affinePdfStatus === 'loading'
                  ? 'Generando PDF...'
                  : hasServerPdfExport
                    ? 'Generar PDF detallado'
                    : 'Abrir informe detallado'}
              </button>
            </div>
          </div>

          <div className="module-layout">
            <aside className="control-panel">
              <div className="group-card">
                <span className="eyebrow">Puntos origen</span>
                {(['p0', 'p1', 'p2'] as const).map((id) => (
                  <CoordinateCard key={id} label={id.toUpperCase()} point={affineSource[id]} isActive={activeAffinePoint === id} onFocus={() => setActiveAffinePoint(id)} onChange={(point) => updateAffinePoint(id, point)} />
                ))}
              </div>
              <div className="group-card">
                <span className="eyebrow">Imágenes</span>
                {(['q0', 'q1', 'q2'] as const).map((id) => (
                  <CoordinateCard key={id} label={id.toUpperCase()} point={affineImages[id]} isActive={activeAffinePoint === id} onFocus={() => setActiveAffinePoint(id)} onChange={(point) => updateAffinePoint(id, point)} />
                ))}
              </div>
              <div className={`summary-card ${affineDraftValid ? '' : 'warning-card'}`}>
                <span className="eyebrow">Comprobación de independencia afín</span>
                <p>Área orientada doble del triángulo origen: <strong>{formatMatrixEntry(affineDraftArea)}</strong></p>
                <p>
                  Cálculo: ({formatMatrixEntry(affineSide1.x)}, {formatMatrixEntry(affineSide1.y)}) ∧ ({formatMatrixEntry(affineSide2.x)}, {formatMatrixEntry(affineSide2.y)}) = {formatMatrixEntry(affineSide1.x)} · {formatMatrixEntry(affineSide2.y)} - {formatMatrixEntry(affineSide1.y)} · {formatMatrixEntry(affineSide2.x)}.
                </p>
                <p>Área geométrica del triángulo: <strong>{formatMatrixEntry(Math.abs(affineDraftArea) / 2)}</strong></p>
                <p>{affineDraftValid ? 'Los puntos origen son afínmente independientes y determinan una única aplicación afín.' : 'El triángulo origen es degenerado. Ajusta p0, p1 y p2.'}</p>
              </div>
              {affinePdfMessage ? <p className="error-text">{affinePdfMessage}</p> : null}
            </aside>

            <div className="visual-panel">
              <div className="plane-stack">
                <CartesianPlane
                  title={
                    <>
                      <span>Aplicación afín en </span>
                      <MathText tex={"\\mathbb{R}^2"} ariaLabel="R cuadrado" />
                    </>
                  }
                  subtitle="Tres puntos origen y sus imágenes."
                  ariaLabel="Aplicación afín en R cuadrado"
                  range={5}
                  activeId={activeAffinePoint}
                  onActivate={(id) => setActiveAffinePoint(id as PointId)}
                  onChange={(id, point) => updateAffinePoint(id as PointId, point)}
                  items={[
                    { id: 'p0', label: 'p0', point: affineSource.p0, color: '#b55233', kind: 'point' },
                    { id: 'p1', label: 'p1', point: affineSource.p1, color: '#127b75', kind: 'point' },
                    { id: 'p2', label: 'p2', point: affineSource.p2, color: '#2457a6', kind: 'point' },
                    { id: 'q0', label: 'q0', point: affineImages.q0, color: '#dd8b18', kind: 'point' },
                    { id: 'q1', label: 'q1', point: affineImages.q1, color: '#309f69', kind: 'point' },
                    { id: 'q2', label: 'q2', point: affineImages.q2, color: '#5b48a3', kind: 'point' },
                    ...affineFixedSetItems,
                  ]}
                  overlays={affineFixedSetOverlays}
                  polygons={[
                    { id: 'source', color: 'rgba(18, 123, 117, 0.15)', points: [affineSource.p0, affineSource.p1, affineSource.p2] },
                    { id: 'image', color: 'rgba(181, 82, 51, 0.12)', points: [affineImages.q0, affineImages.q1, affineImages.q2] },
                  ]}
                />
                <CartesianPlane
                  title={
                    <>
                      <span>Forma normal en </span>
                      <MathText tex={"\\mathbb{R}^2"} ariaLabel="R cuadrado" />
                    </>
                  }
                  subtitle={affineAnalysis ? 'Imágenes de O, e1 y e2 en la base estándar.' : 'Los tres puntos origen están alineados.'}
                  ariaLabel="Forma normal afín en R cuadrado"
                  range={5}
                  items={[
                    { id: 's0', label: 'O', point: { x: 0, y: 0 }, color: '#b55233', kind: 'point' },
                    { id: 's1', label: 'e1', point: { x: 1, y: 0 }, color: '#127b75', kind: 'point' },
                    { id: 's2', label: 'e2', point: { x: 0, y: 1 }, color: '#2457a6', kind: 'point' },
                    ...canonicalAffineImages.map((item) => ({ ...item, kind: 'point' as const })),
                    ...canonicalFixedSetItems,
                  ]}
                  overlays={canonicalFixedSetOverlays}
                  polygons={
                    affineAnalysis
                      ? [
                          { id: 'std', color: 'rgba(18, 123, 117, 0.14)', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
                          { id: 'canon', color: 'rgba(181, 82, 51, 0.12)', points: canonicalAffineImages.map((item) => item.point) },
                        ]
                      : []
                  }
                />
              </div>

              {affineAnalysis ? (
                <div className="results-grid results-grid-affine">
                  <MatrixBlock title="Matriz homogénea de F" rows={affineAnalysis.sourceHomogeneous} />
                  <MatrixBlock title="Forma normal afín" rows={affineAnalysis.canonicalHomogeneous} />
                </div>
              ) : null}

              <div className="steps-card">
                <span className="eyebrow">Clasificación afín</span>
                <h3>{affineAnalysis ? affineAnalysis.caseLabel : 'Datos afines no válidos'}</h3>
                <p>{affineAnalysis ? affineAnalysis.shortText : 'La clasificación afín requiere que p0, p1 y p2 formen una referencia afín de ℝ².'}</p>
                <ol>
                  {affineAnalysis
                    ? affineAnalysis.steps.map((step) => <li key={step}>{step}</li>)
                    : [
                        'Se empieza comprobando que p0, p1 y p2 no estén alineados.',
                        'Esa condición garantiza que forman una referencia afín de R².',
                        'Sólo en ese caso se puede reconstruir de forma única la aplicación afín que envía cada punto origen a su imagen.',
                      ].map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
