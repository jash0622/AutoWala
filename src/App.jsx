import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { AlertTriangle } from 'lucide-react'

import HeroTitle from './components/HeroTitle'
import HornButton from './components/HornButton'
import LyricsTicker from './components/LyricsTicker'
import PlayerBar from './components/PlayerBar'
import PlaylistPanel from './components/PlaylistPanel'
import RickshawGraphic from './components/RickshawGraphic'
import StatusBar from './components/StatusBar'
import { useYouTubePlayer } from './hooks/useYouTubePlayer'
import { useReducedMotion } from './hooks/useReducedMotion'

/**
 * Three.js is ~700kB of the bundle and is pure decoration — keep it out of the
 * critical path so the UI paints immediately. The CSS sunset gradient on
 * <body> covers the gap (and stays as the permanent fallback).
 */
const AmbientBackground = lazy(() => import('./components/AmbientBackground'))

/* ==========================================================================
 *  ऑटो वाला · AUTO WALA
 *  A single-viewport "now playing" dashboard. Nothing scrolls; every layer is
 *  positioned off the --player-h custom property so the horn button, ticker,
 *  playlist panel and rickshaw never collide at any breakpoint.
 *
 *  z-index map
 *    0  · WebGL ambient background
 *    10 · auto-rickshaw PNG (behind the wordmark, in front of the background)
 *    20 · hero title + lyrics ticker
 *    30 · status bar, player bar, playlist click-away
 *    40 · playlist panel, horn button
 * ======================================================================== */

export default function App() {
  const rootRef = useRef(null)
  const [ambientActive, setAmbientActive] = useState(true)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const reduced = useReducedMotion()

  const player = useYouTubePlayer()

  /* ------------------------------------------------- entrance choreography */
  useLayoutEffect(() => {
    if (reduced) {
      setIntroDone(true)
      return undefined
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => setIntroDone(true),
      })

      tl.from('[data-intro="bg"]', { opacity: 0, duration: 1.0 }, 0)
        .from(
          '.logo_line',
          { opacity: 0, scale: 0.82, y: 34, duration: 0.95, stagger: 0.1, ease: 'expo.out' },
          0.18,
        )
        .from('[data-intro="status"]', { opacity: 0, y: -26, duration: 0.7 }, 0.35)
        .from('[data-intro="rickshaw"]', { opacity: 0, y: 70, duration: 1.1 }, 0.3)
        .from('[data-intro="player"]', { opacity: 0, y: 90, duration: 0.95 }, 0.7)
        .from('[data-intro="ticker"]', { opacity: 0, y: 16, duration: 0.7 }, 0.95)
        .from(
          '[data-intro="horn"]',
          { opacity: 0, scale: 0.55, duration: 0.75, ease: 'back.out(2)' },
          1.1,
        )
    }, rootRef)

    return () => ctx.revert()
  }, [reduced])

  /* ------------------------------------------------------------- shortcuts */
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName
      const isControl = tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'A'
      if (event.code === 'Space' && !isControl) {
        event.preventDefault()
        player.togglePlay()
      }
      if (event.key === 'MediaPlayPause') player.togglePlay()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [player])

  /* The horn doubles as the "first gesture" that unlocks unmuted playback. */
  const handleHonk = useCallback(() => {
    if (!player.hasStarted && player.isReady) player.play()
  }, [player])

  const handleSelectTrack = useCallback(
    (index) => {
      player.playAt(index)
      setPlaylistOpen(false)
    },
    [player],
  )

  const showConfigNotice = !player.playlistConfigured

  return (
    <div
      ref={rootRef}
      className="app-shell relative w-full overflow-hidden font-ui text-cream"
    >
      {/* 0 · ambient WebGL background (falls back to the CSS gradient) */}
      <div data-intro="bg" className="absolute inset-0 z-0">
        <Suspense fallback={null}>
          <AmbientBackground active={ambientActive} />
        </Suspense>
      </div>

      {/* 5 · dark road strip — full-width black band at the very bottom,
          exactly like the reference. Vehicle stands on it. */}
      <div className="road-strip" aria-hidden="true" />

      {/* 10 · supplied auto-rickshaw PNG */}
      <RickshawGraphic />

      {/* 20 · hero — a 52vh box with the wordmark centred inside puts the
          title's optical centre at 26vh, exactly where the reference has it,
          independent of font size or breakpoint. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[52vh] items-center justify-center px-5">
        <HeroTitle introDone={introDone} />
      </div>

      {/* 30 · top bar */}
      <StatusBar
        ambientActive={ambientActive}
        onToggleAmbient={() => setAmbientActive((v) => !v)}
        isPlaying={player.isPlaying}
      />

      {showConfigNotice && (
        <div className="pointer-events-none absolute inset-x-0 top-[64px] z-30 flex justify-center px-4 sm:top-[72px]">
          <p className="glass-soft flex max-w-[92vw] items-center gap-2 rounded-full px-3.5 py-2 font-ui text-[0.68rem] text-cream-dim sm:text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-auto-yellow" strokeWidth={2.2} />
            <span>
              Add your playlist ID in{' '}
              <code className="rounded bg-black/30 px-1 py-0.5 text-auto-yellow">
                src/lib/theme.js
              </code>{' '}
              to start the ride.
            </span>
          </p>
        </div>
      )}

      {/* 20 · rotating one-liners */}
      <LyricsTicker />

      {/* 40 · playlist */}
      <PlaylistPanel
        open={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        playlist={player.playlist}
        currentIndex={player.currentIndex}
        isPlaying={player.isPlaying}
        isLoading={player.isLoadingPlaylist}
        onSelect={handleSelectTrack}
      />

      {/* 30 · player */}
      <PlayerBar
        isReady={player.isReady}
        isPlaying={player.isPlaying}
        isBuffering={player.isBuffering}
        isShuffled={player.isShuffled}
        isLoadingPlaylist={player.isLoadingPlaylist}
        playlistConfigured={player.playlistConfigured}
        apiError={player.apiError}
        currentTitle={player.currentTitle}
        currentAuthor={player.currentAuthor}
        currentThumbnail={player.currentThumbnail}
        currentVideoId={player.currentVideoId}
        currentTime={player.currentTime}
        duration={player.duration}
        onTogglePlay={player.togglePlay}
        onNext={player.next}
        onPrevious={player.previous}
        onToggleShuffle={player.toggleShuffle}
        onSeekRatio={player.seekToRatio}
        onScrubbing={player.setScrubbing}
        onTogglePlaylist={() => setPlaylistOpen((v) => !v)}
        playlistOpen={playlistOpen}
      />

      {/* 40 · horn */}
      <HornButton onHonk={handleHonk} />

      {/* Hidden YouTube IFrame player.
          visibility:hidden + zero size (never display:none — that breaks
          playback in some browsers). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          overflow: 'hidden',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div id="yt-player" />
      </div>
    </div>
  )
}
