import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/**
 * NOTE: StrictMode is intentionally omitted.
 * React 18 StrictMode double-invokes effects in development, which creates and
 * destroys the YouTube IFrame player twice and leaves playback in a broken
 * state. The player lifecycle is already guarded, but skipping StrictMode keeps
 * the dev experience identical to production.
 */
createRoot(document.getElementById('root')).render(<App />)
