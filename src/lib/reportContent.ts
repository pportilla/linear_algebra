import {
  classifyLinearMap,
  determinant2,
  formatMatrixEntry,
  inverse2,
  matrixFromImages,
  multiplyMatrices,
  subtractVectors,
} from './math2d'
import type { Matrix2, Vec2 } from './math2d'
import type {
  AffineReportInput,
  LinearReportInput,
  PrintableReportDocument,
  ReportBlock,
  ReportFact,
  ReportSection,
} from './reportModels'

const EPSILON = 1e-8
const MAX_FRACTION_DENOMINATOR = 1000

function createGeneratedAtLabel() {
  return new Date().toLocaleString('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

function greatestCommonDivisor(left: number, right: number) {
  let a = Math.abs(left)
  let b = Math.abs(right)

  while (b !== 0) {
    const remainder = a % b
    a = b
    b = remainder
  }

  return a || 1
}

function approximateFraction(value: number) {
  const clean = Math.abs(value) < EPSILON ? 0 : value

  if (!Number.isFinite(clean)) {
    return null
  }

  let bestNumerator = Math.round(clean)
  let bestDenominator = 1
  let bestError = Math.abs(clean - bestNumerator)

  if (bestError < EPSILON) {
    return { numerator: bestNumerator, denominator: 1 }
  }

  for (let denominator = 1; denominator <= MAX_FRACTION_DENOMINATOR; denominator += 1) {
    const numerator = Math.round(clean * denominator)
    const approximation = numerator / denominator
    const error = Math.abs(clean - approximation)

    if (error < bestError) {
      bestNumerator = numerator
      bestDenominator = denominator
      bestError = error
    }

    if (error < EPSILON) {
      break
    }
  }

  if (bestError > 1e-7) {
    return null
  }

  const divisor = greatestCommonDivisor(bestNumerator, bestDenominator)
  return {
    numerator: bestNumerator / divisor,
    denominator: bestDenominator / divisor,
  }
}

function formatTexNumber(value: number) {
  const clean = Math.abs(value) < EPSILON ? 0 : value
  const fraction = approximateFraction(clean)

  if (fraction) {
    if (fraction.denominator === 1) {
      return fraction.numerator.toString()
    }

    if (fraction.numerator < 0) {
      return `-\\frac{${Math.abs(fraction.numerator)}}{${fraction.denominator}}`
    }

    return `\\frac{${fraction.numerator}}{${fraction.denominator}}`
  }

  return Number(clean.toPrecision(8)).toString()
}

function vectorTex(vector: Vec2) {
  return `\\begin{pmatrix}${formatTexNumber(vector.x)}\\\\${formatTexNumber(vector.y)}\\end{pmatrix}`
}

function matrixTex(matrix: number[][]) {
  return `\\begin{pmatrix}${matrix
    .map((row) => row.map((entry) => formatTexNumber(entry)).join(' & '))
    .join('\\\\')}\\end{pmatrix}`
}

function mathFact(label: string, value: string, displayMode = false): ReportFact {
  return { label, value, valueType: 'math', displayMode }
}

function textFact(label: string, value: string): ReportFact {
  return { label, value, valueType: 'text' }
}

function paragraph(text: string): ReportBlock {
  return { type: 'paragraph', text }
}

function math(tex: string): ReportBlock {
  return { type: 'math', tex }
}

function facts(items: ReportFact[]): ReportBlock {
  return { type: 'facts', items }
}

function list(items: string[], ordered = true): ReportBlock {
  return { type: 'list', items, ordered }
}

function note(text: string, tone: 'info' | 'warning' = 'info'): ReportBlock {
  return { type: 'note', text, tone }
}

function section(id: string, eyebrow: string, title: string, blocks: ReportBlock[], summary?: string): ReportSection {
  return { id, eyebrow, title, blocks, summary }
}

function almostEqual(left: number, right: number) {
  return Math.abs(left - right) < 1e-6
}

function isScalarMatrix(matrix: Matrix2, scalar: number) {
  return (
    almostEqual(matrix[0][0], scalar) &&
    almostEqual(matrix[1][1], scalar) &&
    almostEqual(matrix[0][1], 0) &&
    almostEqual(matrix[1][0], 0)
  )
}

function matrixMinusScalar(matrix: Matrix2, scalar: number): Matrix2 {
  return [
    [matrix[0][0] - scalar, matrix[0][1]],
    [matrix[1][0], matrix[1][1] - scalar],
  ]
}

function kernelVectorOfSingular(matrix: Matrix2): Vec2 {
  const [[a, b], [c, d]] = matrix

  if (Math.abs(a) + Math.abs(b) > EPSILON) {
    return { x: -b, y: a }
  }

  if (Math.abs(c) + Math.abs(d) > EPSILON) {
    return { x: -d, y: c }
  }

  return { x: 1, y: 0 }
}

function eigenvectorFor(matrix: Matrix2, lambda: number) {
  return kernelVectorOfSingular(matrixMinusScalar(matrix, lambda))
}

function generalizedEigenvectorFor(matrix: Matrix2, lambda: number, eigenvector: Vec2) {
  const nilpotent = matrixMinusScalar(matrix, lambda)
  const row0Norm = Math.abs(nilpotent[0][0]) + Math.abs(nilpotent[0][1])
  const row1Norm = Math.abs(nilpotent[1][0]) + Math.abs(nilpotent[1][1])
  const useFirstRow = row0Norm >= row1Norm
  const row = useFirstRow ? nilpotent[0] : nilpotent[1]
  const rhs = useFirstRow ? eigenvector.x : eigenvector.y

  if (Math.abs(row[0]) >= Math.abs(row[1])) {
    return { x: rhs / row[0], y: 0 }
  }

  return { x: 0, y: rhs / row[1] }
}

function complexEigenBasis(matrix: Matrix2, realPart: number, imaginaryPart: number) {
  const [[a11, a12], [a21, a22]] = matrix

  if (Math.abs(a12) > EPSILON) {
    return {
      u: { x: a12, y: realPart - a11 },
      v: { x: 0, y: imaginaryPart },
    }
  }

  return {
    u: { x: a22 - realPart, y: -a21 },
    v: { x: -imaginaryPart, y: 0 },
  }
}

function characteristicPolynomialTex(trace: number, determinant: number) {
  let tex = 'p_A(x)=x^2'

  if (Math.abs(trace) > EPSILON) {
    tex += trace < 0 ? `+${formatTexNumber(-trace)}x` : `-${formatTexNumber(trace)}x`
  }

  if (Math.abs(determinant) > EPSILON) {
    tex += determinant < 0 ? `-${formatTexNumber(-determinant)}` : `+${formatTexNumber(determinant)}`
  }

  return tex
}

function inverseNarrativeBlocks(matrix: Matrix2, symbol: string) {
  const determinant = determinant2(matrix)
  const inverse = inverse2(matrix)

  if (!inverse) {
    return [note(`La matriz ${symbol} no es invertible y la reducción no puede continuar.` as string, 'warning')]
  }

  return [
    paragraph(`Como el determinante no se anula, se puede invertir ${symbol} con la fórmula explícita de las matrices 2×2.`),
    math(`${symbol}^{-1}=\\frac{1}{${formatTexNumber(determinant)}}\\begin{pmatrix}${formatTexNumber(matrix[1][1])} & ${formatTexNumber(-matrix[0][1])}\\\\${formatTexNumber(-matrix[1][0])} & ${formatTexNumber(matrix[0][0])}\\end{pmatrix}=${matrixTex(inverse)}`),
  ]
}

type LinearCanonicalData = {
  symbolJ: string
  P: Matrix2
  classificationBlocks: ReportBlock[]
  basisChangeBlocks: ReportBlock[]
}

function buildLinearCanonicalData(matrix: Matrix2, trace: number, determinant: number, discriminant: number): LinearCanonicalData {
  if (discriminant > EPSILON) {
    const root = Math.sqrt(discriminant)
    const lambda1 = (trace + root) / 2
    const lambda2 = (trace - root) / 2
    const v1 = eigenvectorFor(matrix, lambda1)
    const v2 = eigenvectorFor(matrix, lambda2)
    const P = matrixFromImages(v1, v2)

    return {
      symbolJ: 'J',
      P,
      classificationBlocks: [
        paragraph('Calculamos el discriminante del polinomio característico para decidir el tipo de reducción lineal que aparece.'),
        math(`\\Delta=\\operatorname{tr}(A)^2-4\\det(A)=(${formatTexNumber(trace)})^2-4(${formatTexNumber(determinant)})=${formatTexNumber(discriminant)}>0`),
        paragraph('Al ser positivo, el polinomio característico tiene dos raíces reales distintas.'),
        math(`\\lambda_1=\\frac{${formatTexNumber(trace)}+\\sqrt{${formatTexNumber(discriminant)}}}{2}=${formatTexNumber(lambda1)},\\qquad \\lambda_2=\\frac{${formatTexNumber(trace)}-\\sqrt{${formatTexNumber(discriminant)}}}{2}=${formatTexNumber(lambda2)}`),
        paragraph('Con dos autovalores reales distintos, la matriz es diagonalizable y su forma de Jordan queda dada por la diagonal de autovalores.'),
        math(`J=${matrixTex([[lambda1, 0], [0, lambda2]])}`),
      ],
      basisChangeBlocks: [
        paragraph('Para cada autovalor buscamos un vector columna no nulo que satisfaga el sistema homogéneo correspondiente. Como la matriz resultante es singular, basta tomar un vector del núcleo.'),
        paragraph(`Para el primer autovalor ${formatMatrixEntry(lambda1)}:`),
        math(`A-\\lambda_1 I=${matrixTex(matrixMinusScalar(matrix, lambda1))},\\qquad v_1=${vectorTex(v1)}`),
        paragraph(`Para el segundo autovalor ${formatMatrixEntry(lambda2)}:`),
        math(`A-\\lambda_2 I=${matrixTex(matrixMinusScalar(matrix, lambda2))},\\qquad v_2=${vectorTex(v2)}`),
        paragraph('Pegamos ambos autovectores como columnas para formar la matriz de cambio de base.'),
        math(`P=[\\,v_1\\ v_2\\,]=${matrixTex(P)}`),
      ],
    }
  }

  if (Math.abs(discriminant) <= EPSILON) {
    const lambda = trace / 2

    if (isScalarMatrix(matrix, lambda)) {
      return {
        symbolJ: 'J',
        P: [[1, 0], [0, 1]],
        classificationBlocks: [
          paragraph('El discriminante se anula, así que aparece un único autovalor.'),
          math(`\\lambda=\\frac{\\operatorname{tr}(A)}{2}=${formatTexNumber(lambda)}`),
          paragraph('Además, A coincide con lambda por la identidad: todo vector no nulo es autovector y la propia matriz ya está en su forma canónica.'),
          math(`J=${matrixTex([[lambda, 0], [0, lambda]])}`),
        ],
        basisChangeBlocks: [
          paragraph('Cualquier base de R² sirve. Por comodidad se escoge la base canónica e1, e2.'),
          math(`P=I=${matrixTex([[1, 0], [0, 1]])}`),
        ],
      }
    }

    const v1 = eigenvectorFor(matrix, lambda)
    const v2 = generalizedEigenvectorFor(matrix, lambda, v1)
    const P = matrixFromImages(v1, v2)

    return {
      symbolJ: 'J',
      P,
      classificationBlocks: [
        paragraph('El discriminante se anula, así que hay un autovalor doble.'),
        math(`\\lambda=\\frac{\\operatorname{tr}(A)}{2}=${formatTexNumber(lambda)}`),
        paragraph('Pero A no coincide con lambda por la identidad, así que el autoespacio no tiene dimensión dos. En dimensión dos eso obliga a que aparezca un único bloque de Jordan de tamaño dos.'),
        math(`J=${matrixTex([[lambda, 1], [0, lambda]])}`),
      ],
      basisChangeBlocks: [
        paragraph('Primero calculamos un autovector resolviendo el sistema homogéneo asociado al autovalor doble.'),
        math(`A-\\lambda I=${matrixTex(matrixMinusScalar(matrix, lambda))},\\qquad v_1=${vectorTex(v1)}`),
        paragraph('Después buscamos un vector generalizado v2 que satisfaga la ecuación de Jordan correspondiente.'),
        math(`v_2=${vectorTex(v2)}`),
        paragraph('Con estos dos vectores en las columnas se obtiene la matriz de cambio de base.'),
        math(`P=[\\,v_1\\ v_2\\,]=${matrixTex(P)}`),
      ],
    }
  }

  const realPart = trace / 2
  const imaginaryPart = Math.sqrt(-discriminant) / 2
  const { u, v } = complexEigenBasis(matrix, realPart, imaginaryPart)
  const P = matrixFromImages(v, u)

  return {
    symbolJ: 'J_{\\mathbb R}',
    P,
    classificationBlocks: [
      paragraph('El discriminante es negativo, así que no hay raíces reales del polinomio característico.'),
      math(`\\Delta=${formatTexNumber(discriminant)}<0`),
      paragraph('Los autovalores aparecen como un par complejo conjugado.'),
      math(`\\lambda_{\\pm}=${formatTexNumber(realPart)}\\pm ${formatTexNumber(imaginaryPart)}\\,i`),
      paragraph('Sobre R no existe una forma de Jordan real. En su lugar se usa el bloque canónico real asociado a esa rotación-dilatación.'),
      math(`J_{\\mathbb R}=${matrixTex([[realPart, -imaginaryPart], [imaginaryPart, realPart]])}`),
    ],
    basisChangeBlocks: [
      paragraph('Se busca un autovector complejo z=u+iv asociado al autovalor con parte imaginaria positiva y se separa en parte real e imaginaria.'),
      math(`u=${vectorTex(u)}\\ \text{(parte real)},\\qquad v=${vectorTex(v)}\\ \text{(parte imaginaria)}`),
      paragraph('Si ordenamos la base real como (v,u), la conjugación reproduce exactamente el bloque canónico real.'),
      math(`P=[\\,v\\ u\\,]=${matrixTex(P)}`),
    ],
  }
}

function invalidLinearDocument(input: LinearReportInput): PrintableReportDocument {
  const basisMatrix = matrixFromImages(input.linearPoints.b1, input.linearPoints.b2)
  const determinant = determinant2(basisMatrix)

  return {
    kind: 'linear',
    title: 'Informe detallado de la reducción lineal en R²',
    subtitle: 'La base elegida no determina una única aplicación lineal.',
    statusLabel: 'Base no válida',
    generatedAt: createGeneratedAtLabel(),
    highlights: [
      textFact('Estado', 'No existe una reconstrucción unívoca'),
      mathFact('B', matrixTex(basisMatrix), true),
      mathFact('\\det(B)', formatTexNumber(determinant)),
      textFact('Qué falta', 'Escoger dos vectores linealmente independientes'),
    ],
    sections: [
      section('datos', 'Datos', 'Vectores fijados', [
        facts([
          mathFact('b1', vectorTex(input.linearPoints.b1)),
          mathFact('b2', vectorTex(input.linearPoints.b2)),
          mathFact('T(b1)', vectorTex(input.linearPoints.tb1)),
          mathFact('T(b2)', vectorTex(input.linearPoints.tb2)),
        ]),
      ], 'Se muestran los datos introducidos para la base y para las imágenes.'),
      section('obstruccion', 'Diagnóstico', 'Por qué falla la reconstrucción', [
        paragraph('La aplicación lineal sólo queda determinada de forma única cuando los vectores b1 y b2 forman una base de R².'),
        math(`B=[b_1\\ b_2]=${matrixTex(basisMatrix)},\\qquad \\det(B)=${formatTexNumber(determinant)}`),
        note('El determinante es nulo o numéricamente despreciable, de modo que B no es invertible y la ecuación AB = Y no permite despejar una única matriz A.', 'warning'),
      ], 'Sin la inversa de B no se puede ejecutar el paso A = YB^{-1}.'),
      section('ajuste', 'Siguiente paso', 'Cómo corregirlo', [
        list([
          'Modifica b1 o b2 para que no queden alineados.',
          'Comprueba que el determinante de la matriz [b1 b2] sea distinto de cero.',
          'Una vez la base sea invertible, el informe mostrará automáticamente la matriz A, su polinomio característico y la forma canónica correspondiente.',
        ]),
      ]),
    ],
    closingFacts: [
      mathFact('B', matrixTex(basisMatrix), true),
      mathFact('\\det(B)', formatTexNumber(determinant)),
    ],
  }
}

export function buildLinearReportDocument(input: LinearReportInput): PrintableReportDocument {
  if (!input.linearData || !input.linearAnalysis) {
    return invalidLinearDocument(input)
  }

  const { basisMatrix, imageMatrix, matrix, basisDeterminant } = input.linearData
  const { trace, determinant, discriminant, caseLabel, shortText, canonicalMatrix } = input.linearAnalysis
  const inverseBasis = inverse2(basisMatrix)

  if (!inverseBasis) {
    return invalidLinearDocument(input)
  }

  const canonicalData = buildLinearCanonicalData(matrix, trace, determinant, discriminant)
  const inverseP = inverse2(canonicalData.P)
  const verification = inverseP
    ? multiplyMatrices(multiplyMatrices(inverseP, matrix), canonicalData.P)
    : canonicalMatrix

  return {
    kind: 'linear',
    title: 'Informe detallado de la reducción lineal en R²',
    subtitle: 'Recorrido completo del ejemplo con el cálculo de la matriz y su reducción canónica.',
    statusLabel: caseLabel,
    generatedAt: createGeneratedAtLabel(),
    highlights: [
      textFact('Caso', caseLabel),
      mathFact('A', matrixTex(matrix), true),
      mathFact(canonicalData.symbolJ, matrixTex(canonicalMatrix), true),
      mathFact('\\det(B)', formatTexNumber(basisDeterminant)),
    ],
    sections: [
      section('datos', 'Paso 1', 'Datos de partida', [
        paragraph('Se parte de una base de R² elegida por el usuario y de las imágenes fijadas para esos vectores.'),
        facts([
          mathFact('b1', vectorTex(input.linearPoints.b1)),
          mathFact('b2', vectorTex(input.linearPoints.b2)),
          mathFact('T(b1)', vectorTex(input.linearPoints.tb1)),
          mathFact('T(b2)', vectorTex(input.linearPoints.tb2)),
        ]),
      ]),
      section('matrices', 'Paso 2', 'Matriz de la base y de las imágenes', [
        paragraph('Se colocan los vectores por columnas para construir la matriz de la base y la matriz de imágenes.'),
        math(`B=[b_1\\ b_2]=${matrixTex(basisMatrix)},\\qquad Y=[T(b_1)\\ T(b_2)]=${matrixTex(imageMatrix)}`),
        paragraph('La matriz A de la aplicación lineal en la base estándar cumple A[b1 b2]=[T(b1) T(b2)], es decir, AB=Y.'),
      ]),
      section('inversa-base', 'Paso 3', 'Inversa de B', [
        math(`\\det(B)=${formatTexNumber(basisDeterminant)}\\neq 0`),
        ...inverseNarrativeBlocks(basisMatrix, 'B'),
      ]),
      section('reconstruccion', 'Paso 4', 'Matriz de la aplicación en la base estándar', [
        paragraph('Multiplicando la igualdad AB=Y a la derecha por B^{-1} se despeja la matriz buscada.'),
        math(`A=YB^{-1}=${matrixTex(imageMatrix)}\\cdot${matrixTex(inverseBasis)}=${matrixTex(matrix)}`),
      ], 'Aquí es donde se obtiene la matriz A a partir de los datos fijados.'),
      section('polinomio', 'Paso 5', 'Polinomio característico', [
        paragraph('A partir de la matriz reconstruida se calculan la traza y el determinante.'),
        facts([
          mathFact('\\operatorname{tr}(A)', formatTexNumber(trace)),
          mathFact('\\det(A)', formatTexNumber(determinant)),
          mathFact('\\Delta', formatTexNumber(discriminant)),
          textFact('Lectura geométrica', shortText),
        ]),
        math(characteristicPolynomialTex(trace, determinant)),
      ], 'La información espectral empieza aquí: primero se identifica el polinomio y luego se separa el caso.'),
      section('clasificacion', 'Paso 6', 'Clasificación y forma canónica', canonicalData.classificationBlocks, shortText),
      section('base-canonica', 'Paso 7', 'Autovectores y matriz de cambio de base', canonicalData.basisChangeBlocks),
      section('verificacion', 'Paso 8', 'Verificación de la forma canónica', [
        paragraph('Se invierte la matriz de cambio de base y se comprueba que P^{-1}AP coincide con la forma canónica obtenida.'),
        ...inverseNarrativeBlocks(canonicalData.P, 'P'),
        math(`P^{-1}AP=${matrixTex(verification)}=${matrixTex(canonicalMatrix)}=${canonicalData.symbolJ}`),
      ]),
      section('resumen', 'Resumen final', 'Resumen operativo', [
        list([
          'Primero se comprueba que b1 y b2 forman una base, es decir, que det(B) no es nulo.',
          'Se construyen B=[b1 b2] y Y=[T(b1) T(b2)] y se calcula B^{-1} de forma explícita.',
          'La matriz buscada se obtiene despejando A=YB^{-1}.',
          'La traza, el determinante y el discriminante determinan el caso lineal que aparece.',
          'Según el caso, se calculan autovectores o vectores generalizados para construir la matriz P.',
          'La identidad final P^{-1}AP = J cierra la reducción.',
        ]),
      ]),
    ],
    closingFacts: [
      mathFact('A', matrixTex(matrix), true),
      mathFact('P', matrixTex(canonicalData.P), true),
      mathFact(canonicalData.symbolJ, matrixTex(canonicalMatrix), true),
    ],
  }
}

function invalidAffineDocument(input: AffineReportInput): PrintableReportDocument {
  const side1 = subtractVectors(input.affineSource.p1, input.affineSource.p0)
  const side2 = subtractVectors(input.affineSource.p2, input.affineSource.p0)
  const sourceFrame = matrixFromImages(side1, side2)

  return {
    kind: 'affine',
    title: 'Informe detallado de la clasificación afín en R²',
    subtitle: 'Los puntos origen no son afínmente independientes y la aplicación no queda determinada de forma única.',
    statusLabel: 'Datos afines degenerados',
    generatedAt: createGeneratedAtLabel(),
    highlights: [
      textFact('Estado', 'No existe una única aplicación afín'),
      mathFact('S', matrixTex(sourceFrame), true),
      mathFact('Área doble', formatTexNumber(input.affineDraftArea)),
      textFact('Qué falta', 'Elegir tres puntos origen no alineados'),
    ],
    sections: [
      section('datos', 'Datos', 'Puntos fijados', [
        facts([
          mathFact('p0', vectorTex(input.affineSource.p0)),
          mathFact('p1', vectorTex(input.affineSource.p1)),
          mathFact('p2', vectorTex(input.affineSource.p2)),
          mathFact('q0', vectorTex(input.affineImages.q0)),
          mathFact('q1', vectorTex(input.affineImages.q1)),
          mathFact('q2', vectorTex(input.affineImages.q2)),
        ]),
      ]),
      section('independencia', 'Diagnóstico', 'Fallo de independencia afín', [
        paragraph('La clasificación afín empieza comprobando que p0, p1 y p2 no estén alineados. Eso equivale a pedir que los vectores p1 - p0 y p2 - p0 sean linealmente independientes.'),
        math(`p_1-p_0=${vectorTex(input.affineSource.p1)}-${vectorTex(input.affineSource.p0)}=${vectorTex(side1)}`),
        math(`p_2-p_0=${vectorTex(input.affineSource.p2)}-${vectorTex(input.affineSource.p0)}=${vectorTex(side2)}`),
        math(`(p_1-p_0)\\wedge(p_2-p_0)=\\begin{vmatrix}${formatTexNumber(side1.x)} & ${formatTexNumber(side2.x)}\\\\${formatTexNumber(side1.y)} & ${formatTexNumber(side2.y)}\\end{vmatrix}=${formatTexNumber(input.affineDraftArea)}`),
        note('El área orientada doble es nula o demasiado pequeña, así que la referencia afín origen es degenerada.', 'warning'),
      ]),
      section('ajuste', 'Siguiente paso', 'Cómo corregirlo', [
        list([
          'Mueve cualquiera de los tres puntos origen hasta que dejen de estar alineados.',
          'Comprueba que el área orientada doble del triángulo origen sea distinta de cero.',
          'Con una referencia afín válida, el informe podrá reconstruir A, la traslación y la forma normal afín.',
        ]),
      ]),
    ],
    closingFacts: [
      mathFact('S', matrixTex(sourceFrame), true),
      mathFact('Área doble', formatTexNumber(input.affineDraftArea)),
    ],
  }
}

function affineNormalMapTex(canonicalLinearPart: Matrix2, canonicalTranslation: Vec2) {
  return `F_{\\mathrm{can}}(x)=${matrixTex(canonicalLinearPart)}x+${vectorTex(canonicalTranslation)}`
}

function buildAffineClassificationBlocks(
  linearPart: Matrix2,
  translation: Vec2,
  input: AffineReportInput,
): ReportBlock[] {
  const analysis = input.affineAnalysis

  if (!analysis) {
    return [note('No hay clasificación afín disponible para los datos actuales.', 'warning')]
  }

  const system = matrixMinusScalar(linearPart, 1)
  const rhs = { x: -translation.x, y: -translation.y }
  const blocks: ReportBlock[] = [
    facts([
      textFact('Caso afín', analysis.caseLabel),
      textFact('Conjunto fijo', analysis.fixedSet.label),
      textFact('Forma normal', analysis.canonicalFixedSet.label),
      textFact('Lectura geométrica', analysis.shortText),
    ]),
    math(`(A-I)c=-t,\\qquad A-I=${matrixTex(system)},\\qquad -t=${vectorTex(rhs)}`),
  ]

  if (analysis.fixedSet.kind === 'point' && analysis.fixedSet.point) {
    blocks.push(paragraph('El sistema tiene una solución única, así que existe un punto fijo y la traslación se elimina al mover el origen a ese punto.'))
    blocks.push(math(`c=${vectorTex(analysis.fixedSet.point)}`))
    return blocks
  }

  if (analysis.fixedSet.kind === 'line' && analysis.fixedSet.anchor && analysis.fixedSet.direction) {
    blocks.push(paragraph('El sistema es compatible indeterminado. Los puntos fijos forman una recta afín completa.'))
    blocks.push(
      math(`c=${vectorTex(analysis.fixedSet.anchor)}+s\\,${vectorTex(analysis.fixedSet.direction)}`),
    )
    return blocks
  }

  if (analysis.fixedSet.kind === 'plane') {
    blocks.push(paragraph('La ecuación queda satisfecha para cualquier punto del plano: la aplicación coincide con la identidad afín.'))
    return blocks
  }

  blocks.push(paragraph('El sistema no tiene solución, así que la traslación no se puede absorber completamente y aparece un caso afín esencial.'))

  if (analysis.caseLabel === 'Traslación no trivial') {
    blocks.push(paragraph('La parte lineal ya es la identidad y toda la información geométrica está en el vector de traslación.'))
    return blocks
  }

  if (analysis.caseLabel === 'Sin punto fijo y con un autovalor igual a 1') {
    blocks.push(paragraph('En una base propia adaptada, la única traslación esencial sobrevive en la dirección del autovalor 1 y se normaliza a una unidad.'))
    return blocks
  }

  if (analysis.caseLabel === 'Caso parabólico sin punto fijo') {
    blocks.push(paragraph('El bloque de Jordan del autovalor 1 deja una traslación transversal irreducible, que se normaliza a la forma parabólica estándar.'))
    return blocks
  }

  blocks.push(paragraph('La forma normal afín queda controlada por la parte lineal y por la representación homogénea correspondiente.'))
  return blocks
}

export function buildAffineReportDocument(input: AffineReportInput): PrintableReportDocument {
  if (!input.affineDraftValid || !input.affineAnalysis) {
    return invalidAffineDocument(input)
  }

  const side1 = subtractVectors(input.affineSource.p1, input.affineSource.p0)
  const side2 = subtractVectors(input.affineSource.p2, input.affineSource.p0)
  const imageSide1 = subtractVectors(input.affineImages.q1, input.affineImages.q0)
  const imageSide2 = subtractVectors(input.affineImages.q2, input.affineImages.q0)
  const sourceFrame = matrixFromImages(side1, side2)
  const imageFrame = matrixFromImages(imageSide1, imageSide2)
  const inverseSource = inverse2(sourceFrame)

  if (!inverseSource) {
    return invalidAffineDocument(input)
  }

  const analysis = input.affineAnalysis
  const linearPart = analysis.sourceLinearPart
  const translation = analysis.sourceTranslation
  const linearClassification = classifyLinearMap(linearPart)

  return {
    kind: 'affine',
    title: 'Informe detallado de la clasificación afín en R²',
    subtitle: 'Recorrido completo del ejemplo afín con sus cálculos y la forma normal resultante.',
    statusLabel: analysis.caseLabel,
    generatedAt: createGeneratedAtLabel(),
    highlights: [
      textFact('Caso afín', analysis.caseLabel),
      textFact('Conjunto fijo', analysis.fixedSet.label),
      mathFact('A', matrixTex(linearPart), true),
      mathFact('H_{\\mathrm{can}}', matrixTex(analysis.canonicalHomogeneous), true),
    ],
    sections: [
      section('datos', 'Paso 1', 'Datos de partida', [
        paragraph('La aplicación afín queda fijada por tres puntos origen afínmente independientes y por sus respectivas imágenes.'),
        facts([
          mathFact('p0', vectorTex(input.affineSource.p0)),
          mathFact('p1', vectorTex(input.affineSource.p1)),
          mathFact('p2', vectorTex(input.affineSource.p2)),
          mathFact('q0', vectorTex(input.affineImages.q0)),
          mathFact('q1', vectorTex(input.affineImages.q1)),
          mathFact('q2', vectorTex(input.affineImages.q2)),
        ]),
      ]),
      section('independencia', 'Paso 2', 'Independencia afín del triángulo origen', [
        paragraph('Se resta p0 para convertir el problema afín en un problema lineal sobre los vectores del espacio asociado.'),
        math(`p_1-p_0=${vectorTex(input.affineSource.p1)}-${vectorTex(input.affineSource.p0)}=${vectorTex(side1)}`),
        math(`p_2-p_0=${vectorTex(input.affineSource.p2)}-${vectorTex(input.affineSource.p0)}=${vectorTex(side2)}`),
        math(`(p_1-p_0)\\wedge(p_2-p_0)=\\begin{vmatrix}${formatTexNumber(side1.x)} & ${formatTexNumber(side2.x)}\\\\${formatTexNumber(side1.y)} & ${formatTexNumber(side2.y)}\\end{vmatrix}=${formatTexNumber(input.affineDraftArea)}`),
        facts([
          mathFact('Área doble', formatTexNumber(input.affineDraftArea)),
          mathFact('Área geométrica', formatTexNumber(Math.abs(input.affineDraftArea) / 2)),
          textFact('Conclusión', 'Los tres puntos origen forman una referencia afín válida'),
        ]),
      ]),
      section('reconstruccion', 'Paso 3', 'Reconstrucción de la parte lineal y de la traslación', [
        paragraph('Las diferencias entre puntos origen y puntos imagen determinan la parte lineal A. Después se recupera la traslación imponiendo F(p0) = q0.'),
        math(`S=[p_1-p_0\\ p_2-p_0]=${matrixTex(sourceFrame)},\\qquad T=[q_1-q_0\\ q_2-q_0]=${matrixTex(imageFrame)}`),
        ...inverseNarrativeBlocks(sourceFrame, 'S'),
        math(`A=TS^{-1}=${matrixTex(imageFrame)}\\cdot${matrixTex(inverseSource)}=${matrixTex(linearPart)}`),
        math(`t=q_0-Ap_0=${vectorTex(input.affineImages.q0)}-${matrixTex(linearPart)}${vectorTex(input.affineSource.p0)}=${vectorTex(translation)}`),
        math(`H_F=${matrixTex(analysis.sourceHomogeneous)}`),
      ]),
      section('clasificacion', 'Paso 4', 'Geometría afín: puntos fijos y caso normal', buildAffineClassificationBlocks(linearPart, translation, input), linearClassification.shortText),
      section('normal', 'Paso 5', 'Representante canónico en la nueva referencia', [
        paragraph('La forma normal afín queda recogida por la matriz homogénea canónica en la referencia elegida.'),
        facts([
          mathFact('A_{\\mathrm{can}}', matrixTex(analysis.canonicalLinearPart), true),
          mathFact('t_{\\mathrm{can}}', vectorTex(analysis.canonicalTranslation)),
          textFact('Conjunto fijo canónico', analysis.canonicalFixedSet.label),
          textFact('Lectura rápida', analysis.shortText),
        ]),
        math(`H_{\\mathrm{can}}=${matrixTex(analysis.canonicalHomogeneous)}`),
        math(affineNormalMapTex(analysis.canonicalLinearPart, analysis.canonicalTranslation)),
      ]),
      section('resumen', 'Síntesis', 'Resumen operativo', [
        list(analysis.steps),
      ]),
    ],
    closingFacts: [
      mathFact('A', matrixTex(linearPart), true),
      mathFact('t', vectorTex(translation)),
      mathFact('H_{\\mathrm{can}}', matrixTex(analysis.canonicalHomogeneous), true),
    ],
  }
}

export function formatVectorForDisplay(vector: Vec2) {
  return `(${formatMatrixEntry(vector.x)}, ${formatMatrixEntry(vector.y)})`
}