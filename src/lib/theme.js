/* ==========================================================================
 *  ऑटो वाला · AUTO WALA — CONFIG
 * ==========================================================================
 *
 *  1. Paste your YouTube *playlist* ID below. If you have a playlist URL like
 *     https://www.youtube.com/playlist?list=PLabc123XYZ
 *     then the ID is the part after `list=`  →  "PLabc123XYZ"
 *
 *  2. YT_DATA_API_KEY is genuinely OPTIONAL — you almost certainly don't need
 *     it. Real titles, channel names and artwork for every row are resolved
 *     key-free through YouTube's CORS-enabled oEmbed endpoint (which also
 *     tells us up front which tracks refuse to embed, so they can be greyed
 *     out instead of silently skipped).
 *     A Data API v3 key only buys you: the whole playlist in ONE request
 *     instead of one per track. Nice for 100+ item playlists, pointless for
 *     small ones. Prefer an env var:  VITE_YT_DATA_API_KEY
 * ======================================================================== */

/** "Indie India Spotify Playlist — Best Indie Artists India" · 40 tracks */
export const PLAYLIST_ID = 'PL1gfuz7ZYcaM2Z7sCGOWORCF0CGmonzOv'

export const YT_DATA_API_KEY = import.meta.env?.VITE_YT_DATA_API_KEY || '' // optional

/* ------------------------------------------------------------------------ */

/** Colour tokens — mirrors the CSS custom properties in index.css.
 *  Sunset-on-the-highway: blue sky at the top, crimson band low, black road. */
export const colors = {
  sky: '#1b3f75',
  sky2: '#24406e',
  dusk: '#33305e',
  wine: '#5b1b3e',
  crimson: '#b3212b',
  crimsonDark: '#8d1a22',
  deep: '#3d0a11',
  road: '#0b0407',
  sun: '#e86034',
  cream: '#F5F1E8',
  creamDim: '#D8D2C4',
  live: '#3CFF7A',
  autoYellow: '#FFC72C',
  autoBlack: '#111111',
}

/** Warm tones fed into the WebGL particle field — kept close to the sunset so
 *  the dust reads as haze, not as confetti. */
export const particlePalette = ['#f5f1e8', '#e86034', '#b3212b', '#d8d2c4']

export const timings = {
  /** Master entrance choreography (seconds). */
  intro: 1.6,
  /** Lyrics ticker rotation interval (ms). */
  tickerInterval: 5500,
  /** Progress polling cadence (ms). */
  progressPoll: 250,
  /** Ambient status counter tick (ms). */
  counterTick: 4200,
}

/**
 * Path to the SUPPLIED auto-rickshaw PNG (transparent background).
 * Swap this for your own export any time — see public/assets/README.txt for
 * the trim/geometry notes the layout relies on.
 */
export const RICKSHAW_SRC = '/assets/Auto.png'

/** Optional real horn sample; falls back to a synthesised honk if missing. */
export const HORN_SRC = '/assets/horn.mp3'

/** Rickshaw-driver one-liners for the ticker. */
export const TICKER_LINES = [
  'हॉर्न ओके प्लीज़ — पीछे वाला भी गाना सुन रहा है',
  'बुरी नज़र वाले तेरे बच्चे खुश रहें',
  'मीटर डाउन, वॉल्यूम अप',
  'तीन पहिये, चार सुर, पूरा शहर अपना',
  'ब्रेक फेल है, बस बीट चल रही है',
  'सीट बेल्ट नहीं है, भरोसा है',
  'शॉर्टकट नहीं लेते, अच्छे गाने लेते हैं',
  'चलती है ऑटो, उड़ते हैं गाने',
  'अगला मोड़ — सुनहरी शाम की तरफ़',
  'भाईसाहब, थोड़ा एडजस्ट कर लो — बास तेज़ है',
]

/** Flavour text for the status pill. */
export const STATUS_LABEL = 'listening now'
