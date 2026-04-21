import { useEffect, useState } from 'react'
import katex from 'katex'
import type { PrintableReportDocument, ReportBlock, ReportFact, ReportTexDownload } from '../lib/reportModels'

function renderMath(tex: string, displayMode = false) {
  return {
    __html: katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
    }),
  }
}

function FactValue({ fact }: { fact: ReportFact }) {
  if (fact.valueType === 'math') {
    return (
      <div
        className={`report-fact-value ${fact.displayMode ? 'is-display' : ''}`}
        dangerouslySetInnerHTML={renderMath(fact.value, fact.displayMode)}
      />
    )
  }

  return <p className="report-fact-value">{fact.value}</p>
}

function FactsGrid({ items }: { items: ReportFact[] }) {
  return (
    <div className="report-facts-grid">
      {items.map((item) => (
        <div className="report-fact-card" key={`${item.label}-${item.value}`}>
          <p className="report-fact-label">{item.label}</p>
          <FactValue fact={item} />
        </div>
      ))}
    </div>
  )
}

function ReportBlockView({ block }: { block: ReportBlock }) {
  if (block.type === 'paragraph') {
    return <p className="report-paragraph">{block.text}</p>
  }

  if (block.type === 'math') {
    return <div className="report-math" dangerouslySetInnerHTML={renderMath(block.tex, true)} />
  }

  if (block.type === 'facts') {
    return <FactsGrid items={block.items} />
  }

  if (block.type === 'list') {
    const ListTag = block.ordered === false ? 'ul' : 'ol'

    return (
      <ListTag className="report-list">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ListTag>
    )
  }

  return <div className={`report-note ${block.tone === 'warning' ? 'is-warning' : ''}`}>{block.text}</div>
}

function buildDownloadUrl(download: ReportTexDownload) {
  return download.apiBaseUrl
    ? new URL(download.endpoint, download.apiBaseUrl).toString()
    : download.endpoint
}

function buildHealthUrl(download: ReportTexDownload) {
  return download.apiBaseUrl
    ? new URL('/api/health', download.apiBaseUrl).toString()
    : '/api/health'
}

export function PrintableReportPage({ document }: { document: PrintableReportDocument }) {
  const appUrl = import.meta.env.BASE_URL
  const [texDownloadAvailable, setTexDownloadAvailable] = useState(false)
  const [texDownloadStatus, setTexDownloadStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [texDownloadMessage, setTexDownloadMessage] = useState('')

  useEffect(() => {
    if (!document.texDownload) {
      setTexDownloadAvailable(false)
      return
    }

    const controller = new AbortController()

    const checkTexBackend = async () => {
      try {
        const response = await fetch(buildHealthUrl(document.texDownload as ReportTexDownload), {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!controller.signal.aborted) {
          setTexDownloadAvailable(response.ok)
        }
      } catch {
        if (!controller.signal.aborted) {
          setTexDownloadAvailable(false)
        }
      }
    }

    void checkTexBackend()

    return () => {
      controller.abort()
    }
  }, [document.texDownload])

  const downloadTex = async () => {
    if (!document.texDownload) {
      return
    }

    setTexDownloadStatus('loading')
    setTexDownloadMessage('')

    try {
      const response = await fetch(buildDownloadUrl(document.texDownload), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document.texDownload.payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ error: 'No se pudo preparar el archivo .tex.' }))
        throw new Error(errorPayload.error ?? 'No se pudo preparar el archivo .tex.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.texDownload.filename
      link.click()
      URL.revokeObjectURL(url)
      setTexDownloadStatus('idle')
    } catch (error) {
      setTexDownloadStatus('error')
      setTexDownloadMessage(error instanceof Error ? error.message : 'No se pudo descargar el archivo .tex.')
    }
  }

  return (
    <main className="report-shell">
      <header className="report-hero">
        <div className="report-hero-copy">
          <p className="report-badge">{document.statusLabel}</p>
          <h1>{document.title}</h1>
          <p className="report-subtitle">{document.subtitle}</p>
          <p className="report-generated">Generado el {document.generatedAt}</p>
        </div>

        <div className="report-actions">
          <a className="report-link" href={appUrl}>
            Volver a la aplicación
          </a>
          {document.texDownload && texDownloadAvailable ? (
            <button className="report-link" type="button" onClick={downloadTex} disabled={texDownloadStatus === 'loading'}>
              {texDownloadStatus === 'loading' ? 'Preparando .tex...' : 'Descargar .tex'}
            </button>
          ) : null}
          <button className="report-print-button" type="button" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>

        {texDownloadMessage ? <p className="report-action-message">{texDownloadMessage}</p> : null}

        <FactsGrid items={document.highlights} />
      </header>

      <div className="report-layout">
        <aside className="report-sidebar">
          <section className="report-sidebar-card">
            <p className="report-sidebar-title">Contenido</p>
            <nav className="report-toc">
              {document.sections.map((item) => (
                <a href={`#${item.id}`} key={item.id}>
                  {item.title}
                </a>
              ))}
            </nav>
          </section>

          {document.closingFacts ? (
            <section className="report-sidebar-card">
              <p className="report-sidebar-title">Resumen final</p>
              <FactsGrid items={document.closingFacts} />
            </section>
          ) : null}
        </aside>

        <article className="report-article">
          {document.sections.map((item) => (
            <section className="report-section" id={item.id} key={item.id}>
              <div className="report-section-head">
                {item.eyebrow ? <p className="report-section-eyebrow">{item.eyebrow}</p> : null}
                <h2>{item.title}</h2>
                {item.summary ? <p className="report-section-summary">{item.summary}</p> : null}
              </div>

              <div className="report-section-body">
                {item.blocks.map((block, index) => (
                  <ReportBlockView block={block} key={`${item.id}-${block.type}-${index}`} />
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>
    </main>
  )
}

export function MissingReportPage() {
  const appUrl = import.meta.env.BASE_URL

  return (
    <main className="report-shell report-shell-missing">
      <header className="report-hero">
        <div className="report-hero-copy">
          <p className="report-badge">Informe no encontrado</p>
          <h1>No hay datos para esta página</h1>
          <p className="report-subtitle">
            Vuelve a la aplicación principal y genera el informe otra vez. Esta página necesita el contenido matemático almacenado por la vista principal.
          </p>
        </div>

        <div className="report-actions">
          <a className="report-link" href={appUrl}>
            Ir a la aplicación
          </a>
        </div>
      </header>
    </main>
  )
}