"use client";

import React from "react";
import { motion } from "framer-motion";

interface CountdownProps {
  targetDate: string | Date;
  className?: string;
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
const Digit = ({ value }: { value: number }) => {
  return (
    <div className="relative h-9 w-[0.62em] overflow-hidden tabular-nums md:h-12">
      <motion.div
        animate={{ y: `-${value * 10}%` }}
        transition={{ type: "spring", stiffness: 100, damping: 20, mass: 1 }}
        className="flex flex-col"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <div
            key={num}
            className="flex h-9 items-center justify-center md:h-12"
          >
            {num}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export function Countdown({ targetDate, className }: CountdownProps) {
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

  return (
    <div className={`flex items-start gap-2 sm:gap-3 ${className ?? ""}`}>
      {timeItems.map((item) => (
        <div key={item.label} className="flex flex-col items-center">
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.07] px-2.5 font-sans text-xl font-extrabold tracking-[-0.03em] text-white backdrop-blur-md md:text-[1.75rem]">
            {item.value
              .toString()
              .padStart(2, "0")
              .split("")
              .map((digit, dIdx) => (
                <Digit key={dIdx} value={parseInt(digit)} />
              ))}
          </div>
          <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/55 md:text-[10px]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
