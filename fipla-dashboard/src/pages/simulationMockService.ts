import type { TargetSimulationPayload } from './simulationAdapter'
import {
  MOCK_SIMULATION_ROUTE_PATH,
  type MockSimulationServiceResponse,
} from './simulationMockEngine'

export { MOCK_SIMULATION_ROUTE_PATH, type MockSimulationServiceResponse }

export async function executeMockSimulationService(
  payload: TargetSimulationPayload
): Promise<MockSimulationServiceResponse> {
  const response = await fetch(MOCK_SIMULATION_ROUTE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`La route interne de simulation a répondu avec le statut ${response.status}.`)
  }

  return (await response.json()) as MockSimulationServiceResponse
}
