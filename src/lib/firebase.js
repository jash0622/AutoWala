/* ==========================================================================
 *  Firebase Realtime Database — presence system for live listener count.
 *
 *  How it works:
 *    1. We listen to `.info/connected` — Firebase's built-in connection state.
 *    2. When connected, we write our tab ID to /presence/{tabId} and set up
 *       onDisconnect to remove it when the connection drops.
 *    3. A listener on /presence counts the children → that's the live total.
 *    4. Firebase handles cross-device sync automatically.
 *
 *  Free tier (Spark): 100 simultaneous connections, 1 GB stored, 10 GB/month.
 * ======================================================================== */

import { initializeApp } from 'firebase/app'
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyA8xZLBcQuvcauJ4LfjbZorlxt4dx3Wrko',
  authDomain: 'auto-ea673.firebaseapp.com',
  databaseURL: 'https://auto-ea673-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'auto-ea673',
  storageBucket: 'auto-ea673.firebasestorage.app',
  messagingSenderId: '233311643321',
  appId: '1:233311643321:web:832f86e9a852e100bd1d68',
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

/** Reference to the presence node — each child is one active tab/device. */
const presenceRef = ref(db, 'presence')

/** Firebase's built-in connection state ref. */
const connectedRef = ref(db, '.info/connected')

/**
 * Register this tab as "present". Uses .info/connected to ensure we only
 * write when Firebase is actually connected. onDisconnect guarantees cleanup
 * even on crashes, network loss, or tab close.
 *
 * Returns an unsubscribe/cleanup function.
 */
export function registerPresence() {
  const tabId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const myRef = ref(db, `presence/${tabId}`)
  let registered = false

  // Listen to connection state — re-register every time we reconnect
  const unsubConnect = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      // We're connected (or just reconnected)

      // Set up onDisconnect FIRST (before writing) so there's no race
      onDisconnect(myRef)
        .remove()
        .then(() => {
          // Now write our presence
          set(myRef, { t: serverTimestamp() })
          registered = true
        })
        .catch(() => {
          // If onDisconnect setup fails, still try to write
          set(myRef, { t: serverTimestamp() })
          registered = true
        })
    }
  })

  // Belt + suspenders: remove on tab close
  const onUnload = () => {
    if (registered) {
      // navigator.sendBeacon doesn't work with Firebase SDK,
      // but a synchronous remove attempt helps in some browsers
      try {
        remove(myRef)
      } catch {
        /* noop */
      }
    }
  }
  window.addEventListener('beforeunload', onUnload)

  return () => {
    window.removeEventListener('beforeunload', onUnload)
    unsubConnect()
    if (registered) {
      remove(myRef)
    }
  }
}

/**
 * Subscribe to the live count of active listeners.
 * Calls `callback(count)` every time someone joins or leaves — real-time,
 * cross-device.
 * Returns an unsubscribe function.
 */
export function onPresenceCount(callback) {
  const unsubscribe = onValue(
    presenceRef,
    (snapshot) => {
      const count = snapshot.exists() ? snapshot.size : 0
      callback(count)
    },
    (error) => {
      console.warn('[Auto Wala] Firebase presence read error:', error.message)
      callback(0)
    },
  )
  return unsubscribe
}
