"use client";

// One small confetti burst (canvas-confetti, as Magic UI's confetti wraps it). Callers skip
// it under reduced motion; canvas-confetti also honours the OS setting itself.

import confetti from "canvas-confetti";

const COLORS = ["#4D7CFF", "#F4F4F2", "#F5A524"];

export function burst(origin: { x: number; y: number } = { x: 0.5, y: 0.3 }) {
  confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 32,
    gravity: 1.1,
    ticks: 160,
    scalar: 0.9,
    origin,
    colors: COLORS,
    disableForReducedMotion: true,
  });
}
