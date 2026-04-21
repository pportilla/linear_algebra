export type Vec2 = { x: number; y: number }
export type Matrix2 = [[number, number], [number, number]]
export type Homogeneous3 = [number[], number[], number[]]
export type PointId = 'p0' | 'p1' | 'p2' | 'q0' | 'q1' | 'q2'
export type LinearPointId = 'b1' | 'b2' | 'tb1' | 'tb2'

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
const MAX_FRACTION_DENOMINATOR = 1000

export function formatMatrixEntry(value: number) {
  const clean = Math.abs(value) < EPSILON ? 0 : value
  const fraction = approximateFraction(clean)

  if (fraction) {
    if (fraction.denominator === 1) {
      return fraction.numerator.toString()
    }

    return `${fraction.numerator}/${fraction.denominator}`
  }

  return Number(clean.toPrecision(8)).toString()
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
    return {
      sourceMatrix,
      canonicalMatrix: [[lambda1, 0], [0, lambda2]],
      caseId: 'distinct-real',
      caseLabel: 'Dos autovalores reales distintos',
      canonicalTitle: 'Forma de Jordan',
      shortText: 'La matriz es diagonalizable y su forma de Jordan es diagonal.',
      canvasSubtitle: 'El plano inferior usa la base estándar y la matriz diagonal semejante a la original.',
      steps: [
        `Se calcula la traza ${formatMatrixEntry(trace)} y el determinante ${formatMatrixEntry(determinant)}.`,
        `El discriminante del polinomio característico vale ${formatMatrixEntry(discriminant)} y es positivo.`,
        `Los autovalores reales distintos son ${formatMatrixEntry(lambda1)} y ${formatMatrixEntry(lambda2)}.`,
        'Con dos autovalores reales distintos, la matriz es diagonalizable.',
        'La forma de Jordan coincide con la matriz diagonal formada por esos autovalores.',
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
        shortText: 'La matriz es un múltiplo de la identidad.',
        canvasSubtitle: 'La forma canónica coincide con un múltiplo de la identidad.',
        steps: [
          `La traza es ${formatMatrixEntry(trace)} y el determinante es ${formatMatrixEntry(determinant)}.`,
          `El discriminante es nulo, así que el único autovalor es ${formatMatrixEntry(lambda)}.`,
          'La matriz coincide con ese autovalor por la identidad.',
          'Por eso no aparece ningún bloque de Jordan no trivial.',
        ],
        trace,
        determinant,
        discriminant,
      }
    }

    return {
      sourceMatrix,
      canonicalMatrix: [[lambda, 1], [0, lambda]],
      caseId: 'jordan-block',
      caseLabel: 'Autovalor doble con bloque de Jordan',
      canonicalTitle: 'Forma de Jordan',
      shortText: 'Hay un autovalor doble, pero la matriz no es escalar, así que aparece un único bloque de tamaño dos.',
      canvasSubtitle: 'El plano inferior representa el bloque de Jordan real correspondiente.',
      steps: [
        `La traza es ${formatMatrixEntry(trace)} y el determinante es ${formatMatrixEntry(determinant)}.`,
        `El discriminante es nulo, así que el autovalor doble es ${formatMatrixEntry(lambda)}.`,
        'La matriz no es escalar, luego el espacio propio no tiene dimensión dos.',
        'En dimensión dos eso fuerza un único bloque de Jordan de tamaño dos.',
      ],
      trace,
      determinant,
      discriminant,
    }
  }

  const realPart = trace / 2
  const imaginaryPart = Math.sqrt(-discriminant) / 2
  return {
    sourceMatrix,
    canonicalMatrix: [[realPart, -imaginaryPart], [imaginaryPart, realPart]],
    caseId: 'complex-pair',
    caseLabel: 'Par complejo conjugado',
    canonicalTitle: 'Bloque canónico real',
    shortText: 'Sobre los reales se usa el bloque canónico real asociado al par complejo conjugado.',
    canvasSubtitle: 'El plano inferior muestra el bloque real equivalente a la rotación-dilatación.',
    steps: [
      `La traza es ${formatMatrixEntry(trace)} y el determinante es ${formatMatrixEntry(determinant)}.`,
      `El discriminante vale ${formatMatrixEntry(discriminant)} y es negativo.`,
      `Los autovalores complejos son ${formatMatrixEntry(realPart)} ± ${formatMatrixEntry(imaginaryPart)} i.`,
      'No existe una forma de Jordan real con entradas reales para este caso.',
      'Se usa el bloque real asociado a la rotación y dilatación correspondiente.',
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

function classifyAffineFixedSet(linearPart: Matrix2, translation: Vec2): AffineFixedSet {
  const system: Matrix2 = [
    [linearPart[0][0] - 1, linearPart[0][1]],
    [linearPart[1][0], linearPart[1][1] - 1],
  ]
  const rhs = { x: -translation.x, y: -translation.y }

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

  return matrixFromImages(eigenvector, generalized)
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
        ? 'La aplicación coincide con la identidad tras la reducción afín, de modo que todo punto del plano es fijo.'
        : fixedSet.kind === 'line'
          ? 'Existe una familia afín unidimensional de puntos fijos. Tras mover el origen a uno de ellos, la clasificación afín se reduce a la parte lineal.'
          : 'Tras mover el origen a un punto fijo, la clasificación afín se reduce a la parte lineal.'

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
        'Se construye la parte lineal A a partir de los vectores definidos por los puntos origen y por sus imágenes.',
        'Se calcula la traslación t imponiendo F(p0) = q0.',
        fixedSet.kind === 'line'
          ? 'El sistema (A - I)c = -t es compatible indeterminado, así que los puntos fijos forman una recta afín.'
          : fixedSet.kind === 'plane'
            ? 'El sistema (A - I)c = -t queda trivialmente satisfecho para todo c, así que todo R² está formado por puntos fijos.'
            : 'El sistema (A - I)c = -t tiene una única solución, luego existe un único punto fijo.',
        'Al trasladar el origen a un punto fijo, la traslación desaparece.',
        `La forma normal afín queda reducida a ${linearAnalysis.caseLabel.toLowerCase()}.`,
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
      shortText: 'Sin punto fijo y con parte lineal identidad, la aplicación es afínmente equivalente a una traslación unitaria.',
      canvasSubtitle: 'La forma canónica elegida es una traslación horizontal unitaria.',
      steps: [
        'La parte lineal coincide con la identidad.',
        'No existe punto fijo, así que la traslación es esencial.',
        'Mediante un cambio lineal de coordenadas se puede alinear con el eje x.',
        'Tras reescalar se normaliza a una unidad.',
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
      shortText: 'La traslación esencial sobrevive en la dirección propia del autovalor 1 y se normaliza.',
      canvasSubtitle: 'Se muestra la forma canónica afín con una traslación normalizada en la dirección propia.',
      steps: [
        'La parte lineal tiene dos autovalores reales distintos y uno de ellos es 1.',
        'La ausencia de punto fijo impide absorber completamente la traslación.',
        'En una base propia, sólo queda una componente esencial en la dirección del autovalor 1.',
        `Esa componente se normaliza y se obtiene (x, y) ↦ (x + 1, ${formatMatrixEntry(otherEigenvalue)} y).`,
      ],
    }
  }

  if (linearAnalysis.caseId === 'jordan-block' && almostEqual(trace2(linearPart), 2)) {
    const basis = generalizedJordanBasisForOne(linearPart)
    const inverseBasis = inverse2(basis)
    const translationInBasis = inverseBasis ? applyMatrix(inverseBasis, translation) : { x: 0, y: 1 }
    const canonicalTranslation = almostEqual(translationInBasis.y, 0) ? { x: 0, y: 0 } : { x: 0, y: 1 }
    const canonicalLinearPart: Matrix2 = [[1, 1], [0, 1]]

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
      shortText: 'Aparece un bloque de Jordan para el autovalor 1 y una traslación residual transversal.',
      canvasSubtitle: 'La forma normal afín se representa como (x, y) ↦ (x + y, y + 1).',
      steps: [
        'La parte lineal tiene autovalor 1 con bloque de Jordan no trivial.',
        'No hay punto fijo, así que queda una componente afín esencial.',
        'En una base de Jordan, la traslación residual sólo importa en la dirección transversal.',
        'Tras normalizarla se obtiene la forma parabólica estándar.',
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
    shortText: 'La traslación no introduce un nuevo fenómeno afín tras el cambio de coordenadas adecuado.',
    canvasSubtitle: 'Se muestra la forma canónica real de la parte lineal.',
    steps: [
      'Se construye la matriz homogénea de la aplicación afín.',
      'La reducción afín no deja una traslación esencial en la forma normal.',
      'La clasificación coincide con la forma canónica real de la parte lineal.',
    ],
  }
}