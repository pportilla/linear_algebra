import type { AffineAnalysis, LinearAnalysis, LinearMapData, Vec2 } from './math2d'
import { formatMatrixEntry } from './math2d'

interface LinearReportInput {
  linearPoints: {
    b1: Vec2
    b2: Vec2
    tb1: Vec2
    tb2: Vec2
  }
  linearData: LinearMapData | null
  linearAnalysis: LinearAnalysis | null
}

interface AffineReportInput {
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatVector(vector: Vec2) {
  return `(${formatMatrixEntry(vector.x)}, ${formatMatrixEntry(vector.y)})`
}

function renderMatrix(matrix: number[][]) {
  const rows = matrix
    .map(
      (row) =>
        `<tr>${row
          .map((entry) => `<td>${escapeHtml(formatMatrixEntry(entry))}</td>`)
          .join('')}</tr>`,
    )
    .join('')

  return `<table class="matrix"><tbody>${rows}</tbody></table>`
}

function renderDefinitionList(entries: Array<{ label: string; value: string }>) {
  return `<dl class="facts">${entries
    .map(
      ({ label, value }) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join('')}</dl>`
}

function renderSteps(steps: string[]) {
  return `<ol class="steps">${steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join('')}</ol>`
}

function buildDocument(title: string, subtitle: string, sections: string[]) {
  const generatedAt = new Date().toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #1d2936;
        --muted: #5b6470;
        --paper: #fffdf8;
        --panel: #fff8ef;
        --border: rgba(29, 41, 54, 0.14);
        --accent: #127b75;
        --accent-alt: #b55233;
      }

      * {
        box-sizing: border-box;
      }

      @page {
        margin: 16mm;
      }

      body {
        margin: 0;
        font: 400 16px/1.5 "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background: var(--paper);
      }

      main {
        width: min(960px, 100%);
        margin: 0 auto;
        padding: 24px;
      }

      header {
        margin-bottom: 24px;
        padding: 24px;
        border: 1px solid var(--border);
        border-radius: 20px;
        background:
          radial-gradient(circle at top right, rgba(181, 82, 51, 0.12), transparent 30%),
          radial-gradient(circle at top left, rgba(18, 123, 117, 0.12), transparent 32%),
          var(--panel);
      }

      h1,
      h2 {
        margin: 0;
        font-family: "Iowan Old Style", Georgia, serif;
      }

      h1 {
        font-size: 2rem;
      }

      h2 {
        font-size: 1.2rem;
        margin-bottom: 12px;
      }

      p {
        margin: 0;
      }

      .lede {
        margin-top: 12px;
        color: var(--muted);
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 16px;
      }

      .print-button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        color: #fffaf0;
        background: linear-gradient(135deg, var(--accent), var(--accent-alt));
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .toolbar-note {
        color: var(--muted);
        font-size: 0.95rem;
        align-self: center;
      }

      section {
        margin-bottom: 18px;
        padding: 18px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: #ffffff;
      }

      .facts {
        display: grid;
        gap: 10px;
        margin: 0;
      }

      .facts div {
        display: grid;
        gap: 4px;
      }

      .facts dt {
        color: var(--muted);
        font-weight: 600;
      }

      .facts dd {
        margin: 0;
        font-family: "IBM Plex Mono", Consolas, monospace;
      }

      .matrix-group {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .matrix-card {
        padding: 14px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--panel);
      }

      .matrix-title {
        margin-bottom: 10px;
        color: var(--muted);
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .matrix {
        border-collapse: separate;
        border-spacing: 6px;
      }

      .matrix td {
        min-width: 52px;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 10px;
        text-align: center;
        font-family: "IBM Plex Mono", Consolas, monospace;
        background: rgba(255, 255, 255, 0.94);
      }

      .steps {
        margin: 0;
        padding-left: 20px;
      }

      .steps li + li {
        margin-top: 8px;
      }

      .warning {
        color: #9f2d25;
        font-weight: 600;
      }

      @media print {
        body {
          background: #fff;
        }

        main {
          width: 100%;
          padding: 0;
        }

        .toolbar {
          display: none;
        }

        section,
        header {
          break-inside: avoid;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(title)}</h1>
        <p class="lede">${escapeHtml(subtitle)}</p>
        <p class="lede">Generado: ${escapeHtml(generatedAt)}</p>
        <div class="toolbar">
          <button class="print-button" type="button" onclick="window.print()">Imprimir o guardar como PDF</button>
          <p class="toolbar-note">Si tu navegador no abre el cuadro de impresión automáticamente, usa este botón.</p>
        </div>
      </header>
      ${sections.join('')}
    </main>
    <script>
      window.addEventListener('load', () => {
        window.setTimeout(() => window.print(), 150)
      })
    </script>
  </body>
</html>`
}

function openReportDocument(documentHtml: string) {
  const reportWindow = window.open('', '_blank')

  if (!reportWindow) {
    throw new Error('El navegador bloqueó la ventana del informe. Permite pop-ups para poder imprimir o guardar el PDF.')
  }

  reportWindow.document.open()
  reportWindow.document.write(documentHtml)
  reportWindow.document.close()
  reportWindow.focus()
}

export function openLinearPrintableReport({ linearPoints, linearData, linearAnalysis }: LinearReportInput) {
  const sections = [
    `<section>
      <h2>Datos de partida</h2>
      ${renderDefinitionList([
        { label: 'b1', value: formatVector(linearPoints.b1) },
        { label: 'b2', value: formatVector(linearPoints.b2) },
        { label: 'T(b1)', value: formatVector(linearPoints.tb1) },
        { label: 'T(b2)', value: formatVector(linearPoints.tb2) },
      ])}
    </section>`,
  ]

  if (!linearData || !linearAnalysis) {
    sections.push(`<section>
      <h2>Estado algebraico</h2>
      <p class="warning">La base elegida no es válida. Los vectores b1 y b2 deben ser linealmente independientes para reconstruir una única aplicación lineal.</p>
    </section>`)
  } else {
    sections.push(`<section>
      <h2>Estado algebraico</h2>
      ${renderDefinitionList([
        { label: 'Determinante de la base', value: formatMatrixEntry(linearData.basisDeterminant) },
        { label: 'Traza de A', value: formatMatrixEntry(linearAnalysis.trace) },
        { label: 'Determinante de A', value: formatMatrixEntry(linearAnalysis.determinant) },
        { label: 'Discriminante', value: formatMatrixEntry(linearAnalysis.discriminant) },
        { label: 'Clasificación', value: linearAnalysis.caseLabel },
      ])}
      <p class="lede">${escapeHtml(linearAnalysis.shortText)}</p>
    </section>`)

    sections.push(`<section>
      <h2>Matrices</h2>
      <div class="matrix-group">
        <div class="matrix-card">
          <p class="matrix-title">Matriz de A</p>
          ${renderMatrix(linearData.matrix)}
        </div>
        <div class="matrix-card">
          <p class="matrix-title">${escapeHtml(linearAnalysis.canonicalTitle)}</p>
          ${renderMatrix(linearAnalysis.canonicalMatrix)}
        </div>
      </div>
    </section>`)

    sections.push(`<section>
      <h2>Explicación automática</h2>
      ${renderSteps(linearAnalysis.steps)}
    </section>`)
  }

  openReportDocument(
    buildDocument(
      'Informe imprimible: reducción lineal en R2',
      'Versión estática compatible con GitHub Pages. Puedes guardarla como PDF desde el diálogo de impresión del navegador.',
      sections,
    ),
  )
}

export function openAffinePrintableReport({
  affineSource,
  affineImages,
  affineDraftValid,
  affineDraftArea,
  affineAnalysis,
}: AffineReportInput) {
  const sections = [
    `<section>
      <h2>Datos de partida</h2>
      ${renderDefinitionList([
        { label: 'p0', value: formatVector(affineSource.p0) },
        { label: 'p1', value: formatVector(affineSource.p1) },
        { label: 'p2', value: formatVector(affineSource.p2) },
        { label: 'q0', value: formatVector(affineImages.q0) },
        { label: 'q1', value: formatVector(affineImages.q1) },
        { label: 'q2', value: formatVector(affineImages.q2) },
      ])}
    </section>`,
    `<section>
      <h2>Independencia afín</h2>
      ${renderDefinitionList([
        { label: 'Área orientada doble', value: formatMatrixEntry(affineDraftArea) },
        { label: 'Área geométrica', value: formatMatrixEntry(Math.abs(affineDraftArea) / 2) },
        {
          label: 'Estado',
          value: affineDraftValid
            ? 'Los puntos origen son afínmente independientes.'
            : 'El triángulo origen es degenerado.',
        },
      ])}
    </section>`,
  ]

  if (!affineDraftValid || !affineAnalysis) {
    sections.push(`<section>
      <h2>Clasificación afín</h2>
      <p class="warning">La clasificación afín necesita que p0, p1 y p2 sean afínmente independientes.</p>
    </section>`)
  } else {
    sections.push(`<section>
      <h2>Clasificación afín</h2>
      ${renderDefinitionList([
        { label: 'Caso', value: affineAnalysis.caseLabel },
        { label: 'Conjunto fijo', value: affineAnalysis.fixedSet.label },
        { label: 'Forma normal', value: affineAnalysis.canonicalFixedSet.label },
      ])}
      <p class="lede">${escapeHtml(affineAnalysis.shortText)}</p>
    </section>`)

    sections.push(`<section>
      <h2>Matrices homogéneas</h2>
      <div class="matrix-group">
        <div class="matrix-card">
          <p class="matrix-title">Matriz homogénea de F</p>
          ${renderMatrix(affineAnalysis.sourceHomogeneous)}
        </div>
        <div class="matrix-card">
          <p class="matrix-title">Forma normal afín</p>
          ${renderMatrix(affineAnalysis.canonicalHomogeneous)}
        </div>
      </div>
    </section>`)

    sections.push(`<section>
      <h2>Explicación automática</h2>
      ${renderSteps(affineAnalysis.steps)}
    </section>`)
  }

  openReportDocument(
    buildDocument(
      'Informe imprimible: clasificación afín en R2',
      'Versión estática compatible con GitHub Pages. Puedes guardarla como PDF desde el diálogo de impresión del navegador.',
      sections,
    ),
  )
}
