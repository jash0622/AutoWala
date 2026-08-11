import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { RICKSHAW_SRC } from '../lib/theme'
import { useReducedMotion } from '../hooks/useReducedMotion'

/* ==========================================================================
 *  RickshawGraphic
 *
 *  Renders the SUPPLIED auto-rickshaw PNG (public/assets/Auto.png) — this
 *  component deliberately draws no illustration of its own.
 *
 *  Layering: z-10 → above the WebGL background, below the hero title (z-20),
 *  so the yellow roof sits just behind the wordmark.
 *
 *  Geometry: the PNG has transparent padding, so all offsets are derived from
 *  the --auto-* custom properties defined in index.css (.rickshaw-layer).
 *  That keeps the wheels planted on --auto-bottom at every breakpoint instead
 *  of floating above it.
 *
 *  Motion: a permanent, very small suspension bounce (idling engine) that runs
 *  regardless of play/pause state.
 * ======================================================================== */

/** Flat silhouettes beside the rickshaw, purely for scale and character. */
function PedestrianSilhouettes() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 80 60"
      className="rickshaw-extras hidden opacity-40 md:block"
      fill="#0b0714"
    >
      <g>
        <circle cx="20" cy="12" r="5.2" />
        <path d="M20 18c-5 0-8.3 3-8.9 7.7L9.6 38h4.1L14.6 60h3.3l1.1-16.2h2.8L22.9 60h3.3L26.7 38h4.1l-1.9-12.3C28.3 21 25 18 20 18Z" />
      </g>
      <g opacity="0.82">
        <circle cx="52" cy="17" r="4.4" />
        <path d="M52 22.3c-4.3 0-7.1 2.6-7.6 6.6L43.1 39h3.5L47.4 60h2.9l.9-14h2.4l.9 14h2.9L58.2 39h3.5l-1.3-10.1c-.5-4-3.3-6.6-7.6-6.6Z" />
      </g>
    </svg>
  )
}

export default function RickshawGraphic() {
  const imgRef = useRef(null)
  const [assetMissing, setAssetMissing] = useState(false)
  const reduced = useReducedMotion()

  /* Idle suspension bounce — always on, independent of playback state. */
  useEffect(() => {
    if (reduced || assetMissing || !imgRef.current) return undefined
    const tween = gsap.to(imgRef.current, {
      y: -7,
      duration: 2.7,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })
    return () => tween.kill()
  }, [reduced, assetMissing])

  return (
    <div
      data-intro="rickshaw"
      aria-hidden="true"
      className="rickshaw-layer pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {/* ambient-occlusion pool, grounds the vehicle against the gradient */}
      <div className="rickshaw-shadow" />

      {assetMissing ? (
        <div className="rickshaw-img grid aspect-[1152/1355] place-items-center rounded-2xl border border-dashed border-white/15 bg-black/10">
          <p className="px-4 text-center font-ui text-[0.65rem] leading-relaxed tracking-wide text-cream-dim/45">
            {RICKSHAW_SRC}
            <br />
            <span className="text-[0.6rem]">drop your artwork here</span>
          </p>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={RICKSHAW_SRC}
          alt=""
          draggable="false"
          decoding="async"
          onError={() => setAssetMissing(true)}
          className="rickshaw-img drag-none"
        />
      )}

      <PedestrianSilhouettes />
    </div>
  )
}
