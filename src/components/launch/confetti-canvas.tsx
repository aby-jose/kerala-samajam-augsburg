"use client";

import React, { useEffect, useRef } from "react";

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle" | "ribbon";
  opacity: number;
}

/**
 * Confetti, thrown at the moment the celebration begins.
 *
 * Three throws at once: a burst from the centre of the opening, and a cannon
 * from each lower corner firing up and inward, so the whole opening fills
 * rather than one spot in the middle. The canvas fills whatever box it is
 * put in — the parent clips it to the opening, so nothing lands on the
 * cloth. Pieces are cut small: at the sizes they were first drawn, each one
 * was the width of a letter of the address from the back of the hall, and
 * the burst read as a handful of cards thrown at the screen.
 *
 * The palette is a festival's, not a brand sheet's: the house crimson, gold
 * and ivory, and with them emerald, turquoise, sky, violet and orange. One
 * or two colours read as a logo; a dozen read as a celebration.
 */
export function ConfettiCanvas({
  active,
  originX = 0.5,
  originY = 0.5,
}: {
  active: boolean;
  originX?: number;
  originY?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const host = canvas.parentElement ?? document.body;

    let width = (canvas.width = host.clientWidth);
    let height = (canvas.height = host.clientHeight);

    const handleResize = () => {
      width = canvas.width = host.clientWidth;
      height = canvas.height = host.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    const colors = [
      "#F43F5E", // crimson
      "#FF7A45", // orange
      "#FFC33D", // gold
      "#FFE680", // pale gold
      "#34D399", // emerald
      "#2DD4BF", // turquoise
      "#38BDF8", // sky
      "#818CF8", // violet
      "#F472B6", // pink
      "#F6EEE0", // ivory
      "#FFFFFF",
    ];

    const pieces: ConfettiPiece[] = [];
    const count = 1100;

    const startX = width * originX;
    const startY = height * originY;

    for (let i = 0; i < count; i++) {
      // Which throw this piece belongs to: the centre burst, or one of the
      // two corner cannons, which fire up and inward at a steep angle.
      const throwFrom = i % 3;
      let x: number, y: number, angle: number, speed: number;
      if (throwFrom === 0) {
        x = startX + (Math.random() - 0.5) * 80;
        y = startY + (Math.random() - 0.5) * 40;
        angle = Math.random() * Math.PI * 2;
        speed = 4 + Math.random() * 20;
      } else {
        const left = throwFrom === 1;
        x = left ? width * 0.03 : width * 0.97;
        y = height * 1.02;
        // Straight up is -PI/2; lean inward by 20-45 degrees.
        const lean = (Math.PI / 180) * (20 + Math.random() * 25);
        angle = -Math.PI / 2 + (left ? lean : -lean);
        speed = 14 + Math.random() * 16;
      }
      const shapeType = Math.random() > 0.4 ? "rect" : Math.random() > 0.5 ? "ribbon" : "circle";

      pieces.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (throwFrom === 0 ? 6 : 0),
        size: shapeType === "ribbon" ? 11 + Math.random() * 9 : 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        shape: shapeType,
        opacity: 1,
      });
    }

    let animId: number;
    let frameCount = 0;

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;

      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.24; // Gravity
        p.vx *= 0.985; // Air drag
        // A little flutter as it falls, so a piece drifts rather than drops.
        p.vx += Math.sin((frameCount + i) * 0.17) * 0.12;
        p.rotation += p.rotationSpeed;

        if (frameCount > 110) {
          p.opacity -= 0.006;
        }

        if (p.opacity > 0 && p.y < height + 50) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;

          if (p.shape === "rect") {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          } else if (p.shape === "ribbon") {
            ctx.fillRect(-p.size / 2, -p.size / 8, p.size, p.size / 4);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      if (aliveCount > 0) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, [active, originX, originY]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}
