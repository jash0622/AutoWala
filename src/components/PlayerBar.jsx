import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListMusic, Pause, Play, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { formatTime } from '../hooks/useYouTubePlayer'

/* ==========================================================================
 *  PlayerBar — fixed glassmorphic strip at the bottom of the viewport.
 *
 *  Mobile  : floating rounded card (small margin all round, never edge-to-edge)
 *            rows → [art + title] / [progress] / [controls]
 *  Desktop : centred pill ~68vw
 *            rows → [art + title ......... controls] / [progress]
 * ======================================================================== */

/* ----------------------------------------------------------- marquee title */
function MarqueeText({ text, className = '' }) {
  const boxRef = useRef(null)
  const trackRef = useRef(null)
  const measureRef = useRef(null)
  const [scrolling, setScrolling] = useState(false)

  useLayoutEffect(() => {
    setScrolling(false)
    const box = boxRef.current
    const measure = measureRef.current
    const track = trackRef.current
    if (!box || !measure || !track) return

    const id = window.requestAnimationFrame(() => {
      const overflow = measure.scrollWidth - box.clientWidth
      if (overflow > 6) {
        const distance = measure.scrollWidth + 40 // one copy + gap
        track.style.setProperty('--marquee-distance', `${distance}px`)
        track.style.setProperty('--marquee-duration', `${Math.max(9, distance / 42)}s`)
        setScrolling(true)
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [text])

  return (
    <div ref={boxRef} className={`overflow-hidden ${className}`}>
      <div ref={trackRef} className={`marquee-track ${scrolling ? 'is-scrolling' : ''}`}>
        <span ref={measureRef} className="inline-block">
          {text}
        </span>
        {scrolling && (
          <span aria-hidden="true" className="inline-block pl-10">
            {text}
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ progress bar */
function ProgressBar({ currentTime, duration, onSeekRatio, onScrubbing, disabled }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [dragRatio, setDragRatio] = useState(0)
  const [hoverRatio, setHoverRatio] = useState(null)

  const ratioFromClientX = useCallback((clientX) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }, [])

  const liveRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const shownRatio = dragging ? dragRatio : liveRatio

  useEffect(() => {
    if (!dragging) return undefined

    const onMove = (event) => {
      const ratio = ratioFromClientX(event.clientX)
      setDragRatio(ratio)
      onScrubbing?.(true, ratio * duration)
    }
    const onUp = (event) => {
      const ratio = ratioFromClientX(event.clientX)
      setDragging(false)
      onScrubbing?.(false)
      onSeekRatio?.(ratio)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, duration, onScrubbing, onSeekRatio, ratioFromClientX])

  const handlePointerDown = (event) => {
    if (disabled) return
    const ratio = ratioFromClientX(event.clientX)
    setDragRatio(ratio)
    setDragging(true)
    onScrubbing?.(true, ratio * duration)
  }

  const handleKeyDown = (event) => {
    if (disabled || !duration) return
    const step = event.shiftKey ? 30 : 5
    let target = null
    if (event.key === 'ArrowRight') target = currentTime + step
    else if (event.key === 'ArrowLeft') target = currentTime - step
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = duration - 1
    if (target === null) return
    event.preventDefault()
    onSeekRatio?.(Math.min(1, Math.max(0, target / duration)))
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration) || 0}
      aria-valuenow={Math.round(dragging ? dragRatio * duration : currentTime) || 0}
      aria-valuetext={`${formatTime(dragging ? dragRatio * duration : currentTime)} of ${formatTime(duration)}`}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => !dragging && setHoverRatio(ratioFromClientX(e.clientX))}
      onPointerLeave={() => setHoverRatio(null)}
      onKeyDown={handleKeyDown}
      className={`group relative flex h-3 w-full items-center ${
        disabled ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      {/* rail */}
      <div className="relative h-[2.5px] w-full overflow-visible rounded-full bg-white/[0.16]">
        {/* hover ghost */}
        {hoverRatio !== null && !dragging && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/25"
            style={{ width: `${hoverRatio * 100}%` }}
          />
        )}
        {/* fill — light and quiet, like the reference */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${shownRatio * 100}%`,
            background: 'rgba(245,241,232,0.9)',
            transition: dragging ? 'none' : 'width 220ms linear',
          }}
        />
        {/* knob */}
        <div
          className={`absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-opacity ${
            dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
          style={{ left: `${shownRatio * 100}%` }}
        />
      </div>

      {/* hover scrub preview */}
      {hoverRatio !== null && !dragging && duration > 0 && (
        <span
          className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-md bg-black/70 px-1.5 py-0.5 font-ui text-[0.62rem] tabular-nums text-cream"
          style={{ left: `${hoverRatio * 100}%` }}
        >
          {formatTime(hoverRatio * duration)}
        </span>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- control button */
function IconButton({ label, onClick, active, disabled, children, className = '' }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={label}
      whileHover={disabled ? undefined : { scale: 1.1 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 480, damping: 26 }}
      className={`grid h-11 w-11 place-items-center rounded-full transition-colors disabled:opacity-30 sm:h-8 sm:w-8 ${
        active ? 'text-cream' : 'text-cream/70 hover:text-cream'
      } ${className}`}
    >
      {children}
    </motion.button>
  )
}

/* ================================================================ PlayerBar */
export default function PlayerBar({
  isReady,
  isPlaying,
  isBuffering,
  isShuffled,
  isLoadingPlaylist,
  playlistConfigured,
  apiError,
  currentTitle,
  currentAuthor,
  currentThumbnail,
  currentVideoId,
  currentTime,
  duration,
  onTogglePlay,
  onNext,
  onPrevious,
  onToggleShuffle,
  onSeekRatio,
  onScrubbing,
  onTogglePlaylist,
  playlistOpen,
}) {
  const shellRef = useRef(null)
  const disabled = !isReady || !playlistConfigured
  const showSkeleton = playlistConfigured && !apiError && !currentTitle && !isReady

  /**
   * The bar's real rendered height becomes --player-h, which every other layer
   * (ticker, playlist panel, horn button, rickshaw) is positioned against. This
   * is what guarantees nothing ever overlaps at any breakpoint, font size or
   * zoom level — instead of trusting hardcoded pixel guesses.
   */
  useEffect(() => {
    const el = shellRef.current
    if (!el) return undefined

    const apply = () => {
      const height = Math.round(el.getBoundingClientRect().height)
      if (height > 0) document.documentElement.style.setProperty('--player-h', `${height}px`)
    }

    apply()

    let observer
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(apply)
      observer.observe(el)
    }
    window.addEventListener('resize', apply)
    document.fonts?.ready?.then(apply).catch(() => {})

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', apply)
      document.documentElement.style.removeProperty('--player-h')
    }
  }, [])

  const title = !playlistConfigured
    ? 'PLAYLIST_ID सेट करें'
    : apiError && apiError !== 'missing-playlist'
      ? 'प्लेलिस्ट लोड नहीं हुई'
      : currentTitle || (isLoadingPlaylist ? 'लोड हो रहा है…' : 'ऑटो वाला रेडियो')

  const subtitle = !playlistConfigured
    ? 'src/lib/theme.js → PLAYLIST_ID'
    : apiError && apiError !== 'missing-playlist'
      ? apiError
      : currentAuthor || 'YouTube'

  return (
    <div data-intro="player" className="slot-player z-30">
      <div className="w-full px-3 sm:px-4 lg:px-6">
        <div
          ref={shellRef}
          className="glass-clear mx-auto w-full max-w-[min(540px,94vw)] rounded-2xl px-2.5 py-2 sm:px-3 lg:max-w-[max(430px,37vw)] lg:px-3.5 lg:py-2.5"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* ---------------- art + meta ---------------- */}
            <div className="order-1 flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/25 sm:h-[46px] sm:w-[46px]">
                <AnimatePresence mode="popLayout">
                  {currentThumbnail ? (
                    <motion.img
                      key={currentVideoId || 'art'}
                      src={currentThumbnail}
                      alt=""
                      initial={{ opacity: 0, scale: 1.12 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable="false"
                    />
                  ) : (
                    <motion.div
                      key="art-placeholder"
                      className={showSkeleton ? 'shimmer absolute inset-0' : 'absolute inset-0'}
                      style={
                        showSkeleton
                          ? undefined
                          : {
                              background:
                                'linear-gradient(140deg, #b3212b 0%, #5b1b3e 60%, #0b0407 100%)',
                            }
                      }
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="min-w-0 flex-1">
                {showSkeleton ? (
                  <div className="space-y-2 py-1">
                    <div className="shimmer h-3 w-2/3 rounded" />
                    <div className="shimmer h-2.5 w-1/3 rounded" />
                  </div>
                ) : (
                  <>
                    <MarqueeText
                      key={currentVideoId || title}
                      text={title}
                      className="legible font-ui text-[0.8rem] font-semibold leading-tight text-cream sm:text-[0.88rem]"
                    />
                    <p className="legible mt-[3px] truncate font-ui text-[0.68rem] leading-tight text-cream/60 sm:text-[0.72rem]">
                      {subtitle}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ---------------- controls ---------------- */}
            <div className="icon-legible order-3 flex w-full items-center justify-center gap-0.5 sm:order-2 sm:w-auto sm:justify-end sm:gap-0">
              <IconButton
                label={isShuffled ? 'Shuffle on' : 'Shuffle off'}
                onClick={onToggleShuffle}
                active={isShuffled}
                disabled={disabled}
              >
                <Shuffle className="h-4 w-4" strokeWidth={2} />
              </IconButton>

              <IconButton label="Previous track" onClick={onPrevious} disabled={disabled}>
                <SkipBack className="h-[17px] w-[17px]" strokeWidth={2} fill="currentColor" />
              </IconButton>

              {/* central play / pause — a soft cream disc, not a glowing orb */}
              <motion.button
                type="button"
                onClick={onTogglePlay}
                disabled={disabled}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                whileHover={disabled ? undefined : { scale: 1.07 }}
                whileTap={disabled ? undefined : { scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                className="relative mx-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-40 sm:h-[42px] sm:w-[42px]"
                style={{
                  background: 'rgba(245,241,232,0.94)',
                  color: '#2a0a10',
                  boxShadow: '0 6px 18px -6px rgba(0,0,0,0.5)',
                }}
              >
                {isBuffering && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-ping rounded-full border border-cream/50"
                  />
                )}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isPlaying ? 'pause' : 'play'}
                    initial={{ scale: 0.5, opacity: 0, rotate: -35 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.5, opacity: 0, rotate: 35 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="grid place-items-center"
                  >
                    {isPlaying ? (
                      <Pause className="h-[17px] w-[17px]" strokeWidth={2.4} fill="currentColor" />
                    ) : (
                      <Play className="ml-[2px] h-[17px] w-[17px]" strokeWidth={2.4} fill="currentColor" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </motion.button>

              <IconButton label="Next track" onClick={onNext} disabled={disabled}>
                <SkipForward className="h-[17px] w-[17px]" strokeWidth={2} fill="currentColor" />
              </IconButton>

              <IconButton
                label={playlistOpen ? 'Hide playlist' : 'Show playlist'}
                onClick={onTogglePlaylist}
                active={playlistOpen}
              >
                <ListMusic className="h-[17px] w-[17px]" strokeWidth={2} />
              </IconButton>
            </div>

            {/* ---------------- progress + single time label ---------------- */}
            <div className="order-2 w-full sm:order-3">
              <ProgressBar
                currentTime={currentTime}
                duration={duration}
                onSeekRatio={onSeekRatio}
                onScrubbing={onScrubbing}
                disabled={disabled || !duration}
              />
              <p className="legible mt-[1px] font-ui text-[0.6rem] tabular-nums text-cream/50">
                {`${formatTime(currentTime)} / ${formatTime(duration)}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
