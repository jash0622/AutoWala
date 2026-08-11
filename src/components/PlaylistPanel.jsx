import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListMusic, X } from 'lucide-react'

/* ==========================================================================
 *  PlaylistPanel — slide-up glass card listing the real YouTube playlist.
 *
 *  Data comes straight from the IFrame API (player.getPlaylist()), enriched
 *  with Data API v3 metadata when a key is configured. Clicking a row calls
 *  player.playVideoAt(index).
 * ======================================================================== */

const EQ_DELAYS = ['0ms', '150ms', '300ms', '90ms']

function Equalizer({ playing }) {
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-[2px]">
      {EQ_DELAYS.map((delay, i) => (
        <span
          key={i}
          className={playing ? 'eq-bar' : ''}
          style={{
            width: 2,
            height: [14, 9, 16, 11][i],
            borderRadius: 2,
            backgroundColor: 'var(--c-auto-yellow)',
            animationDelay: delay,
            transform: playing ? undefined : 'scaleY(0.35)',
            transformOrigin: 'bottom center',
          }}
        />
      ))}
    </span>
  )
}

function SkeletonRows({ count = 6 }) {
  return (
    <ul className="space-y-1.5 p-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
          <div className="shimmer h-4 w-4 shrink-0 rounded" />
          <div className="shimmer h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="shimmer h-3 rounded" style={{ width: `${58 + ((i * 11) % 34)}%` }} />
            <div className="shimmer h-2.5 w-1/3 rounded" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function PlaylistPanel({
  open,
  onClose,
  playlist = [],
  currentIndex = 0,
  isPlaying = false,
  isLoading = false,
  onSelect,
}) {
  const listRef = useRef(null)
  const activeRowRef = useRef(null)

  /* Escape closes the panel */
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  /* Keep the now-playing row in view */
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 260)
    return () => window.clearTimeout(id)
  }, [open, currentIndex])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* click-away layer */}
          <motion.div
            key="playlist-backdrop"
            className="absolute inset-0 z-30 cursor-default bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.section
            key="playlist-panel"
            role="dialog"
            aria-modal="false"
            aria-label="Playlist"
            className="slot-panel z-40 px-3 sm:px-6"
            initial={{ opacity: 0, y: 34, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 26, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
          >
            <div className="glass auto-stripe mx-auto w-full max-w-[min(640px,94vw)] overflow-hidden rounded-3xl lg:max-w-[min(760px,68vw)]">
              <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <ListMusic className="h-4 w-4 text-auto-yellow" strokeWidth={2.2} />
                  <h2 className="font-ui text-xs font-semibold uppercase tracking-[0.22em] text-cream/85">
                    सवारी लिस्ट
                  </h2>
                  {!isLoading && (
                    <span className="font-ui text-[0.68rem] tabular-nums text-cream-dim/55">
                      {playlist.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close playlist"
                  className="grid h-8 w-8 place-items-center rounded-full text-cream-dim/70 transition-colors hover:bg-white/10 hover:text-cream"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </header>

              <div
                ref={listRef}
                className="scroll-thin max-h-[min(44vh,330px)] overflow-y-auto overscroll-contain short:max-h-[min(38vh,190px)]"
              >
                {isLoading ? (
                  <SkeletonRows />
                ) : playlist.length === 0 ? (
                  <p className="px-4 py-8 text-center font-ui text-xs text-cream-dim/60">
                    कोई गाना नहीं मिला — check your PLAYLIST_ID.
                  </p>
                ) : (
                  <ul className="space-y-1 p-2">
                    {playlist.map((track) => {
                      const active = track.index === currentIndex
                      return (
                        <li key={`${track.id}-${track.index}`} ref={active ? activeRowRef : null}>
                          <button
                            type="button"
                            onClick={() => onSelect?.(track.index)}
                            disabled={track.unavailable}
                            aria-current={active ? 'true' : undefined}
                            title={
                              track.unavailable
                                ? 'यह गाना embed नहीं होता — uploader ne block kiya hai'
                                : track.title
                            }
                            className={`group relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors ${
                              track.unavailable
                                ? 'cursor-not-allowed opacity-40'
                                : 'hover:bg-white/[0.07]'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="playlist-active-highlight"
                                className="absolute inset-0 rounded-2xl border border-auto-yellow/30"
                                style={{
                                  background:
                                    'linear-gradient(90deg, rgba(255,199,44,0.16), rgba(216,56,47,0.10) 60%, transparent)',
                                }}
                                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                              />
                            )}

                            <span className="relative z-10 w-5 shrink-0 text-center font-ui text-[0.7rem] tabular-nums text-cream-dim/55">
                              {active ? <Equalizer playing={isPlaying} /> : track.index + 1}
                            </span>

                            <span className="relative z-10 h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
                              <img
                                src={track.thumbnail}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover"
                                onError={(event) => {
                                  event.currentTarget.style.visibility = 'hidden'
                                }}
                              />
                            </span>

                            <span className="relative z-10 min-w-0 flex-1">
                              <span
                                className={`block truncate font-ui text-[0.82rem] font-medium ${
                                  active ? 'text-auto-yellow' : 'text-cream/90'
                                }`}
                              >
                                {track.title}
                              </span>
                              <span className="mt-0.5 block truncate font-ui text-[0.68rem] text-cream-dim/60">
                                {track.unavailable ? 'उपलब्ध नहीं · embed blocked' : track.author}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
