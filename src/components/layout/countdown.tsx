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

const Digit = ({ value }: { value: number }) => {
  return (
    <div className="h-8 xs:h-10 md:h-14 overflow-hidden relative w-[0.6em] md:w-[0.6em] tabular-nums">
      <motion.div
        animate={{ y: `-${value * 10}%` }}
        transition={{ type: "spring", stiffness: 100, damping: 20, mass: 1 }}
        className="flex flex-col"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <div key={num} className="h-8 xs:h-10 md:h-14 flex items-center justify-center">
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
    <div className={`flex items-center gap-1.5 xs:gap-2 sm:gap-4 ${className}`}>
      {timeItems.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <div className="flex gap-0.5 items-center bg-black/20 backdrop-blur-md px-2.5 xs:px-3 rounded-xl xs:rounded-2xl border border-white/5">
            {item.value.toString().padStart(2, '0').split('').map((digit, dIdx) => (
              <Digit key={dIdx} value={parseInt(digit)} />
            ))}
          </div>
          <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mt-2">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
