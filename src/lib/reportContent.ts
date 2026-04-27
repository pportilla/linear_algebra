import {
  applyMatrix,
  determinant2,
  formatMatrixEntry,
  homogeneousFromAffine,
  inverse2,
  matrixFromImages,
  subtractVectors,
  trace2,
} from './math2d'
import type { AffineAnalysis, Matrix2, Vec2 } from './math2d'
import {
  addExpressions,
  expressionFromNumber,
  formatLatexExpression,
  formatLatexNumber as formatTexNumber,
  formatPlainExpression,
  negateExpression,
  scaleExpression,
  squareRootExpressionFromNumber,
  subtractExpressions,
  type SymbolicExpression,
} from './symbolicMath'
import type {
  AffineReportInput,
  LinearReportInput,
  PrintableReportDocument,
  ReportBlock,
  ReportFact,
  ReportSection,
} from './reportModels'

const EPSILON = 1e-8

function createGeneratedAtLabel() {
  return new Date().toLocaleString('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

function vectorTex(vector: Vec2) {
  return `\\begin{pmatrix}${formatTexNumber(vector.x)}\\\\${formatTexNumber(vector.y)}\\end{pmatrix}`
}

function matrixTex(matrix: number[][]) {
  return `\\begin{pmatrix}${matrix
    .map((row) => row.map((entry) => formatTexNumber(entry)).join(' & '))
    .join('\\\\')}\\end{pmatrix}`
}

function symbolicNumber(value: number) {
  const expression = expressionFromNumber(value)

  if (!expression) {
    throw new Error(`No se pudo convertir ${value} en una expresión racional.`)
  }

  return expression
}

function expressionVectorTex(entries: [SymbolicExpression, SymbolicExpression]) {
  return `\\begin{pmatrix}${entries.map(formatLatexExpression).join('\\\\')}\\end{pmatrix}`
}

function expressionMatrixTex(matrix: SymbolicExpression[][]) {
  return `\\begin{pmatrix}${matrix.map((row) => row.map(formatLatexExpression).join(' & ')).join('\\\\')}\\end{pmatrix}`
}

function expressionHomogeneousLinearTex(matrix: SymbolicExpression[][]) {
  return `\\begin{pmatrix}1 & 0 & 0\\\\0 & ${formatLatexExpression(matrix[0][0])} & ${formatLatexExpression(matrix[0][1])}\\\\0 & ${formatLatexExpression(matrix[1][0])} & ${formatLatexExpression(matrix[1][1])}\\end{pmatrix}`
}

function homogeneousLinearMatrixTex(matrix: Matrix2) {
  return matrixTex(homogeneousFromAffine(matrix, { x: 0, y: 0 }))
}

function symbolicDistinctRealEigenvalues(trace: number, discriminant: number) {
  const halfTrace = scaleExpression(symbolicNumber(trace), 1, 2)
  const halfRoot = scaleExpression(
    squareRootExpressionFromNumber(discriminant) ?? symbolicNumber(Math.sqrt(discriminant)),
    1,
    2,
  )

  return {
    lambda1: addExpressions(halfTrace, halfRoot),
    lambda2: subtractExpressions(halfTrace, halfRoot),
  }
}

function symbolicComplexEigenParts(trace: number, discriminant: number) {
  return {
    realPart: scaleExpression(symbolicNumber(trace), 1, 2),
    imaginaryPart: scaleExpression(
      squareRootExpressionFromNumber(-discriminant) ?? symbolicNumber(Math.sqrt(-discriminant)),
      1,
      2,
    ),
  }
}

function symbolicMatrixMinusScalar(matrix: Matrix2, lambda: SymbolicExpression) {
  return [
    [subtractExpressions(symbolicNumber(matrix[0][0]), lambda), symbolicNumber(matrix[0][1])],
    [symbolicNumber(matrix[1][0]), subtractExpressions(symbolicNumber(matrix[1][1]), lambda)],
  ]
}

function symbolicDistinctRealEigenvector(matrix: Matrix2, lambda: SymbolicExpression, lambdaValue: number): [SymbolicExpression, SymbolicExpression] {
  const shifted = matrixMinusScalar(matrix, lambdaValue)
  const row0Norm = Math.abs(shifted[0][0]) + Math.abs(shifted[0][1])
  const row1Norm = Math.abs(shifted[1][0]) + Math.abs(shifted[1][1])

  if (row0Norm >= row1Norm && row0Norm > EPSILON) {
    return [symbolicNumber(matrix[0][1]), subtractExpressions(lambda, symbolicNumber(matrix[0][0]))]
  }

  if (row1Norm > EPSILON) {
    return [subtractExpressions(lambda, symbolicNumber(matrix[1][1])), symbolicNumber(matrix[1][0])]
  }

  return [symbolicNumber(1), symbolicNumber(0)]
}

function symbolicComplexEigenBasis(matrix: Matrix2, realPart: SymbolicExpression, imaginaryPart: SymbolicExpression) {
  const [[a11, a12], [a21, a22]] = matrix

  if (Math.abs(a12) > EPSILON) {
    return {
      u: [symbolicNumber(a12), subtractExpressions(realPart, symbolicNumber(a11))] as [SymbolicExpression, SymbolicExpression],
      v: [symbolicNumber(0), imaginaryPart] as [SymbolicExpression, SymbolicExpression],
    }
  }

  return {
    u: [subtractExpressions(realPart, symbolicNumber(a22)), symbolicNumber(a21)] as [SymbolicExpression, SymbolicExpression],
    v: [imaginaryPart, symbolicNumber(0)] as [SymbolicExpression, SymbolicExpression],
  }
}

function mathFact(label: string, value: string, displayMode = false): ReportFact {
  return { label, labelType: 'math', value, valueType: 'math', displayMode }
}

function textFact(label: string, value: string): ReportFact {
  return { label, labelType: 'text', value, valueType: 'text' }
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

function identityMinusMatrix(matrix: Matrix2): Matrix2 {
  return [
    [1 - matrix[0][0], -matrix[0][1]],
    [-matrix[1][0], 1 - matrix[1][1]],
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
    paragraph(`Como el determinante no se anula, ${symbol} es invertible y podemos seguir sin ambigüedad. En dimensión dos resulta cómodo escribir la inversa con la fórmula explícita de las matrices 2×2.`),
    math(`${symbol}^{-1}=\\frac{1}{${formatTexNumber(determinant)}}\\begin{pmatrix}${formatTexNumber(matrix[1][1])} & ${formatTexNumber(-matrix[0][1])}\\\\${formatTexNumber(-matrix[1][0])} & ${formatTexNumber(matrix[0][0])}\\end{pmatrix}=${matrixTex(inverse)}`),
  ]
}

type LinearCanonicalData = {
  symbolJ: string
  P: Matrix2
  pTex: string
  canonicalTex: string
  canonicalHomogeneousTex: string
  hasSymbolicEntries: boolean
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
    const symbolicEigenvalues = symbolicDistinctRealEigenvalues(trace, discriminant)
    const symbolicV1 = symbolicDistinctRealEigenvector(matrix, symbolicEigenvalues.lambda1, lambda1)
    const symbolicV2 = symbolicDistinctRealEigenvector(matrix, symbolicEigenvalues.lambda2, lambda2)
    const pTex = expressionMatrixTex([[symbolicV1[0], symbolicV2[0]], [symbolicV1[1], symbolicV2[1]]])
    const canonicalEntries = [[symbolicEigenvalues.lambda1, symbolicNumber(0)], [symbolicNumber(0), symbolicEigenvalues.lambda2]]
    const canonicalTex = expressionMatrixTex(canonicalEntries)

    return {
      symbolJ: 'J',
      P,
      pTex,
      canonicalTex,
      canonicalHomogeneousTex: expressionHomogeneousLinearTex(canonicalEntries),
      hasSymbolicEntries: true,
      classificationBlocks: [
        paragraph('Ahora miramos el discriminante del polinomio característico, porque su signo separa los tres escenarios básicos en dimensión dos.'),
        math(`\\Delta=\\operatorname{tr}(A)^2-4\\det(A)=(${formatTexNumber(trace)})^2-4(${formatTexNumber(determinant)})=${formatTexNumber(discriminant)}>0`),
        paragraph('Aquí sale positivo, así que el polinomio tiene dos raíces reales distintas y aparecen dos direcciones propias independientes.'),
        math(`\\lambda_1=\\frac{${formatTexNumber(trace)}+\\sqrt{${formatTexNumber(discriminant)}}}{2}=${formatLatexExpression(symbolicEigenvalues.lambda1)},\\qquad \\lambda_2=\\frac{${formatTexNumber(trace)}-\\sqrt{${formatTexNumber(discriminant)}}}{2}=${formatLatexExpression(symbolicEigenvalues.lambda2)}`),
        paragraph('Cuando eso ocurre, la matriz es diagonalizable y la forma canónica queda simplemente en diagonal, con cada autovalor ocupando su sitio.'),
        math(`J=${canonicalTex}`),
      ],
      basisChangeBlocks: [
        paragraph('El siguiente paso es construir una base adaptada. Para cada autovalor resolvemos el sistema homogéneo correspondiente y elegimos un vector no nulo del núcleo.'),
        paragraph(`Para el primer autovalor ${formatPlainExpression(symbolicEigenvalues.lambda1)}:`),
        math(`A-\\lambda_1 I=${expressionMatrixTex(symbolicMatrixMinusScalar(matrix, symbolicEigenvalues.lambda1))},\\qquad v_1=${expressionVectorTex(symbolicV1)}`),
        paragraph(`Para el segundo autovalor ${formatPlainExpression(symbolicEigenvalues.lambda2)}:`),
        math(`A-\\lambda_2 I=${expressionMatrixTex(symbolicMatrixMinusScalar(matrix, symbolicEigenvalues.lambda2))},\\qquad v_2=${expressionVectorTex(symbolicV2)}`),
        paragraph('Al colocar esos dos autovectores como columnas obtenemos la matriz de cambio de base que lleva A a la diagonal anterior.'),
        math(`P=[\\,v_1\\ v_2\\,]=${pTex}`),
      ],
    }
  }

  if (Math.abs(discriminant) <= EPSILON) {
    const lambda = trace / 2

    if (isScalarMatrix(matrix, lambda)) {
      const pTex = matrixTex([[1, 0], [0, 1]])
      const canonicalTex = matrixTex([[lambda, 0], [0, lambda]])

      return {
        symbolJ: 'J',
        P: [[1, 0], [0, 1]],
        pTex,
        canonicalTex,
        canonicalHomogeneousTex: homogeneousLinearMatrixTex([[lambda, 0], [0, lambda]]),
        hasSymbolicEntries: false,
        classificationBlocks: [
          paragraph('El discriminante se anula, de modo que sólo aparece un autovalor.'),
          math(`\\lambda=\\frac{\\operatorname{tr}(A)}{2}=${formatTexNumber(lambda)}`),
          paragraph('Además, al comparar A con lambda por la identidad vemos que no queda ninguna estructura extra por simplificar: todo vector no nulo es autovector y la matriz ya está en su forma canónica.'),
          math(`J=${canonicalTex}`),
        ],
        basisChangeBlocks: [
          paragraph('Aquí no hace falta buscar una base especial. Cualquier base de R² sirve y, por comodidad, nos quedamos con la base canónica.'),
          math(`P=I=${pTex}`),
        ],
      }
    }

    const eigen = eigenvectorFor(matrix, lambda)
    const generalized = generalizedEigenvectorFor(matrix, lambda, eigen)
    const P = matrixFromImages(generalized, eigen)
    const pTex = matrixTex(P)
    const canonicalMatrix: Matrix2 = [[lambda, 0], [1, lambda]]
    const canonicalTex = matrixTex(canonicalMatrix)

    return {
      symbolJ: 'J',
      P,
      pTex,
      canonicalTex,
      canonicalHomogeneousTex: homogeneousLinearMatrixTex(canonicalMatrix),
      hasSymbolicEntries: false,
      classificationBlocks: [
        paragraph('El discriminante vuelve a anularse, así que estamos ante un autovalor doble.'),
        math(`\\lambda=\\frac{\\operatorname{tr}(A)}{2}=${formatTexNumber(lambda)}`),
        paragraph('Sin embargo, A no coincide con lambda por la identidad, así que no aparecen dos direcciones propias independientes. En dimensión dos eso obliga a que la forma canónica tenga un único bloque de Jordan de tamaño dos.'),
        math(`J=${canonicalTex}`),
      ],
      basisChangeBlocks: [
        paragraph('Primero buscamos un autovector resolviendo el sistema homogéneo asociado al autovalor doble.'),
        math(`A-\\lambda I=${matrixTex(matrixMinusScalar(matrix, lambda))},\\qquad v=${vectorTex(eigen)}`),
        paragraph('Como un solo autovector no basta para completar la base, añadimos un vector generalizado que encaje con la cadena de Jordan.'),
        math(`(A-\\lambda I)w=v,\\qquad w=${vectorTex(generalized)}`),
        paragraph('Para obtener el bloque de Jordan en la convención usada en las notas, ordenamos la base como (w,v).'),
        math(`P=[\\,w\\ v\\,]=${pTex}`),
      ],
    }
  }

  const realPart = trace / 2
  const imaginaryPart = Math.sqrt(-discriminant) / 2
  const { u, v } = complexEigenBasis(matrix, realPart, imaginaryPart)
  const P = matrixFromImages(v, u)
  const symbolicParts = symbolicComplexEigenParts(trace, discriminant)
  const symbolicBasis = symbolicComplexEigenBasis(matrix, symbolicParts.realPart, symbolicParts.imaginaryPart)
  const pTex = expressionMatrixTex([[symbolicBasis.v[0], symbolicBasis.u[0]], [symbolicBasis.v[1], symbolicBasis.u[1]]])
  const canonicalEntries = [[symbolicParts.realPart, negateExpression(symbolicParts.imaginaryPart)], [symbolicParts.imaginaryPart, symbolicParts.realPart]]
  const canonicalTex = expressionMatrixTex(canonicalEntries)

  return {
    symbolJ: 'J_{\\mathbb R}',
    P,
    pTex,
    canonicalTex,
    canonicalHomogeneousTex: expressionHomogeneousLinearTex(canonicalEntries),
    hasSymbolicEntries: true,
    classificationBlocks: [
      paragraph('Si el discriminante sale negativo, el polinomio característico ya no tiene raíces reales.'),
      math(`\\Delta=${formatTexNumber(discriminant)}<0`),
      paragraph('En su lugar aparece un par complejo conjugado, que sigue describiendo por completo la dinámica lineal.'),
      math(`\\lambda_{\\pm}=${formatLatexExpression(symbolicParts.realPart)}\\pm ${formatLatexExpression(symbolicParts.imaginaryPart)}\\,i`),
      paragraph('Como estamos trabajando sobre los números reales, sustituimos la diagonal compleja por el bloque real equivalente, que representa la misma rotación-dilatación.'),
      math(`J_{\\mathbb R}=${canonicalTex}`),
    ],
    basisChangeBlocks: [
      paragraph('Para construir la base real adecuada, se toma un autovector complejo z = u + iv asociado al autovalor con parte imaginaria positiva y se separa en sus partes real e imaginaria.'),
      math(`u=${expressionVectorTex(symbolicBasis.u)}\\quad\\text{(parte real)},\\qquad v=${expressionVectorTex(symbolicBasis.v)}\\quad\\text{(parte imaginaria)}`),
      paragraph('Al ordenar la base real como (v,u), la conjugación reproduce exactamente el bloque canónico real anterior.'),
      math(`P=[\\,v\\ u\\,]=${pTex}`),
    ],
  }
}

function invalidLinearDocument(input: LinearReportInput): PrintableReportDocument {
  const basisMatrix = matrixFromImages(input.linearPoints.b1, input.linearPoints.b2)
  const determinant = determinant2(basisMatrix)

  return {
    kind: 'linear',
    title: 'Informe detallado de la reducción lineal en R²',
    subtitle: 'Con los datos actuales no se puede reconstruir una única aplicación lineal.',
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
        paragraph('Antes de intentar ninguna cuenta, conviene mirar exactamente qué vectores se han fijado y cuáles son sus imágenes.'),
        facts([
          mathFact('b1', vectorTex(input.linearPoints.b1)),
          mathFact('b2', vectorTex(input.linearPoints.b2)),
          mathFact('T(b1)', vectorTex(input.linearPoints.tb1)),
          mathFact('T(b2)', vectorTex(input.linearPoints.tb2)),
        ]),
      ], 'Estos son los datos de partida sobre los que debería reconstruirse la aplicación.'),
      section('obstruccion', 'Diagnóstico', 'Por qué falla la reconstrucción', [
        paragraph('La aplicación lineal sólo queda determinada de forma única cuando b1 y b2 forman una base de R². Si esos dos vectores están alineados, la información de partida no basta para distinguir una única matriz.'),
        math(`B=[b_1\\ b_2]=${matrixTex(basisMatrix)},\\qquad \\det(B)=${formatTexNumber(determinant)}`),
        note('El determinante es nulo o numéricamente despreciable, de modo que B no es invertible y la ecuación AB = Y no permite despejar una única matriz A.', 'warning'),
      ], 'Sin la inversa de B no se puede ejecutar el paso A = YB^{-1}.'),
      section('ajuste', 'Siguiente paso', 'Cómo corregirlo', [
        paragraph('La corrección es sencilla: hay que volver a elegir la base origen hasta que realmente genere todo el plano.'),
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
  const { trace, determinant, discriminant, caseLabel, shortText } = input.linearAnalysis
  const inverseBasis = inverse2(basisMatrix)

  if (!inverseBasis) {
    return invalidLinearDocument(input)
  }

  const canonicalData = buildLinearCanonicalData(matrix, trace, determinant, discriminant)
  return {
    kind: 'linear',
    title: 'Informe detallado de la reducción lineal en R²',
    subtitle: '',
    statusLabel: caseLabel,
    generatedAt: createGeneratedAtLabel(),
    highlights: [
      textFact('Caso', caseLabel),
      mathFact('A', matrixTex(matrix), true),
      mathFact(canonicalData.symbolJ, canonicalData.canonicalTex, true),
      mathFact('\\det(B)', formatTexNumber(basisDeterminant)),
    ],
    sections: [
      section('datos', 'Paso 1', 'Datos de partida', [
        paragraph('Empezamos con una base de R² elegida por el usuario y con las imágenes que se han fijado para esos dos vectores. Toda la reconstrucción saldrá de relacionar esas cuatro columnas.'),
        facts([
          mathFact('b1', vectorTex(input.linearPoints.b1)),
          mathFact('b2', vectorTex(input.linearPoints.b2)),
          mathFact('T(b1)', vectorTex(input.linearPoints.tb1)),
          mathFact('T(b2)', vectorTex(input.linearPoints.tb2)),
        ]),
      ], 'Aquí sólo reunimos la información de partida, pero ya se ve qué base entra en juego y qué hace la aplicación sobre ella.'),
      section('matrices', 'Paso 2', 'Matriz de la base y de las imágenes', [
        paragraph('El siguiente paso consiste en ordenar esos vectores por columnas. Así se separa con claridad la información de la base origen y la información de sus imágenes.'),
        math(`B=[b_1\\ b_2]=${matrixTex(basisMatrix)},\\qquad Y=[T(b_1)\\ T(b_2)]=${matrixTex(imageMatrix)}`),
        paragraph('La matriz buscada A debe transformar las columnas de B exactamente en las columnas de Y. Es decir, todavía no conocemos A, pero sí sabemos que cumple la relación AB=Y.'),
      ], 'Escribimos el problema en forma matricial para poder despejar A en el paso siguiente.'),
      section('inversa-base', 'Paso 3', 'Inversa de B', [
        paragraph('Para despejar A necesitamos invertir B. Por eso este paso decide si la reconstrucción es posible y, en caso afirmativo, deja lista la herramienta principal.'),
        math(`\\det(B)=${formatTexNumber(basisDeterminant)}\\neq 0`),
        ...inverseNarrativeBlocks(basisMatrix, 'B'),
      ], 'Si B es invertible, los datos determinan una única aplicación lineal.'),
      section('reconstruccion', 'Paso 4', 'Matriz de la aplicación en la base estándar', [
        paragraph('Ahora sí se puede despejar la matriz buscada. Basta multiplicar la igualdad AB=Y por la derecha por B^{-1} para aislar A.'),
        math(`A=YB^{-1}=${matrixTex(imageMatrix)}\\cdot${matrixTex(inverseBasis)}=${matrixTex(matrix)}`),
        paragraph('Con esta cuenta ya hemos pasado de los datos geométricos a la matriz concreta de la aplicación en la base estándar.'),
      ], 'Este es el momento en el que la aplicación queda reconstruida de manera explícita.'),
      section('polinomio', 'Paso 5', 'Polinomio característico', [
        paragraph('Una vez conocida A, miramos sus invariantes más útiles: la traza, el determinante y el discriminante del polinomio característico. Son los números que van a decidir el tipo de reducción.'),
        facts([
          mathFact('\\operatorname{tr}(A)', formatTexNumber(trace)),
          mathFact('\\det(A)', formatTexNumber(determinant)),
          mathFact('\\Delta', formatTexNumber(discriminant)),
          textFact('Lectura geométrica', shortText),
        ]),
        math(characteristicPolynomialTex(trace, determinant)),
      ], 'Aquí empieza la lectura espectral del problema: el signo del discriminante nos dirá qué forma canónica corresponde.'),
      section('clasificacion', 'Paso 6', 'Clasificación y forma canónica', canonicalData.classificationBlocks, 'Con la información espectral ya se puede decidir qué forma canónica aparece en este ejemplo.'),
      section('base-canonica', 'Paso 7', 'Autovectores y matriz de cambio de base', canonicalData.basisChangeBlocks, 'Ahora se construye la base adaptada que lleva A a la forma canónica del paso anterior.'),
      section('verificacion', 'Paso 8', 'Verificación de la forma canónica', [
        paragraph('El último cálculo importante consiste en verificar que la base elegida era la correcta. Para eso invertimos P y comprobamos directamente la conjugación.'),
        ...inverseNarrativeBlocks(canonicalData.P, 'P'),
        math(`P^{-1}AP=${canonicalData.canonicalTex}=${canonicalData.symbolJ}`),
      ], 'La identidad final confirma que la reducción está bien hecha y que la base adaptada funciona.'),
      section('resumen', 'Resumen', 'Resumen', [
        paragraph('Si se recorre todo el proceso de corrido, la historia del cálculo queda así:'),
        list([
          'Primero se comprueba que b1 y b2 realmente forman una base, es decir, que det(B) no se anula.',
          'Después se escriben los datos en las matrices B y Y para traducir el problema geométrico a una igualdad matricial.',
          'Con la inversa de B se despeja A y queda reconstruida la aplicación en la base estándar.',
          'A continuación, la traza, el determinante y el discriminante indican qué tipo de forma canónica corresponde.',
          'Con esa información se construye una base adaptada mediante autovectores o, si hace falta, un vector generalizado.',
          'Por último se verifica la reducción comprobando que P^{-1}AP coincide con la forma canónica obtenida.',
        ]),
      ], 'Este repaso final junta en pocas líneas toda la cadena de cálculos.'),
    ],
    closingFacts: [
      mathFact('A', matrixTex(matrix), true),
      mathFact('P', canonicalData.pTex, true),
      mathFact(canonicalData.symbolJ, canonicalData.canonicalTex, true),
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
    subtitle: 'Con los datos actuales no se puede reconstruir una única aplicación afín.',
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
        paragraph('Lo primero es mirar con calma los tres puntos origen elegidos y las imágenes que se les han asignado.'),
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
        paragraph('La clasificación afín empieza comprobando que p0, p1 y p2 no estén alineados. Equivalentemente, los vectores p1 - p0 y p2 - p0 deben ser linealmente independientes en el espacio de direcciones.'),
        math(`p_1-p_0=${vectorTex(input.affineSource.p1)}-${vectorTex(input.affineSource.p0)}=${vectorTex(side1)}`),
        math(`p_2-p_0=${vectorTex(input.affineSource.p2)}-${vectorTex(input.affineSource.p0)}=${vectorTex(side2)}`),
        math(`(p_1-p_0)\\wedge(p_2-p_0)=\\begin{vmatrix}${formatTexNumber(side1.x)} & ${formatTexNumber(side2.x)}\\\\${formatTexNumber(side1.y)} & ${formatTexNumber(side2.y)}\\end{vmatrix}=${formatTexNumber(input.affineDraftArea)}`),
        note('El área orientada doble es nula o demasiado pequeña, así que la referencia afín origen es degenerada.', 'warning'),
      ]),
      section('ajuste', 'Siguiente paso', 'Cómo corregirlo', [
        paragraph('En cuanto el triángulo origen deje de ser degenerado, la terna (p0,p1,p2) vuelve a definir una referencia afín y el resto del proceso se recupera sin cambios.'),
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

function affineNormalMapTex(canonicalLinearPart: Matrix2, canonicalTranslation: Vec2, canonicalLinearTex?: string) {
  return `F_{\\mathrm{can}}(x)=${canonicalLinearTex ?? matrixTex(canonicalLinearPart)}x+${vectorTex(canonicalTranslation)}`
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

  const system = identityMinusMatrix(linearPart)
  const blocks: ReportBlock[] = [
    paragraph('Con la descomposición afín F(x) = A x + b ya reconstruida, toca decidir si el término de traslación puede absorberse mediante un cambio de origen. El criterio es estudiar la ecuación de puntos fijos.'),
    facts([
      textFact('Caso afín', analysis.caseLabel),
      textFact('Conjunto fijo', analysis.fixedSet.label),
      textFact('Forma normal', analysis.canonicalFixedSet.label),
      textFact('Lectura geométrica', analysis.shortText),
    ]),
    math(`(I-A)x=b,\\qquad I-A=${matrixTex(system)},\\qquad b=${vectorTex(translation)}`),
  ]

  if (analysis.fixedSet.kind === 'point' && analysis.fixedSet.point) {
    blocks.push(paragraph('El sistema tiene solución única, así que existe un punto fijo. En el paso siguiente se usará como nuevo origen para eliminar el término independiente.'))
    blocks.push(math(`c=${vectorTex(analysis.fixedSet.point)}`))
    return blocks
  }

  if (analysis.fixedSet.kind === 'line' && analysis.fixedSet.anchor && analysis.fixedSet.direction) {
    blocks.push(paragraph('El sistema es compatible indeterminado. No aparece un único punto fijo, sino una recta afín completa; el paso siguiente permite elegir cualquiera de sus puntos como origen.'))
    blocks.push(
      math(`c=${vectorTex(analysis.fixedSet.anchor)}+s\\,${vectorTex(analysis.fixedSet.direction)}`),
    )
    return blocks
  }

  if (analysis.fixedSet.kind === 'plane') {
    blocks.push(paragraph('La ecuación se satisface para cualquier punto del plano: la aplicación coincide con la identidad afín y todo punto es fijo.'))
    return blocks
  }

  blocks.push(paragraph('Aquí el sistema no tiene solución, de modo que la traslación no puede eliminarse por cambio de origen. Queda, por tanto, un componente afín esencial en la forma normal.'))

  if (analysis.caseLabel === 'Traslación no trivial') {
    blocks.push(paragraph('La parte lineal es la identidad, así que toda la información geométrica queda en el vector de traslación. Se elige una referencia afín donde ese vector adopte su forma normalizada.'))
    return blocks
  }

  if (analysis.caseLabel === 'Sin punto fijo y con un autovalor igual a 1') {
    blocks.push(paragraph('En una base propia adaptada, la parte esencial de la traslación sobrevive en la dirección asociada al autovalor 1. Después se normaliza esa coordenada a una unidad.'))
    return blocks
  }

  if (analysis.caseLabel === 'Caso parabólico sin punto fijo') {
    blocks.push(paragraph('El bloque de Jordan del autovalor 1 deja una traslación esencial que no puede eliminarse. Tras elegir una base de Jordan y normalizar esa componente, aparece la forma parabólica estándar.'))
    return blocks
  }

  blocks.push(paragraph('En el resto de casos, la forma normal afín queda gobernada por la parte lineal y por su representación homogénea en una referencia adaptada.'))
  return blocks
}

function scaleVector(vector: Vec2, scalar: number): Vec2 {
  return { x: scalar * vector.x, y: scalar * vector.y }
}

function perpendicularVector(vector: Vec2): Vec2 {
  return Math.abs(vector.x) >= Math.abs(vector.y)
    ? { x: -vector.y, y: vector.x }
    : { x: vector.y, y: -vector.x }
}

function fixedSetOrigin(analysis: AffineAnalysis): Vec2 {
  if (analysis.fixedSet.kind === 'point' && analysis.fixedSet.point) {
    return analysis.fixedSet.point
  }

  if (analysis.fixedSet.kind === 'line' && analysis.fixedSet.anchor) {
    return analysis.fixedSet.anchor
  }

  return { x: 0, y: 0 }
}

function affineNormalFacts(analysis: AffineAnalysis, canonicalLinearTex?: string, canonicalHomogeneousTex?: string): ReportBlock[] {
  return [
    facts([
      mathFact('A_{\\mathrm{can}}', canonicalLinearTex ?? matrixTex(analysis.canonicalLinearPart), true),
      mathFact('b_{\\mathrm{can}}', vectorTex(analysis.canonicalTranslation)),
      textFact('Conjunto fijo canónico', analysis.canonicalFixedSet.label),
      textFact('Lectura rápida', analysis.shortText),
    ]),
    math(`H_{\\mathrm{can}}=${canonicalHomogeneousTex ?? matrixTex(analysis.canonicalHomogeneous)}`),
    math(affineNormalMapTex(analysis.canonicalLinearPart, analysis.canonicalTranslation, canonicalLinearTex)),
  ]
}

function multiplyMatrices3(left: number[][], right: number[][]) {
  return left.map((row) =>
    right[0].map((_, columnIndex) =>
      row.reduce((sum, entry, rowIndex) => sum + entry * right[rowIndex][columnIndex], 0),
    ),
  )
}

function homogeneousChangeOfReference(origin: Vec2, basis: Matrix2) {
  return [
    [1, 0, 0],
    [origin.x, basis[0][0], basis[0][1]],
    [origin.y, basis[1][0], basis[1][1]],
  ]
}

function inverseHomogeneousChangeOfReference(origin: Vec2, basis: Matrix2) {
  const inverseBasis = inverse2(basis)

  if (!inverseBasis) {
    return null
  }

  return homogeneousFromAffine(inverseBasis, applyMatrix(inverseBasis, { x: -origin.x, y: -origin.y }))
}

function affineHomogeneousVerificationBlocks(
  linearPart: Matrix2,
  translation: Vec2,
  origin: Vec2,
  basis: Matrix2,
  basisTex?: string,
  canonicalHomogeneousTex?: string,
): ReportBlock[] {
  if (basisTex && canonicalHomogeneousTex) {
    return [
      paragraph('El último paso comprueba la forma normal con la matriz homogénea del cambio de referencia x = O + Pz. Mantenemos P en forma simbólica para no perder fracciones ni raíces.'),
      math(`C=\\begin{pmatrix}1&0\\\\O&P\\end{pmatrix},\\qquad O=${vectorTex(origin)},\\qquad P=${basisTex}`),
      math(`C^{-1}H_FC=H_{\\mathrm{can}}=${canonicalHomogeneousTex}`),
    ]
  }

  const change = homogeneousChangeOfReference(origin, basis)
  const inverseChange = inverseHomogeneousChangeOfReference(origin, basis)

  if (!inverseChange) {
    return [
      note('La matriz del cambio de referencia no es invertible, así que no se puede completar la comprobación homogénea.', 'warning'),
      math(`C=${matrixTex(change)}`),
    ]
  }

  const transformed = multiplyMatrices3(
    multiplyMatrices3(inverseChange, homogeneousFromAffine(linearPart, translation)),
    change,
  )

  return [
    paragraph('El último paso comprueba la forma normal con la matriz homogénea del cambio de referencia x = O + Pz. En la notación del capítulo, la matriz nueva es C^{-1}H_FC.'),
    math(`C=${matrixTex(change)}`),
    math(`C^{-1}H_FC=${matrixTex(transformed)}=H_{\\mathrm{can}}`),
  ]
}

function referenceBlock(origin: Vec2, basis: Matrix2, basisTex?: string): ReportBlock {
  if (basisTex) {
    return math(`\\mathcal R=(O,P),\\qquad O=${vectorTex(origin)},\\qquad P=${basisTex}`)
  }

  return math(`\\mathcal R=(${vectorTex(origin)},(${vectorTex({ x: basis[0][0], y: basis[1][0] })},${vectorTex({ x: basis[0][1], y: basis[1][1] })}))`)
}

function buildAffineNormalAlgorithmSections(linearPart: Matrix2, translation: Vec2, analysis: AffineAnalysis): ReportSection[] {
  const system = identityMinusMatrix(linearPart)

  if (analysis.fixedSet.kind !== 'none') {
    const origin = fixedSetOrigin(analysis)
    const linearTrace = trace2(linearPart)
    const linearDeterminant = determinant2(linearPart)
    const discriminant = linearTrace * linearTrace - 4 * linearDeterminant
    const canonicalData = buildLinearCanonicalData(linearPart, linearTrace, linearDeterminant, discriminant)
    const canonicalHomogeneousTex = canonicalData.canonicalHomogeneousTex
    const verificationBasisTex = canonicalData.hasSymbolicEntries ? canonicalData.pTex : undefined
    const verificationHomogeneousTex = canonicalData.hasSymbolicEntries ? canonicalHomogeneousTex : undefined
    const fixedBlocks: ReportBlock[] = [
      paragraph('Como la ecuación de puntos fijos es compatible, el algoritmo del capítulo 7 elige una solución como nuevo origen. Con ese cambio, la traslación desaparece.'),
      math(`(I-A)x=b,\\qquad I-A=${matrixTex(system)},\\qquad b=${vectorTex(translation)}`),
    ]

    if (analysis.fixedSet.kind === 'point' && analysis.fixedSet.point) {
      fixedBlocks.push(paragraph('Aquí el sistema tiene solución única, así que el origen adaptado es ese punto fijo.'))
      fixedBlocks.push(math(`c_0=${vectorTex(analysis.fixedSet.point)}`))
    } else if (analysis.fixedSet.kind === 'line' && analysis.fixedSet.anchor && analysis.fixedSet.direction) {
      fixedBlocks.push(paragraph('Aquí el sistema es compatible indeterminado: los puntos fijos forman una recta. El algoritmo permite tomar cualquier punto de esa recta como origen.'))
      fixedBlocks.push(math(`c=${vectorTex(analysis.fixedSet.anchor)}+s\\,${vectorTex(analysis.fixedSet.direction)},\\qquad c_0=${vectorTex(origin)}`))
    } else {
      fixedBlocks.push(paragraph('Aquí todo punto es fijo. Tomamos el origen canónico como punto fijo elegido para mantener la referencia lo más simple posible.'))
      fixedBlocks.push(math(`c_0=${vectorTex(origin)}`))
    }

    return [
      section('eliminar-traslacion', 'Paso 3', 'Si hay punto fijo, eliminar la traslación', [
        ...fixedBlocks,
        paragraph('Con el cambio de coordenadas z = x - c0, la traslación desaparece y la clasificación afín se reduce a la parte lineal.'),
        math('\\tau_{-c_0}\\circ F\\circ\\tau_{c_0}(z)=Az'),
      ], 'El caso compatible se centra en un punto fijo.'),
      section('reducir-lineal', 'Paso 4', 'Reducir la parte lineal', [
        ...canonicalData.classificationBlocks,
        ...canonicalData.basisChangeBlocks,
        math(`P=${canonicalData.pTex}`),
      ], 'Después de eliminar la traslación, queda la forma real de Jordan de A.'),
      section('referencia-adaptada', 'Paso 5', 'Elegir la referencia adaptada', [
        referenceBlock(origin, canonicalData.P, canonicalData.pTex),
      ], 'La referencia nueva combina el origen elegido y la base lineal adaptada.'),
      section('comprobacion-homogenea', 'Paso 6', 'Comprobar la matriz homogénea canónica', [
        ...affineHomogeneousVerificationBlocks(linearPart, translation, origin, canonicalData.P, verificationBasisTex, verificationHomogeneousTex),
        ...affineNormalFacts(analysis, canonicalData.canonicalTex, canonicalHomogeneousTex),
      ], 'La comprobación final usa el producto C^{-1}H_FC.'),
    ]
  }

  if (analysis.caseLabel === 'Traslación no trivial') {
    const v1 = translation
    const v2 = perpendicularVector(translation)
    const P = matrixFromImages(v1, v2)

    return [
      section('traslacion-residual', 'Paso 3', 'Separar la traslación residual', [
        paragraph('Como A = I, se tiene im(I-A) = {0}. Ninguna parte de b puede absorberse cambiando el origen, así que toda la traslación es residual.'),
        math(`b_1=${vectorTex({ x: 0, y: 0 })},\\qquad b_2=b=${vectorTex(translation)}`),
      ], 'En una traslación pura no hay componente eliminable.'),
      section('absorber-traslacion', 'Paso 4', 'Absorber la parte eliminable', [
        paragraph('Este paso no modifica la aplicación: al ser I-A = 0, no existe componente b1 dentro de im(I-A).'),
      ], 'La traslación no trivial queda entera para la normalización.'),
      section('referencia-adaptada', 'Paso 5', 'Elegir una base adaptada y normalizar', [
        math(`p_1=b=${vectorTex(v1)},\\qquad p_2=${vectorTex(v2)},\\qquad P=[p_1\\ p_2]=${matrixTex(P)}`),
        paragraph('En esa base, la traslación queda normalizada como primera coordenada. No hace falta mover el origen.'),
        math(`P^{-1}b=${vectorTex({ x: 1, y: 0 })}`),
        referenceBlock({ x: 0, y: 0 }, P),
      ], 'La base convierte la traslación en (1,0).'),
      section('comprobacion-homogenea', 'Paso 6', 'Comprobar la matriz homogénea canónica', [
        ...affineHomogeneousVerificationBlocks(linearPart, translation, { x: 0, y: 0 }, P),
        ...affineNormalFacts(analysis),
      ], 'La forma normal se verifica por conjugación homogénea.'),
    ]
  }

  if (analysis.caseLabel === 'Sin punto fijo y con un autovalor igual a 1') {
    const linearTrace = trace2(linearPart)
    const linearDeterminant = determinant2(linearPart)
    const discriminant = linearTrace * linearTrace - 4 * linearDeterminant
    const root = Math.sqrt(discriminant)
    const lambda1 = (linearTrace + root) / 2
    const lambda2 = (linearTrace - root) / 2
    const other = Math.abs(lambda1 - 1) < 1e-6 ? lambda2 : lambda1
    const v1 = eigenvectorFor(linearPart, 1)
    const v2 = eigenvectorFor(linearPart, other)
    const P = matrixFromImages(v1, v2)
    const invP = inverse2(P)
    const s = invP ? applyMatrix(invP, translation) : { x: 1, y: 0 }
    const yStar = s.y / (1 - other)
    const newOrigin = scaleVector(v2, yStar)
    const scaledV1 = scaleVector(v1, s.x)
    const imageGenerator = scaleVector(v2, 1 - other)
    const eliminableTranslation = scaleVector(v2, s.y)
    const residualTranslation = scaledV1
    const adaptedBasis = matrixFromImages(scaledV1, v2)

    return [
      section('traslacion-residual', 'Paso 3', 'Separar la traslación residual', [
        paragraph('Al pasar a una base propia, el algoritmo separa b en una componente absorbible dentro de im(I-A) y una componente residual en W = ker(I-A).'),
        math(`p_1=${vectorTex(v1)}\\ (\\lambda=1),\\qquad p_2=${vectorTex(v2)}\\ (\\lambda=${formatTexNumber(other)})`),
        math(`\\operatorname{im}(I-A)=\\langle ${vectorTex(imageGenerator)}\\rangle=\\langle p_2\\rangle,\\qquad W=\\ker(I-A)=\\langle p_1\\rangle`),
        math(`P=[p_1\\ p_2]=${matrixTex(P)},\\qquad s=P^{-1}b=${vectorTex(s)}=(s_1,s_2)`),
        math(`b_1=s_2p_2=${vectorTex(eliminableTranslation)},\\qquad b_2=s_1p_1=${vectorTex(residualTranslation)}`),
      ], 'Este es el subcaso diagonalizable sin punto fijo del capítulo 7.'),
      section('absorber-traslacion', 'Paso 4', 'Absorber la parte eliminable', [
        paragraph('La componente b1 se elimina desplazando el origen a una solución de (I-A)x0 = b1. La componente b2 queda como traslación residual.'),
        math(`y_2^*=\\frac{s_2}{1-${formatTexNumber(other)}}=${formatTexNumber(yStar)},\\qquad x_0=y_2^*p_2=${vectorTex(newOrigin)}`),
      ], 'Sólo sobrevive la componente paralela al eje del autovalor 1.'),
      section('referencia-adaptada', 'Paso 5', 'Elegir una base adaptada y normalizar', [
        paragraph('Para que la traslación residual sea exactamente (1,0), tomamos como primer vector de la base la propia componente residual b2.'),
        math(`p_1'=b_2=s_1p_1=${vectorTex(scaledV1)},\\qquad p_2'=p_2=${vectorTex(v2)},\\qquad P_{\\mathrm{ad}}=[p_1'\\ p_2']=${matrixTex(adaptedBasis)}`),
        referenceBlock(newOrigin, adaptedBasis),
      ], 'La forma queda (u1,u2) -> (u1+1, mu u2).'),
      section('comprobacion-homogenea', 'Paso 6', 'Comprobar la matriz homogénea canónica', [
        ...affineHomogeneousVerificationBlocks(linearPart, translation, newOrigin, adaptedBasis),
        ...affineNormalFacts(analysis),
      ], 'La forma normal se verifica con el producto homogéneo.'),
    ]
  }

  if (analysis.caseLabel === 'Caso parabólico sin punto fijo') {
    const eigen = eigenvectorFor(linearPart, 1)
    const generalized = generalizedEigenvectorFor(linearPart, 1, eigen)
    const P = matrixFromImages(generalized, eigen)
    const invP = inverse2(P)
    const s = invP ? applyMatrix(invP, translation) : { x: 1, y: 0 }
    const newOrigin = scaleVector(generalized, -s.y)
    const scaledGeneralized = scaleVector(generalized, s.x)
    const scaledEigen = scaleVector(eigen, s.x)
    const eliminableTranslation = scaleVector(eigen, s.y)
    const residualTranslation = scaledGeneralized
    const adaptedBasis = matrixFromImages(scaledGeneralized, scaledEigen)

    return [
      section('traslacion-residual', 'Paso 3', 'Separar la traslación residual', [
        paragraph('En el caso parabólico usamos la convención de Jordan inferior: primero un vector generalizado y después el autovector. Aquí im(I-A) = ker(I-A), y elegimos como suplementario la dirección del vector generalizado.'),
        math(`p_1=${vectorTex(generalized)},\\qquad p_2=${vectorTex(eigen)},\\qquad (A-I)p_1=p_2`),
        math(`\\operatorname{im}(I-A)=\\ker(I-A)=\\langle p_2\\rangle,\\qquad W=\\langle p_1\\rangle`),
        math(`P=[p_1\\ p_2]=${matrixTex(P)},\\qquad s=P^{-1}b=${vectorTex(s)}=(s_1,s_2)`),
        math(`b_1=s_2p_2=${vectorTex(eliminableTranslation)},\\qquad b_2=s_1p_1=${vectorTex(residualTranslation)}`),
      ], 'La parte s1 es esencial y la parte s2 se absorberá desplazando el origen.'),
      section('absorber-traslacion', 'Paso 4', 'Absorber la parte eliminable', [
        paragraph('La componente b1 se elimina buscando x0 con (I-A)x0 = b1. Como (I-A)p1 = -p2, basta mover el origen en la dirección del vector generalizado.'),
        math(`x_0=-s_2p_1=${vectorTex(newOrigin)}`),
      ], 'Después del centrado queda sólo la traslación esencial.'),
      section('referencia-adaptada', 'Paso 5', 'Elegir una base adaptada y normalizar', [
        paragraph('Tomamos p1 igual a la traslación residual y p2 = (A-I)p1. Así se conserva el bloque de Jordan y la traslación queda normalizada.'),
        math(`p_1'=b_2=s_1p_1=${vectorTex(scaledGeneralized)},\\qquad p_2'=(A-I)p_1'=s_1p_2=${vectorTex(scaledEigen)},\\qquad P_{\\mathrm{ad}}=[p_1'\\ p_2']=${matrixTex(adaptedBasis)}`),
        referenceBlock(newOrigin, adaptedBasis),
      ], 'La forma queda (u1,u2) -> (u1+1, u1+u2).'),
      section('comprobacion-homogenea', 'Paso 6', 'Comprobar la matriz homogénea canónica', [
        ...affineHomogeneousVerificationBlocks(linearPart, translation, newOrigin, adaptedBasis),
        ...affineNormalFacts(analysis),
      ], 'La forma normal parabólica se confirma con matrices homogéneas.'),
    ]
  }

  const linearTrace = trace2(linearPart)
  const linearDeterminant = determinant2(linearPart)
  const discriminant = linearTrace * linearTrace - 4 * linearDeterminant
  const canonicalData = buildLinearCanonicalData(linearPart, linearTrace, linearDeterminant, discriminant)
  const canonicalHomogeneousTex = canonicalData.canonicalHomogeneousTex
  const verificationBasisTex = canonicalData.hasSymbolicEntries ? canonicalData.pTex : undefined
  const verificationHomogeneousTex = canonicalData.hasSymbolicEntries ? canonicalHomogeneousTex : undefined

  return [
    section('traslacion-residual', 'Paso 3', 'Separar la traslación residual', [
      paragraph('No se detecta una traslación esencial adicional en la forma normal mostrada. La reducción queda gobernada por la parte lineal.'),
    ]),
    section('absorber-traslacion', 'Paso 4', 'Reducir la parte lineal', [
      ...canonicalData.classificationBlocks,
      ...canonicalData.basisChangeBlocks,
    ]),
    section('referencia-adaptada', 'Paso 5', 'Elegir la referencia adaptada', [
      referenceBlock({ x: 0, y: 0 }, canonicalData.P, canonicalData.pTex),
    ]),
    section('comprobacion-homogenea', 'Paso 6', 'Comprobar la matriz homogénea canónica', [
      ...affineHomogeneousVerificationBlocks(linearPart, translation, { x: 0, y: 0 }, canonicalData.P, verificationBasisTex, verificationHomogeneousTex),
      ...affineNormalFacts(analysis, canonicalData.canonicalTex, canonicalHomogeneousTex),
    ]),
  ]
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
  const displayTrace = trace2(linearPart)
  const displayDeterminant = determinant2(linearPart)
  const displayDiscriminant = displayTrace * displayTrace - 4 * displayDeterminant
  const displayCanonicalData = buildLinearCanonicalData(linearPart, displayTrace, displayDeterminant, displayDiscriminant)
  const canonicalTranslationIsZero = Math.abs(analysis.canonicalTranslation.x) < EPSILON && Math.abs(analysis.canonicalTranslation.y) < EPSILON
  const canonicalHomogeneousTex = canonicalTranslationIsZero ? displayCanonicalData.canonicalHomogeneousTex : matrixTex(analysis.canonicalHomogeneous)

  return {
    kind: 'affine',
    title: 'Informe detallado de la clasificación afín en R²',
    subtitle: '',
    statusLabel: analysis.caseLabel,
    generatedAt: createGeneratedAtLabel(),
    highlights: [
      textFact('Caso afín', analysis.caseLabel),
      textFact('Conjunto fijo', analysis.fixedSet.label),
      mathFact('A', matrixTex(linearPart), true),
      mathFact('H_{\\mathrm{can}}', canonicalHomogeneousTex, true),
    ],
    sections: [
      section('separar', 'Paso 1', 'Separar la parte lineal y la traslación', [
        paragraph('El algoritmo del capítulo 7 parte de una afinidad escrita como F(x)=Ax+b. Como aquí los datos llegan mediante tres puntos origen y sus imágenes, primero reconstruimos esa descomposición.'),
        facts([
          mathFact('p0', vectorTex(input.affineSource.p0)),
          mathFact('p1', vectorTex(input.affineSource.p1)),
          mathFact('p2', vectorTex(input.affineSource.p2)),
          mathFact('q0', vectorTex(input.affineImages.q0)),
          mathFact('q1', vectorTex(input.affineImages.q1)),
          mathFact('q2', vectorTex(input.affineImages.q2)),
        ]),
        paragraph('Para pasar de puntos a direcciones, restamos p0. Así formulamos el problema en el espacio de direcciones mediante los vectores p1 - p0 y p2 - p0.'),
        math(`p_1-p_0=${vectorTex(input.affineSource.p1)}-${vectorTex(input.affineSource.p0)}=${vectorTex(side1)}`),
        math(`p_2-p_0=${vectorTex(input.affineSource.p2)}-${vectorTex(input.affineSource.p0)}=${vectorTex(side2)}`),
        math(`(p_1-p_0)\\wedge(p_2-p_0)=\\begin{vmatrix}${formatTexNumber(side1.x)} & ${formatTexNumber(side2.x)}\\\\${formatTexNumber(side1.y)} & ${formatTexNumber(side2.y)}\\end{vmatrix}=${formatTexNumber(input.affineDraftArea)}`),
        facts([
          mathFact('Área doble', formatTexNumber(input.affineDraftArea)),
          mathFact('Área geométrica', formatTexNumber(Math.abs(input.affineDraftArea) / 2)),
          textFact('Conclusión', 'Los tres puntos origen forman una referencia afín válida'),
        ]),
        paragraph('Con las direcciones del triángulo origen y del triángulo imagen se reconstruye la parte lineal A. Luego se obtiene la traslación b imponiendo F(p0) = q0.'),
        math(`S=[p_1-p_0\\ p_2-p_0]=${matrixTex(sourceFrame)},\\qquad T=[q_1-q_0\\ q_2-q_0]=${matrixTex(imageFrame)}`),
        ...inverseNarrativeBlocks(sourceFrame, 'S'),
        math(`A=TS^{-1}=${matrixTex(imageFrame)}\\cdot${matrixTex(inverseSource)}=${matrixTex(linearPart)}`),
        math(`b=q_0-Ap_0=${vectorTex(input.affineImages.q0)}-${matrixTex(linearPart)}${vectorTex(input.affineSource.p0)}=${vectorTex(translation)}`),
        math(`H_F=${matrixTex(analysis.sourceHomogeneous)}`),
      ], 'Quedan fijados A, b y la matriz homogénea inicial H_F.'),
      section('puntos-fijos', 'Paso 2', 'Resolver la ecuación de puntos fijos', buildAffineClassificationBlocks(linearPart, translation, input), 'Este paso decide si la traslación puede eliminarse poniendo el origen en un punto fijo.'),
      ...buildAffineNormalAlgorithmSections(linearPart, translation, analysis),
      section('resumen', 'Resumen', 'Resumen', [
        paragraph('Si se leen juntos los pasos anteriores, el proceso completo se resume así:'),
        list([
          'Separar la parte lineal y la traslación: reconstruir A, b y H_F.',
          'Resolver la ecuación de puntos fijos (I-A)x=b.',
          'Si hay punto fijo, trasladar el origen a una solución; si no lo hay, separar la traslación residual.',
          'Absorber la parte eliminable de la traslación o reducir la parte lineal que queda.',
          'Elegir una referencia afín adaptada y normalizar los parámetros esenciales.',
          'Comprobar la forma normal mediante C^{-1}H_FC=H_can.',
        ]),
      ], 'Este repaso final deja el hilo del ejemplo en pocas líneas y sin tecnicismos innecesarios.'),
    ],
    closingFacts: [
      mathFact('A', matrixTex(linearPart), true),
      mathFact('b', vectorTex(translation)),
      mathFact('H_{\\mathrm{can}}', canonicalHomogeneousTex, true),
    ],
  }
}

export function formatVectorForDisplay(vector: Vec2) {
  return `(${formatMatrixEntry(vector.x)}, ${formatMatrixEntry(vector.y)})`
}
