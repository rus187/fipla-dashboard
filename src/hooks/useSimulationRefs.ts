import { useRef } from "react";
import type { MutableRefObject } from "react";

export interface SimulationRefs {
  autoSimulationStatusRef: MutableRefObject<Record<string, "running" | "done">>;
  pendingDesktopSimulationDisplayRef: MutableRefObject<Record<string, number>>;
  pendingPostSimulationScrollRef: MutableRefObject<"optimisation" | null>;
}

export function useSimulationRefs(): SimulationRefs {
  const autoSimulationStatusRef = useRef<Record<string, "running" | "done">>({});
  const pendingDesktopSimulationDisplayRef = useRef<Record<string, number>>({});
  const pendingPostSimulationScrollRef = useRef<"optimisation" | null>(null);

  return {
    autoSimulationStatusRef,
    pendingDesktopSimulationDisplayRef,
    pendingPostSimulationScrollRef,
  };
}
