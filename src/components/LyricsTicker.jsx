import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { RotateCw } from 'lucide-react'
import { TICKER_LINES, timings } from '../lib/theme'
import { useReducedMotion } from '../hooks/useReducedMotion'

/* ==========================================================================
 *  LyricsTicker — rotating rickshaw-driver one-liners, sitting directly above
 *  the player bar. Auto-cycles every ~5.5s with a GSAP fade + slide; the small
 *  looping-arrow button to the right advances manually and spins on click.
 * ======================================================================== */

export default function LyricsTicker() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TICKER_LINES.length))
  const [cycleKey, setCycleKey] = useState(0)
  const textRef = useRef(null)
  const iconRef = useRef(null)
  const animatingRef = useRef(false)
  const reduced = useReducedMotion()

  const advance = useCallback(
    (step = 1) => {
      const el = textRef.current
      const bump = () => setIndex((i) => (i + step + TICKER_LINES.length) % TICKER_LINES.length)

      if (reduced || !el) {
        bump()
        setCycleKey((k) => k + 1)
        return
      }
      if (animatingRef.current) return

      animatingRef.current = true
      gsap.to(el, {
        opacity: 0,
        y: -10,
        filter: 'blur(4px)',
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          bump()
          setCycleKey((k) => k + 1)
        },
      })
    },
    [reduced],
  )

  /* fade the new line in whenever the index changes */
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0, filter: 'blur(0px)' })
      animatingRef.current = false
      return
    }
    gsap.fromTo(
      el,
      { opacity: 0, y: 12, filter: 'blur(5px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.6,
        ease: 'power3.out',
        onComplete: () => {
          animatingRef.current = false
        },
      },
    )
  }, [index, reduced])

  /* auto-rotation — restarts whenever the line changes for any reason */
  useEffect(() => {
    const id = window.setTimeout(() => advance(1), timings.tickerInterval)
    return () => window.clearTimeout(id)
  }, [cycleKey, advance])

  const handleManual = () => {
    if (iconRef.current && !reduced) {
      gsap.to(iconRef.current, { rotate: '+=360', duration: 0.65, ease: 'power2.out' })
    }
    advance(1)
  }

  return (
    <div data-intro="ticker" className="slot-ticker z-20 px-6 sm:px-10">
      <div className="mx-auto flex max-w-[min(560px,88vw)] items-center justify-center gap-2.5 sm:gap-3">
        <p
          ref={textRef}
          aria-live="polite"
          className="text-balance text-center font-deva text-[0.95rem] leading-snug text-cream/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.4)] sm:text-[1.05rem] lg:text-[1.15rem]"
        >
          {TICKER_LINES[index]}
        </p>

        <button
          type="button"
          onClick={handleManual}
          aria-label="Next line"
          title="Next line"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-cream/40 transition-colors hover:bg-white/10 hover:text-cream"
        >
          <span ref={iconRef} className="grid place-items-center">
            <RotateCw className="h-3 w-3" strokeWidth={2.2} />
          </span>
        </button>
      </div>
    </div>
  )
}
