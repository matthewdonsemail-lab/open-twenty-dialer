import { useEffect, useRef, useState } from 'react'

// "Here are some ideas": five real apps, one at a time, the chosen one in the
// column and its neighbours peeking in at both margins. It cycles on its own,
// wraps all the way around (two clones on each end make the wrap seamless),
// and stops while the pointer is over it.

const IDEAS = [
  { id: 'crm', name: 'CRM', alt: 'CRM: sidebar, pipeline by stage, action items, recent meetings' },
  { id: 'analytics', name: 'Analytics', alt: 'Analytics: usage by account, sessions trend, retention cohorts' },
  { id: 'revenue', name: 'Renewal desk', alt: 'Renewal desk: ARR up for renewal by month and risk' },
  { id: 'c360', name: 'Customer 360', alt: 'Customer 360: one question answered from Stripe, Linear, Gmail, PostHog and Slack' },
  { id: 'logistics', name: 'Ops console', alt: 'Ops console: a seven-day shipment board with a NOW line' },
]

const CLONES = 2
const GAP = 16
const EVERY = 4000

export function Ideas() {
  const wrap = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  // Position on the track, clones included: real index i sits at i + CLONES.
  const [pos, setPos] = useState(CLONES + 2)
  const [animate, setAnimate] = useState(false)
  const hover = useRef(false)
  const drag = useRef<{ x: number; moved: boolean } | null>(null)

  const slides = [
    ...IDEAS.slice(-CLONES).map((s) => ({ ...s, clone: true })),
    ...IDEAS.map((s) => ({ ...s, clone: false })),
    ...IDEAS.slice(0, CLONES).map((s) => ({ ...s, clone: true })),
  ]

  function offset(i: number): number {
    const el = track.current
    const w = el?.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth : 0
    const wrapW = wrap.current?.clientWidth ?? 0
    return wrapW / 2 - w / 2 - i * (w + GAP)
  }

  function place(x?: number) {
    if (track.current) track.current.style.transform = 'translateX(' + (x ?? offset(pos)) + 'px)'
  }

  // Lay the track out for the current position, and again whenever it resizes.
  useEffect(() => {
    place()
    const onResize = () => {
      setAnimate(false)
      place()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  // Landing on a clone: jump (no transition) to the real slide it stands for.
  function onTransitionEnd() {
    if (pos < CLONES) {
      setAnimate(false)
      setPos(pos + IDEAS.length)
    } else if (pos >= IDEAS.length + CLONES) {
      setAnimate(false)
      setPos(pos - IDEAS.length)
    }
  }

  function go(i: number) {
    setAnimate(true)
    setPos(i)
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      if (hover.current || drag.current || document.hidden) return
      setAnimate(true)
      setPos((p) => p + 1)
    }, EVERY)
    return () => window.clearInterval(timer)
  }, [])

  // Drag to browse. A press that didn't move is a click on a neighbour.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.x
      if (Math.abs(dx) > 4) drag.current.moved = true
      place(offset(pos) + dx)
    }
    const up = (e: PointerEvent) => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.x
      const moved = drag.current.moved
      drag.current = null
      if (Math.abs(dx) > 40) go(pos + (dx < 0 ? 1 : -1))
      else {
        setAnimate(true)
        place()
      }
      // keep the click that ends a drag from selecting a neighbour
      if (moved) setTimeout(() => (drag.current = null), 0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  })

  return (
    <div
      ref={wrap}
      className="peekwrap"
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Example apps"
      onPointerEnter={() => (hover.current = true)}
      onPointerLeave={() => (hover.current = false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          go(pos - 1)
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          go(pos + 1)
        }
      }}
    >
      <div
        ref={track}
        className={animate ? 'peektrack' : 'peektrack drag'}
        onTransitionEnd={(e) => {
          if (e.target === track.current) onTransitionEnd()
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, moved: false }
          setAnimate(false)
        }}
      >
        {slides.map((s, k) => (
          <figure
            key={k}
            className={k === pos ? 'pk on' : 'pk'}
            aria-hidden={s.clone || undefined}
            onClick={() => {
              if (k !== pos && !drag.current) go(k)
            }}
          >
            <div className="shot">
              <img src={'/ideas/' + s.id + '.jpg'} width="1200" height="706" alt={s.alt} draggable={false} />
            </div>
            <figcaption>{s.name}</figcaption>
          </figure>
        ))}
      </div>
      <div className="crow">
        <button type="button" className="cbtn" aria-label="Previous" onClick={() => go(pos - 1)}>
          ←
        </button>
        <button type="button" className="cbtn" aria-label="Next" onClick={() => go(pos + 1)}>
          →
        </button>
      </div>
    </div>
  )
}
