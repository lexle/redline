"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./landing.module.css";

export function TapedSentence({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <mark ref={ref} className={styles.stripMark} data-seen={seen || undefined}>
      {children}
    </mark>
  );
}
