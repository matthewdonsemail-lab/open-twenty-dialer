import { useEffect, useRef } from 'react'

// The onboarding run's weather, ported as-is from the dashboard
// (components/sky + lib/clouds): RCT-style pixel clouds drifting across the
// whole page, and a field of stars behind them after dark. Each cloud is a
// stack of lumps rasterized onto a tiny canvas with a cooler underside, drawn
// once at sprite size and shown scaled up, hard-edged.

type Shape = 'wisp' | 'puff' | 'drift' | 'bank'

const SHAPES: Record<Shape, { w: number; h: number; lumps: [number, number][] }> = {
  wisp: { w: 12, h: 5, lumps: [[3, 2.3], [6.8, 1.9], [9, 1.5]] },
  puff: { w: 17, h: 7, lumps: [[2.3, 1.9], [5.3, 3], [9, 2.6], [12.8, 1.9]] },
  drift: { w: 23, h: 8, lumps: [[3, 2.3], [6.8, 3.8], [12, 3], [16.5, 2.6], [19.5, 1.9]] },
  bank: { w: 29, h: 10, lumps: [[3.8, 2.6], [8.3, 4.5], [15, 2.8], [20.3, 3], [24.8, 2.3]] },
}

const DAY = { body: '#FFFFFF', under: '#D3E4F2' }
const NIGHT = { body: '#1B2740', under: '#131D31' }

// Which sprite drifts in which lane — altitude and pace live in styles.css.
const LANES: { lane: string; shape: Shape }[] = [
  { lane: 'k1', shape: 'bank' },
  { lane: 'k2', shape: 'puff' },
  { lane: 'k3', shape: 'wisp' },
  { lane: 'k4', shape: 'drift' },
  { lane: 'k5', shape: 'wisp' },
  { lane: 'k6', shape: 'puff' },
  { lane: 'k7', shape: 'puff' },
  { lane: 'k8', shape: 'drift' },
]

function drawCloud(canvas: HTMLCanvasElement, shape: Shape, night: boolean) {
  const s = SHAPES[shape]
  const { w, h } = s
  const base = h - 1
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // A slab under the lumps gives the cloud the flat bottom it needs.
  const slab = Math.max(2, Math.round(h * 0.22))
  let left = Infinity
  let right = -Infinity
  for (const [cx, r] of s.lumps) {
    left = Math.min(left, cx - r + 1)
    right = Math.max(right, cx + r - 1)
  }
  const filled: boolean[] = []
  const depth = new Array<number>(w).fill(0)
  for (let y = 0; y <= base; y++) {
    for (let x = 0; x < w; x++) {
      let hit = y > base - slab && x + 0.5 >= left && x + 0.5 <= right
      for (let i = 0; i < s.lumps.length && !hit; i++) {
        const dx = x + 0.5 - s.lumps[i][0]
        const dy = y + 0.5 - (base + 1 - s.lumps[i][1])
        hit = dx * dx + dy * dy <= s.lumps[i][1] * s.lumps[i][1]
      }
      filled[y * w + x] = hit
      if (hit) depth[x]++
    }
  }
  const tone = night ? NIGHT : DAY
  ctx.clearRect(0, 0, w, h)
  for (let y = 0; y <= base; y++) {
    for (let x = 0; x < w; x++) {
      if (!filled[y * w + x]) continue
      ctx.fillStyle = y === base || (y === base - 1 && depth[x] <= 3) ? tone.under : tone.body
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

// The integer hash the stars are sown with — stable per (x, y), so the field
// never shimmers between repaints.
function noise(x: number, y: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

// One star per ~150x150 patch on a 2px grid, a quarter of them bright.
function paintStars(canvas: HTMLCanvasElement) {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (!w || !h) return
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const n = noise(x, y)
      if (n % 5570 !== 0) continue
      ctx.fillStyle = (n >>> 12) % 4 === 0 ? '#C2D0E6' : '#56658A'
      ctx.fillRect(x, y, 2, 2)
    }
  }
}

export function Sky(props: { night: boolean }) {
  const field = useRef<HTMLDivElement>(null)
  const stars = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const paint = () => {
      const el = field.current
      if (!el) return
      // The drift keyframe ends at the sky's own width, so a cloud always
      // leaves by the right edge whatever the viewport.
      el.style.setProperty('--sky-w', el.clientWidth + 'px')
      el.querySelectorAll<HTMLCanvasElement>('canvas').forEach((c) => {
        drawCloud(c, c.dataset.shape as Shape, props.night)
      })
      if (stars.current) paintStars(stars.current)
    }
    paint()
    let timer = 0
    const onResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(paint, 160)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [props.night])

  return (
    <>
      <canvas ref={stars} className="sky-stars" aria-hidden="true" />
      <div ref={field} className="sky-field" aria-hidden="true">
        {LANES.map((c) => (
          <canvas key={c.lane} className={'sky-cloud ' + c.lane + ' s-' + c.shape} data-shape={c.shape} />
        ))}
      </div>
    </>
  )
}
