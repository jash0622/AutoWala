import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import { STATUS_LABEL, timings } from '../lib/theme'

/* ==========================================================================
 *  StatusBar — thin top row.
 *    left   · live clock (12h)
 *    center · pulsing green dot + slowly ticking km counter ("on the road")
 *    right  · circular button that toggles the ambient WebGL motion
 * ======================================================================== */

function formatClock(date) {
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const suffix = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${suffix}`
}

export default function StatusBar({ ambientActive, onToggleAmbient, isPlaying }) {
  const [clock, setClock] = useState(() => formatClock(new Date()))
  const [km, setKm] = useState(540)

  /* Clock — re-sync on the minute boundary rather than every second. */
  useEffect(() => {
    let timeoutId
    const schedule = () => {
      const now = new Date()
      setClock(formatClock(now))
      const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds())
      timeoutId = window.setTimeout(schedule, msToNextMinute + 20)
    }
    schedule()
    return () => window.clearTimeout(timeoutId)
  }, [])

  /* Ambience: the odometer creeps up, a touch faster while music plays. */
  useEffect(() => {
    const interval = window.setInterval(
      () => setKm((value) => value + 1),
      isPlaying ? timings.counterTick : timings.counterTick * 2,
    )
    return () => window.clearInterval(interval)
  }, [isPlaying])

  return (
    <header
      data-intro="status"
      className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-5 lg:px-9 lg:pt-6"
    >
      {/* left · clock */}
      <time
        className="min-w-[64px] font-ui text-sm font-medium tabular-nums text-cream/90 sm:text-base"
        dateTime={new Date().toISOString()}
      >
        {clock}
      </time>

      {/* center · live status — bare text on the gradient, no pill.
          The reference sets the counter bold and the label dim; that contrast
          is the whole effect, a chip around it kills it. */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <span className="relative flex h-[7px] w-[7px] shrink-0">
          <span
            className="live-dot absolute inset-0 rounded-full"
            style={{ backgroundColor: 'var(--c-live)' }}
          />
        </span>
        <p className="whitespace-nowrap font-ui text-[0.75rem] tracking-wide sm:text-[0.88rem]">
          <span className="font-semibold tabular-nums text-cream">{km}</span>
          <span className="ml-1.5 font-normal text-cream/55">{STATUS_LABEL}</span>
        </p>
      </div>

      {/* right · ambient motion toggle — thin outlined circle */}
      <div className="flex min-w-[64px] justify-end">
        <motion.button
          type="button"
          onClick={onToggleAmbient}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          aria-pressed={ambientActive}
          aria-label={
            ambientActive ? 'Turn off ambient background motion' : 'Turn on ambient background motion'
          }
          title={ambientActive ? 'Ambient motion: on' : 'Ambient motion: off'}
          className="icon-ring grid h-[30px] w-[30px] place-items-center rounded-full text-cream/85 transition-colors hover:text-cream sm:h-8 sm:w-8"
        >
          {ambientActive ? (
            <Play className="ml-[1px] h-3 w-3" strokeWidth={2} fill="currentColor" />
          ) : (
            <Pause className="h-3 w-3" strokeWidth={2} fill="currentColor" />
          )}
        </motion.button>
      </div>
    </header>
  )
}
