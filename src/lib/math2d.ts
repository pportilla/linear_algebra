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

export interface ConicCoefficients {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export type ConicNormalMode = 'affine' | 'euclidean'

export type ConicCaseId =
  | 'invalid'
  | 'real-ellipse'
  | 'imaginary-ellipse'
  | 'hyperbola'
  | 'parabola'
  | 'point'
  | 'intersecting-lines'
  | 'parallel-lines'
  | 'imaginary-parallel-lines'
  | 'double-line'

export interface ConicDrawablePoint {
  id: string
  label: string
  point: Vec2
  color: string
}

export interface ConicDrawableLine {
  id: string
  label: string
  anchor: Vec2
  direction: Vec2
  color: string
}

export interface ConicDrawableHints {
  focus: Vec2
  range: number
  points: ConicDrawablePoint[]
  lines: ConicDrawableLine[]
  isEmpty: boolean
  emptyText?: string
}

export interface ConicCanonicalData {
  mode: ConicNormalMode
  label: string
  coefficients: ConicCoefficients
  equationTex: string
  parameters: Array<{ label: string; value: number; text?: string }>
  drawable: ConicDrawableHints
}

export interface ConicReductionData {
  principalMatrix: Matrix2
  eigenvalues: [number, number]
  linearInPrincipal: Vec2
  rankCase: 'full' | 'rank-one' | 'invalid'
  center?: Vec2
  centerInPrincipal?: Vec2
  vertex?: Vec2
  vertexInPrincipal?: Vec2
  residualConstant?: number
  k?: number
  nonzeroEigenvalue?: number
  nonzeroLinearCoefficient?: number
  nullLinearCoefficient?: number
  doubleLine?: { anchor: Vec2; direction: Vec2 }
  parallelOffset?: number
}

export interface ConicAnalysis {
  valid: boolean
  coefficients: ConicCoefficients
  quadraticMatrix: Matrix2
  linearVector: Vec2
  augmentedMatrix: number[][]
  trace: number
  determinantQ: number
  determinantAugmented: number
  rankQ: number
  rankAugmented: number
  inertia: { positive: number; negative: number; zero: number }
  reduction: ConicReductionData
  caseId: ConicCaseId
  caseLabel: string
  affineLabel: string
  euclideanLabel: string
  degeneracyLabel: string
  setDescription: string
  shortText: string
  affineCanonical: ConicCanonicalData
  euclideanCanonical: ConicCanonicalData
  originalDrawable: ConicDrawableHints
  steps: string[]
}

const emptyConicCoefficients: ConicCoefficients = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 1 }

function dotVectors(left: Vec2, right: Vec2) {
  return left.x * right.x + left.y * right.y
}

function conicZero(value: number) {
  return Math.abs(value) <= 1e-7
}

export function conicMatrixFromCoefficients(coefficients: ConicCoefficients) {
  const { a, b, c, d, e, f } = coefficients
  return [
    [f, d, e],
    [d, a, b],
    [e, b, c],
  ]
}

export function conicQuadraticMatrix(coefficients: ConicCoefficients): Matrix2 {
  return [
    [coefficients.a, coefficients.b],
    [coefficients.b, coefficients.c],
  ]
}

export function evaluateConic(coefficients: ConicCoefficients, point: Vec2) {
  const { a, b, c, d, e, f } = coefficients
  return (
    a * point.x * point.x +
    2 * b * point.x * point.y +
    c * point.y * point.y +
    2 * d * point.x +
    2 * e * point.y +
    f
  )
}

export function determinant3(matrix: number[][]) {
  return (
    matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
    matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
    matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
  )
}

function rank2(matrix: Matrix2) {
  if (Math.abs(determinant2(matrix)) > 1e-7) {
    return 2
  }

  return matrix.some((row) => row.some((entry) => Math.abs(entry) > 1e-7)) ? 1 : 0
}

function rank3(matrix: number[][]) {
  if (Math.abs(determinant3(matrix)) > 1e-7) {
    return 3
  }

  const minors: number[] = []
  for (let row0 = 0; row0 < 3; row0 += 1) {
    for (let row1 = row0 + 1; row1 < 3; row1 += 1) {
      for (let col0 = 0; col0 < 3; col0 += 1) {
        for (let col1 = col0 + 1; col1 < 3; col1 += 1) {
          minors.push(matrix[row0][col0] * matrix[row1][col1] - matrix[row0][col1] * matrix[row1][col0])
        }
      }
    }
  }

  if (minors.some((minor) => Math.abs(minor) > 1e-7)) {
    return 2
  }

  return matrix.some((row) => row.some((entry) => Math.abs(entry) > 1e-7)) ? 1 : 0
}

function symmetricEigenData(matrix: Matrix2) {
  const [[a, b], [, c]] = matrix
  const trace = a + c
  const root = Math.hypot(a - c, 2 * b)
  const lambda1 = (trace + root) / 2
  const lambda2 = (trace - root) / 2

  if (root <= 1e-9) {
    return {
      values: [lambda1, lambda2] as [number, number],
      vectors: [{ x: 1, y: 0 }, { x: 0, y: 1 }] as [Vec2, Vec2],
    }
  }

  const raw = Math.abs(b) + Math.abs(lambda1 - a) > 1e-9
    ? { x: b, y: lambda1 - a }
    : { x: lambda1 - c, y: b }
  const u1 = normalizeVector(raw)
  const u2 = { x: -u1.y, y: u1.x }

  return {
    values: [lambda1, lambda2] as [number, number],
    vectors: [u1, u2] as [Vec2, Vec2],
  }
}

function matrixFromOrthonormalVectors(first: Vec2, second: Vec2): Matrix2 {
  return [
    [first.x, second.x],
    [first.y, second.y],
  ]
}

function conicInertia(eigenvalues: [number, number]) {
  const positive = eigenvalues.filter((value) => value > 1e-7).length
  const negative = eigenvalues.filter((value) => value < -1e-7).length
  return { positive, negative, zero: 2 - positive - negative }
}

function conicTypeLabels(caseId: ConicCaseId) {
  const labels: Record<ConicCaseId, { caseLabel: string; setDescription: string; degeneracyLabel: string }> = {
    invalid: {
      caseLabel: 'Datos no cuadráticos',
      setDescription: 'No hay una cónica de segundo grado.',
      degeneracyLabel: 'No aplicable',
    },
    'real-ellipse': {
      caseLabel: 'Elipse real',
      setDescription: 'Curva cerrada con puntos reales.',
      degeneracyLabel: 'No degenerada',
    },
    'imaginary-ellipse': {
      caseLabel: 'Elipse imaginaria',
      setDescription: 'El lugar real está vacío.',
      degeneracyLabel: 'No degenerada',
    },
    hyperbola: {
      caseLabel: 'Hipérbola',
      setDescription: 'Curva abierta con dos ramas reales.',
      degeneracyLabel: 'No degenerada',
    },
    parabola: {
      caseLabel: 'Parábola',
      setDescription: 'Curva abierta con una dirección cuadrática degenerada.',
      degeneracyLabel: 'No degenerada',
    },
    point: {
      caseLabel: 'Punto',
      setDescription: 'El lugar real se reduce a un único punto.',
      degeneracyLabel: 'Degenerada',
    },
    'intersecting-lines': {
      caseLabel: 'Dos rectas secantes',
      setDescription: 'Un par de rectas reales que se cortan.',
      degeneracyLabel: 'Degenerada',
    },
    'parallel-lines': {
      caseLabel: 'Dos rectas paralelas',
      setDescription: 'Un par de rectas reales paralelas.',
      degeneracyLabel: 'Degenerada',
    },
    'imaginary-parallel-lines': {
      caseLabel: 'Rectas paralelas imaginarias',
      setDescription: 'El lugar real está vacío, aunque algebraicamente es un par paralelo imaginario.',
      degeneracyLabel: 'Degenerada',
    },
    'double-line': {
      caseLabel: 'Recta doble',
      setDescription: 'Una única recta real contada con multiplicidad dos.',
      degeneracyLabel: 'Degenerada',
    },
  }

  return labels[caseId]
}

function conicShortText(caseId: ConicCaseId) {
  const text: Record<ConicCaseId, string> = {
    invalid: 'La clasificación de cónicas exige que la parte cuadrática no sea nula.',
    'real-ellipse': 'La parte cuadrática es definida y la constante reducida tiene el signo que permite puntos reales.',
    'imaginary-ellipse': 'La parte cuadrática es definida, pero la ecuación reducida no admite puntos reales.',
    hyperbola: 'La parte cuadrática es indefinida y la cónica no está degenerada.',
    parabola: 'La parte cuadrática tiene rango uno y queda un término lineal en la dirección nula.',
    point: 'La parte cuadrática es definida y la constante reducida se anula: sólo queda el centro.',
    'intersecting-lines': 'La parte cuadrática es indefinida y la constante reducida se anula, por eso la ecuación se factoriza en dos rectas secantes.',
    'parallel-lines': 'La parte cuadrática tiene rango uno y la forma reducida es un cuadrado igual a una constante positiva.',
    'imaginary-parallel-lines': 'La parte cuadrática tiene rango uno y la forma reducida fuerza un cuadrado igual a una constante negativa.',
    'double-line': 'La ecuación reducida es un cuadrado perfecto igual a cero.',
  }

  return text[caseId]
}

function canonicalDrawable(
  caseId: ConicCaseId,
  focus: Vec2,
  range: number,
): ConicDrawableHints {
  const emptyText =
    caseId === 'imaginary-ellipse'
      ? 'Elipse imaginaria: sin puntos reales'
      : caseId === 'imaginary-parallel-lines'
        ? 'Rectas imaginarias: sin puntos reales'
        : undefined

  if (caseId === 'point') {
    return {
      focus,
      range,
      points: [{ id: 'canonical-point', label: 'Punto', point: { x: 0, y: 0 }, color: '#c62828' }],
      lines: [],
      isEmpty: false,
    }
  }

  if (caseId === 'double-line') {
    return {
      focus,
      range,
      points: [],
      lines: [{ id: 'canonical-double-line', label: 'Recta doble', anchor: { x: 0, y: 0 }, direction: { x: 0, y: 1 }, color: '#c62828' }],
      isEmpty: false,
    }
  }

  return {
    focus,
    range,
    points: [],
    lines: [],
    isEmpty: Boolean(emptyText),
    emptyText,
  }
}

function affineCanonicalData(caseId: ConicCaseId): ConicCanonicalData {
  const entries: Record<ConicCaseId, { label: string; coefficients: ConicCoefficients; equationTex: string; range: number }> = {
    invalid: {
      label: 'Sin forma normal',
      coefficients: emptyConicCoefficients,
      equationTex: '1=0',
      range: 4,
    },
    'real-ellipse': {
      label: 'Forma afín de una elipse real',
      coefficients: { a: 1, b: 0, c: 1, d: 0, e: 0, f: -1 },
      equationTex: 'x^2+y^2=1',
      range: 2.4,
    },
    'imaginary-ellipse': {
      label: 'Forma afín de una elipse imaginaria',
      coefficients: { a: 1, b: 0, c: 1, d: 0, e: 0, f: 1 },
      equationTex: 'x^2+y^2=-1',
      range: 2.4,
    },
    hyperbola: {
      label: 'Forma afín de una hipérbola',
      coefficients: { a: 1, b: 0, c: -1, d: 0, e: 0, f: -1 },
      equationTex: 'x^2-y^2=1',
      range: 4.2,
    },
    parabola: {
      label: 'Forma afín de una parábola',
      coefficients: { a: 0, b: 0, c: 1, d: -0.5, e: 0, f: 0 },
      equationTex: 'y^2=x',
      range: 4.2,
    },
    point: {
      label: 'Forma afín de un punto',
      coefficients: { a: 1, b: 0, c: 1, d: 0, e: 0, f: 0 },
      equationTex: 'x^2+y^2=0',
      range: 2.4,
    },
    'intersecting-lines': {
      label: 'Forma afín de dos rectas secantes',
      coefficients: { a: 1, b: 0, c: -1, d: 0, e: 0, f: 0 },
      equationTex: 'x^2-y^2=0',
      range: 3.4,
    },
    'parallel-lines': {
      label: 'Forma afín de dos rectas paralelas',
      coefficients: { a: 1, b: 0, c: 0, d: 0, e: 0, f: -1 },
      equationTex: 'x^2=1',
      range: 3.2,
    },
    'imaginary-parallel-lines': {
      label: 'Forma afín de rectas paralelas imaginarias',
      coefficients: { a: 1, b: 0, c: 0, d: 0, e: 0, f: 1 },
      equationTex: 'x^2=-1',
      range: 3.2,
    },
    'double-line': {
      label: 'Forma afín de una recta doble',
      coefficients: { a: 1, b: 0, c: 0, d: 0, e: 0, f: 0 },
      equationTex: 'x^2=0',
      range: 3.2,
    },
  }
  const entry = entries[caseId]

  return {
    mode: 'affine',
    label: entry.label,
    coefficients: entry.coefficients,
    equationTex: entry.equationTex,
    parameters: [],
    drawable: canonicalDrawable(caseId, { x: 0, y: 0 }, entry.range),
  }
}

function conicTermTex(coefficient: number, variable: string, isFirst: boolean) {
  if (Math.abs(coefficient) <= 1e-10) {
    return ''
  }

  const sign = coefficient < 0 ? '-' : isFirst ? '' : '+'
  const absolute = Math.abs(coefficient)
  const coefficientTex = variable && Math.abs(absolute - 1) <= 1e-10 ? '' : formatMatrixEntry(absolute)
  return `${sign}${coefficientTex}${variable}`
}

export function formatConicEquationTex(coefficients: ConicCoefficients) {
  const terms = [
    [coefficients.a, 'x^2'] as const,
    [2 * coefficients.b, 'xy'] as const,
    [coefficients.c, 'y^2'] as const,
    [2 * coefficients.d, 'x'] as const,
    [2 * coefficients.e, 'y'] as const,
    [coefficients.f, ''] as const,
  ]
  let tex = ''

  for (const [coefficient, variable] of terms) {
    const term = conicTermTex(coefficient, variable, tex.length === 0)
    if (term) {
      tex += term
    }
  }

  return `${tex || '0'}=0`
}

function euclideanCanonicalData(caseId: ConicCaseId, reduction: ConicReductionData, trace: number, determinantQ: number, determinantAugmented: number) {
  const fallback = affineCanonicalData(caseId)

  if (caseId === 'real-ellipse' || caseId === 'imaginary-ellipse') {
    const k = Math.abs(reduction.k ?? -determinantAugmented / determinantQ)
    const semiaxes = reduction.eigenvalues
      .filter((value) => Math.abs(value) > 1e-7)
      .map((value) => Math.sqrt(k / Math.abs(value)))
      .sort((left, right) => right - left)
    const semimajor = semiaxes[0] ?? 1
    const semiminor = semiaxes[1] ?? semimajor
    const sign = caseId === 'real-ellipse' ? -1 : 1
    const coefficients = { a: 1 / (semimajor * semimajor), b: 0, c: 1 / (semiminor * semiminor), d: 0, e: 0, f: sign }

    return {
      mode: 'euclidean' as const,
      label: caseId === 'real-ellipse' ? 'Forma euclídea de una elipse real' : 'Forma euclídea de una elipse imaginaria',
      coefficients,
      equationTex: `\\frac{x^2}{${formatMatrixEntry(semimajor * semimajor)}}+\\frac{y^2}{${formatMatrixEntry(semiminor * semiminor)}}=${caseId === 'real-ellipse' ? '1' : '-1'}`,
      parameters: [
        { label: 'a', value: semimajor, text: 'semieje mayor' },
        { label: 'b', value: semiminor, text: 'semieje menor' },
      ],
      drawable: canonicalDrawable(caseId, { x: 0, y: 0 }, Math.max(2.4, semimajor * 1.45)),
    }
  }

  if (caseId === 'hyperbola') {
    const k = reduction.k ?? -determinantAugmented / determinantQ
    const quotients = reduction.eigenvalues
      .filter((value) => Math.abs(value) > 1e-7)
      .map((value) => k / value)
    const realAxis = Math.sqrt(Math.abs(quotients.find((value) => value > 0) ?? 1))
    const imaginaryAxis = Math.sqrt(Math.abs(quotients.find((value) => value < 0) ?? 1))
    const coefficients = { a: 1 / (realAxis * realAxis), b: 0, c: -1 / (imaginaryAxis * imaginaryAxis), d: 0, e: 0, f: -1 }

    return {
      mode: 'euclidean' as const,
      label: 'Forma euclídea de una hipérbola',
      coefficients,
      equationTex: `\\frac{x^2}{${formatMatrixEntry(realAxis * realAxis)}}-\\frac{y^2}{${formatMatrixEntry(imaginaryAxis * imaginaryAxis)}}=1`,
      parameters: [
        { label: 'a', value: realAxis, text: 'semieje real' },
        { label: 'b', value: imaginaryAxis, text: 'semieje imaginario' },
      ],
      drawable: canonicalDrawable(caseId, { x: 0, y: 0 }, Math.max(4.2, Math.max(realAxis, imaginaryAxis) * 2.4)),
    }
  }

  if (caseId === 'parabola') {
    const alpha = reduction.nullLinearCoefficient
    const lambda = reduction.nonzeroEigenvalue
    const parameter = alpha && lambda ? Math.abs(alpha / lambda) : Math.sqrt(Math.abs(determinantAugmented)) / Math.pow(Math.abs(trace), 1.5)
    const coefficients = { a: 0, b: 0, c: 1, d: -parameter, e: 0, f: 0 }

    return {
      mode: 'euclidean' as const,
      label: 'Forma euclídea de una parábola',
      coefficients,
      equationTex: `y^2=2\\,${formatMatrixEntry(parameter)}x`,
      parameters: [{ label: 'p', value: parameter, text: 'parámetro de la parábola' }],
      drawable: canonicalDrawable(caseId, { x: parameter, y: 0 }, Math.max(4.2, parameter * 5)),
    }
  }

  if (caseId === 'intersecting-lines') {
    const positive = reduction.eigenvalues.find((value) => value > 1e-7) ?? 1
    const negative = Math.abs(reduction.eigenvalues.find((value) => value < -1e-7) ?? -1)
    const rawSlope = Math.sqrt(positive / negative)
    const slope = rawSlope > 1 ? 1 / rawSlope : rawSlope
    const coefficients = { a: 1, b: 0, c: -1 / (slope * slope), d: 0, e: 0, f: 0 }

    return {
      mode: 'euclidean' as const,
      label: 'Forma euclídea de dos rectas secantes',
      coefficients,
      equationTex: `x^2-\\frac{y^2}{${formatMatrixEntry(slope * slope)}}=0`,
      parameters: [
        { label: 'm', value: slope, text: 'pendiente reducida' },
        { label: 'theta', value: 2 * Math.atan(slope), text: 'ángulo agudo entre las rectas' },
      ],
      drawable: canonicalDrawable(caseId, { x: 0, y: 0 }, 3.4),
    }
  }

  if (caseId === 'parallel-lines' || caseId === 'imaginary-parallel-lines') {
    const offset = Math.abs(reduction.parallelOffset ?? 1)
    const coefficients = { a: 1, b: 0, c: 0, d: 0, e: 0, f: caseId === 'parallel-lines' ? -offset * offset : offset * offset }

    return {
      mode: 'euclidean' as const,
      label: caseId === 'parallel-lines' ? 'Forma euclídea de dos rectas paralelas' : 'Forma euclídea de rectas paralelas imaginarias',
      coefficients,
      equationTex: `x^2=${caseId === 'parallel-lines' ? '' : '-'}${formatMatrixEntry(offset * offset)}`,
      parameters: [{ label: 'd', value: offset, text: 'semidistancia entre las rectas' }],
      drawable: canonicalDrawable(caseId, { x: 0, y: 0 }, Math.max(3.2, offset * 2.4)),
    }
  }

  return {
    ...fallback,
    mode: 'euclidean' as const,
    label: fallback.label.replace('afín', 'euclídea'),
  }
}

function classifyConicCase(determinantQ: number, determinantAugmented: number, trace: number, rankAugmented: number, reduction: ConicReductionData): ConicCaseId {
  if (Math.abs(determinantAugmented) > 1e-7) {
    if (determinantQ > 1e-7) {
      return determinantAugmented * trace < 0 ? 'real-ellipse' : 'imaginary-ellipse'
    }

    if (determinantQ < -1e-7) {
      return 'hyperbola'
    }

    return 'parabola'
  }

  if (determinantQ > 1e-7) {
    return 'point'
  }

  if (determinantQ < -1e-7) {
    return 'intersecting-lines'
  }

  if (rankAugmented <= 1 || conicZero(reduction.residualConstant ?? 0)) {
    return 'double-line'
  }

  const quotient = (reduction.residualConstant ?? 0) / (reduction.nonzeroEigenvalue ?? 1)
  return quotient < 0 ? 'parallel-lines' : 'imaginary-parallel-lines'
}

function buildConicReduction(
  coefficients: ConicCoefficients,
  quadraticMatrix: Matrix2,
  rankQValue: number,
  determinantAugmented: number,
  determinantQ: number,
): ConicReductionData {
  const eigen = symmetricEigenData(quadraticMatrix)
  const ordered =
    rankQValue === 1 && Math.abs(eigen.values[1]) > Math.abs(eigen.values[0])
      ? {
          values: [eigen.values[1], eigen.values[0]] as [number, number],
          vectors: [eigen.vectors[1], eigen.vectors[0]] as [Vec2, Vec2],
        }
      : eigen
  const principalMatrix = matrixFromOrthonormalVectors(ordered.vectors[0], ordered.vectors[1])
  const linearInPrincipal = {
    x: dotVectors(ordered.vectors[0], { x: coefficients.d, y: coefficients.e }),
    y: dotVectors(ordered.vectors[1], { x: coefficients.d, y: coefficients.e }),
  }

  if (rankQValue === 2) {
    const centerInPrincipal = {
      x: -linearInPrincipal.x / ordered.values[0],
      y: -linearInPrincipal.y / ordered.values[1],
    }
    const center = applyMatrix(principalMatrix, centerInPrincipal)
    const residualConstant =
      coefficients.f -
      (linearInPrincipal.x * linearInPrincipal.x) / ordered.values[0] -
      (linearInPrincipal.y * linearInPrincipal.y) / ordered.values[1]

    return {
      principalMatrix,
      eigenvalues: ordered.values,
      linearInPrincipal,
      rankCase: 'full',
      center,
      centerInPrincipal,
      residualConstant,
      k: -residualConstant || -determinantAugmented / determinantQ,
    }
  }

  if (rankQValue === 1) {
    const lambda = Math.abs(ordered.values[0]) > 1e-7 ? ordered.values[0] : ordered.values[1]
    const nonzeroVector = Math.abs(ordered.values[0]) > 1e-7 ? ordered.vectors[0] : ordered.vectors[1]
    const nullVector = Math.abs(ordered.values[0]) > 1e-7 ? ordered.vectors[1] : ordered.vectors[0]
    const adjustedPrincipalMatrix = matrixFromOrthonormalVectors(nonzeroVector, nullVector)
    const nonzeroLinearCoefficient = dotVectors(nonzeroVector, { x: coefficients.d, y: coefficients.e })
    const nullLinearCoefficient = dotVectors(nullVector, { x: coefficients.d, y: coefficients.e })
    const residualConstant = coefficients.f - (nonzeroLinearCoefficient * nonzeroLinearCoefficient) / lambda
    const shiftedX = -nonzeroLinearCoefficient / lambda
    const vertexInPrincipal = Math.abs(nullLinearCoefficient) > 1e-7
      ? { x: shiftedX, y: -residualConstant / (2 * nullLinearCoefficient) }
      : undefined
    const vertex = vertexInPrincipal ? applyMatrix(adjustedPrincipalMatrix, vertexInPrincipal) : undefined
    const doubleLineAnchor = applyMatrix(adjustedPrincipalMatrix, { x: shiftedX, y: 0 })
    const quotient = -residualConstant / lambda
    const parallelOffset = quotient > 0 ? Math.sqrt(quotient) : quotient < 0 ? Math.sqrt(-quotient) : 0

    return {
      principalMatrix: adjustedPrincipalMatrix,
      eigenvalues: [lambda, 0],
      linearInPrincipal: { x: nonzeroLinearCoefficient, y: nullLinearCoefficient },
      rankCase: 'rank-one',
      vertex,
      vertexInPrincipal,
      residualConstant,
      nonzeroEigenvalue: lambda,
      nonzeroLinearCoefficient,
      nullLinearCoefficient,
      doubleLine: { anchor: doubleLineAnchor, direction: nullVector },
      parallelOffset,
    }
  }

  return {
    principalMatrix,
    eigenvalues: ordered.values,
    linearInPrincipal,
    rankCase: 'invalid',
  }
}

function originalConicDrawable(caseId: ConicCaseId, reduction: ConicReductionData, euclideanCanonical: ConicCanonicalData): ConicDrawableHints {
  const focus = reduction.center ?? reduction.vertex ?? reduction.doubleLine?.anchor ?? { x: 0, y: 0 }
  const rangeFromParameters = euclideanCanonical.parameters.reduce((current, parameter) => Math.max(current, Math.abs(parameter.value)), 0)
  const baseRange =
    caseId === 'real-ellipse'
      ? Math.max(2.4, rangeFromParameters * 1.6)
      : caseId === 'hyperbola'
        ? Math.max(4.5, rangeFromParameters * 2.4)
        : caseId === 'parabola'
          ? Math.max(4.5, rangeFromParameters * 5)
          : caseId === 'parallel-lines' || caseId === 'imaginary-parallel-lines'
            ? Math.max(3.4, rangeFromParameters * 2.4)
            : 4

  if (caseId === 'point' && reduction.center) {
    return {
      focus,
      range: baseRange,
      points: [{ id: 'original-point', label: 'Punto', point: reduction.center, color: '#c62828' }],
      lines: [],
      isEmpty: false,
    }
  }

  if (caseId === 'double-line' && reduction.doubleLine) {
    return {
      focus,
      range: baseRange,
      points: [],
      lines: [{ id: 'original-double-line', label: 'Recta doble', ...reduction.doubleLine, color: '#c62828' }],
      isEmpty: false,
    }
  }

  if (caseId === 'imaginary-ellipse' || caseId === 'imaginary-parallel-lines') {
    return {
      focus,
      range: baseRange,
      points: [],
      lines: [],
      isEmpty: true,
      emptyText: caseId === 'imaginary-ellipse' ? 'Elipse imaginaria: sin puntos reales' : 'Rectas imaginarias: sin puntos reales',
    }
  }

  return {
    focus,
    range: baseRange,
    points: [],
    lines: [],
    isEmpty: false,
  }
}

function conicClassificationSteps(analysis: Pick<ConicAnalysis, 'caseId' | 'trace' | 'determinantQ' | 'determinantAugmented' | 'rankAugmented' | 'reduction'>) {
  const deltaLabel = formatMatrixEntry(analysis.determinantQ)
  const bigDeltaLabel = formatMatrixEntry(analysis.determinantAugmented)

  if (analysis.caseId === 'invalid') {
    return [
      'La parte cuadrática Q es nula, así que no estamos ante una ecuación de segundo grado.',
      'Para clasificar una cónica hace falta que al menos uno de a, b o c sea distinto de cero.',
    ]
  }

  const steps = [
    `Se forma Q y la matriz ampliada Q~; sus determinantes son delta = ${deltaLabel} y Delta = ${bigDeltaLabel}.`,
    `El rango de Q~ es ${analysis.rankAugmented}, por eso la cónica es ${Math.abs(analysis.determinantAugmented) > 1e-7 ? 'no degenerada' : 'degenerada'}.`,
  ]

  if (Math.abs(analysis.determinantAugmented) > 1e-7) {
    if (analysis.determinantQ > 1e-7) {
      steps.push(`Como delta > 0, la parte cuadrática es definida; el signo de Delta · tr(Q) = ${formatMatrixEntry(analysis.determinantAugmented * analysis.trace)} decide si la elipse tiene puntos reales.`)
    } else if (analysis.determinantQ < -1e-7) {
      steps.push('Como delta < 0, la parte cuadrática es indefinida y el caso no degenerado es una hipérbola.')
    } else {
      steps.push('Como delta = 0 y Delta no se anula, queda una dirección cuadrática nula con término lineal residual: es una parábola.')
    }
  } else if (analysis.determinantQ > 1e-7) {
    steps.push('Como delta > 0 y Delta = 0, la forma definida se reduce a un único punto.')
  } else if (analysis.determinantQ < -1e-7) {
    steps.push('Como delta < 0 y Delta = 0, la forma indefinida se factoriza en dos rectas secantes.')
  } else if (analysis.caseId === 'double-line') {
    steps.push('Como delta = 0 y el rango de Q~ baja a 1, la forma reducida es un cuadrado perfecto: una recta doble.')
  } else {
    steps.push('Como delta = 0 y rango(Q~) = 2, se mira el signo de la constante reducida para separar rectas paralelas reales e imaginarias.')
  }

  steps.push('La forma normal afín queda determinada por la tabla del capítulo 9.')
  return steps
}

export function classifyConic(coefficients: ConicCoefficients): ConicAnalysis {
  const quadraticMatrix = conicQuadraticMatrix(coefficients)
  const linearVector = { x: coefficients.d, y: coefficients.e }
  const augmentedMatrix = conicMatrixFromCoefficients(coefficients)
  const trace = trace2(quadraticMatrix)
  const determinantQ = determinant2(quadraticMatrix)
  const determinantAugmented = determinant3(augmentedMatrix)
  const rankQValue = rank2(quadraticMatrix)
  const rankAugmented = rank3(augmentedMatrix)
  const eigen = symmetricEigenData(quadraticMatrix)
  const inertia = conicInertia(eigen.values)
  const invalidReduction: ConicReductionData = {
    principalMatrix: [[1, 0], [0, 1]],
    eigenvalues: eigen.values,
    linearInPrincipal: linearVector,
    rankCase: 'invalid',
  }

  if (rankQValue === 0) {
    const affineCanonical = affineCanonicalData('invalid')
    const euclideanCanonical = euclideanCanonicalData('invalid', invalidReduction, trace, determinantQ, determinantAugmented)
    const labels = conicTypeLabels('invalid')
    const invalidAnalysis = {
      valid: false,
      coefficients,
      quadraticMatrix,
      linearVector,
      augmentedMatrix,
      trace,
      determinantQ,
      determinantAugmented,
      rankQ: rankQValue,
      rankAugmented,
      inertia,
      reduction: invalidReduction,
      caseId: 'invalid' as const,
      caseLabel: labels.caseLabel,
      affineLabel: labels.caseLabel,
      euclideanLabel: labels.caseLabel,
      degeneracyLabel: labels.degeneracyLabel,
      setDescription: labels.setDescription,
      shortText: conicShortText('invalid'),
      affineCanonical,
      euclideanCanonical,
      originalDrawable: {
        focus: { x: 0, y: 0 },
        range: 4,
        points: [],
        lines: [],
        isEmpty: true,
        emptyText: 'No hay parte cuadrática',
      },
      steps: [] as string[],
    }

    return {
      ...invalidAnalysis,
      steps: conicClassificationSteps(invalidAnalysis),
    }
  }

  const reduction = buildConicReduction(coefficients, quadraticMatrix, rankQValue, determinantAugmented, determinantQ)
  const caseId = classifyConicCase(determinantQ, determinantAugmented, trace, rankAugmented, reduction)
  const affineCanonical = affineCanonicalData(caseId)
  const euclideanCanonical = euclideanCanonicalData(caseId, reduction, trace, determinantQ, determinantAugmented)
  const labels = conicTypeLabels(caseId)
  const analysisWithoutSteps = {
    valid: true,
    coefficients,
    quadraticMatrix,
    linearVector,
    augmentedMatrix,
    trace,
    determinantQ,
    determinantAugmented,
    rankQ: rankQValue,
    rankAugmented,
    inertia,
    reduction,
    caseId,
    caseLabel: labels.caseLabel,
    affineLabel: labels.caseLabel,
    euclideanLabel: euclideanCanonical.parameters.length > 0
      ? `${labels.caseLabel} (${euclideanCanonical.parameters.map((parameter) => `${parameter.label}=${formatMatrixEntry(parameter.value)}`).join(', ')})`
      : labels.caseLabel,
    degeneracyLabel: labels.degeneracyLabel,
    setDescription: labels.setDescription,
    shortText: conicShortText(caseId),
    affineCanonical,
    euclideanCanonical,
    originalDrawable: originalConicDrawable(caseId, reduction, euclideanCanonical),
    steps: [] as string[],
  }

  return {
    ...analysisWithoutSteps,
    steps: conicClassificationSteps(analysisWithoutSteps),
  }
}
