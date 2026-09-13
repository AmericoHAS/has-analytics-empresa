"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
export function PublicExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (
      !root.current ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    root.current
      .querySelectorAll("[data-reveal]")
      .forEach((element) => observer.observe(element));
    root.current.classList.add("reveal-ready");
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className={`public-site ${paused ? "motion-paused" : ""}`}>
      <div className="brand-watermark" aria-hidden="true">
        <svg viewBox="0 0 800 500">
          <g fill="currentColor">
            {[45, 95, 165, 240, 330, 280, 195, 115, 55].map((height, index) => (
              <rect
                key={index}
                x={90 + index * 68}
                y={420 - height}
                width="40"
                height={height}
                rx="6"
              />
            ))}
          </g>
          <path
            d="M35 410 C180 410 245 345 325 180 S430 35 495 180 S610 410 765 415"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
          />
        </svg>
      </div>
      {children}
      <button
        type="button"
        className="motion-toggle"
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play /> : <Pause />}
        {paused ? "Ativar animações" : "Pausar animações"}
      </button>
    </div>
  );
}
