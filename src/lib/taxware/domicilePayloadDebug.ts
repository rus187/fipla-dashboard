export const DOMICILE_INTERNAL_DEBUG_KEY = "__domicileDebug";

type AnyRecord = Record<string, unknown>;

export function stripInternalPayloadDebug<T extends AnyRecord>(payload: T): T {
  const { [DOMICILE_INTERNAL_DEBUG_KEY]: _internalDebug, ...rest } = payload;
  return rest as T;
}

export function readInternalPayloadDebug(payload: Record<string, unknown> | null | undefined) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return (payload as Record<string, unknown>)[DOMICILE_INTERNAL_DEBUG_KEY] ?? null;
}
