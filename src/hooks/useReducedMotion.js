import { useEffect, useState } from 'react'

/** Tracks the OS-level `prefers-reduced-motion` setting, live. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event) => setReduced(event.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Cheap capability probe for the WebGL ambient layer.
 * Returns false for: no WebGL context, or obviously low-end hardware.
 * Callers fall back to the static CSS gradient painted on <body>.
 */
export function detectWebglCapability() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    if (!gl) return false
    if (typeof gl.getExtension === 'function') gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    return false
  }

  const cores = navigator.hardwareConcurrency
  if (typeof cores === 'number' && cores > 0 && cores <= 2) return false

  return true
}
