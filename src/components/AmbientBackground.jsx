import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { particlePalette } from '../lib/theme'
import { detectWebglCapability, useReducedMotion } from '../hooks/useReducedMotion'

/* ==========================================================================
 *  AmbientBackground — full-screen WebGL layer that sits behind ALL UI.
 *
 *  Two cheap passes:
 *    1. a shader "gradient mesh" (sunset wash + slow warm blobs + highway
 *       light streaks drifting horizontally)
 *    2. a drifting warm particle field (road dust / fireflies)
 *
 *  Performance guards:
 *    · frameloop="demand" + a hand-rolled rAF driver capped at ~34fps
 *    · fully idle while document.visibilityState !== 'visible'
 *    · never mounted at all when WebGL is missing, hardware looks low-end,
 *      or the user prefers reduced motion — the CSS gradient on <body>
 *      is the fallback and is always present underneath
 * ======================================================================== */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Sunset-on-the-highway wash, reverse-engineered from the reference:
 * blue sky at the top → deep wine → a bright crimson band around 28% up →
 * a hard, near-black road strip along the bottom, with a soft low sun sitting
 * left of centre. No light streaks, no orange: the reference has neither, and
 * both were what made the first pass look loud.
 */
const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform float uAspect;
  uniform vec3  uSky;
  uniform vec3  uDusk;
  uniform vec3  uWine;
  uniform vec3  uCrimson;
  uniform vec3  uDeep;
  uniform vec3  uRoad;
  uniform vec3  uSun;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vec2 uv = vUv;          // uv.y: 0 = bottom of screen, 1 = top
    float y = uv.y;

    // ---- vertical stack, built from the road upwards --------------------
    vec3 col = uRoad;
    col = mix(col, uDeep,    smoothstep(0.020, 0.095, y));
    col = mix(col, uCrimson, smoothstep(0.095, 0.270, y));
    col = mix(col, uWine,    smoothstep(0.340, 0.575, y));
    col = mix(col, uDusk,    smoothstep(0.575, 0.790, y));
    col = mix(col, uSky,     smoothstep(0.790, 1.000, y));

    // ---- low sun, left of centre ---------------------------------------
    vec2 sunPos = vec2(0.17, 0.36);
    float d = length((uv - sunPos) * vec2(uAspect, 1.0));
    col += uSun * smoothstep(0.135, 0.0, d) * 0.50;   // disc
    col += uSun * smoothstep(0.340, 0.0, d) * 0.09;   // halo

    // ---- warm bloom low-centre (lifts the crimson band) -----------------
    vec2 bc = (uv - vec2(0.46, 0.24)) * vec2(uAspect * 0.8, 1.6);
    col += uCrimson * exp(-dot(bc, bc) * 2.2) * 0.22;

    // ---- very slow organic drift so it never looks like a flat gradient --
    float t = uTime * 0.028;
    vec2 p = vec2(uv.x * uAspect, uv.y);
    float blob = noise(p * 1.5 + vec2(t, -t * 0.65));
    blob += 0.5 * noise(p * 3.1 - vec2(t * 1.2, t));
    blob /= 1.5;
    col = mix(col, uCrimson, smoothstep(0.58, 1.0, blob) * 0.10);
    col *= 1.0 - smoothstep(0.50, 0.0, blob) * 0.055;

    // ---- keep the road strip crisp under all of the above ---------------
    col = mix(col, uRoad, smoothstep(0.075, 0.030, y));

    // ---- gentle vignette + dither to kill banding ------------------------
    vec2 c = uv - 0.5;
    col *= 1.0 - dot(c, c) * 0.30;
    col += (hash(uv * 1024.0 + uTime) - 0.5) * 0.014;

    gl_FragColor = vec4(col, 1.0);
  }
`

/** Drives renders at a capped frame rate; completely idle on hidden tabs. */
function CappedFrameDriver({ fps = 34, active = true }) {
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    invalidate() // always paint at least one static frame
    if (!active) return undefined

    let raf = 0
    let last = 0
    const interval = 1000 / fps

    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      if (document.visibilityState !== 'visible') return
      if (now - last < interval) return
      last = now
      invalidate()
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, fps, invalidate])

  return null
}

function GradientMesh({ active }) {
  const materialRef = useRef(null)
  const { viewport, size } = useThree()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uSky: { value: new THREE.Color('#1b3f75') },
      uDusk: { value: new THREE.Color('#33305e') },
      uWine: { value: new THREE.Color('#5b1b3e') },
      uCrimson: { value: new THREE.Color('#b3212b') },
      uDeep: { value: new THREE.Color('#3d0a11') },
      uRoad: { value: new THREE.Color('#0b0407') },
      uSun: { value: new THREE.Color('#e86034') },
    }),
    [],
  )

  useEffect(() => {
    uniforms.uAspect.value = size.width / Math.max(1, size.height)
  }, [size.width, size.height, uniforms])

  useFrame((state, delta) => {
    if (!materialRef.current || !active) return
    // Clamp delta so a backgrounded tab can't fast-forward the animation.
    uniforms.uTime.value += Math.min(delta, 0.05)
  })

  return (
    <mesh scale={[viewport.width, viewport.height, 1]} position={[0, 0, -2]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
      />
    </mesh>
  )
}

function DustField({ active, count = 420 }) {
  const pointsRef = useRef(null)
  const { viewport } = useThree()

  const { positions, colors, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const spd = new Float32Array(count)
    const palette = particlePalette.map((hex) => new THREE.Color(hex))

    for (let i = 0; i < count; i += 1) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 2.4
      pos[i * 3 + 1] = (Math.random() - 0.5) * 2.4
      pos[i * 3 + 2] = Math.random() * 0.6 - 0.3

      const c = palette[Math.floor(Math.random() * palette.length)]
      const shade = 0.45 + Math.random() * 0.55
      col[i * 3 + 0] = c.r * shade
      col[i * 3 + 1] = c.g * shade
      col[i * 3 + 2] = c.b * shade

      spd[i] = 0.012 + Math.random() * 0.05
    }
    return { positions: pos, colors: col, speeds: spd }
  }, [count])

  useFrame((state, delta) => {
    const mesh = pointsRef.current
    if (!mesh || !active) return
    const d = Math.min(delta, 0.05)
    const array = mesh.geometry.attributes.position.array
    const t = state.clock.elapsedTime

    for (let i = 0; i < count; i += 1) {
      const iy = i * 3 + 1
      array[iy] += speeds[i] * d
      // gentle lateral sway so it reads as floating dust, not rain
      array[i * 3] += Math.sin(t * 0.4 + i) * 0.00035
      if (array[iy] > 1.25) {
        array[iy] = -1.25
        array[i * 3] = (Math.random() - 0.5) * 2.4
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true
  })

  // positions live in -1.2…1.2, so 0.42 × viewport maps them just past the edges
  const scaleX = viewport.width * 0.42
  const scaleY = viewport.height * 0.42

  return (
    <points ref={pointsRef} scale={[scaleX, scaleY, 1]} position={[0, 0, -1]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.03}
        sizeAttenuation
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function AmbientBackground({ active = true }) {
  const prefersReduced = useReducedMotion()
  const [capable, setCapable] = useState(null)

  useEffect(() => {
    setCapable(detectWebglCapability())
  }, [])

  // Fallback: the animated CSS gradient already painted on <body>, plus a
  // slow-drifting warm glow so it never looks completely dead.
  if (prefersReduced || capable === false) {
    return (
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className={`absolute -inset-1/4 ${prefersReduced ? '' : 'bg-drift'}`}
          style={{
            background:
              'radial-gradient(40% 28% at 46% 76%, rgba(196,44,44,0.34), transparent 72%), radial-gradient(22% 18% at 17% 64%, rgba(232,96,52,0.22), transparent 70%)',
          }}
        />
      </div>
    )
  }

  if (capable === null) {
    return <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <Canvas
        frameloop="demand"
        orthographic
        camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'low-power',
          preserveDrawingBuffer: false,
        }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <CappedFrameDriver active={active} fps={34} />
        <GradientMesh active={active} />
        <DustField active={active} />
      </Canvas>
    </div>
  )
}
