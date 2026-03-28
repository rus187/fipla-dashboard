import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { TargetSimulationPayload } from './src/pages/simulationAdapter'
import { MOCK_SIMULATION_ROUTE_PATH } from './src/pages/simulationMockEngine'
import { executeSimulationThroughServerBridge } from './server/simulationServerBridge'

function getRequestPath(requestUrl: string | undefined) {
  if (!requestUrl) {
    return ''
  }

  return new URL(requestUrl, 'http://127.0.0.1').pathname
}

async function readJsonBody<TPayload>(request: IncomingMessage): Promise<TPayload> {
  const bodyChunks: Buffer[] = []

  for await (const chunk of request) {
    bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(bodyChunks).toString('utf-8')

  if (rawBody.trim().length === 0) {
    throw new Error('Le payload JSON est vide.')
  }

  return JSON.parse(rawBody) as TPayload
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function createMockSimulationRoutePlugin(): Plugin {
  const handleMockSimulationRoute = async (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) => {
    if (
      request.method !== 'POST' ||
      getRequestPath(request.url) !== MOCK_SIMULATION_ROUTE_PATH
    ) {
      next()
      return
    }

    try {
      const payload = await readJsonBody<TargetSimulationPayload>(request)
      const routeResponse = await executeSimulationThroughServerBridge(payload)

      sendJson(response, 200, routeResponse)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'La route interne de simulation n’a pas pu traiter la requête.'

      sendJson(response, 400, {
        error: 'mock_simulation_route_error',
        message,
      })
    }
  }

  return {
    name: 'mock-simulation-route',
    configureServer(server) {
      server.middlewares.use(handleMockSimulationRoute)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleMockSimulationRoute)
    },
  }
}

export default defineConfig({
  plugins: [react(), createMockSimulationRoutePlugin()],
})
