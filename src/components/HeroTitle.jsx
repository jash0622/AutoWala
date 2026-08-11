import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from '../hooks/useReducedMotion'

/* ==========================================================================
 *  HeroTitle — the giant "ऑटो वाला" wordmark.
 *
 *  Markup + CSS follow the reference spec exactly: a .logo flex container with
 *  two .logo_line spans, sized and offset purely through CSS custom properties
 *  (--logo-size / --logo-x) so GSAP can tween the variables themselves.
 *
 *  Entrance (scale + fade, spans staggered ~0.1s) is driven by the master
 *  timeline in App.jsx. This component owns the idle float and the pointer
 *  parallax that writes to --logo-x.
 * ======================================================================== */

export default function HeroTitle({ introDone = false }) {
  const wrapRef = useRef(null)
  const logoRef = useRef(null)
  const reduced = useReducedMotion()

  /* ---- idle float: slow y-axis breathing, starts after the intro ---- */
  useEffect(() => {
    if (!introDone || reduced || !wrapRef.current) return undefined
    const tween = gsap.to(wrapRef.current, {
      y: -14,
      duration: 4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })
    return () => tween.kill()
  }, [introDone, reduced])

  /* ---- pointer parallax: eased write straight into the --logo-x variable ---- */
  useEffect(() => {
    if (reduced || !logoRef.current) return undefined
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return undefined

    const el = logoRef.current
    let target = 0
    let current = 0

    const onMove = (event) => {
      const nx = event.clientX / window.innerWidth - 0.5 // -0.5 … 0.5
      target = nx * 26
    }
    const onLeave = () => {
      target = 0
    }
    const tick = () => {
      const nextValue = current + (target - current) * 0.075
      if (Math.abs(nextValue - current) < 0.01 && Math.abs(target - current) < 0.01) return
      current = nextValue
      el.style.setProperty('--logo-x', `${current.toFixed(2)}px`)
    }

    gsap.ticker.add(tick)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)

    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      el.style.removeProperty('--logo-x')
    }
  }, [reduced])

  return (
    <div ref={wrapRef} className="pointer-events-none flex select-none items-center justify-center">
      <h1 ref={logoRef} className="logo" aria-label="ऑटो वाला — Auto Wala">
        <span className="logo_line">ऑटो</span>
        <span className="logo_line">वाला</span>
      </h1>
    </div>
  )
}
