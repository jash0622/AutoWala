import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import gsap from 'gsap'
import { Volume2 } from 'lucide-react'
import { HORN_SRC } from '../lib/theme'
import { useReducedMotion } from '../hooks/useReducedMotion'

/* ==========================================================================
 *  HornButton — हॉर्न ओके प्लीज़
 *
 *  · glassmorphic pill, speaker icon + two-line label
 *  · press → honk + GSAP shake/glow pulse + expanding shockwave rings
 *  · audio: plays /assets/horn.mp3 when present, otherwise synthesises a
 *    two-tone rickshaw honk with the Web Audio API (zero-asset fallback)
 *  · real <button>, aria-label, keyboard operable, visible focus ring
 * ======================================================================== */

let sharedAudioContext = null
function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!sharedAudioContext) sharedAudioContext = new Ctx()
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume()
  return sharedAudioContext
}

/** Squeezy three-tone auto horn, ~0.45s. */
function synthesiseHonk() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const stop = now + 0.46

  const master = ctx.createGain()
  master.connect(ctx.destination)
  master.gain.setValueAtTime(0.0001, now)
  master.gain.linearRampToValueAtTime(0.85, now + 0.025)
  master.gain.setValueAtTime(0.85, now + 0.3)
  master.gain.exponentialRampToValueAtTime(0.0008, stop)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2400, now)
  filter.Q.value = 0.9
  filter.connect(master)

  const partials = [
    { freq: 415, type: 'sawtooth', gain: 0.38 },
    { freq: 523, type: 'square', gain: 0.26 },
    { freq: 831, type: 'sawtooth', gain: 0.14 },
  ]

  partials.forEach(({ freq, type, gain }) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq * 0.94, now)
    osc.frequency.linearRampToValueAtTime(freq, now + 0.06)
    osc.frequency.linearRampToValueAtTime(freq * 0.97, stop)

    const g = ctx.createGain()
    g.gain.value = gain
    osc.connect(g)
    g.connect(filter)
    osc.start(now)
    osc.stop(stop)
  })
}

export default function HornButton({ onHonk }) {
  const buttonRef = useRef(null)
  const sampleRef = useRef(null)
  const sampleOkRef = useRef(false)
  const [ripples, setRipples] = useState([])
  const rippleId = useRef(0)
  const reduced = useReducedMotion()

  /* Probe for an optional real horn sample. */
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = HORN_SRC
    const onOk = () => {
      sampleOkRef.current = true
    }
    const onFail = () => {
      sampleOkRef.current = false
    }
    audio.addEventListener('canplaythrough', onOk)
    audio.addEventListener('error', onFail)
    sampleRef.current = audio
    return () => {
      audio.removeEventListener('canplaythrough', onOk)
      audio.removeEventListener('error', onFail)
      audio.src = ''
      sampleRef.current = null
    }
  }, [])

  const playHonkSound = useCallback(() => {
    const sample = sampleRef.current
    if (sampleOkRef.current && sample) {
      try {
        const clone = sample.cloneNode(true)
        clone.volume = 0.85
        clone.play().catch(() => synthesiseHonk())
        return
      } catch {
        /* fall through to the synth */
      }
    }
    synthesiseHonk()
  }, [])

  const handlePress = useCallback(() => {
    playHonkSound()

    // shockwave rings
    const id = (rippleId.current += 1)
    setRipples((prev) => [...prev.slice(-2), id])
    window.setTimeout(() => setRipples((prev) => prev.filter((r) => r !== id)), 900)

    // GSAP shake + glow punch
    if (!reduced && buttonRef.current) {
      const el = buttonRef.current
      gsap.killTweensOf(el)
      gsap
        .timeline()
        .to(el, {
          keyframes: [
            { x: -7, rotate: -2.2, duration: 0.06 },
            { x: 7, rotate: 2.2, duration: 0.06 },
            { x: -5, rotate: -1.4, duration: 0.06 },
            { x: 4, rotate: 1, duration: 0.06 },
            { x: 0, rotate: 0, duration: 0.09 },
          ],
          ease: 'none',
        })
        .fromTo(
          el,
          { boxShadow: '0 20px 50px -22px rgba(0,0,0,0.55)' },
          {
            boxShadow: '0 10px 44px -4px rgba(245,241,232,0.42)',
            duration: 0.18,
            yoyo: true,
            repeat: 1,
          },
          0,
        )
        .fromTo(el, { scale: 1 }, { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1 }, 0)
    }

    onHonk?.()
  }, [onHonk, playHonkSound, reduced])

  return (
    <div data-intro="horn" className="slot-horn z-40">
      <div className="relative">
        {/* shockwave rings */}
        <AnimatePresence>
          {ripples.map((id) => (
            <motion.span
              key={id}
              aria-hidden="true"
              initial={{ scale: 0.6, opacity: 0.5 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                border: '1.5px solid rgba(245,241,232,0.5)',
                boxShadow: '0 0 26px rgba(245,241,232,0.2)',
              }}
            />
          ))}
        </AnimatePresence>

        <motion.button
          ref={buttonRef}
          type="button"
          onClick={handlePress}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          aria-label="Honk the horn — हॉर्न ओके प्लीज़"
          className="frost relative flex items-center gap-2 rounded-full px-2 py-1.5 text-left sm:gap-2.5 sm:px-2.5"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.14] sm:h-6 sm:w-6">
            <Volume2 className="h-3.5 w-3.5 text-cream sm:h-3 sm:w-3" strokeWidth={2.2} />
          </span>

          <span className="flex flex-col pr-1 leading-none">
            <span className="font-display text-[0.72rem] font-extrabold tracking-wide text-cream sm:text-[0.7rem]">
              हॉर्न ओके प्लीज़
            </span>
            <span className="mt-[3px] font-ui text-[0.52rem] font-medium tracking-[0.06em] text-cream/60 sm:text-[0.5rem]">
              Horn ok pleaseeee
            </span>
          </span>
        </motion.button>
      </div>
    </div>
  )
}
