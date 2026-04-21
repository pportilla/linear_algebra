const EPSILON = 1e-8
const MAX_FRACTION_DENOMINATOR = 4096
const FRACTION_TOLERANCE = 1e-10

export interface Fraction {
  numerator: number
  denominator: number
}

export interface SymbolicExpression {
  rational: Fraction
  radical?: {
    coefficient: Fraction
    radicand: number
  }
}

export type SymbolicMatrix2 = [
  [SymbolicExpression, SymbolicExpression],
  [SymbolicExpression, SymbolicExpression],
]

export interface SymbolicMatrix2Inverse {
  determinant: SymbolicExpression
  adjugate: SymbolicMatrix2
  inverse: SymbolicMatrix2
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

function normalizeFraction(numerator: number, denominator = 1): Fraction {
  if (Math.abs(numerator) < EPSILON) {
    return { numerator: 0, denominator: 1 }
  }

  if (denominator < 0) {
    return normalizeFraction(-numerator, -denominator)
  }

  const divisor = greatestCommonDivisor(Math.round(numerator), Math.round(denominator))
  return {
    numerator: Math.round(numerator) / divisor,
    denominator: Math.round(denominator) / divisor,
  }
}

function addFractions(left: Fraction, right: Fraction) {
  return normalizeFraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

function multiplyFractions(left: Fraction, right: Fraction) {
  return normalizeFraction(left.numerator * right.numerator, left.denominator * right.denominator)
}

function divideFractions(left: Fraction, right: Fraction) {
  if (right.numerator === 0) {
    throw new Error('No se puede dividir por una fracción nula.')
  }

  return normalizeFraction(left.numerator * right.denominator, left.denominator * right.numerator)
}

function negateFraction(value: Fraction) {
  return normalizeFraction(-value.numerator, value.denominator)
}

function isZeroFraction(value: Fraction) {
  return value.numerator === 0
}

export function approximateFraction(value: number): Fraction | null {
  const clean = Math.abs(value) < EPSILON ? 0 : value

  if (!Number.isFinite(clean)) {
    return null
  }

  let bestNumerator = Math.round(clean)
  let bestDenominator = 1
  let bestError = Math.abs(clean - bestNumerator)

  if (bestError < FRACTION_TOLERANCE) {
    return normalizeFraction(bestNumerator, 1)
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

    if (error < FRACTION_TOLERANCE) {
      break
    }
  }

  if (bestError > FRACTION_TOLERANCE) {
    return null
  }

  return normalizeFraction(bestNumerator, bestDenominator)
}

function formatFractionText(value: Fraction) {
  if (value.denominator === 1) {
    return value.numerator.toString()
  }

  return `${value.numerator}/${value.denominator}`
}

function formatFractionTex(value: Fraction) {
  if (value.denominator === 1) {
    return value.numerator.toString()
  }

  if (value.numerator < 0) {
    return `-\\frac{${Math.abs(value.numerator)}}{${value.denominator}}`
  }

  return `\\frac{${value.numerator}}{${value.denominator}}`
}

export function formatPlainNumber(value: number) {
  const clean = Math.abs(value) < EPSILON ? 0 : value
  const fraction = approximateFraction(clean)

  if (fraction) {
    return formatFractionText(fraction)
  }

  return Number(clean.toPrecision(8)).toString()
}

export function formatLatexNumber(value: number) {
  const clean = Math.abs(value) < EPSILON ? 0 : value
  const fraction = approximateFraction(clean)

  if (fraction) {
    return formatFractionTex(fraction)
  }

  return Number(clean.toPrecision(8)).toString()
}

export function expressionFromNumber(value: number): SymbolicExpression | null {
  const fraction = approximateFraction(value)

  if (!fraction) {
    return null
  }

  return { rational: fraction }
}

function extractSquareFactor(value: number) {
  let outside = 1
  let inside = value

  for (let factor = 2; factor * factor <= inside; factor += 1) {
    const square = factor * factor

    while (inside % square === 0) {
      inside /= square
      outside *= factor
    }
  }

  return { outside, inside }
}

function normalizeExpression(value: SymbolicExpression): SymbolicExpression {
  const rational = normalizeFraction(value.rational.numerator, value.rational.denominator)

  if (!value.radical) {
    return { rational }
  }

  const coefficient = normalizeFraction(value.radical.coefficient.numerator, value.radical.coefficient.denominator)

  if (isZeroFraction(coefficient)) {
    return { rational }
  }

  if (value.radical.radicand === 1) {
    return {
      rational: addFractions(rational, coefficient),
    }
  }

  return {
    rational,
    radical: {
      coefficient,
      radicand: value.radical.radicand,
    },
  }
}

export function negateExpression(value: SymbolicExpression) {
  return normalizeExpression({
    rational: negateFraction(value.rational),
    radical: value.radical
      ? {
          coefficient: negateFraction(value.radical.coefficient),
          radicand: value.radical.radicand,
        }
      : undefined,
  })
}

export function scaleExpression(value: SymbolicExpression, numerator: number, denominator = 1) {
  const factor = normalizeFraction(numerator, denominator)

  return normalizeExpression({
    rational: multiplyFractions(value.rational, factor),
    radical: value.radical
      ? {
          coefficient: multiplyFractions(value.radical.coefficient, factor),
          radicand: value.radical.radicand,
        }
      : undefined,
  })
}

export function multiplyExpressions(left: SymbolicExpression, right: SymbolicExpression) {
  const normalizedLeft = normalizeExpression(left)
  const normalizedRight = normalizeExpression(right)

  if (
    normalizedLeft.radical &&
    normalizedRight.radical &&
    normalizedLeft.radical.radicand !== normalizedRight.radical.radicand
  ) {
    throw new Error('No se pueden multiplicar expresiones con radicales distintos.')
  }

  const radicand = normalizedLeft.radical?.radicand ?? normalizedRight.radical?.radicand
  let rational = multiplyFractions(normalizedLeft.rational, normalizedRight.rational)

  if (normalizedLeft.radical && normalizedRight.radical && radicand) {
    rational = addFractions(
      rational,
      multiplyFractions(
        multiplyFractions(normalizedLeft.radical.coefficient, normalizedRight.radical.coefficient),
        normalizeFraction(radicand),
      ),
    )
  }

  const radicalCoefficient = radicand
    ? addFractions(
        multiplyFractions(normalizedLeft.rational, normalizedRight.radical?.coefficient ?? normalizeFraction(0)),
        multiplyFractions(normalizedRight.rational, normalizedLeft.radical?.coefficient ?? normalizeFraction(0)),
      )
    : normalizeFraction(0)

  return normalizeExpression({
    rational,
    radical: radicand && !isZeroFraction(radicalCoefficient)
      ? {
          coefficient: radicalCoefficient,
          radicand,
        }
      : undefined,
  })
}

export function addExpressions(left: SymbolicExpression, right: SymbolicExpression) {
  if (left.radical && right.radical && left.radical.radicand !== right.radical.radicand) {
    throw new Error('No se pueden sumar expresiones con radicales distintos.')
  }

  return normalizeExpression({
    rational: addFractions(left.rational, right.rational),
    radical: left.radical || right.radical
      ? {
          coefficient: addFractions(left.radical?.coefficient ?? normalizeFraction(0), right.radical?.coefficient ?? normalizeFraction(0)),
          radicand: left.radical?.radicand ?? right.radical!.radicand,
        }
      : undefined,
  })
}

export function subtractExpressions(left: SymbolicExpression, right: SymbolicExpression) {
  return addExpressions(left, negateExpression(right))
}

export function divideExpressionByMonomial(value: SymbolicExpression, divisor: SymbolicExpression) {
  const normalizedDivisor = normalizeExpression(divisor)

  if (!normalizedDivisor.radical) {
    if (isZeroFraction(normalizedDivisor.rational)) {
      throw new Error('No se puede dividir por cero.')
    }

    return scaleExpression(value, normalizedDivisor.rational.denominator, normalizedDivisor.rational.numerator)
  }

  if (!isZeroFraction(normalizedDivisor.rational)) {
    throw new Error('Sólo se admite dividir por expresiones racionales o por un único radical.')
  }

  const normalizedValue = normalizeExpression(value)
  const { coefficient, radicand } = normalizedDivisor.radical

  if (normalizedValue.radical && normalizedValue.radical.radicand !== radicand) {
    throw new Error('No se puede dividir entre radicales distintos.')
  }

  const rational = normalizedValue.radical
    ? divideFractions(normalizedValue.radical.coefficient, coefficient)
    : normalizeFraction(0)
  const radicalDenominator = multiplyFractions(coefficient, normalizeFraction(radicand))
  const radicalCoefficient = isZeroFraction(normalizedValue.rational)
    ? normalizeFraction(0)
    : divideFractions(normalizedValue.rational, radicalDenominator)

  return normalizeExpression({
    rational,
    radical: !isZeroFraction(radicalCoefficient)
      ? {
          coefficient: radicalCoefficient,
          radicand,
        }
      : undefined,
  })
}

export function invertSymbolicMatrix2(matrix: SymbolicMatrix2): SymbolicMatrix2Inverse | null {
  const determinant = normalizeExpression(
    subtractExpressions(
      multiplyExpressions(matrix[0][0], matrix[1][1]),
      multiplyExpressions(matrix[0][1], matrix[1][0]),
    ),
  )

  if (!determinant.radical && isZeroFraction(determinant.rational)) {
    return null
  }

  if (determinant.radical && !isZeroFraction(determinant.rational)) {
    return null
  }

  const adjugate: SymbolicMatrix2 = [
    [matrix[1][1], negateExpression(matrix[0][1])],
    [negateExpression(matrix[1][0]), matrix[0][0]],
  ]

  return {
    determinant,
    adjugate,
    inverse: [
      [divideExpressionByMonomial(adjugate[0][0], determinant), divideExpressionByMonomial(adjugate[0][1], determinant)],
      [divideExpressionByMonomial(adjugate[1][0], determinant), divideExpressionByMonomial(adjugate[1][1], determinant)],
    ],
  }
}

export function squareRootExpressionFromNumber(value: number): SymbolicExpression | null {
  const fraction = approximateFraction(value)

  if (!fraction || fraction.numerator < 0) {
    return null
  }

  if (fraction.numerator === 0) {
    return { rational: normalizeFraction(0) }
  }

  const numeratorParts = extractSquareFactor(Math.abs(fraction.numerator))
  const denominatorParts = extractSquareFactor(fraction.denominator)
  const coefficient = normalizeFraction(
    numeratorParts.outside,
    denominatorParts.outside * denominatorParts.inside,
  )
  const radicand = numeratorParts.inside * denominatorParts.inside

  return normalizeExpression({
    rational: normalizeFraction(0),
    radical: {
      coefficient,
      radicand,
    },
  })
}

function formatRadicalTextAbs(coefficient: Fraction, radicand: number) {
  const numerator = Math.abs(coefficient.numerator)
  const root = `√${radicand}`

  if (coefficient.denominator === 1) {
    if (numerator === 1) {
      return root
    }

    return `${numerator}${root}`
  }

  if (numerator === 1) {
    return `${root}/${coefficient.denominator}`
  }

  return `${numerator}${root}/${coefficient.denominator}`
}

function formatRadicalTexAbs(coefficient: Fraction, radicand: number) {
  const numerator = Math.abs(coefficient.numerator)
  const root = `\\sqrt{${radicand}}`

  if (coefficient.denominator === 1) {
    if (numerator === 1) {
      return root
    }

    return `${numerator}${root}`
  }

  if (numerator === 1) {
    return `\\frac{${root}}{${coefficient.denominator}}`
  }

  return `\\frac{${numerator}${root}}{${coefficient.denominator}}`
}

export function formatPlainExpression(value: SymbolicExpression) {
  const normalized = normalizeExpression(value)

  if (!normalized.radical) {
    return formatFractionText(normalized.rational)
  }

  const radicalSign = normalized.radical.coefficient.numerator < 0 ? '-' : '+'
  const radicalText = formatRadicalTextAbs(normalized.radical.coefficient, normalized.radical.radicand)

  if (isZeroFraction(normalized.rational)) {
    return radicalSign === '-' ? `-${radicalText}` : radicalText
  }

  return `${formatFractionText(normalized.rational)}${radicalSign}${radicalText}`
}

export function formatLatexExpression(value: SymbolicExpression) {
  const normalized = normalizeExpression(value)

  if (!normalized.radical) {
    return formatFractionTex(normalized.rational)
  }

  const radicalSign = normalized.radical.coefficient.numerator < 0 ? '-' : '+'
  const radicalText = formatRadicalTexAbs(normalized.radical.coefficient, normalized.radical.radicand)

  if (isZeroFraction(normalized.rational)) {
    return radicalSign === '-' ? `-${radicalText}` : radicalText
  }

  return `${formatFractionTex(normalized.rational)}${radicalSign}${radicalText}`
}