/* ==========================================================================
 *  Firebase Realtime Database — presence system for live listener count.
 *
 *  How it works:
 *    1. Each tab writes its unique ID to /presence/{tabId} with onDisconnect
 *       set to remove it automatically when the connection drops.
 *    2. A listener on /presence counts the children → that's the live total.
 *    3. Firebase RTDB handles cross-device, cross-browser, cross-network
 *       synchronisation out of the box — no WebSocket server needed.
 *
 *  Free tier (Spark): 100 simultaneous connections, 1 GB stored, 10 GB/month
 *  transferred. More than enough for a personal project.
 * ======================================================================== */

import { initializeApp } from 'firebase/app'
import {
  getDatabase,
  ref,
  set,
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

/** Reference to the presence node — each child is one active tab. */
export const presenceRef = ref(db, 'presence')

/**
 * Register this tab as "present". Firebase's onDisconnect guarantees cleanup
 * even if the user closes the tab, loses network, or the browser crashes.
 *
 * Returns an unsubscribe function to call on unmount.
 */
export function registerPresence() {
  const tabId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const myRef = ref(db, `presence/${tabId}`)

  // Write our entry
  set(myRef, { t: serverTimestamp() })

  // Tell Firebase to remove it when we disconnect
  onDisconnect(myRef).remove()

  // Also handle explicit tab close (belt + suspenders)
  const cleanup = () => {
    try {
      // Use sendBeacon-style removal via the REST API as a last resort
      set(myRef, null)
    } catch {
      /* noop */
    }
  }

  window.addEventListener('beforeunload', cleanup)

  return () => {
    window.removeEventListener('beforeunload', cleanup)
    set(myRef, null)
  }
}

/**
 * Subscribe to the live count of active listeners.
 * Calls `callback(count)` every time someone joins or leaves.
 * Returns an unsubscribe function.
 */
export function onPresenceCount(callback) {
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const count = snapshot.exists() ? snapshot.size : 0
    callback(count)
  })
  return unsubscribe
}
