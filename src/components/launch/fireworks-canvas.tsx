"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  /** Shells are drawn as a bright head with a trail; sparks fade to nothing. */
  shell: boolean;
  targetY?: number;
}

/** Brand crimson, kasavu gold, cream, white — the same four as the confetti. */
const COLORS = ["#E11D48", "#D4A537", "#F5EFE6", "#FFFFFF"];

/**
 * Fireworks over the stage, running for as long as they are told to.
 *
 * Unlike the confetti — one burst, thrown at the moment the curtain clears —
 * this keeps launching. It carries the whole celebration beat and continues
 * quietly behind the showcase, so the screen the hall is scanning from is
 * never a still image.
 *
 * Sits BEHIND the stage content (z-11, under the z-12 stage): a shell that
 * bursts across the QR is a code that will not scan, and the whole point of
 * the showcase is that three hundred phones read it first time.
 *
 * Trails come from painting a translucent black rectangle over the canvas each
 * frame instead of clearing it, which is far cheaper than storing a history
 * per particle and is what gives the sparks their falling tails.
 */
export function FireworksCanvas({
  active,
  intensity = 1,
}: {
  active: boolean;
  /** 1 for the celebration; lower for the quieter run behind the showcase. */
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
    // Narrowed once here so the closures below do not each have to re-prove it.
    const ctx: CanvasRenderingContext2D = c;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const parts: Particle[] = [];

    function launch() {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const x = width * (0.12 + Math.random() * 0.76);
      const targetY = height * (0.12 + Math.random() * 0.3);
      parts.push({
        x,
        y: height + 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(9 + Math.random() * 3),
        life: 1,
        decay: 0,
        color,
        shell: true,
        targetY,
      });
    }

    function burst(x: number, y: number, color: string) {
      // A ring plus scatter: uniform angles keep the shape legible from the
      // back of a hall, the jitter stops it looking like a clip-art asterisk.
      const n = reduced ? 26 : 54 + Math.floor(Math.random() * 26);
      const speed = 2.6 + Math.random() * 2.2;
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.12;
        const s = speed * (0.55 + Math.random() * 0.65);
        parts.push({
          x,
          y,
          vx: Math.cos(angle) * s,
          vy: Math.sin(angle) * s,
          life: 1,
          decay: 0.008 + Math.random() * 0.011,
          color,
          shell: false,
        });
      }
    }

    let raf = 0;
    let sinceLaunch = 0;

    function frame() {
      // The trail. Never clearRect: the residue IS the tail.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      sinceLaunch += 1;
      const gap = Math.max(14, Math.round(34 / Math.max(intensityRef.current, 0.15)));
      if (sinceLaunch >= gap) {
        sinceLaunch = 0;
        launch();
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.shell) {
          p.vy += 0.13;
          // Burst at the top of the arc, or on reaching the intended height.
          if (p.vy >= -0.6 || (p.targetY !== undefined && p.y <= p.targetY)) {
            burst(p.x, p.y, p.color);
            parts.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        p.vy += 0.035;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.life -= p.decay;

        if (p.life <= 0 || p.y > height + 40) {
          parts.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[11] h-full w-full"
    />
  );
}
