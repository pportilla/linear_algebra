import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode, WheelEvent } from 'react'
import { formatMatrixEntry } from '../lib/math2d'
import type { Vec2 } from '../lib/math2d'

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

interface PlaneItem {
  id: string
  label: string
  point: Vec2
  color: string
  kind: 'vector' | 'point'
  lineDash?: string
  interactive?: boolean
}

interface PlanePolygon {
  id: string
  points: Vec2[]
  color: string
}

interface PlaneOverlay {
  id: string
  kind: 'line' | 'plane'
  color: string
  label: string
  anchor?: Vec2
  direction?: Vec2
}

interface CartesianPlaneProps {
  title: ReactNode
  subtitle: ReactNode
  ariaLabel?: string
  range: number
  items: PlaneItem[]
  polygons?: PlanePolygon[]
  overlays?: PlaneOverlay[]
  activeId?: string
  onActivate?: (id: string) => void
  onChange?: (id: string, point: Vec2) => void
}

const size = 420
const minRange = 1.5
const maxRange = 24
const hitRadius = 16

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value))
}

function snap(value: number) {
  return Math.round(value * 4) / 4
}

function arrowHead(origin: Vec2, target: Vec2) {
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const width = 8
  const depth = 14
  const baseX = target.x - ux * depth
  const baseY = target.y - uy * depth
  const leftX = baseX - uy * width
  const leftY = baseY + ux * width
  const rightX = baseX + uy * width
  const rightY = baseY - ux * width
  return `${target.x},${target.y} ${leftX},${leftY} ${rightX},${rightY}`
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

function fitViewBounds(points: Vec2[], fallbackRange: number) {
  if (points.length === 0) {
    return { center: { x: 0, y: 0 }, halfRange: fallbackRange }
  }

  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y

  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  const spanX = maxX - minX
  const spanY = maxY - minY
  const dominantSpan = Math.max(spanX, spanY, 1)
  const margin = Math.max(0.75, dominantSpan * 0.18)

  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    halfRange: clamp(Math.max(spanX, spanY, 0.8) / 2 + margin, minRange, maxRange),
  }
}

export function CartesianPlane({
  title,
  subtitle,
  ariaLabel,
  range,
  items,
  polygons = [],
  overlays = [],
  activeId,
  onActivate,
  onChange,
}: CartesianPlaneProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [center, setCenter] = useState<Vec2>({ x: 0, y: 0 })
  const [halfRange, setHalfRange] = useState(range)
  const cycleRef = useRef<{ key: string; nextIndex: number } | null>(null)
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startCenter: Vec2
    moved: boolean
  } | null>(null)

  useEffect(() => {
    setHalfRange(range)
  }, [range])

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

  const screenToWorld = (clientX: number, clientY: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) {
      return { x: 0, y: 0 }
    }

    const x = ((clientX - box.left) / box.width) * size
    const y = ((clientY - box.top) / box.height) * size
    return {
      x: snap(center.x + (x / size) * 2 * halfRange - halfRange),
      y: snap(center.y + ((size - y) / size) * 2 * halfRange - halfRange),
    }
  }

  const commitPoint = (id: string, event: PointerEvent<SVGElement>) => {
    if (!onChange) {
      return
    }

    onChange(id, screenToWorld(event.clientX, event.clientY))
  }

  const interactiveItems = items.filter((item) => item.interactive !== false)

  const getHitCandidates = (clientX: number, clientY: number) => {
    return interactiveItems
      .map((item) => {
        const screenPoint = worldToScreen(item.point)
        const distance = Math.hypot(screenPoint.x - clientXToCanvas(clientX), screenPoint.y - clientYToCanvas(clientY))
        return { id: item.id, distance }
      })
      .filter((candidate) => candidate.distance <= hitRadius)
      .sort((left, right) => left.distance - right.distance)
  }

  const clientYToCanvas = (clientY: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) {
      return 0
    }

    return ((clientY - box.top) / box.height) * size
  }

  const clientXToCanvas = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) {
      return 0
    }

    return ((clientX - box.left) / box.width) * size
  }

  const pickItemAtPointer = (event: PointerEvent<SVGSVGElement>) => {
    const candidates = getHitCandidates(event.clientX, event.clientY)
    if (candidates.length === 0) {
      cycleRef.current = null
      return null
    }

    if (activeId && candidates.some((candidate) => candidate.id === activeId)) {
      cycleRef.current = null
      return activeId
    }

    const key = candidates.map((candidate) => candidate.id).join('|')
    if (cycleRef.current?.key === key) {
      const index = cycleRef.current.nextIndex % candidates.length
      cycleRef.current = { key, nextIndex: index + 1 }
      return candidates[index].id
    }

    cycleRef.current = { key, nextIndex: 1 }
    return candidates[0].id
  }

  const beginPan = (event: PointerEvent<SVGSVGElement>) => {
    const selectedId = pickItemAtPointer(event)
    if (selectedId && onChange) {
      event.stopPropagation()
      onActivate?.(selectedId)
      setDraggingId(selectedId)
      svgRef.current?.setPointerCapture(event.pointerId)
      commitPoint(selectedId, event)
      return
    }

    svgRef.current?.setPointerCapture(event.pointerId)
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenter: center,
      moved: false,
    }
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!draggingId || !onChange) {
      const pan = panRef.current

      if (!pan || pan.pointerId !== event.pointerId) {
        return
      }

      const dx = event.clientX - pan.startX
      const dy = event.clientY - pan.startY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        pan.moved = true
      }

      const worldDx = (dx / size) * 2 * halfRange
      const worldDy = (dy / size) * 2 * halfRange
      setCenter({ x: pan.startCenter.x - worldDx, y: pan.startCenter.y + worldDy })
      return
    }

    commitPoint(draggingId, event)
  }

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }

    const pan = panRef.current
    if (pan && pan.pointerId === event.pointerId) {
      if (!pan.moved && activeId && onChange) {
        commitPoint(activeId, event)
      }
      panRef.current = null
    }

    setDraggingId(null)
  }

  const handlePointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }

    panRef.current = null
    setDraggingId(null)
  }

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 1.15 : 0.85
    setHalfRange((current) => clamp(current * factor, minRange, maxRange))
  }

  const zoom = (factor: number) => {
    setHalfRange((current) => clamp(current * factor, minRange, maxRange))
  }

  const resetView = () => {
    const overlayPoints = overlays.flatMap((overlay) => {
      if (overlay.kind !== 'line' || !overlay.anchor || !overlay.direction) {
        return []
      }

      return [
        overlay.anchor,
        {
          x: overlay.anchor.x + overlay.direction.x * 2,
          y: overlay.anchor.y + overlay.direction.y * 2,
        },
        {
          x: overlay.anchor.x - overlay.direction.x * 2,
          y: overlay.anchor.y - overlay.direction.y * 2,
        },
      ]
    })

    const points = [
      ...items.map((item) => item.point),
      ...polygons.flatMap((polygon) => polygon.points),
      ...overlayPoints,
    ]

    const fittedView = fitViewBounds(points, range)
    setCenter(fittedView.center)
    setHalfRange(fittedView.halfRange)
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
          onPointerCancel={handlePointerCancel}
          onWheel={handleWheel}
          role="img"
          aria-label={ariaLabel ?? (typeof title === 'string' ? title : 'Plano cartesiano')}
        >
        <g pointerEvents="none">
          {xMinorTicks.map((value) => {
            const sx = worldToScreen({ x: value, y: 0 }).x
            return (
              <line
                key={`xm-${value}`}
                x1={sx}
                y1={0}
                x2={sx}
                y2={size}
                stroke="rgba(40, 53, 70, 0.06)"
                strokeWidth={0.6}
              />
            )
          })}
          {yMinorTicks.map((value) => {
            const sy = worldToScreen({ x: 0, y: value }).y
            return (
              <line
                key={`ym-${value}`}
                x1={0}
                y1={sy}
                x2={size}
                y2={sy}
                stroke="rgba(40, 53, 70, 0.06)"
                strokeWidth={0.6}
              />
            )
          })}
          {xMajorTicks.map((value) => {
            const sx = worldToScreen({ x: value, y: 0 }).x
            return (
              <line
                key={`xM-${value}`}
                x1={sx}
                y1={0}
                x2={sx}
                y2={size}
                stroke="rgba(40, 53, 70, 0.14)"
                strokeWidth={1}
              />
            )
          })}
          {yMajorTicks.map((value) => {
            const sy = worldToScreen({ x: 0, y: value }).y
            return (
              <line
                key={`yM-${value}`}
                x1={0}
                y1={sy}
                x2={size}
                y2={sy}
                stroke="rgba(40, 53, 70, 0.14)"
                strokeWidth={1}
              />
            )
          })}
          {showYAxis && (
            <line
              x1={axisXScreen}
              y1={0}
              x2={axisXScreen}
              y2={size}
              stroke="rgba(40, 53, 70, 0.55)"
              strokeWidth={1.6}
            />
          )}
          {showXAxis && (
            <line
              x1={0}
              y1={axisYScreen}
              x2={size}
              y2={axisYScreen}
              stroke="rgba(40, 53, 70, 0.55)"
              strokeWidth={1.6}
            />
          )}
        </g>

        {polygons.map((polygon) => (
          <polygon
            key={polygon.id}
            points={polygon.points
              .map((point) => {
                const screen = worldToScreen(point)
                return `${screen.x},${screen.y}`
              })
              .join(' ')}
            fill={polygon.color}
            stroke="rgba(40, 53, 70, 0.14)"
            strokeWidth="1.2"
          />
        ))}

        {overlays.map((overlay) => {
          if (overlay.kind === 'plane') {
            return <rect key={overlay.id} x={0} y={0} width={size} height={size} fill={overlay.color} pointerEvents="none" />
          }

          if (!overlay.anchor || !overlay.direction) {
            return null
          }

          const clipped = clipInfiniteLine(
            overlay.anchor,
            overlay.direction,
            center.x - halfRange,
            center.x + halfRange,
            center.y - halfRange,
            center.y + halfRange,
          )
          if (!clipped) {
            return null
          }

          const start = worldToScreen(clipped.start)
          const end = worldToScreen(clipped.end)
          return (
            <g key={overlay.id} pointerEvents="none">
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={overlay.color} strokeWidth={4} strokeLinecap="round" />
              <text x={(start.x + end.x) / 2 + 10} y={(start.y + end.y) / 2 - 10} fill={overlay.color} fontSize="14" fontWeight="700">
                {overlay.label}
              </text>
            </g>
          )
        })}

        {items.map((item) => {
          const screenPoint = worldToScreen(item.point)
          const isActive = item.id === activeId
          const isInteractive = item.interactive !== false

          if (item.kind === 'vector') {
            const origin = worldToScreen({ x: 0, y: 0 })
            return (
              <g key={item.id}>
                <line
                  x1={origin.x}
                  y1={origin.y}
                  x2={screenPoint.x}
                  y2={screenPoint.y}
                  stroke={item.color}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={item.lineDash}
                />
                <polygon points={arrowHead(origin, screenPoint)} fill={item.color} />
                <circle
                  cx={screenPoint.x}
                  cy={screenPoint.y}
                  r={isActive ? 9 : 7.5}
                  fill="#fffaf0"
                  stroke={item.color}
                  strokeWidth={isActive ? 4 : 3}
                  pointerEvents={isInteractive ? 'none' : 'auto'}
                />
                <text x={screenPoint.x + 10} y={screenPoint.y - 10} fill={item.color} fontSize="14" fontWeight="700">
                  {item.label}
                </text>
              </g>
            )
          }

          return (
            <g key={item.id}>
              <circle
                cx={screenPoint.x}
                cy={screenPoint.y}
                r={isActive ? 9.5 : 8}
                fill={item.color}
                stroke="#fffaf0"
                strokeWidth={isActive ? 4 : 2.5}
                pointerEvents={isInteractive ? 'none' : 'auto'}
              />
              <text x={screenPoint.x + 10} y={screenPoint.y - 10} fill={item.color} fontSize="14" fontWeight="700">
                {item.label}
              </text>
            </g>
          )
        })}
        </svg>
      </div>

      <div className="plane-legend">
        {items.map((item) => (
          <span className="legend-chip" key={item.id}>
            <span className="legend-swatch" style={{ backgroundColor: item.color }} />
            {item.label} = ({formatMatrixEntry(item.point.x)}, {formatMatrixEntry(item.point.y)})
          </span>
        ))}
        {overlays.map((overlay) => (
          <span className="legend-chip" key={overlay.id}>
            <span className="legend-swatch" style={{ backgroundColor: overlay.color }} />
            {overlay.label}
          </span>
        ))}
      </div>
    </section>
  )
}