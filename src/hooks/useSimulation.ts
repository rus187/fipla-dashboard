import { useState } from "react";

export function useSimulation() {
  const [isSimulatingVariants, setIsSimulatingVariants] = useState(false);
  const [simulationStatusMessage, setSimulationStatusMessage] = useState("");

  return {
    isSimulatingVariants,
    setIsSimulatingVariants,
    simulationStatusMessage,
    setSimulationStatusMessage,
  };
}
