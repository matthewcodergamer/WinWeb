export const engineId = 'bottleship-hle' as const;
export const upstreamRevision = 'a7c8543d75569d48890d48744897a0ffe3fb02f7';

export function createBottleShipWorker(): Worker {
  return new Worker(
    new URL('../../vendor/bottleship/src/worker/emulator.worker.ts', import.meta.url),
    { type: 'module', name: 'winweb-bottleship-hle' }
  );
}
