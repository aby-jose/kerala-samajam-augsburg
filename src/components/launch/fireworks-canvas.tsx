"use client";

import { useEffect, useRef } from "react";

type Kind = "shell" | "spark" | "flash";

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  /** How far the spark keeps falling: willows droop, crackles hang. */
  gravity: number;
  /** Air resistance per frame. */
  drag: number;
  /** How many past positions the spark keeps for its tail. */
  tailLen: number;
  /** Core radius. */
  size: number;
  /** Twinkle strength once past half-life, 0–1. */
  twinkle: number;
  /** Shells only: the shape they burst into, and where. */
  bloom?: Bloom;
  targetY?: number;
  /** The last few positions, oldest first — the tail is drawn through them. */
  trail: number[];
}

/**
 * The kinds of bloom a shell can open into. Each is a different firework
 * the way a real display has different fireworks, and the difference is
 * in the physics, not just the colour: how many sparks, how fast, how much
 * they fall, how long they live, how much tail they draw.
 */
type Bloom = "peony" | "chrysanthemum" | "willow" | "crackle" | "ring";

/**
 * Two-tone shells: a body and a highlight, most sparks in the body. Warm
 * golds and corals carry the house palette; the teal, sky and lilac are
 * there because a display in one colour family is a screensaver, and cool
 * sparks crossing warm ones go white-hot under additive drawing.
 */
const SHELLS: [string, string][] = [
  ["#FFD166", "#FFF6DC"],
  ["#FFB347", "#FFE9B8"],
  ["#FF6B86", "#FFC2CD"],
  ["#FF4D8D", "#FFD1E3"],
  ["#4FD1C5", "#CFFAF5"],
  ["#7DD3FC", "#E0F2FE"],
  ["#C4B5FD", "#EDE9FE"],
  ["#F9C846", "#FF7A93"],
];

/** Willows are always gold: a gold willow is the firework everyone remembers. */
const WILLOW: [string, string] = ["#FFC94D", "#FFF1C2"];

/** A ceiling on live sparks, so a busy sky never costs the projector a frame. */
const MAX_PARTICLES = 2200;

/**
 * Fireworks over the stage, running for as long as they are told to.
 *
 * They begin the moment the site lights on the glass and keep launching:
 * full-throated through the celebration, then quieter for as long as the
 * site is on stage, so the screen is never a still picture.
 *
 * The canvas fills whatever box it is put in — the parent clips it to the
 * opening, so a shell never crosses the cloth. It sits IN FRONT of the stage
 * content: the sparks are additive, so over the site they read as light on
 * the picture, and over the white of the code they vanish — a white pixel
 * cannot get lighter — which is why the code still scans.
 *
 * Five blooms, chosen at launch with the crowd-pleasers weighted up: peonies
 * and chrysanthemums most of the time, a gold willow now and then, a crackle
 * for texture, the odd clean ring. Every burst opens with a flash — a large,
 * fast-fading halo — because that is what the eye actually sees at the
 * instant a shell breaks, and without it a burst is sparks appearing from
 * nowhere.
 *
 * Tails are drawn EXPLICITLY, from a short history each spark keeps, and the
 * canvas is cleared every frame. The cheaper way — never clearing, and
 * painting a translucent black over everything each frame so the residue is
 * the tail — leaves a ghost: eight-bit alpha never quite reaches zero under
 * repeated multiplication, and every burst left a faint grey print of itself
 * on the stage that never went away. The hall saw smoke that was not there.
 */
export function FireworksCanvas({
  active,
  intensity = 1,
}: {
  active: boolean;
  /** 1 for the celebration; lower for the quieter runs before and after. */
  intensity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Held in a ref so changing intensity never restarts the animation. Written
  // in an effect rather than during render: a ref mutated mid-render is a
  // render side effect, and React's rules flag it for good reason.
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    const ctx: CanvasRenderingContext2D = c;
    const host = canvas.parentElement ?? document.body;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = (canvas.width = host.clientWidth);
    let height = (canvas.height = host.clientHeight);
    const onResize = () => {
      width = canvas.width = host.clientWidth;
      height = canvas.height = host.clientHeight;
    };
    window.addEventListener("resize", onResize);

    const parts: Particle[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function pickBloom(): Bloom {
      const r = Math.random();
      if (r < 0.34) return "peony";
      if (r < 0.62) return "chrysanthemum";
      if (r < 0.78) return "willow";
      if (r < 0.9) return "crackle";
      return "ring";
    }

    function launch() {
      if (parts.length > MAX_PARTICLES) return;
      const bloom = pickBloom();
      const [body] = bloom === "willow" ? WILLOW : SHELLS[Math.floor(Math.random() * SHELLS.length)];
      parts.push({
        kind: "shell",
        x: width * rand(0.12, 0.88),
        y: height + 10,
        vx: rand(-0.5, 0.5),
        vy: -rand(8.5, 11.5),
        life: 1,
        decay: 0,
        color: body,
        gravity: 0.13,
        drag: 1,
        tailLen: 7,
        size: 2.2,
        twinkle: 0,
        bloom,
        // Willows want height to hang from; crackles sit lower and closer.
        targetY: height * (bloom === "willow" ? rand(0.08, 0.22) : rand(0.1, 0.42)),
        trail: [],
      });
    }

    function burst(shell: Particle) {
      const { x, y, bloom = "peony" } = shell;
      const pair = bloom === "willow" ? WILLOW : SHELLS.find((s) => s[0] === shell.color) ?? SHELLS[0];

      // The flash: what the eye sees at the instant the shell breaks.
      parts.push({
        kind: "flash",
        x, y, vx: 0, vy: 0,
        life: 1,
        decay: bloom === "willow" ? 0.09 : 0.14,
        color: pair[1],
        gravity: 0, drag: 1, tailLen: 0,
        size: bloom === "crackle" ? 26 : 40,
        twinkle: 0,
        trail: [],
      });

      // Each bloom's physics. Uniform angles keep the shape legible from the
      // back of a hall; the jitter stops it looking like a clip-art asterisk.
      const spec = {
        peony:         { n: rand(70, 100),  speed: rand(2.6, 4.6), spread: 0.65, gravity: 0.03,  drag: 0.985, decay: [0.007, 0.014], tail: 6,  size: 1.9, twinkle: 0.4, jitter: 0.12 },
        chrysanthemum: { n: rand(90, 130),  speed: rand(3.0, 5.0), spread: 0.6,  gravity: 0.035, drag: 0.988, decay: [0.005, 0.009], tail: 11, size: 1.7, twinkle: 0.3, jitter: 0.1 },
        willow:        { n: rand(60, 85),   speed: rand(2.0, 3.2), spread: 0.5,  gravity: 0.062, drag: 0.992, decay: [0.0028, 0.0045], tail: 16, size: 1.6, twinkle: 0.25, jitter: 0.08 },
        crackle:       { n: rand(110, 150), speed: rand(1.6, 4.6), spread: 0.9,  gravity: 0.03,  drag: 0.982, decay: [0.01, 0.022], tail: 2,  size: 1.5, twinkle: 1,    jitter: 0.5 },
        ring:          { n: rand(56, 72),   speed: rand(3.6, 4.2), spread: 0.06, gravity: 0.03,  drag: 0.986, decay: [0.008, 0.012], tail: 7,  size: 1.9, twinkle: 0.3, jitter: 0 },
      }[bloom];

      const n = Math.floor(reduced ? spec.n * 0.4 : spec.n);
      const tilt = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) {
        const angle = tilt + (Math.PI * 2 * i) / n + Math.random() * spec.jitter;
        const s = spec.speed * (1 - spec.spread + Math.random() * spec.spread * 2);
        parts.push({
          kind: "spark",
          x, y,
          vx: Math.cos(angle) * s,
          vy: Math.sin(angle) * s,
          life: 1,
          decay: rand(spec.decay[0], spec.decay[1]),
          color: Math.random() < 0.72 ? pair[0] : pair[1],
          gravity: spec.gravity,
          drag: spec.drag,
          tailLen: spec.tail,
          size: spec.size,
          twinkle: spec.twinkle,
          trail: [],
        });
      }
    }

    function remember(p: Particle) {
      if (p.tailLen === 0) return;
      p.trail.push(p.x, p.y);
      if (p.trail.length > p.tailLen * 2) p.trail.splice(0, 2);
    }

    function tail(p: Particle, alpha: number, widthPx: number) {
      if (p.trail.length < 4) return;
      ctx.strokeStyle = p.color;
      ctx.lineCap = "round";
      ctx.lineWidth = widthPx;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(p.trail[0], p.trail[1]);
      for (let k = 2; k < p.trail.length; k += 2) ctx.lineTo(p.trail[k], p.trail[k + 1]);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    function head(p: Particle, alpha: number, r: number) {
      // A soft halo under a hard core is what makes a spark read as light
      // rather than as a dot.
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha * 0.18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function flash(p: Particle) {
      const r = p.size * (1.4 - p.life * 0.4);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, p.color);
      g.addColorStop(0.35, p.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.55 * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    let raf = 0;
    let sinceLaunch = 0;
    let last = 0;

    // One step of the physics, tuned for 60 steps a second. Launching is
    // counted in steps too, so the cadence is the same whatever the frame
    // rate: a projector's browser that drops to 30fps takes two steps a
    // frame and the display looks the same, only less smooth.
    function step() {
      sinceLaunch += 1;
      const gap = Math.max(12, Math.round(30 / Math.max(intensityRef.current, 0.15)));
      if (sinceLaunch >= gap) {
        sinceLaunch = 0;
        launch();
        // At full intensity, now and then two go up together.
        if (intensityRef.current >= 1 && Math.random() < 0.3) launch();
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];

        if (p.kind === "flash") {
          p.life -= p.decay;
          if (p.life <= 0) parts.splice(i, 1);
          continue;
        }

        remember(p);
        p.x += p.vx;
        p.y += p.vy;

        if (p.kind === "shell") {
          p.vy += p.gravity;
          if (p.vy >= -0.6 || (p.targetY !== undefined && p.y <= p.targetY)) {
            burst(p);
            parts.splice(i, 1);
          }
          continue;
        }

        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.life -= p.decay;
        if (p.life <= 0 || p.y > height + 40) parts.splice(i, 1);
      }
    }

    function draw() {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (const p of parts) {
        if (p.kind === "flash") {
          flash(p);
          continue;
        }
        if (p.kind === "shell") {
          tail(p, 0.55, 1.6);
          head(p, 0.95, p.size);
          continue;
        }
        // Sparks twinkle as they die: a little random flicker once past
        // half-life is the difference between embers and a fading dot.
        const flicker = p.life < 0.55 ? 1 - p.twinkle * Math.random() * 0.6 : 1;
        const a = Math.max(0, p.life) * flicker;
        tail(p, a * 0.45, 1.3);
        head(p, a, p.size);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function frame(now: number) {
      // Catch up on the steps this frame is owed, and no more than a few:
      // a tab that was asleep for a second must not detonate everything at
      // once when it wakes.
      const dt = last ? now - last : 16.7;
      last = now;
      const steps = Math.min(6, Math.max(1, Math.round(dt / 16.7)));
      for (let s = 0; s < steps; s++) step();
      draw();
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [active]);

  if (!active) return null;

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
