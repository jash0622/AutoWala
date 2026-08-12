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
 * Returns false for: no WebGL context, obviously low-end hardware, or devices
 * that would trigger a "major performance caveat" (integrated GPU fallback).
 * Callers fall back to the static CSS gradient painted on <body>.
 */
export function detectWebglCapability() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const opts = { failIfMajorPerformanceCaveat: true }
    const gl =
      canvas.getContext('webgl2', opts) ||
      canvas.getContext('webgl', opts) ||
      canvas.getContext('experimental-webgl', opts)
    if (!gl) return false

    // Check if the GPU can actually compile a trivial shader — some mobile
    // browsers report context support but fail silently at compile time.
    const vs = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vs, 'void main(){gl_Position=vec4(0);}')
    gl.compileShader(vs)
    const ok = gl.getShaderParameter(vs, gl.COMPILE_STATUS)
    gl.deleteShader(vs)
    if (!ok) return false

    if (typeof gl.getExtension === 'function') gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    return false
  }

  const cores = navigator.hardwareConcurrency
  if (typeof cores === 'number' && cores > 0 && cores <= 2) return false

  // On mobile, the GPU driver often survives these checks but the compositor
  // can't sustain the frame budget → result is a black rectangle. Be
  // conservative: skip WebGL on mobile (touch-only, narrow viewport).
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches &&
    window.innerWidth < 768
  if (isMobile) return false

  return true
}
