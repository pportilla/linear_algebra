import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, ReactNode, WheelEvent } from 'react'
import { evaluateConic, formatMatrixEntry } from '../lib/math2d'
import type { ConicCoefficients, ConicDrawableHints, Vec2 } from '../lib/math2d'

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.5 13.5 17 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M9 6.7v4.6M6.7 9h4.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.5 13.5 17 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M6.7 9h4.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function CenterIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <path d="M10 2.5v2.3M10 15.2v2.3M2.5 10h2.3M15.2 10h2.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

interface ConicPlaneProps {
  title: ReactNode
  subtitle: ReactNode
  ariaLabel?: string
  coefficients: ConicCoefficients
  drawable: ConicDrawableHints
  strokeColor?: string
}

const size = 420
const minRange = 1.5
const maxRange = 40

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value))
}

function niceGridStep(target: number) {
  if (target <= 0 || !Number.isFinite(target)) {
    return 1
  }

  const exponent = Math.floor(Math.log10(target))
  const power = Math.pow(10, exponent)
  const mantissa = target / power
  const niceMantissa = mantissa < 1.5 ? 1 : mantissa < 3.5 ? 2 : mantissa < 7.5 ? 5 : 10
  return niceMantissa * power
}

function collectTicks(minValue: number, maxValue: number, step: number) {
  const ticks: number[] = []
  if (step <= 0) {
    return ticks
  }

  const tolerance = step * 1e-6
  const first = Math.ceil((minValue - tolerance) / step) * step
  for (let value = first; value <= maxValue + tolerance; value += step) {
    ticks.push(Math.round(value / step) * step)
  }
  return ticks
}

function clipInfiniteLine(anchor: Vec2, direction: Vec2, minX: number, maxX: number, minY: number, maxY: number) {
  const points: Vec2[] = []
  const epsilon = 1e-6

  if (Math.abs(direction.x) > epsilon) {
    for (const x of [minX, maxX]) {
      const parameter = (x - anchor.x) / direction.x
      const y = anchor.y + parameter * direction.y
      if (y >= minY - epsilon && y <= maxY + epsilon) {
        points.push({ x, y })
      }
    }
  }

  if (Math.abs(direction.y) > epsilon) {
    for (const y of [minY, maxY]) {
      const parameter = (y - anchor.y) / direction.y
      const x = anchor.x + parameter * direction.x
      if (x >= minX - epsilon && x <= maxX + epsilon) {
        points.push({ x, y })
      }
    }
  }

  const uniquePoints = points.filter(
    (point, index) =>
      points.findIndex((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < epsilon) === index,
  )

  if (uniquePoints.length < 2) {
    return null
  }

  let start = uniquePoints[0]
  let end = uniquePoints[1]
  let bestDistance = Math.hypot(end.x - start.x, end.y - start.y)

  for (let left = 0; left < uniquePoints.length; left += 1) {
    for (let right = left + 1; right < uniquePoints.length; right += 1) {
      const distance = Math.hypot(uniquePoints[right].x - uniquePoints[left].x, uniquePoints[right].y - uniquePoints[left].y)
      if (distance > bestDistance) {
        bestDistance = distance
        start = uniquePoints[left]
        end = uniquePoints[right]
      }
    }
  }

  return { start, end }
}

function interpolateZero(first: Vec2, firstValue: number, second: Vec2, secondValue: number) {
  const denominator = firstValue - secondValue
  const parameter = Math.abs(denominator) < 1e-12 ? 0.5 : firstValue / denominator
  const clampedParameter = clamp(parameter, 0, 1)
  return {
    x: first.x + (second.x - first.x) * clampedParameter,
    y: first.y + (second.y - first.y) * clampedParameter,
  }
}

function uniquePoints(points: Vec2[]) {
  const epsilon = 1e-7
  return points.filter(
    (point, index) =>
      points.findIndex((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < epsilon) === index,
  )
}

function sampleConicSegments(coefficients: ConicCoefficients, minX: number, maxX: number, minY: number, maxY: number) {
  const resolution = 96
  const dx = (maxX - minX) / resolution
  const dy = (maxY - minY) / resolution
  const values: number[][] = []

  for (let row = 0; row <= resolution; row += 1) {
    values[row] = []
    const y = minY + row * dy
    for (let column = 0; column <= resolution; column += 1) {
      const x = minX + column * dx
      values[row][column] = evaluateConic(coefficients, { x, y })
    }
  }

  const segments: Array<[Vec2, Vec2]> = []

  for (let row = 0; row < resolution; row += 1) {
    for (let column = 0; column < resolution; column += 1) {
      const corners = [
        { point: { x: minX + column * dx, y: minY + row * dy }, value: values[row][column] },
        { point: { x: minX + (column + 1) * dx, y: minY + row * dy }, value: values[row][column + 1] },
        { point: { x: minX + (column + 1) * dx, y: minY + (row + 1) * dy }, value: values[row + 1][column + 1] },
        { point: { x: minX + column * dx, y: minY + (row + 1) * dy }, value: values[row + 1][column] },
      ]
      const edges = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ] as const
      const intersections: Vec2[] = []

      for (const [startIndex, endIndex] of edges) {
        const start = corners[startIndex]
        const end = corners[endIndex]
        const startZero = Math.abs(start.value) < 1e-10
        const endZero = Math.abs(end.value) < 1e-10

        if (startZero && endZero) {
          continue
        }

        if (startZero) {
          intersections.push(start.point)
          continue
        }

        if (endZero) {
          intersections.push(end.point)
          continue
        }

        if (start.value * end.value < 0) {
          intersections.push(interpolateZero(start.point, start.value, end.point, end.value))
        }
      }

      const unique = uniquePoints(intersections)
      if (unique.length === 2) {
        segments.push([unique[0], unique[1]])
      } else if (unique.length > 2) {
        const center = {
          x: minX + (column + 0.5) * dx,
          y: minY + (row + 0.5) * dy,
        }
        unique.sort((left, right) => Math.atan2(left.y - center.y, left.x - center.x) - Math.atan2(right.y - center.y, right.x - center.x))
        for (let index = 0; index + 1 < unique.length; index += 2) {
          segments.push([unique[index], unique[index + 1]])
        }
      }
    }
  }

  return segments
}

export function ConicPlane({
  title,
  subtitle,
  ariaLabel,
  coefficients,
  drawable,
  strokeColor = '#127b75',
}: ConicPlaneProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [center, setCenter] = useState(drawable.focus)
  const [halfRange, setHalfRange] = useState(clamp(drawable.range, minRange, maxRange))
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startCenter: Vec2
  } | null>(null)

  const resetView = () => {
    setCenter(drawable.focus)
    setHalfRange(clamp(drawable.range, minRange, maxRange))
  }

  useEffect(() => {
    const node = svgRef.current
    if (!node) {
      return undefined
    }

    const preventWheelScroll = (event: globalThis.WheelEvent) => {
      event.preventDefault()
    }

    node.addEventListener('wheel', preventWheelScroll, { passive: false })
    return () => {
      node.removeEventListener('wheel', preventWheelScroll)
    }
  }, [])

  const worldToScreen = (point: Vec2) => ({
    x: ((point.x - center.x + halfRange) / (2 * halfRange)) * size,
    y: size - ((point.y - center.y + halfRange) / (2 * halfRange)) * size,
  })

  const beginPan = (event: PointerEvent<SVGSVGElement>) => {
    svgRef.current?.setPointerCapture(event.pointerId)
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenter: center,
    }
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) {
      return
    }

    const dx = event.clientX - pan.startX
    const dy = event.clientY - pan.startY
    const worldDx = (dx / size) * 2 * halfRange
    const worldDy = (dy / size) * 2 * halfRange
    setCenter({ x: pan.startCenter.x - worldDx, y: pan.startCenter.y + worldDy })
  }

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }
    panRef.current = null
  }

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 1.15 : 0.85
    setHalfRange((current) => clamp(current * factor, minRange, maxRange))
  }

  const zoom = (factor: number) => {
    setHalfRange((current) => clamp(current * factor, minRange, maxRange))
  }

  const viewMinX = center.x - halfRange
  const viewMaxX = center.x + halfRange
  const viewMinY = center.y - halfRange
  const viewMaxY = center.y + halfRange
  const majorStep = niceGridStep((2 * halfRange) / 8)
  const minorDivisor = Math.abs(majorStep / Math.pow(10, Math.floor(Math.log10(majorStep))) - 2) < 0.01 ? 4 : 5
  const minorStep = majorStep / minorDivisor
  const xMinorTicks = collectTicks(viewMinX, viewMaxX, minorStep)
  const yMinorTicks = collectTicks(viewMinY, viewMaxY, minorStep)
  const xMajorTicks = collectTicks(viewMinX, viewMaxX, majorStep)
  const yMajorTicks = collectTicks(viewMinY, viewMaxY, majorStep)
  const axisXScreen = worldToScreen({ x: 0, y: 0 }).x
  const axisYScreen = worldToScreen({ x: 0, y: 0 }).y
  const showYAxis = viewMinX <= 0 && 0 <= viewMaxX
  const showXAxis = viewMinY <= 0 && 0 <= viewMaxY

  const conicSegments = useMemo(
    () => (drawable.isEmpty ? [] : sampleConicSegments(coefficients, viewMinX, viewMaxX, viewMinY, viewMaxY)),
    [coefficients, drawable.isEmpty, viewMinX, viewMaxX, viewMinY, viewMaxY],
  )

  return (
    <section className="plane-card">
      <div className="plane-header">
        <div>
          <h3>{title}</h3>
          <p className="plane-caption">{subtitle}</p>
        </div>
      </div>

      <div className="plane-stage">
        <div className="plane-toolbar">
          <button type="button" className="plane-button" onClick={() => zoom(0.85)} aria-label="Acercar">
            <ZoomInIcon />
          </button>
          <button type="button" className="plane-button" onClick={() => zoom(1.15)} aria-label="Alejar">
            <ZoomOutIcon />
          </button>
          <button type="button" className="plane-button" onClick={resetView} aria-label="Centrar vista">
            <CenterIcon />
          </button>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${size} ${size}`}
          className="plane-svg"
          onPointerDown={beginPan}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          role="img"
          aria-label={ariaLabel ?? (typeof title === 'string' ? title : 'Plano de cónica')}
        >
          <g pointerEvents="none">
            {xMinorTicks.map((value) => {
              const sx = worldToScreen({ x: value, y: 0 }).x
              return <line key={`xm-${value}`} x1={sx} y1={0} x2={sx} y2={size} stroke="rgba(40, 53, 70, 0.06)" strokeWidth={0.6} />
            })}
            {yMinorTicks.map((value) => {
              const sy = worldToScreen({ x: 0, y: value }).y
              return <line key={`ym-${value}`} x1={0} y1={sy} x2={size} y2={sy} stroke="rgba(40, 53, 70, 0.06)" strokeWidth={0.6} />
            })}
            {xMajorTicks.map((value) => {
              const sx = worldToScreen({ x: value, y: 0 }).x
              return <line key={`xM-${value}`} x1={sx} y1={0} x2={sx} y2={size} stroke="rgba(40, 53, 70, 0.14)" strokeWidth={1} />
            })}
            {yMajorTicks.map((value) => {
              const sy = worldToScreen({ x: 0, y: value }).y
              return <line key={`yM-${value}`} x1={0} y1={sy} x2={size} y2={sy} stroke="rgba(40, 53, 70, 0.14)" strokeWidth={1} />
            })}
            {showYAxis ? <line x1={axisXScreen} y1={0} x2={axisXScreen} y2={size} stroke="rgba(40, 53, 70, 0.55)" strokeWidth={1.6} /> : null}
            {showXAxis ? <line x1={0} y1={axisYScreen} x2={size} y2={axisYScreen} stroke="rgba(40, 53, 70, 0.55)" strokeWidth={1.6} /> : null}
          </g>

          <g pointerEvents="none">
            {conicSegments.map(([start, end], index) => {
              const screenStart = worldToScreen(start)
              const screenEnd = worldToScreen(end)
              return (
                <line
                  key={`segment-${index}`}
                  x1={screenStart.x}
                  y1={screenStart.y}
                  x2={screenEnd.x}
                  y2={screenEnd.y}
                  stroke={strokeColor}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              )
            })}

            {drawable.lines.map((line) => {
              const clipped = clipInfiniteLine(line.anchor, line.direction, viewMinX, viewMaxX, viewMinY, viewMaxY)
              if (!clipped) {
                return null
              }

              const start = worldToScreen(clipped.start)
              const end = worldToScreen(clipped.end)
              return (
                <g key={line.id}>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={line.color} strokeWidth={4} strokeLinecap="round" />
                  <text x={(start.x + end.x) / 2 + 10} y={(start.y + end.y) / 2 - 10} fill={line.color} fontSize="14" fontWeight="700">
                    {line.label}
                  </text>
                </g>
              )
            })}

            {drawable.points.map((item) => {
              const screen = worldToScreen(item.point)
              return (
                <g key={item.id}>
                  <circle cx={screen.x} cy={screen.y} r={8.5} fill={item.color} stroke="#fffaf0" strokeWidth={2.5} />
                  <text x={screen.x + 10} y={screen.y - 10} fill={item.color} fontSize="14" fontWeight="700">
                    {item.label}
                  </text>
                </g>
              )
            })}

            {drawable.isEmpty && drawable.emptyText ? (
              <text x={size / 2} y={size / 2} textAnchor="middle" fill="#9f2d25" fontSize="15" fontWeight="700">
                {drawable.emptyText}
              </text>
            ) : null}
          </g>
        </svg>
      </div>

      <div className="plane-legend">
        <span className="legend-chip">
          <span className="legend-swatch" style={{ backgroundColor: strokeColor }} />
          F(x,y)=0
        </span>
        {drawable.points.map((point) => (
          <span className="legend-chip" key={point.id}>
            <span className="legend-swatch" style={{ backgroundColor: point.color }} />
            {point.label} = ({formatMatrixEntry(point.point.x)}, {formatMatrixEntry(point.point.y)})
          </span>
        ))}
        {drawable.lines.map((line) => (
          <span className="legend-chip" key={line.id}>
            <span className="legend-swatch" style={{ backgroundColor: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
    </section>
  )
}
