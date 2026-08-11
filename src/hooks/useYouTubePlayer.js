import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PLAYLIST_ID, YT_DATA_API_KEY, timings } from '../lib/theme'

/* ==========================================================================
 *  useYouTubePlayer — ALL YouTube IFrame Player API logic lives here.
 *
 *  The native player is a hidden 1x1 iframe (visibility:hidden, NOT
 *  display:none — display:none breaks playback in several browsers). Every
 *  control in the UI is wired to the player instance methods below.
 * ======================================================================== */

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
}

/** Single shared promise so the API script is only ever injected once. */
let apiPromise = null

function loadIframeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('YouTube IFrame API did not load (network or blocker?)')),
      15000,
    )

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous()
      window.clearTimeout(timeout)
      resolve(window.YT)
    }

    if (!document.querySelector(`script[src="${IFRAME_API_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = IFRAME_API_SRC
      script.async = true
      script.onerror = () => {
        window.clearTimeout(timeout)
        reject(new Error('Failed to fetch the YouTube IFrame API script'))
      }
      document.head.appendChild(script)
    }
  })

  return apiPromise
}

export const thumbFor = (videoId, quality = 'hqdefault') =>
  videoId ? `https://i.ytimg.com/vi/${videoId}/${quality}.jpg` : ''

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Optional richer metadata for the WHOLE playlist via YouTube Data API v3.
 * Returns a Map<videoId, { title, author, thumbnail }> or null.
 */
async function fetchPlaylistMetadata(playlistId, apiKey) {
  if (!apiKey || !playlistId) return null
  const byId = new Map()
  let pageToken = ''
  let guard = 0

  try {
    do {
      const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
      url.searchParams.set('part', 'snippet,contentDetails')
      url.searchParams.set('maxResults', '50')
      url.searchParams.set('playlistId', playlistId)
      url.searchParams.set('key', apiKey)
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Data API ${res.status}`)
      const json = await res.json()

      for (const item of json.items || []) {
        const id = item?.contentDetails?.videoId
        if (!id) continue
        const snip = item.snippet || {}
        byId.set(id, {
          title: snip.title && snip.title !== 'Private video' ? snip.title : null,
          author: snip.videoOwnerChannelTitle || snip.channelTitle || null,
          thumbnail:
            snip.thumbnails?.medium?.url ||
            snip.thumbnails?.high?.url ||
            snip.thumbnails?.default?.url ||
            null,
        })
      }

      pageToken = json.nextPageToken || ''
      guard += 1
    } while (pageToken && guard < 8) // up to 400 items
    return byId
  } catch (err) {
    // Graceful degradation — IFrame-API-only data is perfectly usable.
    console.warn('[Auto Wala] Data API v3 metadata unavailable:', err.message)
    return null
  }
}

/**
 * KEY-FREE metadata for a single video via YouTube's oEmbed endpoint, which
 * sends permissive CORS headers so it can be called straight from the browser.
 *
 * This is what lets the playlist panel show real titles without anyone having
 * to register for a Data API key. A non-2xx response is also a useful signal:
 * it means the video is private, deleted, or has embedding disabled by the
 * uploader — i.e. it will not play, so we can grey the row out instead of
 * silently skipping it later.
 */
const OEMBED_CONCURRENCY = 6

async function fetchOEmbedMeta(videoId, signal) {
  const target = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)
  const url = `https://www.youtube.com/oembed?url=${target}&format=json`
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return { unavailable: true }
    const json = await res.json()
    return {
      title: json.title || null,
      author: json.author_name || null,
      thumbnail: json.thumbnail_url || null,
      unavailable: false,
    }
  } catch (err) {
    if (err.name === 'AbortError') return null
    return null // network hiccup — keep the placeholder, don't mark it dead
  }
}

export function useYouTubePlayer({ containerId = 'yt-player', playlistId = PLAYLIST_ID } = {}) {
  const playerRef = useRef(null)
  const pollRef = useRef(null)
  const metaRef = useRef(new Map()) // videoId -> { title, author, thumbnail }
  const destroyedRef = useRef(false)
  const scrubbingRef = useRef(false)

  const [apiError, setApiError] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentVideoId, setCurrentVideoId] = useState(null)
  const [currentTitle, setCurrentTitle] = useState('')
  const [currentAuthor, setCurrentAuthor] = useState('')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoIds, setVideoIds] = useState([])
  const [metaVersion, setMetaVersion] = useState(0)

  const playlistConfigured =
    Boolean(playlistId) && playlistId !== 'PASTE_YOUR_YOUTUBE_PLAYLIST_ID_HERE'

  /* ---------------------------------------------------------------- helpers */

  const safeCall = useCallback((method, ...args) => {
    const p = playerRef.current
    if (!p || typeof p[method] !== 'function') return undefined
    try {
      return p[method](...args)
    } catch (err) {
      console.warn(`[Auto Wala] player.${method}() failed:`, err)
      return undefined
    }
  }, [])

  /** Pull title/author for whatever is playing right now and cache it. */
  const syncNowPlaying = useCallback(() => {
    const data = safeCall('getVideoData') || {}
    const id = data.video_id || null
    const idx = safeCall('getPlaylistIndex')

    if (typeof idx === 'number' && idx >= 0) setCurrentIndex(idx)

    if (id) {
      setCurrentVideoId(id)
      const cached = metaRef.current.get(id) || {}
      const title = data.title || cached.title || ''
      const author = data.author || cached.author || ''
      if (title || author) {
        metaRef.current.set(id, {
          title: title || cached.title || null,
          author: author || cached.author || null,
          thumbnail: cached.thumbnail || null,
        })
        setMetaVersion((v) => v + 1)
      }
      setCurrentTitle(title)
      setCurrentAuthor(author)
    }

    const dur = safeCall('getDuration')
    if (Number.isFinite(dur) && dur > 0) setDuration(dur)
  }, [safeCall])

  /** getPlaylist() can be briefly null right after onReady — retry politely. */
  const hydratePlaylist = useCallback(
    (attempt = 0) => {
      if (destroyedRef.current) return
      const list = safeCall('getPlaylist')
      if (Array.isArray(list) && list.length) {
        // Keep the same array identity when the contents haven't changed —
        // getPlaylist() hands back a fresh array on every state change and we
        // don't want that re-triggering the metadata hydration effect.
        setVideoIds((prev) =>
          prev.length === list.length && prev.every((id, i) => id === list[i]) ? prev : list,
        )
        return
      }
      if (attempt < 20) window.setTimeout(() => hydratePlaylist(attempt + 1), 300)
    },
    [safeCall],
  )

  /* --------------------------------------------------------- progress poller */

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = window.setInterval(() => {
      if (scrubbingRef.current) return
      const t = safeCall('getCurrentTime')
      const d = safeCall('getDuration')
      if (Number.isFinite(t)) setCurrentTime(t)
      if (Number.isFinite(d) && d > 0) setDuration((prev) => (Math.abs(prev - d) > 0.5 ? d : prev))
    }, timings.progressPoll)
  }, [safeCall, stopPolling])

  /* ------------------------------------------------------------- player init */

  useEffect(() => {
    destroyedRef.current = false
    let cancelled = false

    if (!playlistConfigured) {
      setApiError('missing-playlist')
      return () => {}
    }

    loadIframeApi()
      .then((YT) => {
        if (cancelled || destroyedRef.current) return
        const host = document.getElementById(containerId)
        if (!host) {
          setApiError('The hidden player container is missing from the DOM.')
          return
        }

        playerRef.current = new YT.Player(containerId, {
          height: '0',
          width: '0',
          playerVars: {
            listType: 'playlist',
            list: playlistId,
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (destroyedRef.current) return
              setIsReady(true)
              safeCall('setLoop', true)
              hydratePlaylist()
              syncNowPlaying()

              // Optional: full metadata for every row up front.
              fetchPlaylistMetadata(playlistId, YT_DATA_API_KEY).then((map) => {
                if (!map || destroyedRef.current) return
                map.forEach((value, id) => {
                  const prev = metaRef.current.get(id) || {}
                  metaRef.current.set(id, {
                    title: value.title || prev.title || null,
                    author: value.author || prev.author || null,
                    thumbnail: value.thumbnail || prev.thumbnail || null,
                  })
                })
                setMetaVersion((v) => v + 1)
              })
            },

            onStateChange: (event) => {
              if (destroyedRef.current) return
              const state = event.data

              setIsBuffering(state === YT_STATE.BUFFERING)

              if (state === YT_STATE.PLAYING) {
                setIsPlaying(true)
                setHasStarted(true)
                startPolling()
              } else {
                setIsPlaying(false)
                if (state !== YT_STATE.BUFFERING) stopPolling()
              }

              if (state === YT_STATE.ENDED) setCurrentTime(0)

              if (
                state === YT_STATE.PLAYING ||
                state === YT_STATE.CUED ||
                state === YT_STATE.BUFFERING ||
                state === YT_STATE.UNSTARTED
              ) {
                syncNowPlaying()
                hydratePlaylist()
              }
            },

            onError: (event) => {
              // 2 invalid param · 5 html5 · 100/101/150 unavailable-or-restricted
              const code = event?.data
              console.warn('[Auto Wala] YouTube player error', code)
              if (code === 2 || code === 5) {
                setApiError('This playlist could not be loaded. Double-check PLAYLIST_ID.')
              } else {
                // Restricted/removed video — skip to the next one.
                safeCall('nextVideo')
              }
            },
          },
        })
      })
      .catch((err) => {
        if (!cancelled) setApiError(err.message)
      })

    return () => {
      cancelled = true
      destroyedRef.current = true
      stopPolling()
      const p = playerRef.current
      playerRef.current = null
      if (p && typeof p.destroy === 'function') {
        try {
          p.destroy()
        } catch {
          /* noop */
        }
      }
    }
  }, [
    containerId,
    playlistId,
    playlistConfigured,
    hydratePlaylist,
    safeCall,
    startPolling,
    stopPolling,
    syncNowPlaying,
  ])

  /* ------------------------------------------------- key-free title hydration
   * Once we know the video IDs, resolve real titles/channels for any row the
   * Data API didn't already cover. Runs 6-at-a-time and flushes to state in
   * small batches so rows fill in progressively instead of in one late jump.
   */
  useEffect(() => {
    if (!videoIds.length) return undefined

    const missing = videoIds.filter((id) => {
      const meta = metaRef.current.get(id)
      return !meta || (!meta.title && meta.unavailable === undefined)
    })
    if (!missing.length) return undefined

    const controller = new AbortController()
    let cancelled = false
    let sinceFlush = 0

    const flush = () => {
      if (!cancelled) setMetaVersion((v) => v + 1)
    }

    const worker = async (queue) => {
      while (queue.length && !cancelled) {
        const id = queue.shift()
        const meta = await fetchOEmbedMeta(id, controller.signal)
        if (cancelled || !meta) continue

        const prev = metaRef.current.get(id) || {}
        metaRef.current.set(id, {
          title: meta.title || prev.title || null,
          author: meta.author || prev.author || null,
          thumbnail: prev.thumbnail || meta.thumbnail || null,
          unavailable: meta.unavailable,
        })

        sinceFlush += 1
        if (sinceFlush >= 4) {
          sinceFlush = 0
          flush()
        }
      }
    }

    const queue = [...missing]
    Promise.all(Array.from({ length: OEMBED_CONCURRENCY }, () => worker(queue))).then(flush)

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [videoIds])

  /* Pause the poller while the tab is hidden — no point burning cycles. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopPolling()
      else if (isPlaying) startPolling()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [isPlaying, startPolling, stopPolling])

  useEffect(() => stopPolling, [stopPolling])

  /* ---------------------------------------------------------------- controls */

  const play = useCallback(() => safeCall('playVideo'), [safeCall])
  const pause = useCallback(() => safeCall('pauseVideo'), [safeCall])

  const togglePlay = useCallback(() => {
    if (isPlaying) safeCall('pauseVideo')
    else safeCall('playVideo')
  }, [isPlaying, safeCall])

  const next = useCallback(() => {
    setCurrentTime(0)
    safeCall('nextVideo')
  }, [safeCall])

  const previous = useCallback(() => {
    // Standard music-player behaviour: restart the track if we're >3s in.
    const t = safeCall('getCurrentTime')
    if (Number.isFinite(t) && t > 3) {
      safeCall('seekTo', 0, true)
      setCurrentTime(0)
      return
    }
    setCurrentTime(0)
    safeCall('previousVideo')
  }, [safeCall])

  const playAt = useCallback(
    (index) => {
      setCurrentTime(0)
      setCurrentIndex(index)
      safeCall('playVideoAt', index)
      // playVideoAt only cues in some states; nudge playback along.
      window.setTimeout(() => safeCall('playVideo'), 60)
    },
    [safeCall],
  )

  const toggleShuffle = useCallback(() => {
    setIsShuffled((prev) => {
      const nextValue = !prev
      safeCall('setShuffle', nextValue)
      return nextValue
    })
  }, [safeCall])

  const seekTo = useCallback(
    (seconds) => {
      const clamped = Math.max(0, Math.min(seconds, duration || seconds))
      setCurrentTime(clamped)
      safeCall('seekTo', clamped, true)
    },
    [duration, safeCall],
  )

  const seekToRatio = useCallback(
    (ratio) => {
      if (!duration) return
      seekTo(Math.max(0, Math.min(1, ratio)) * duration)
    },
    [duration, seekTo],
  )

  /** Called by the progress bar so polling doesn't fight the drag. */
  const setScrubbing = useCallback(
    (value, previewSeconds) => {
      scrubbingRef.current = value
      if (value && Number.isFinite(previewSeconds)) setCurrentTime(previewSeconds)
    },
    [],
  )

  /* ------------------------------------------------------------- derived data */

  const playlist = useMemo(() => {
    void metaVersion // recompute when the metadata cache grows
    return videoIds.map((id, index) => {
      const meta = metaRef.current.get(id) || {}
      return {
        id,
        index,
        title: meta.title || `Track ${index + 1}`,
        author: meta.author || 'YouTube',
        thumbnail: meta.thumbnail || thumbFor(id, 'mqdefault'),
        hasRealTitle: Boolean(meta.title),
        /** true = private / deleted / embedding disabled → it will not play */
        unavailable: meta.unavailable === true,
      }
    })
  }, [videoIds, metaVersion])

  const currentThumbnail = useMemo(() => {
    if (!currentVideoId) return ''
    const meta = metaRef.current.get(currentVideoId)
    return meta?.thumbnail || thumbFor(currentVideoId)
  }, [currentVideoId, metaVersion])

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  const displayTitle =
    currentTitle || (playlist[currentIndex]?.hasRealTitle ? playlist[currentIndex].title : '')

  return {
    // status
    isReady,
    isPlaying,
    isBuffering,
    hasStarted,
    isShuffled,
    apiError,
    playlistConfigured,
    isLoadingPlaylist: playlistConfigured && !apiError && playlist.length === 0,

    // now playing
    currentIndex,
    currentVideoId,
    currentTitle: displayTitle,
    currentAuthor: currentAuthor || playlist[currentIndex]?.author || '',
    currentThumbnail,
    duration,
    currentTime,
    progress,

    // list
    playlist,

    // controls
    play,
    pause,
    togglePlay,
    next,
    previous,
    playAt,
    toggleShuffle,
    seekTo,
    seekToRatio,
    setScrubbing,
  }
}
