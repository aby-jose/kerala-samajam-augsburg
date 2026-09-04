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

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Four colours, all of them the house palette: crimson, kasavu gold, cream,
    // white. The draft threw indigo and emerald in as well, which read as a
    // birthday party rather than this association's brand.
    const colors = ["#E11D48", "#D4A537", "#F5EFE6", "#FFFFFF"];

    const pieces: ConfettiPiece[] = [];
    const count = 350;

    const startX = width * originX;
    const startY = height * originY;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 22;
      const shapeType = Math.random() > 0.4 ? "rect" : Math.random() > 0.5 ? "ribbon" : "circle";

      pieces.push({
        x: startX + (Math.random() - 0.5) * 80,
        y: startY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        size: shapeType === "ribbon" ? 14 + Math.random() * 12 : 7 + Math.random() * 9,
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
        p.vy += 0.28; // Gravity
        p.vx *= 0.985; // Air drag
        p.rotation += p.rotationSpeed;

        if (frameCount > 80) {
          p.opacity -= 0.007;
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

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}
