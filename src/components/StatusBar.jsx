import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import { STATUS_LABEL } from '../lib/theme'

/* ==========================================================================
 *  StatusBar — thin top row.
 *    left   · live clock (12h)
 *    center · pulsing green dot + LIVE LISTENER COUNT
 *    right  · circular button that toggles the ambient WebGL motion
 *
 *  The listener count uses a BroadcastChannel + localStorage heartbeat to
 *  count how many tabs/windows have the site open on THIS device. For a
 *  true cross-device count, replace the useLiveCount hook with a WebSocket
 *  connection (e.g. Ably, Pusher, Firebase Presence, or a custom WS server).
 * ======================================================================== */

function formatClock(date) {
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const suffix = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${suffix}`
}

/**
 * Counts how many tabs/windows have the site open RIGHT NOW on this device.
 * Uses BroadcastChannel for instant cross-tab sync + localStorage heartbeat
 * as a fallback for browsers that don't support BroadcastChannel.
 *
 * To replace with a real server-side count:
 *   1. Connect to your WebSocket/presence service in useEffect
 *   2. Set `count` from the server's reported presence number
 *   3. Remove the localStorage/BroadcastChannel logic
 */
function useLiveCount() {
  const [count, setCount] = useState(1)
  const idRef = useRef(null)

  useEffect(() => {
    // Generate a unique ID for this tab
    const tabId = `aw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    idRef.current = tabId

    const STORAGE_KEY = 'autowala_live_tabs'
    const HEARTBEAT_MS = 2000
    const STALE_MS = 5000

    const writeSelf = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const tabs = raw ? JSON.parse(raw) : {}
        tabs[tabId] = Date.now()
        // Prune stale entries
        const now = Date.now()
        for (const id of Object.keys(tabs)) {
          if (now - tabs[id] > STALE_MS) delete tabs[id]
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
        setCount(Object.keys(tabs).length)
      } catch {
        setCount(1)
      }
    }

    const removeSelf = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const tabs = raw ? JSON.parse(raw) : {}
        delete tabs[tabId]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
      } catch { /* noop */ }
    }

    writeSelf()
    const interval = setInterval(writeSelf, HEARTBEAT_MS)

    // BroadcastChannel for instant cross-tab notification
    let bc = null
    try {
      bc = new BroadcastChannel('autowala_presence')
      bc.postMessage({ type: 'join', id: tabId })
      bc.onmessage = () => writeSelf() // re-count on any presence change
    } catch { /* BroadcastChannel not supported — localStorage alone is fine */ }

    // Cleanup on tab close
    const onUnload = () => {
      removeSelf()
      bc?.postMessage({ type: 'leave', id: tabId })
      bc?.close()
    }
    window.addEventListener('beforeunload', onUnload)

    // Listen for storage changes from other tabs
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) writeSelf()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('storage', onStorage)
      removeSelf()
      bc?.close()
    }
  }, [])

  return count
}

export default function StatusBar({ ambientActive, onToggleAmbient }) {
  const [clock, setClock] = useState(() => formatClock(new Date()))
  const liveCount = useLiveCount()

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
          <span className="font-semibold tabular-nums text-cream">{liveCount}</span>
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
