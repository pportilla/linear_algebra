import {
  applyMatrix,
  determinant2,
  homogeneousFromAffine,
  inverse2,
  matrixFromImages,
  multiplyMatrices,
  pointAreaTwice,
  subtractVectors,
  trace2,
} from './math2d'
import type { Matrix2, Vec2 } from './math2d'
import {
  addExpressions,
  expressionFromNumber,
  formatLatexExpression,
  formatLatexNumber as formatNumber,
  negateExpression,
  scaleExpression,
  squareRootExpressionFromNumber,
  subtractExpressions,
  type SymbolicExpression,
} from './symbolicMath'

const EPSILON = 1e-8

export interface LinearTexPayload {
  basis: {
    b1: Vec2
    b2: Vec2
  }
  imageBasis: {
    tb1: Vec2
    tb2: Vec2
  }
}

export interface AffineTexPayload {
  source: {
    p0: Vec2
    p1: Vec2
    p2: Vec2
  }
  image: {
    q0: Vec2
    q1: Vec2
    q2: Vec2
  }
}

type LinearTexAnalysis =
  | {
      caseId: 'distinct-real'
      canonicalMatrix: Matrix2
      trace: number
      determinant: number
      discriminant: number
      lambda1: number
      lambda2: number
    }
  | {
      caseId: 'scalar' | 'jordan-block'
      canonicalMatrix: Matrix2
      trace: number
      determinant: number
      discriminant: number
      lambda: number
    }
  | {
      caseId: 'complex-pair'
      canonicalMatrix: Matrix2
      trace: number
      determinant: number
      discriminant: number
      realPart: number
      imaginaryPart: number
    }

type LinearCanonical = {
  v1: Vec2
  v2: Vec2
  P: Matrix2
  canonical: Matrix2
  body: string
}

type DistinctRealAnalysis = Extract<LinearTexAnalysis, { caseId: 'distinct-real' }>
type ComplexPairAnalysis = Extract<LinearTexAnalysis, { caseId: 'complex-pair' }>

function vecToLatex(vector: Vec2) {
  return `\\begin{pmatrix}${formatNumber(vector.x)}\\\\${formatNumber(vector.y)}\\end{pmatrix}`
}

function matrixToLatex(matrix: number[][]) {
  return `\\begin{pmatrix}${matrix.map((row) => row.map(formatNumber).join(' & ')).join('\\\\')}\\end{pmatrix}`
}

function symbolicNumber(value: number) {
  const expression = expressionFromNumber(value)

  if (!expression) {
    throw new Error(`No se pudo convertir ${value} en una expresión racional.`)
  }

  return expression
}

function expressionVectorToLatex(entries: [SymbolicExpression, SymbolicExpression]) {
  return `\\begin{pmatrix}${entries.map(formatLatexExpression).join('\\\\')}\\end{pmatrix}`
}

function expressionMatrixToLatex(matrix: SymbolicExpression[][]) {
  return `\\begin{pmatrix}${matrix.map((row) => row.map(formatLatexExpression).join(' & ')).join('\\\\')}\\end{pmatrix}`
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

function isScalarMatrix(matrix: Matrix2, scalar: number) {
  return (
    Math.abs(matrix[0][0] - scalar) < 1e-6 &&
    Math.abs(matrix[1][1] - scalar) < 1e-6 &&
    Math.abs(matrix[0][1]) < 1e-6 &&
    Math.abs(matrix[1][0]) < 1e-6
  )
}

function matrixMinusScalar(matrix: Matrix2, scalar: number): Matrix2 {
  return [
    [matrix[0][0] - scalar, matrix[0][1]],
    [matrix[1][0], matrix[1][1] - scalar],
  ]
}

function classifyLinear(matrix: Matrix2): LinearTexAnalysis {
  const trace = trace2(matrix)
  const determinant = determinant2(matrix)
  const discriminant = trace * trace - 4 * determinant

  if (discriminant > EPSILON) {
    const root = Math.sqrt(discriminant)
    const lambda1 = (trace + root) / 2
    const lambda2 = (trace - root) / 2
    return {
      caseId: 'distinct-real',
      canonicalMatrix: [
        [lambda1, 0],
        [0, lambda2],
      ],
      trace,
      determinant,
      discriminant,
      lambda1,
      lambda2,
    }
  }

  if (Math.abs(discriminant) <= EPSILON) {
    const lambda = trace / 2

    if (isScalarMatrix(matrix, lambda)) {
      return {
        caseId: 'scalar',
        canonicalMatrix: [
          [lambda, 0],
          [0, lambda],
        ],
        trace,
        determinant,
        discriminant,
        lambda,
      }
    }

    return {
      caseId: 'jordan-block',
      canonicalMatrix: [
        [lambda, 1],
        [0, lambda],
      ],
      trace,
      determinant,
      discriminant,
      lambda,
    }
  }

  const realPart = trace / 2
  const imaginaryPart = Math.sqrt(-discriminant) / 2
  return {
    caseId: 'complex-pair',
    canonicalMatrix: [
      [realPart, -imaginaryPart],
      [imaginaryPart, realPart],
    ],
    trace,
    determinant,
    discriminant,
    realPart,
    imaginaryPart,
  }
}

function solvePossiblySingular(matrix: Matrix2, rhs: Vec2) {
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

  const candidate = Math.abs(pivot.a) >= Math.abs(pivot.b)
    ? { x: pivot.c / pivot.a, y: 0 }
    : { x: 0, y: pivot.c / pivot.b }
  const image = applyMatrix(matrix, candidate)
  return Math.hypot(image.x - rhs.x, image.y - rhs.y) < 1e-6 ? candidate : null
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
  const useRow0 = row0Norm >= row1Norm
  const row = useRow0 ? nilpotent[0] : nilpotent[1]
  const rhs = useRow0 ? eigenvector.x : eigenvector.y

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

function matrixToLatex3x3(matrix: number[][]) {
  return `\\begin{pmatrix}${matrix[0].map(formatNumber).join(' & ')}\\\\${matrix[1].map(formatNumber).join(' & ')}\\\\${matrix[2].map(formatNumber).join(' & ')}\\end{pmatrix}`
}

function linearInverseNarrative(matrix: Matrix2, symbol = 'B') {
  const determinant = determinant2(matrix)
  const inverse = inverse2(matrix)

  if (!inverse) {
    throw new Error(`La matriz ${symbol} no es invertible.`)
  }

  return `
Recordamos la matriz y su determinante,
\\[
${symbol}=${matrixToLatex(matrix)},\\qquad \\det(${symbol})=${formatNumber(determinant)}.
\\]
Como el determinante no se anula, podemos invertir $${symbol}$ con la fórmula usual para matrices $2\\times 2$:
\\[
${symbol}^{-1}=\\frac{1}{${formatNumber(determinant)}}\\begin{pmatrix}${formatNumber(matrix[1][1])} & ${formatNumber(-matrix[0][1])}\\\\${formatNumber(-matrix[1][0])} & ${formatNumber(matrix[0][0])}\\end{pmatrix}=${matrixToLatex(inverse)}.
\\]
`
}

function buildAreaCalculationLatex(p0: Vec2, p1: Vec2, p2: Vec2, area: number) {
  const side1 = subtractVectors(p1, p0)
  const side2 = subtractVectors(p2, p0)

  return `
Se restan primero los vectores con origen en $p_0$, porque la independencia afín de $p_0,p_1,p_2$ se comprueba estudiando si $p_1-p_0$ y $p_2-p_0$ son linealmente independientes:
\\[
p_1-p_0=${vecToLatex(p1)}-${vecToLatex(p0)}=${vecToLatex(side1)},
\\qquad
p_2-p_0=${vecToLatex(p2)}-${vecToLatex(p0)}=${vecToLatex(side2)}.
\\]
Entonces el área orientada doble del triángulo origen es el determinante formado por esos dos vectores:
\\[
(p_1-p_0)\\wedge(p_2-p_0)
=\\begin{vmatrix}${formatNumber(side1.x)} & ${formatNumber(side2.x)}\\\\${formatNumber(side1.y)} & ${formatNumber(side2.y)}\\end{vmatrix}
=${formatNumber(side1.x)}\\cdot${formatNumber(side2.y)}-${formatNumber(side1.y)}\\cdot${formatNumber(side2.x)}
=${formatNumber(area)}\\neq 0.
\\]
Por tanto, $p_1-p_0$ y $p_2-p_0$ forman una base del espacio vectorial asociado. En consecuencia, $p_0,p_1,p_2$ son afínmente independientes y determinan una única aplicación afín.

Además, el área geométrica del triángulo origen es
\\[
\\frac{1}{2}\\left|${formatNumber(area)}\\right|=${formatNumber(Math.abs(area) / 2)}.
\\]
`
}

function buildLinearCanonical(matrix: Matrix2, analysis: LinearTexAnalysis): LinearCanonical {
  if (analysis.caseId === 'distinct-real') {
    const v1 = eigenvectorFor(matrix, analysis.lambda1)
    const v2 = eigenvectorFor(matrix, analysis.lambda2)
    const P = matrixFromImages(v1, v2)
    const symbolicEigenvalues = symbolicDistinctRealEigenvalues(analysis.trace, analysis.discriminant)
    const symbolicV1 = symbolicDistinctRealEigenvector(matrix, symbolicEigenvalues.lambda1, analysis.lambda1)
    const symbolicV2 = symbolicDistinctRealEigenvector(matrix, symbolicEigenvalues.lambda2, analysis.lambda2)
    return {
      v1,
      v2,
      P,
      canonical: analysis.canonicalMatrix,
      body: `
Tenemos dos autovalores reales distintos, $\\lambda_1=${formatLatexExpression(symbolicEigenvalues.lambda1)}$ y $\\lambda_2=${formatLatexExpression(symbolicEigenvalues.lambda2)}$. Para cada uno buscamos un autovector resolviendo $(A-\\lambda_i I)\\,v=0$:
\\[
A-\\lambda_1 I=${expressionMatrixToLatex(symbolicMatrixMinusScalar(matrix, symbolicEigenvalues.lambda1))}\\ \\implies\\ v_1=${expressionVectorToLatex(symbolicV1)},
\\]
\\[
A-\\lambda_2 I=${expressionMatrixToLatex(symbolicMatrixMinusScalar(matrix, symbolicEigenvalues.lambda2))}\\ \\implies\\ v_2=${expressionVectorToLatex(symbolicV2)}.
\\]
Colocando los autovectores como columnas obtenemos $P=[\\,v_1\\ v_2\\,]=${expressionMatrixToLatex([[symbolicV1[0], symbolicV2[0]], [symbolicV1[1], symbolicV2[1]]])}$, y la forma canónica correspondiente es
\\[
J=${expressionMatrixToLatex([[symbolicEigenvalues.lambda1, symbolicNumber(0)], [symbolicNumber(0), symbolicEigenvalues.lambda2]])}.
\\]
`,
    }
  }

  if (analysis.caseId === 'scalar') {
    return {
      v1: { x: 1, y: 0 },
      v2: { x: 0, y: 1 },
      P: [[1, 0], [0, 1]],
      canonical: analysis.canonicalMatrix,
      body: `
Aquí $A=${formatNumber(analysis.lambda)}\\,I$: todo vector no nulo es autovector. Podemos quedarnos con la base canónica, $v_1=e_1$ y $v_2=e_2$, con lo que $P=I$ y la forma de Jordan es simplemente la propia $A$:
\\[
J=${matrixToLatex(analysis.canonicalMatrix)}.
\\]
`,
    }
  }

  if (analysis.caseId === 'jordan-block') {
    const v1 = eigenvectorFor(matrix, analysis.lambda)
    const v2 = generalizedEigenvectorFor(matrix, analysis.lambda, v1)
    const P = matrixFromImages(v1, v2)
    return {
      v1,
      v2,
      P,
      canonical: analysis.canonicalMatrix,
      body: `
Estamos en el caso del autovalor doble $\\lambda=${formatNumber(analysis.lambda)}$ con un único bloque de Jordan. Primero calculamos un autovector resolviendo $(A-\\lambda I)\\,v=0$:
\\[
A-\\lambda I=${matrixToLatex(matrixMinusScalar(matrix, analysis.lambda))}\\ \\implies\\ v_1=${vecToLatex(v1)}.
\\]
Necesitamos además un vector generalizado $v_2$ que satisfaga $(A-\\lambda I)\\,v_2=v_1$. Elegimos
\\[
v_2=${vecToLatex(v2)}.
\\]
Con estos dos vectores formamos $P=[\\,v_1\\ v_2\\,]=${matrixToLatex(P)}$, y obtenemos
\\[
J=${matrixToLatex(analysis.canonicalMatrix)}.
\\]
`,
    }
  }

  const complexAnalysis = analysis as ComplexPairAnalysis
  const { u, v } = complexEigenBasis(matrix, complexAnalysis.realPart, complexAnalysis.imaginaryPart)
  const P = matrixFromImages(v, u)
  const symbolicParts = symbolicComplexEigenParts(complexAnalysis.trace, complexAnalysis.discriminant)
  const symbolicBasis = symbolicComplexEigenBasis(matrix, symbolicParts.realPart, symbolicParts.imaginaryPart)
  return {
    v1: v,
    v2: u,
    P,
    canonical: complexAnalysis.canonicalMatrix,
    body: `
Los autovalores son complejos conjugados, $\\lambda_{\\pm}=${formatLatexExpression(symbolicParts.realPart)}\\pm ${formatLatexExpression(symbolicParts.imaginaryPart)}\\,i$. Buscamos un autovector complejo de $\\lambda_+$ y lo descomponemos en parte real e imaginaria:
\\[
u=${expressionVectorToLatex(symbolicBasis.u)}\\ \\text{(parte real)},\\qquad v=${expressionVectorToLatex(symbolicBasis.v)}\\ \\text{(parte imaginaria)}.
\\]
Para que la conjugación dé exactamente el bloque $\\begin{pmatrix}a & -b\\\\b & a\\end{pmatrix}$, colocamos la parte imaginaria en la primera columna:
\\[
P=[\\,v\\ u\\,]=${expressionMatrixToLatex([[symbolicBasis.v[0], symbolicBasis.u[0]], [symbolicBasis.v[1], symbolicBasis.u[1]]])},\\qquad J_{\\mathbb R}=${expressionMatrixToLatex([[symbolicParts.realPart, negateExpression(symbolicParts.imaginaryPart)], [symbolicParts.imaginaryPart, symbolicParts.realPart]])}.
\\]
`,
  }
}

function buildAffineCaseFixedPoint(linearPart: Matrix2, fixedPoint: Vec2, analysis: LinearTexAnalysis) {
  const aMinusI = matrixMinusScalar(linearPart, 1)
  const det = determinant2(aMinusI)
  const canonical = buildLinearCanonical(linearPart, analysis)
  const invP = inverse2(canonical.P)
  const verification = invP ? multiplyMatrices(multiplyMatrices(invP, linearPart), canonical.P) : canonical.canonical
  const symbolJ = analysis.caseId === 'complex-pair' ? 'J_{\\mathbb R}' : 'J'

  return `
\\subsection*{Paso 7. Búsqueda de punto fijo}
Se plantea $F(c)=c$, es decir, $Ac+t=c$, o equivalentemente $(A-I)c=-t$:
\\[
A-I=${matrixToLatex(aMinusI)},\\qquad \\det(A-I)=${formatNumber(det)}.
\\]
Como $\\det(A-I)\\neq 0$, el sistema tiene solución única
\\[
c=(A-I)^{-1}(-t)=${vecToLatex(fixedPoint)}.
\\]
Por tanto, $F$ tiene un único punto fijo. En las coordenadas trasladadas $y=x-c$, la aplicación se convierte en
\\[
\\tilde F(y)=F(y+c)-c=Ay,
\\]
es decir, la traslación desaparece y el problema afín se reduce al lineal.

\\subsection*{Paso 8. Reducción de Jordan de la parte lineal $A$}
${canonical.body}
Invirtiendo $P$ se verifica la conjugación:
${linearInverseNarrative(canonical.P, 'P')}
\\[
P^{-1}AP=${matrixToLatex(verification)}=${matrixToLatex(analysis.canonicalMatrix)}=${symbolJ}.
\\]

\\subsection*{Paso 9. Referencia afín adaptada}
La referencia afín en la que $F$ adopta su forma normal es
\\[
\\mathcal R=(${vecToLatex(fixedPoint)},(${vecToLatex(canonical.v1)},${vecToLatex(canonical.v2)})).
\\]
En esa referencia la traslación es nula y la parte lineal es $${symbolJ}$. La matriz homogénea de la forma normal afín es
\\[
H_{\\mathrm{can}}=${matrixToLatex3x3(homogeneousFromAffine(analysis.canonicalMatrix, { x: 0, y: 0 }))}.
\\]
`
}

function buildAffineCaseTranslation(translation: Vec2) {
  const v1 = translation
  const v2 = Math.abs(translation.x) >= Math.abs(translation.y)
    ? { x: -translation.y, y: translation.x }
    : { x: translation.y, y: -translation.x }
  const P = matrixFromImages(v1, v2)

  return `
\\subsection*{Paso 7. Búsqueda de punto fijo}
Aquí $A=I$, de modo que $A-I=0$ y la ecuación $(A-I)c=-t$ se reduce a $0=-t$. Como $t\\neq 0$, no hay punto fijo: $F$ es una traslación pura.

\\subsection*{Paso 8. Elección de base para normalizar la traslación}
Puesto que la parte lineal es la identidad, en cualquier base la aplicación sigue siendo una suma por el mismo vector. Para que esa suma quede lo más simple posible, se toma como primer vector de la base la propia dirección de la traslación y como segundo un vector no paralelo:
\\[
v_1=t=${vecToLatex(translation)},\\qquad v_2=${vecToLatex(v2)},\\qquad P=[v_1\\ v_2]=${matrixToLatex(P)}.
\\]
Con esta elección, el vector de traslación coincide exactamente con el primer vector de la base. Por eso, en las coordenadas $y=P^{-1}x$ se tiene
\\[
P^{-1}t=${vecToLatex({ x: 1, y: 0 })},
\\]
y la aplicación actúa por
\\[
(y_1,y_2)\\longmapsto (y_1+1,\\ y_2).
\\]

\\subsection*{Paso 9. Referencia afín adaptada}
En una traslación pura no hace falta mover el origen. Si se cambia el origen en un vector $u$, el nuevo término independiente sería
\\[
t+(A-I)u=t+(I-I)u=t,
\\]
de modo que el vector de traslación no cambia. Por eso podemos conservar el origen actual y modificar sólo la base:
\\[
\\mathcal R=((0,0),(${vecToLatex(translation)},${vecToLatex(v2)})).
\\]
En esa referencia la forma normal afín queda descrita por la matriz homogénea
\\[
H_{\\mathrm{can}}=${matrixToLatex3x3(homogeneousFromAffine([[1, 0], [0, 1]], { x: 1, y: 0 }))}.
\\]
`
}

function buildAffineCaseDistinctOneIsEigenvalue(linearPart: Matrix2, translation: Vec2, analysis: DistinctRealAnalysis) {
  const other = Math.abs(analysis.lambda1 - 1) < 1e-6 ? analysis.lambda2 : analysis.lambda1
  const v1 = eigenvectorFor(linearPart, 1)
  const v2 = eigenvectorFor(linearPart, other)
  const P = matrixFromImages(v1, v2)
  const invP = inverse2(P)
  const s = invP ? applyMatrix(invP, translation) : { x: 1, y: 0 }
  const yStar = s.y / (1 - other)
  const newOrigin = { x: yStar * v2.x, y: yStar * v2.y }
  const scaledV1 = { x: s.x * v1.x, y: s.x * v1.y }
  const canonical: Matrix2 = [[1, 0], [0, other]]

  return `
\\subsection*{Paso 7. Ausencia de punto fijo}
Uno de los autovalores de $A$ es $1$, por lo que $A-I$ es singular:
\\[
A-I=${matrixToLatex(matrixMinusScalar(linearPart, 1))},\\qquad \\det(A-I)=0.
\\]
El sistema $(A-I)c=-t$ sólo tiene solución si la componente de $-t$ a lo largo de $v_1$ (el autovector de $\\lambda=1$) es nula. Aquí no lo es, luego no hay punto fijo.

\\subsection*{Paso 8. Cambio a base propia de $A$}
Autovectores (uno por cada autovalor):
\\[
v_1=${vecToLatex(v1)}\\ (\\lambda=1),
\\qquad
v_2=${vecToLatex(v2)}\\ (\\lambda=${formatNumber(other)}).
\\]
Con $P=[v_1\\ v_2]=${matrixToLatex(P)}$, las coordenadas $y=P^{-1}x$ diagonalizan $A$. La traslación en esas coordenadas es
\\[
s=P^{-1}t=${vecToLatex(s)}=(s_1,s_2).
\\]
En ellas $F$ actúa como
\\[
(y_1,y_2)\\longmapsto (y_1+s_1,\\ ${formatNumber(other)}\\,y_2+s_2).
\\]

\\subsection*{Paso 9. Centrado en la dirección no trivial}
En la segunda coordenada el factor $\\lambda_2=${formatNumber(other)}\\neq 1$ permite cancelar la traslación desplazando el origen a
\\[
y_2^{*}=\\frac{s_2}{1-\\lambda_2}=${formatNumber(yStar)}.
\\]
En coordenadas originales esto equivale a tomar como nuevo origen
\\[
O'=y_2^{*}\\,v_2=${vecToLatex(newOrigin)}.
\\]
Con el origen movido a $O'$ queda $(z_1,z_2)\\mapsto(z_1+s_1,\\ ${formatNumber(other)}\\,z_2)$.

\\subsection*{Paso 10. Normalización de la traslación esencial}
Para llevar la traslación residual a $1$, se reescala la primera coordenada ($w_1=z_1/s_1$), lo que equivale a sustituir $v_1$ por $s_1 v_1=${vecToLatex(scaledV1)}$. Con ello $F$ adopta la forma canónica
\\[
(w_1,w_2)\\longmapsto (w_1+1,\\ ${formatNumber(other)}\\,w_2).
\\]

\\subsection*{Paso 11. Referencia afín adaptada}
\\[
\\mathcal R=(${vecToLatex(newOrigin)},(${vecToLatex(scaledV1)},${vecToLatex(v2)})).
\\]
Matriz homogénea de la forma normal afín:
\\[
H_{\\mathrm{can}}=${matrixToLatex3x3(homogeneousFromAffine(canonical, { x: 1, y: 0 }))}.
\\]
`
}

function buildAffineCaseParabolic(linearPart: Matrix2, translation: Vec2) {
  const v1 = eigenvectorFor(linearPart, 1)
  const v2 = generalizedEigenvectorFor(linearPart, 1, v1)
  const P = matrixFromImages(v1, v2)
  const invP = inverse2(P)
  const s = invP ? applyMatrix(invP, translation) : { x: 0, y: 1 }
  const newOrigin = { x: -s.x * v2.x, y: -s.x * v2.y }
  const scaledV1 = { x: s.y * v1.x, y: s.y * v1.y }
  const canonical: Matrix2 = [[1, 1], [0, 1]]

  return `
\\subsection*{Paso 7. Ausencia de punto fijo}
$A$ tiene autovalor doble $\\lambda=1$ con bloque de Jordan, de modo que $A-I\\neq 0$ pero $(A-I)^2=0$. El sistema $(A-I)c=-t$ sólo tiene solución cuando $-t\\in\\mathrm{im}(A-I)=\\ker(A-I)$. Aquí la componente transversal de $-t$ no es nula: no hay punto fijo.

\\subsection*{Paso 8. Cambio a base de Jordan}
Autovector y vector generalizado para $\\lambda=1$:
\\[
v_1=${vecToLatex(v1)}\\ \\text{(autovector)},
\\qquad
v_2=${vecToLatex(v2)}\\ \\text{con }(A-I)v_2=v_1.
\\]
Con $P=[v_1\\ v_2]=${matrixToLatex(P)}$, $A$ se conjuga al bloque de Jordan $J=${matrixToLatex([[1, 1], [0, 1]])}$. La traslación en estas coordenadas es
\\[
s=P^{-1}t=${vecToLatex(s)}=(s_1,s_2).
\\]
En ellas $F$ actúa como
\\[
(y_1,y_2)\\longmapsto (y_1+y_2+s_1,\\ y_2+s_2).
\\]

\\subsection*{Paso 9. Cancelar la parte no esencial de la traslación}
Desplazamos el origen tomando $c_1=0$ y $c_2=-s_1$, es decir,
\\[
O'=-s_1\\,v_2=${vecToLatex(newOrigin)}.
\\]
En las nuevas coordenadas $z=y-c$ la aplicación queda
\\[
(z_1,z_2)\\longmapsto (z_1+z_2,\\ z_2+s_2).
\\]

\\subsection*{Paso 10. Normalización de la traslación transversal}
Se reescala la segunda coordenada con $w_2=z_2/s_2$. Para respetar la forma del bloque de Jordan hay que reescalar también la primera, sustituyendo $v_1$ por $s_2 v_1=${vecToLatex(scaledV1)}$. Con ello se llega a la forma canónica
\\[
(w_1,w_2)\\longmapsto (w_1+w_2,\\ w_2+1).
\\]

\\subsection*{Paso 11. Referencia afín adaptada}
\\[
\\mathcal R=(${vecToLatex(newOrigin)},(${vecToLatex(scaledV1)},${vecToLatex(v2)})).
\\]
Matriz homogénea de la forma normal afín:
\\[
H_{\\mathrm{can}}=${matrixToLatex3x3(homogeneousFromAffine(canonical, { x: 0, y: 1 }))}.
\\]
`
}

function buildAffineCaseFallback(linearPart: Matrix2, analysis: LinearTexAnalysis) {
  const canonical = buildLinearCanonical(linearPart, analysis)
  const symbolJ = analysis.caseId === 'complex-pair' ? 'J_{\\mathbb R}' : 'J'

  return `
\\subsection*{Paso 7. Reducción a la forma lineal canónica}
En este caso el cambio lineal de coordenadas que normaliza $A$ absorbe también la traslación sin dejar residuos esenciales.

${canonical.body}

\\subsection*{Paso 8. Referencia afín adaptada}
\\[
\\mathcal R=((0,0),(${vecToLatex(canonical.v1)},${vecToLatex(canonical.v2)})).
\\]
En esa referencia $F$ actúa como la forma canónica real de $A$:
\\[
H_{\\mathrm{can}}=${matrixToLatex3x3(homogeneousFromAffine(analysis.canonicalMatrix, { x: 0, y: 0 }))}\\ (${symbolJ}\\text{ en las dos primeras columnas}).
\\]
`
}

export function buildLinearTex(payload: LinearTexPayload) {
  const basisMatrix = matrixFromImages(payload.basis.b1, payload.basis.b2)
  const imageMatrix = matrixFromImages(payload.imageBasis.tb1, payload.imageBasis.tb2)
  const inverseBasis = inverse2(basisMatrix)

  if (!inverseBasis) {
    throw new Error('La base introducida no es invertible.')
  }

  const matrix = multiplyMatrices(imageMatrix, inverseBasis)
  const analysis = classifyLinear(matrix)
  const characteristic = `p_A(x)=x^2-(${formatNumber(analysis.trace)})x+(${formatNumber(analysis.determinant)})`
  const canonical = buildLinearCanonical(matrix, analysis)
  let pDisplay = matrixToLatex(canonical.P)
  let canonicalDisplay = matrixToLatex(analysis.canonicalMatrix)

  let caseTitle = ''
  let caseBody = ''

  if (analysis.caseId === 'distinct-real') {
    const symbolicEigenvalues = symbolicDistinctRealEigenvalues(analysis.trace, analysis.discriminant)
    const symbolicV1 = symbolicDistinctRealEigenvector(matrix, symbolicEigenvalues.lambda1, analysis.lambda1)
    const symbolicV2 = symbolicDistinctRealEigenvector(matrix, symbolicEigenvalues.lambda2, analysis.lambda2)
    pDisplay = expressionMatrixToLatex([[symbolicV1[0], symbolicV2[0]], [symbolicV1[1], symbolicV2[1]]])
    canonicalDisplay = expressionMatrixToLatex([[symbolicEigenvalues.lambda1, symbolicNumber(0)], [symbolicNumber(0), symbolicEigenvalues.lambda2]])
    caseTitle = 'dos autovalores reales distintos'
    caseBody = `
\\subsection*{Paso 6. Clasificación y autovalores}
Calculamos el discriminante del polinomio característico:
\\[
\\Delta=\\operatorname{tr}(A)^2-4\\det(A)=(${formatNumber(analysis.trace)})^2-4(${formatNumber(analysis.determinant)})=${formatNumber(analysis.discriminant)}>0.
\\]
Al ser positivo, $p_A$ tiene dos raíces reales distintas,
\\[
\\lambda_1=\\frac{${formatNumber(analysis.trace)}+\\sqrt{${formatNumber(analysis.discriminant)}}}{2}=${formatLatexExpression(symbolicEigenvalues.lambda1)},
\\qquad
\\lambda_2=\\frac{${formatNumber(analysis.trace)}-\\sqrt{${formatNumber(analysis.discriminant)}}}{2}=${formatLatexExpression(symbolicEigenvalues.lambda2)}.
\\]
Con dos autovalores reales distintos, $A$ es diagonalizable y su forma de Jordan es la matriz diagonal formada por esos autovalores:
\\[
J=${expressionMatrixToLatex([[symbolicEigenvalues.lambda1, symbolicNumber(0)], [symbolicNumber(0), symbolicEigenvalues.lambda2]])}.
\\]

\\subsection*{Paso 7. Autovectores y matriz de cambio de base}
Para cada autovalor buscamos un vector columna no nulo que cumpla $(A-\\lambda_i I)\\,v=0$. Como $A-\\lambda_i I$ es singular, podemos tomar un vector perpendicular a cualquiera de sus filas no nulas.

Para $\\lambda_1=${formatLatexExpression(symbolicEigenvalues.lambda1)}$:
\\[
A-\\lambda_1 I=${expressionMatrixToLatex(symbolicMatrixMinusScalar(matrix, symbolicEigenvalues.lambda1))}
\\quad\\implies\\quad
v_1=${expressionVectorToLatex(symbolicV1)}.
\\]

Para $\\lambda_2=${formatLatexExpression(symbolicEigenvalues.lambda2)}$:
\\[
A-\\lambda_2 I=${expressionMatrixToLatex(symbolicMatrixMinusScalar(matrix, symbolicEigenvalues.lambda2))}
\\quad\\implies\\quad
v_2=${expressionVectorToLatex(symbolicV2)}.
\\]

Pegamos los dos autovectores como columnas para formar la matriz de cambio de base:
\\[
P=[\\,v_1\\ v_2\\,]=${expressionMatrixToLatex([[symbolicV1[0], symbolicV2[0]], [symbolicV1[1], symbolicV2[1]]])}.
\\]
`
  } else if (analysis.caseId === 'scalar') {
    caseTitle = 'matriz escalar'
    caseBody = `
\\subsection*{Paso 6. Clasificación y autovalor}
El discriminante se anula, así que hay un único autovalor,
\\[
\\lambda=\\frac{\\operatorname{tr}(A)}{2}=${formatNumber(analysis.lambda)}.
\\]
Además, $A$ coincide con $\\lambda I$: todo vector no nulo es ya autovector, y $A$ está en su forma canónica.

\\subsection*{Paso 7. Matriz de cambio de base}
Cualquier base de $\\mathbb R^2$ vale. Por comodidad escogemos la base canónica, $v_1=e_1$ y $v_2=e_2$, con lo que
\\[
P=${matrixToLatex(canonical.P)}.
\\]
`
  } else if (analysis.caseId === 'jordan-block') {
    caseTitle = 'autovalor doble con bloque de Jordan'
    caseBody = `
\\subsection*{Paso 6. Clasificación y autovalor doble}
El discriminante se anula, así que hay un único autovalor,
\\[
\\lambda=\\frac{\\operatorname{tr}(A)}{2}=${formatNumber(analysis.lambda)}.
\\]
Pero $A\\neq\\lambda I$, así que el autoespacio tiene sólo dimensión $1$. En dimensión dos esto obliga a que aparezca un único bloque de Jordan de tamaño $2$:
\\[
J=${matrixToLatex(analysis.canonicalMatrix)}.
\\]

\\subsection*{Paso 7. Autovector, vector generalizado y matriz de cambio de base}
Primero calculamos un autovector resolviendo $(A-\\lambda I)\\,v=0$:
\\[
A-\\lambda I=${matrixToLatex(matrixMinusScalar(matrix, analysis.lambda))}
\\quad\\implies\\quad
v_1=${vecToLatex(canonical.v1)}.
\\]
A continuación necesitamos un vector generalizado $v_2$ que satisfaga $(A-\\lambda I)\\,v_2=v_1$. Basta con usar una fila no trivial del sistema. Obtenemos
\\[
v_2=${vecToLatex(canonical.v2)}.
\\]
Con estos dos vectores en las columnas se obtiene la matriz de cambio de base:
\\[
P=[\\,v_1\\ v_2\\,]=${matrixToLatex(canonical.P)}.
\\]
`
  } else {
    const complexAnalysis = analysis as ComplexPairAnalysis
    const symbolicParts = symbolicComplexEigenParts(complexAnalysis.trace, complexAnalysis.discriminant)
    const symbolicBasis = symbolicComplexEigenBasis(matrix, symbolicParts.realPart, symbolicParts.imaginaryPart)
    pDisplay = expressionMatrixToLatex([[symbolicBasis.v[0], symbolicBasis.u[0]], [symbolicBasis.v[1], symbolicBasis.u[1]]])
    canonicalDisplay = expressionMatrixToLatex([[symbolicParts.realPart, negateExpression(symbolicParts.imaginaryPart)], [symbolicParts.imaginaryPart, symbolicParts.realPart]])
    caseTitle = 'par de autovalores complejos conjugados'
    caseBody = `
\\subsection*{Paso 6. Clasificación y autovalores complejos}
El discriminante es negativo,
\\[
\\Delta=${formatNumber(analysis.discriminant)}<0,
\\]
así que $p_A$ no tiene raíces reales: los autovalores son complejos conjugados,
\\[
\\lambda_{\\pm}=${formatLatexExpression(symbolicParts.realPart)}\\pm ${formatLatexExpression(symbolicParts.imaginaryPart)}\\,i.
\\]
Sobre $\\mathbb R$ no existe una forma de Jordan real. En su lugar usamos el bloque canónico real
\\[
J_{\\mathbb R}=${expressionMatrixToLatex([[symbolicParts.realPart, negateExpression(symbolicParts.imaginaryPart)], [symbolicParts.imaginaryPart, symbolicParts.realPart]])}.
\\]

\\subsection*{Paso 7. Autovector complejo y base real}
Buscamos un autovector complejo $z=u+iv$ asociado a $\\lambda_+=a+bi$ como núcleo complejo de $A-\\lambda_+ I$, y lo separamos en parte real e imaginaria:
\\[
u=${expressionVectorToLatex(symbolicBasis.u)}\\ \\text{(parte real)},\\qquad v=${expressionVectorToLatex(symbolicBasis.v)}\\ \\text{(parte imaginaria)}.
\\]
Si ordenamos la base como $(v,u)$ —parte imaginaria primero—, la conjugación reproduce exactamente el bloque $\\begin{pmatrix}a & -b\\\\b & a\\end{pmatrix}$:
\\[
P=[\\,v\\ u\\,]=${expressionMatrixToLatex([[symbolicBasis.v[0], symbolicBasis.u[0]], [symbolicBasis.v[1], symbolicBasis.u[1]]])}.
\\]
`
  }

  const symbolJ = analysis.caseId === 'complex-pair' ? 'J_{\\mathbb R}' : 'J'

  return `
\\documentclass[11pt]{article}
\\usepackage[spanish]{babel}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{lmodern}
\\usepackage{amsmath,amssymb}
\\usepackage[a4paper,margin=2.2cm]{geometry}
\\setlength{\\parindent}{0pt}
\\begin{document}
\\section*{Reducción lineal en $\\mathbb R^2$: ${caseTitle}}

\\subsection*{Paso 1. Datos de partida}
Se parte de una base de $\\mathbb R^2$ elegida por el usuario,
\\[
b_1=${vecToLatex(payload.basis.b1)},\\qquad b_2=${vecToLatex(payload.basis.b2)},
\\]
y de las imágenes fijadas para esos vectores,
\\[
T(b_1)=${vecToLatex(payload.imageBasis.tb1)},\\qquad T(b_2)=${vecToLatex(payload.imageBasis.tb2)}.
\\]

\\subsection*{Paso 2. Matriz de la base y de las imágenes}
Se colocan los vectores por columnas,
\\[
B=[b_1\\ b_2]=${matrixToLatex(basisMatrix)},
\\qquad
Y=[T(b_1)\\ T(b_2)]=${matrixToLatex(imageMatrix)}.
\\]
La matriz $A$ de $T$ en la base estándar cumple $A\\,[b_1\\ b_2]=[T(b_1)\\ T(b_2)]$, es decir, $AB=Y$.

\\subsection*{Paso 3. Inversa de $B$}
${linearInverseNarrative(basisMatrix, 'B')}

\\subsection*{Paso 4. Matriz de la aplicación en la base estándar}
Multiplicando $AB=Y$ a la derecha por $B^{-1}$ se despeja
\\[
A=YB^{-1}=${matrixToLatex(imageMatrix)}\\cdot${matrixToLatex(inverseBasis)}=${matrixToLatex(matrix)}.
\\]

\\subsection*{Paso 5. Polinomio característico}
Se calculan
\\[
\\operatorname{tr}(A)=${formatNumber(analysis.trace)},
\\qquad
\\det(A)=${formatNumber(analysis.determinant)},
\\]
y por tanto
\\[
${characteristic}.
\\]

${caseBody}

\\subsection*{Paso 8. Verificación de la forma canónica}
Se invierte la matriz de cambio de base y se comprueba que $P^{-1}AP=${symbolJ}$.
${linearInverseNarrative(canonical.P, 'P')}
Efectuando el producto,
\\[
P^{-1}AP=${canonicalDisplay}=${symbolJ}.
\\]

\\subsection*{Resumen final}
\\begin{enumerate}
\\item Se comprueba que $b_1,b_2$ son base verificando $\\det(B)\\neq 0$.
\\item Se construyen $B=[b_1\\ b_2]$ y $Y=[T(b_1)\\ T(b_2)]$.
\\item Se calcula $B^{-1}$ de forma explícita.
\\item Se obtiene $A=YB^{-1}$.
\\item Se escribe el polinomio característico y se estudia su discriminante.
\\item Según el caso, se calculan autovectores (y un vector generalizado si hay bloque de Jordan) y con ellos la matriz $P$.
\\item Se verifica que $P^{-1}AP$ coincide con la forma canónica.
\\end{enumerate}

\\bigskip
Conclusión:
\\[
A=${matrixToLatex(matrix)},
\\qquad
P=${pDisplay},
\\qquad
${symbolJ}=${canonicalDisplay}.
\\]
\\end{document}
`
}

export function buildAffineTex(payload: AffineTexPayload) {
  const area = pointAreaTwice(payload.source.p0, payload.source.p1, payload.source.p2)

  if (Math.abs(area) < EPSILON) {
    throw new Error('Los puntos origen no son afínmente independientes.')
  }

  const sourceFrame = matrixFromImages(
    subtractVectors(payload.source.p1, payload.source.p0),
    subtractVectors(payload.source.p2, payload.source.p0),
  )
  const imageFrame = matrixFromImages(
    subtractVectors(payload.image.q1, payload.image.q0),
    subtractVectors(payload.image.q2, payload.image.q0),
  )
  const inverseSource = inverse2(sourceFrame)

  if (!inverseSource) {
    throw new Error('Los puntos origen no son afínmente independientes.')
  }

  const linearPart = multiplyMatrices(imageFrame, inverseSource)
  const translation = subtractVectors(payload.image.q0, applyMatrix(linearPart, payload.source.p0))
  const homogeneous = homogeneousFromAffine(linearPart, translation)
  const analysis = classifyLinear(linearPart)
  const aMinusI = matrixMinusScalar(linearPart, 1)
  const fixedPoint = solvePossiblySingular(aMinusI, { x: -translation.x, y: -translation.y })

  let caseTitle = ''
  let caseBlock = ''

  if (fixedPoint) {
    caseTitle = 'aplicación afín con punto fijo'
    caseBlock = buildAffineCaseFixedPoint(linearPart, fixedPoint, analysis)
  } else if (isScalarMatrix(linearPart, 1)) {
    caseTitle = 'traslación no trivial'
    caseBlock = buildAffineCaseTranslation(translation)
  } else if (
    analysis.caseId === 'distinct-real' &&
    (Math.abs(analysis.lambda1 - 1) < 1e-6 || Math.abs(analysis.lambda2 - 1) < 1e-6)
  ) {
    const distinctRealAnalysis = analysis as DistinctRealAnalysis
    caseTitle = 'sin punto fijo con un autovalor igual a 1'
    caseBlock = buildAffineCaseDistinctOneIsEigenvalue(linearPart, translation, distinctRealAnalysis)
  } else if (analysis.caseId === 'jordan-block' && Math.abs(analysis.lambda - 1) < 1e-6) {
    caseTitle = 'caso parabólico sin punto fijo'
    caseBlock = buildAffineCaseParabolic(linearPart, translation)
  } else {
    caseTitle = 'reducción absorbida por la forma lineal canónica'
    caseBlock = buildAffineCaseFallback(linearPart, analysis)
  }

  return `
\\documentclass[11pt]{article}
\\usepackage[spanish]{babel}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{lmodern}
\\usepackage{amsmath,amssymb}
\\usepackage[a4paper,margin=2.2cm]{geometry}
\\setlength{\\parindent}{0pt}
\\begin{document}
\\section*{Reducción afín en $\\mathbb R^2$: ${caseTitle}}

\\subsection*{Paso 1. Datos de partida}
Se toman tres puntos afínmente independientes
\\[
p_0=${vecToLatex(payload.source.p0)},\\qquad
p_1=${vecToLatex(payload.source.p1)},\\qquad
p_2=${vecToLatex(payload.source.p2)},
\\]
y sus imágenes
\\[
q_0=${vecToLatex(payload.image.q0)},\\qquad
q_1=${vecToLatex(payload.image.q1)},\\qquad
q_2=${vecToLatex(payload.image.q2)}.
\\]

\\subsection*{Paso 2. Comprobación de independencia afín}
${buildAreaCalculationLatex(payload.source.p0, payload.source.p1, payload.source.p2, area)}

\\subsection*{Paso 3. Vectores asociados a los puntos origen y a sus imágenes}
\\[
S=[p_1-p_0\\ \\ p_2-p_0]=${matrixToLatex(sourceFrame)},
\\qquad
T=[q_1-q_0\\ \\ q_2-q_0]=${matrixToLatex(imageFrame)}.
\\]

\\subsection*{Paso 4. Parte lineal $A=TS^{-1}$}
${linearInverseNarrative(sourceFrame, 'S')}
Por tanto,
\\[
A=TS^{-1}=${matrixToLatex(imageFrame)}\\cdot${matrixToLatex(inverseSource)}=${matrixToLatex(linearPart)}.
\\]

\\subsection*{Paso 5. Traslación $t=q_0-Ap_0$}
Imponiendo $F(p_0)=q_0$,
\\[
t=q_0-Ap_0=${vecToLatex(payload.image.q0)}-${matrixToLatex(linearPart)}${vecToLatex(payload.source.p0)}=${vecToLatex(translation)}.
\\]
Por tanto, $F(x)=Ax+t$.

\\subsection*{Paso 6. Matriz homogénea}
\\[
H_F=${matrixToLatex3x3(homogeneous)}.
\\]

${caseBlock}

\\subsection*{Resumen del algoritmo}
\\begin{enumerate}
\\item Comprobar la independencia afín con el área orientada doble.
\\item Construir $S$ y $T$ restando al punto base.
\\item Calcular $A=TS^{-1}$ y $t=q_0-Ap_0$.
\\item Escribir la matriz homogénea $H_F$.
\\item Buscar puntos fijos resolviendo $(A-I)c=-t$.
\\item Si existe punto fijo, trasladar el origen a $c$ y reducir $A$ por Jordan para obtener una referencia afín adaptada.
\\item Si no existe, identificar el caso (traslación pura, autovalor $1$ simple, bloque de Jordan de $1$) y normalizar la traslación esencial por centrado y reescalado.
\\item Escribir la referencia afín adaptada $\\mathcal R=(O,(v_1,v_2))$ y la matriz homogénea de la forma normal.
\\end{enumerate}
\\end{document}
`
}