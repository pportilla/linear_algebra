export type Vec2 = { x: number; y: number }
export type Matrix2 = [[number, number], [number, number]]
export type Homogeneous3 = [number[], number[], number[]]
export type PointId = 'p0' | 'p1' | 'p2' | 'q0' | 'q1' | 'q2'
export type LinearPointId = 'b1' | 'b2' | 'tb1' | 'tb2'

import {
  addExpressions,
  expressionFromNumber,
  formatPlainExpression,
  formatPlainNumber,
  scaleExpression,
  squareRootExpressionFromNumber,
  subtractExpressions,
} from './symbolicMath'

export interface LinearMapData {
  basisMatrix: Matrix2
  imageMatrix: Matrix2
  matrix: Matrix2
  basisDeterminant: number
}

export interface LinearAnalysis {
  sourceMatrix: Matrix2
  canonicalMatrix: Matrix2
  caseId: 'distinct-real' | 'scalar' | 'jordan-block' | 'complex-pair'
  caseLabel: string
  canonicalTitle: string
  shortText: string
  canvasSubtitle: string
  steps: string[]
  trace: number
  determinant: number
  discriminant: number
}

export interface AffineAnalysis {
  sourceLinearPart: Matrix2
  sourceTranslation: Vec2
  sourceHomogeneous: number[][]
  canonicalLinearPart: Matrix2
  canonicalTranslation: Vec2
  canonicalHomogeneous: number[][]
  fixedSet: AffineFixedSet
  canonicalFixedSet: AffineFixedSet
  caseLabel: string
  shortText: string
  canvasSubtitle: string
  steps: string[]
}

export interface AffineFixedSet {
  kind: 'none' | 'point' | 'line' | 'plane'
  point?: Vec2
  anchor?: Vec2
  direction?: Vec2
  label: string
}

const EPSILON = 1e-8

export function formatMatrixEntry(value: number) {
  return formatPlainNumber(value)
}

function symbolicNumber(value: number) {
  return expressionFromNumber(value)
}

function symbolicDistinctRealEigenvalues(trace: number, discriminant: number) {
  const traceExpression = symbolicNumber(trace)
  const rootExpression = squareRootExpressionFromNumber(discriminant) ?? symbolicNumber(Math.sqrt(discriminant))

  if (!traceExpression || !rootExpression) {
    return null
  }

  const halfTrace = scaleExpression(traceExpression, 1, 2)
  const halfRoot = scaleExpression(
    rootExpression,
    1,
    2,
  )

  return {
    lambda1: addExpressions(halfTrace, halfRoot),
    lambda2: subtractExpressions(halfTrace, halfRoot),
  }
}

function symbolicComplexEigenParts(trace: number, discriminant: number) {
  const traceExpression = symbolicNumber(trace)
  const imaginaryExpression = squareRootExpressionFromNumber(-discriminant) ?? symbolicNumber(Math.sqrt(-discriminant))

  if (!traceExpression || !imaginaryExpression) {
    return null
  }

  return {
    realPart: scaleExpression(traceExpression, 1, 2),
    imaginaryPart: scaleExpression(imaginaryExpression, 1, 2),
  }
}

export function matrixFromImages(left: Vec2, right: Vec2): Matrix2 {
  return [
    [left.x, right.x],
    [left.y, right.y],
  ]
}

export function matrixToRows(matrix: Matrix2 | number[][]) {
  return matrix.map((row) => [...row])
}

export function determinant2(matrix: Matrix2) {
  return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]
}

export function trace2(matrix: Matrix2) {
  return matrix[0][0] + matrix[1][1]
}

export function subtractVectors(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x - right.x, y: left.y - right.y }
}

export function addVectors(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y }
}

export function applyMatrix(matrix: Matrix2, vector: Vec2): Vec2 {
  return {
    x: matrix[0][0] * vector.x + matrix[0][1] * vector.y,
    y: matrix[1][0] * vector.x + matrix[1][1] * vector.y,
  }
}

export function applyAffine(matrix: Matrix2, translation: Vec2, vector: Vec2): Vec2 {
  return addVectors(applyMatrix(matrix, vector), translation)
}

export function multiplyMatrices(left: Matrix2, right: Matrix2): Matrix2 {
  return [
    [
      left[0][0] * right[0][0] + left[0][1] * right[1][0],
      left[0][0] * right[0][1] + left[0][1] * right[1][1],
    ],
    [
      left[1][0] * right[0][0] + left[1][1] * right[1][0],
      left[1][0] * right[0][1] + left[1][1] * right[1][1],
    ],
  ]
}

export function inverse2(matrix: Matrix2): Matrix2 | null {
  const determinant = determinant2(matrix)
  if (Math.abs(determinant) < EPSILON) {
    return null
  }

  return [
    [matrix[1][1] / determinant, -matrix[0][1] / determinant],
    [-matrix[1][0] / determinant, matrix[0][0] / determinant],
  ]
}

export function homogeneousFromAffine(matrix: Matrix2, translation: Vec2): Homogeneous3 {
  return [
    [1, 0, 0],
    [translation.x, matrix[0][0], matrix[0][1]],
    [translation.y, matrix[1][0], matrix[1][1]],
  ]
}

export function pointAreaTwice(p0: Vec2, p1: Vec2, p2: Vec2) {
  return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x)
}

export function isAffineConfigurationValid(p0: Vec2, p1: Vec2, p2: Vec2) {
  return Math.abs(pointAreaTwice(p0, p1, p2)) > EPSILON
}

export function linearMapFromBasis(b1: Vec2, b2: Vec2, tb1: Vec2, tb2: Vec2): LinearMapData | null {
  const basisMatrix = matrixFromImages(b1, b2)
  const imageMatrix = matrixFromImages(tb1, tb2)
  const inverseBasis = inverse2(basisMatrix)

  if (!inverseBasis) {
    return null
  }

  return {
    basisMatrix,
    imageMatrix,
    matrix: multiplyMatrices(imageMatrix, inverseBasis),
    basisDeterminant: determinant2(basisMatrix),
  }
}

function normalizeVector(vector: Vec2) {
  const length = Math.hypot(vector.x, vector.y)
  if (length < EPSILON) {
    return { x: 1, y: 0 }
  }
  return { x: vector.x / length, y: vector.y / length }
}

function kernelVector(matrix: Matrix2): Vec2 {
  const [[a, b], [c, d]] = matrix

  if (Math.abs(a) + Math.abs(b) > EPSILON) {
    return normalizeVector({ x: -b, y: a })
  }

  if (Math.abs(c) + Math.abs(d) > EPSILON) {
    return normalizeVector({ x: -d, y: c })
  }

  return { x: 1, y: 0 }
}

function solvePossiblySingular(matrix: Matrix2, rhs: Vec2): Vec2 | null {
  const inverse = inverse2(matrix)
  if (inverse) {
    return applyMatrix(inverse, rhs)
  }

  const rows = [
    { a: matrix[0][0], b: matrix[0][1], c: rhs.x },
    { a: matrix[1][0], b: matrix[1][1], c: rhs.y },
  ].sort((left, right) => Math.abs(right.a) + Math.abs(right.b) - (Math.abs(left.a) + Math.abs(left.b)))

  const pivot = rows[0]
  if (Math.abs(pivot.a) + Math.abs(pivot.b) < EPSILON) {
    return Math.abs(rhs.x) + Math.abs(rhs.y) < EPSILON ? { x: 0, y: 0 } : null
  }

  const candidate =
    Math.abs(pivot.a) >= Math.abs(pivot.b)
      ? { x: pivot.c / pivot.a, y: 0 }
      : { x: 0, y: pivot.c / pivot.b }
  const image = applyMatrix(matrix, candidate)

  if (Math.hypot(image.x - rhs.x, image.y - rhs.y) > 1e-6) {
    return null
  }

  return candidate
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

function matrixMinusScalarIdentity(matrix: Matrix2, scalar: number): Matrix2 {
  return [
    [matrix[0][0] - scalar, matrix[0][1]],
    [matrix[1][0], matrix[1][1] - scalar],
  ]
}

export function classifyLinearMap(sourceMatrix: Matrix2): LinearAnalysis {
  const trace = trace2(sourceMatrix)
  const determinant = determinant2(sourceMatrix)
  const discriminant = trace * trace - 4 * determinant

  if (discriminant > EPSILON) {
    const root = Math.sqrt(discriminant)
    const lambda1 = (trace + root) / 2
    const lambda2 = (trace - root) / 2
    const symbolicEigenvalues = symbolicDistinctRealEigenvalues(trace, discriminant)
    const lambda1Label = symbolicEigenvalues ? formatPlainExpression(symbolicEigenvalues.lambda1) : formatMatrixEntry(lambda1)
    const lambda2Label = symbolicEigenvalues ? formatPlainExpression(symbolicEigenvalues.lambda2) : formatMatrixEntry(lambda2)
    return {
      sourceMatrix,
      canonicalMatrix: [[lambda1, 0], [0, lambda2]],
      caseId: 'distinct-real',
      caseLabel: 'Dos autovalores reales distintos',
      canonicalTitle: 'Forma de Jordan',
      shortText: 'La matriz se puede diagonalizar: aparecen dos direcciones propias independientes y la forma canónica queda en diagonal.',
      canvasSubtitle: 'El plano inferior usa la base estándar y la matriz diagonal semejante a la original.',
      steps: [
        `Primero se calculan la traza ${formatMatrixEntry(trace)} y el determinante ${formatMatrixEntry(determinant)}.`,
        `Después se mira el discriminante del polinomio característico, que vale ${formatMatrixEntry(discriminant)} y sale positivo.`,
        `Eso da dos autovalores reales distintos: ${lambda1Label} y ${lambda2Label}.`,
        'Como aparecen dos direcciones propias independientes, la matriz se puede diagonalizar.',
        'La forma canónica queda en la diagonal formada por esos dos autovalores.',
      ],
      trace,
      determinant,
      discriminant,
    }
  }

  if (Math.abs(discriminant) <= EPSILON) {
    const lambda = trace / 2
    if (isScalarMatrix(sourceMatrix, lambda)) {
      return {
        sourceMatrix,
        canonicalMatrix: [[lambda, 0], [0, lambda]],
        caseId: 'scalar',
        caseLabel: 'Matriz escalar',
        canonicalTitle: 'Forma de Jordan',
        shortText: 'La matriz actúa igual en todas las direcciones: no es más que un múltiplo de la identidad.',
        canvasSubtitle: 'La forma canónica coincide con un múltiplo de la identidad.',
        steps: [
          `Primero se calculan la traza ${formatMatrixEntry(trace)} y el determinante ${formatMatrixEntry(determinant)}.`,
          `El discriminante es nulo, así que sólo aparece el autovalor ${formatMatrixEntry(lambda)}.`,
          'Al comparar la matriz con ese valor por la identidad, se ve que coinciden exactamente.',
          'Por eso no aparece ningún bloque de Jordan no trivial y la matriz ya está en su forma más simple.',
        ],
        trace,
        determinant,
        discriminant,
      }
    }

    return {
      sourceMatrix,
      canonicalMatrix: [[lambda, 0], [1, lambda]],
      caseId: 'jordan-block',
      caseLabel: 'Autovalor doble con bloque de Jordan',
      canonicalTitle: 'Forma de Jordan',
      shortText: 'Hay un autovalor doble, pero sólo una dirección propia. Por eso aparece un único bloque de Jordan de tamaño dos.',
      canvasSubtitle: 'El plano inferior representa el bloque de Jordan real correspondiente.',
      steps: [
        `Primero se calculan la traza ${formatMatrixEntry(trace)} y el determinante ${formatMatrixEntry(determinant)}.`,
        `El discriminante vuelve a salir nulo, así que el autovalor doble es ${formatMatrixEntry(lambda)}.`,
        'Sin embargo, la matriz no es escalar, de modo que no aparecen dos direcciones propias independientes.',
        'En dimensión dos eso obliga a que la forma canónica tenga un único bloque de Jordan de tamaño dos.',
      ],
      trace,
      determinant,
      discriminant,
    }
  }

  const realPart = trace / 2
  const imaginaryPart = Math.sqrt(-discriminant) / 2
  const symbolicParts = symbolicComplexEigenParts(trace, discriminant)
  const realPartLabel = symbolicParts ? formatPlainExpression(symbolicParts.realPart) : formatMatrixEntry(realPart)
  const imaginaryPartLabel = symbolicParts ? formatPlainExpression(symbolicParts.imaginaryPart) : formatMatrixEntry(imaginaryPart)
  return {
    sourceMatrix,
    canonicalMatrix: [[realPart, -imaginaryPart], [imaginaryPart, realPart]],
    caseId: 'complex-pair',
    caseLabel: 'Par complejo conjugado',
    canonicalTitle: 'Bloque canónico real',
    shortText: 'Como no hay autovalores reales, se usa el bloque real equivalente que describe la misma rotación-dilatación.',
    canvasSubtitle: 'El plano inferior muestra el bloque real equivalente a la rotación-dilatación.',
    steps: [
      `Primero se calculan la traza ${formatMatrixEntry(trace)} y el determinante ${formatMatrixEntry(determinant)}.`,
      `Después se comprueba que el discriminante vale ${formatMatrixEntry(discriminant)} y es negativo.`,
      `Eso produce el par complejo conjugado ${realPartLabel} ± ${imaginaryPartLabel} i.`,
      'Como estamos trabajando con matrices reales, no se deja la forma canónica en diagonal compleja.',
      'En su lugar se usa el bloque real equivalente, que recoge la misma rotación y la misma dilatación.',
    ],
    trace,
    determinant,
    discriminant,
  }
}

function identityMatrix(): Matrix2 {
  return [[1, 0], [0, 1]]
}

function isIdentity(matrix: Matrix2) {
  return isScalarMatrix(matrix, 1)
}

function isZeroVector(vector: Vec2) {
  return Math.abs(vector.x) < EPSILON && Math.abs(vector.y) < EPSILON
}

function isZeroMatrix(matrix: Matrix2) {
  return matrix.every((row) => row.every((entry) => Math.abs(entry) < EPSILON))
}

export function classifyAffineFixedSet(linearPart: Matrix2, translation: Vec2): AffineFixedSet {
  const system: Matrix2 = [
    [1 - linearPart[0][0], -linearPart[0][1]],
    [-linearPart[1][0], 1 - linearPart[1][1]],
  ]
  const rhs = translation

  const inverse = inverse2(system)
  if (inverse) {
    return {
      kind: 'point',
      point: applyMatrix(inverse, rhs),
      label: 'Punto fijo',
    }
  }

  if (isZeroMatrix(system)) {
    if (isZeroVector(rhs)) {
      return {
        kind: 'plane',
        label: 'Todo R² fijo',
      }
    }

    return {
      kind: 'none',
      label: 'Sin puntos fijos',
    }
  }

  const anchor = solvePossiblySingular(system, rhs)
  if (!anchor) {
    return {
      kind: 'none',
      label: 'Sin puntos fijos',
    }
  }

  return {
    kind: 'line',
    anchor,
    direction: kernelVector(system),
    label: 'Recta de puntos fijos',
  }
}

function affineLinearPart(
  source: Record<'p0' | 'p1' | 'p2', Vec2>,
  image: Record<'q0' | 'q1' | 'q2', Vec2>,
) {
  const sourceFrame = matrixFromImages(
    subtractVectors(source.p1, source.p0),
    subtractVectors(source.p2, source.p0),
  )
  const imageFrame = matrixFromImages(
    subtractVectors(image.q1, image.q0),
    subtractVectors(image.q2, image.q0),
  )
  const inverseSource = inverse2(sourceFrame)

  if (!inverseSource) {
    return null
  }

  const linearPart = multiplyMatrices(imageFrame, inverseSource)
  const translation = subtractVectors(image.q0, applyMatrix(linearPart, source.p0))
  return { linearPart, translation }
}

function generalizedJordanBasisForOne(matrix: Matrix2) {
  const nilpotent = matrixMinusScalarIdentity(matrix, 1)
  const eigenvector = kernelVector(nilpotent)
  const useFirstRow = Math.abs(nilpotent[0][0]) + Math.abs(nilpotent[0][1]) > EPSILON
  const row = useFirstRow ? nilpotent[0] : nilpotent[1]
  const rhs = useFirstRow ? eigenvector.x : eigenvector.y
  const generalized =
    Math.abs(row[0]) >= Math.abs(row[1])
      ? { x: rhs / row[0], y: 0 }
      : { x: 0, y: rhs / row[1] }

  return matrixFromImages(generalized, eigenvector)
}

export function canonicalizeAffineMap(
  source: Record<'p0' | 'p1' | 'p2', Vec2>,
  image: Record<'q0' | 'q1' | 'q2', Vec2>,
): AffineAnalysis | null {
  const data = affineLinearPart(source, image)
  if (!data) {
    return null
  }

  const { linearPart, translation } = data
  const linearAnalysis = classifyLinearMap(linearPart)
  const sourceHomogeneous = homogeneousFromAffine(linearPart, translation)
  const fixedSet = classifyAffineFixedSet(linearPart, translation)

  if (fixedSet.kind !== 'none') {
    const canonicalTranslation = { x: 0, y: 0 }
    const canonicalFixedSet = classifyAffineFixedSet(linearAnalysis.canonicalMatrix, canonicalTranslation)

    const caseLabel =
      fixedSet.kind === 'plane'
        ? 'Todos los puntos son fijos'
        : fixedSet.kind === 'line'
          ? 'Aplicación afín con una recta de puntos fijos'
          : 'Aplicación afín con un único punto fijo'

    const shortText =
      fixedSet.kind === 'plane'
        ? 'Después de la reducción afín, la aplicación coincide con la identidad y todo punto del plano queda fijo.'
        : fixedSet.kind === 'line'
          ? 'Los puntos fijos forman una recta. Al mover el origen a uno de ellos, el problema afín se reduce a la parte lineal.'
          : 'Al mover el origen al punto fijo, el problema afín se reduce a la parte lineal.'

    const canvasSubtitle =
      fixedSet.kind === 'plane'
        ? 'El sombreado rojo indica que todo el plano está formado por puntos fijos.'
        : fixedSet.kind === 'line'
          ? 'La recta roja recoge todos los puntos fijos. En el plano canónico se conserva la misma geometría.'
          : 'Se representa el triángulo estándar y su imagen por la forma normal con un único punto fijo marcado en rojo.'

    return {
      sourceLinearPart: linearPart,
      sourceTranslation: translation,
      sourceHomogeneous,
      canonicalLinearPart: linearAnalysis.canonicalMatrix,
      canonicalTranslation,
      canonicalHomogeneous: homogeneousFromAffine(linearAnalysis.canonicalMatrix, canonicalTranslation),
      fixedSet,
      canonicalFixedSet,
      caseLabel,
      shortText,
      canvasSubtitle,
      steps: [
        'Primero se reconstruye la parte lineal A a partir de los vectores del triángulo origen y del triángulo imagen.',
        'Después se calcula la traslación b imponiendo que F(p0) sea q0.',
        fixedSet.kind === 'line'
          ? 'La ecuación de los puntos fijos es compatible indeterminada, así que los puntos fijos forman una recta afín.'
          : fixedSet.kind === 'plane'
            ? 'La ecuación de los puntos fijos se satisface para cualquier x, así que todo el plano está formado por puntos fijos.'
            : 'La ecuación de los puntos fijos tiene una única solución, así que aparece un único punto fijo.',
        'Al trasladar el origen a un punto fijo, la traslación desaparece.',
        `A partir de ahí, la forma normal afín queda descrita por ${linearAnalysis.caseLabel.toLowerCase()}.`,
      ],
    }
  }

  if (isIdentity(linearPart)) {
    const canonicalTranslation = { x: 1, y: 0 }
    return {
      sourceLinearPart: linearPart,
      sourceTranslation: translation,
      sourceHomogeneous,
      canonicalLinearPart: identityMatrix(),
      canonicalTranslation,
      canonicalHomogeneous: homogeneousFromAffine(identityMatrix(), canonicalTranslation),
      fixedSet,
      canonicalFixedSet: classifyAffineFixedSet(identityMatrix(), canonicalTranslation),
      caseLabel: 'Traslación no trivial',
      shortText: 'No hay punto fijo y la parte lineal es la identidad, así que todo se reduce a una traslación unitaria.',
      canvasSubtitle: 'La forma canónica elegida es una traslación horizontal unitaria.',
      steps: [
        'La parte lineal coincide con la identidad, así que no aporta ninguna deformación adicional.',
        'Como no existe punto fijo, la traslación no se puede eliminar.',
        'Con un cambio lineal de coordenadas se alinea esa traslación con el eje x.',
        'Después se reescala para que quede normalizada a una unidad.',
      ],
    }
  }

  if (linearAnalysis.caseId === 'distinct-real') {
    const trace = trace2(linearPart)
    const determinant = determinant2(linearPart)
    const discriminant = trace * trace - 4 * determinant
    const root = Math.sqrt(discriminant)
    const lambda1 = (trace + root) / 2
    const lambda2 = (trace - root) / 2
    const otherEigenvalue = almostEqual(lambda1, 1) ? lambda2 : lambda1
    const eigenOne = kernelVector(matrixMinusScalarIdentity(linearPart, 1))
    const eigenOther = kernelVector(matrixMinusScalarIdentity(linearPart, otherEigenvalue))
    const basis = matrixFromImages(eigenOne, eigenOther)
    const inverseBasis = inverse2(basis)
    const translationInBasis = inverseBasis ? applyMatrix(inverseBasis, translation) : { x: 1, y: 0 }
    const canonicalTranslation = almostEqual(translationInBasis.x, 0) ? { x: 0, y: 0 } : { x: 1, y: 0 }
    const canonicalLinearPart: Matrix2 = [[1, 0], [0, otherEigenvalue]]

    return {
      sourceLinearPart: linearPart,
      sourceTranslation: translation,
      sourceHomogeneous,
      canonicalLinearPart,
      canonicalTranslation,
      canonicalHomogeneous: homogeneousFromAffine(canonicalLinearPart, canonicalTranslation),
      fixedSet,
      canonicalFixedSet: classifyAffineFixedSet(canonicalLinearPart, canonicalTranslation),
      caseLabel: 'Sin punto fijo y con un autovalor igual a 1',
      shortText: 'La parte esencial de la traslación sobrevive en la dirección propia del autovalor 1 y después se normaliza.',
      canvasSubtitle: 'Se muestra la forma canónica afín con una traslación normalizada en la dirección propia.',
      steps: [
        'La parte lineal tiene dos autovalores reales distintos y uno de ellos es 1.',
        'Como no hay punto fijo, la traslación no se puede absorber por completo.',
        'Al pasar a una base propia, sólo queda una componente esencial en la dirección del autovalor 1.',
        `Después se normaliza esa componente y se obtiene la forma (x, y) ↦ (x + 1, ${formatMatrixEntry(otherEigenvalue)} y).`,
      ],
    }
  }

  if (linearAnalysis.caseId === 'jordan-block' && almostEqual(trace2(linearPart), 2)) {
    const basis = generalizedJordanBasisForOne(linearPart)
    const inverseBasis = inverse2(basis)
    const translationInBasis = inverseBasis ? applyMatrix(inverseBasis, translation) : { x: 0, y: 1 }
    const canonicalTranslation = almostEqual(translationInBasis.x, 0) ? { x: 0, y: 0 } : { x: 1, y: 0 }
    const canonicalLinearPart: Matrix2 = [[1, 0], [1, 1]]

    return {
      sourceLinearPart: linearPart,
      sourceTranslation: translation,
      sourceHomogeneous,
      canonicalLinearPart,
      canonicalTranslation,
      canonicalHomogeneous: homogeneousFromAffine(canonicalLinearPart, canonicalTranslation),
      fixedSet,
      canonicalFixedSet: classifyAffineFixedSet(canonicalLinearPart, canonicalTranslation),
      caseLabel: 'Caso parabólico sin punto fijo',
      shortText: 'Aparece un bloque de Jordan para el autovalor 1 y una traslación esencial que no se puede eliminar.',
      canvasSubtitle: 'La forma normal afín se representa como (x, y) ↦ (x + 1, x + y).',
      steps: [
        'La parte lineal tiene el autovalor 1, pero aparece con un bloque de Jordan no trivial.',
        'Como no hay punto fijo, sobrevive una componente afín esencial.',
        'En una base de Jordan ordenada como (vector generalizado, autovector), la traslación esencial queda en la primera coordenada.',
        'Después se normaliza esa componente y aparece la forma parabólica estándar.',
      ],
    }
  }

  const canonicalTranslation = { x: 0, y: 0 }
  return {
    sourceLinearPart: linearPart,
    sourceTranslation: translation,
    sourceHomogeneous,
    canonicalLinearPart: linearAnalysis.canonicalMatrix,
    canonicalTranslation,
    canonicalHomogeneous: homogeneousFromAffine(linearAnalysis.canonicalMatrix, canonicalTranslation),
    fixedSet,
    canonicalFixedSet: classifyAffineFixedSet(linearAnalysis.canonicalMatrix, canonicalTranslation),
    caseLabel: 'Forma normal afín reducida a la parte lineal',
    shortText: 'Tras el cambio de coordenadas adecuado, la traslación ya no introduce un fenómeno afín nuevo.',
    canvasSubtitle: 'Se muestra la forma canónica real de la parte lineal.',
    steps: [
      'Primero se escribe la matriz homogénea de la aplicación afín.',
      'Después se comprueba que la reducción no deja una traslación esencial en la forma normal.',
      'Al final, la clasificación coincide con la forma canónica real de la parte lineal.',
    ],
  }
}
