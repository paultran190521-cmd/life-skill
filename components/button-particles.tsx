"use client";

import { useEffect } from "react";
import { installButtonParticles } from "@/lib/button-particles";

export function ButtonParticles() {
  useEffect(() => installButtonParticles(document, window), []);
  return null;
}
