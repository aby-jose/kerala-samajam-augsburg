"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type CountdownSize = "default" | "sm";

interface CountdownProps {
  targetDate: string | Date;
  className?: string;
  /** `sm` is for clocks that sit over artwork, where the default would dominate. */
  size?: CountdownSize;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * A single rolling digit. The reel is ten stacked rows of identical height,
 * so a -10% shift per unit always lands on the right number regardless of
 * the type size it inherits.
 */
const Digit = ({ value, size }: { value: number; size: CountdownSize }) => {
  // The reel row and its window must share a height class, or a -10% shift
  // per unit stops landing on the right number.
  const rowHeight = size === "sm" ? "h-7" : "h-8 sm:h-9 md:h-12";

  return (
    <div
      className={cn(
        "relative w-[0.62em] overflow-hidden tabular-nums",
        rowHeight
      )}
    >
      <motion.div
        animate={{ y: `-${value * 10}%` }}
        transition={{ type: "spring", stiffness: 100, damping: 20, mass: 1 }}
        className="flex flex-col"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <div
            key={num}
            className={cn("flex items-center justify-center", rowHeight)}
          >
            {num}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export function Countdown({
  targetDate,
  className,
  size = "default",
}: CountdownProps) {
  const [timeLeft, setTimeLeft] = React.useState<TimeLeft | null>(null);

  React.useEffect(() => {
    const updateTimer = () => {
      const difference = +new Date(targetDate) - +new Date();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft(null);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) return null;

  const timeItems = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Mins", value: timeLeft.minutes },
    { label: "Secs", value: timeLeft.seconds },
  ];

  const isSm = size === "sm";

  return (
    <div
      className={cn(
        "flex items-start",
        isSm ? "gap-1.5" : "gap-1.5 sm:gap-2 md:gap-3",
        className
      )}
    >
      {timeItems.map((item) => (
        <div key={item.label} className="flex flex-col items-center">
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.07] font-sans font-extrabold tracking-[-0.03em] text-white backdrop-blur-md",
              isSm ? "px-2 text-base" : "px-2 text-lg sm:px-2.5 sm:text-xl md:text-[1.75rem]"
            )}
          >
            {item.value
              .toString()
              .padStart(2, "0")
              .split("")
              .map((digit, dIdx) => (
                <Digit key={dIdx} value={parseInt(digit)} size={size} />
              ))}
          </div>
          <span
            className={cn(
              "font-bold uppercase tracking-[0.2em] text-white/55",
              isSm ? "mt-1.5 text-[8px]" : "mt-1.5 text-[9px] sm:mt-2 md:text-[10px]"
            )}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
