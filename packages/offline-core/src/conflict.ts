import type { RegistroVersionado } from "./types.js";

/**
 * Resolução de conflitos (ADR-0003):
 * - status de entrega: last-write-wins por `_lastModified`;
 * - localização: merge por campo, usando `_campoTs[campo]` quando presente.
 */

const CAMPOS_META = new Set(["_lastModified", "_localVersion", "_campoTs"]);

export function lastWriteWins<T extends RegistroVersionado>(local: T, remoto: T): T {
  return remoto._lastModified >= local._lastModified ? remoto : local;
}

export function mergePorCampo<T extends RegistroVersionado>(local: T, remoto: T): T {
  const campos = new Set([
    ...Object.keys(local),
    ...Object.keys(remoto),
  ]);
  const resultado: Record<string, unknown> = {};
  const campoTs: Record<string, string> = {};

  for (const campo of campos) {
    if (CAMPOS_META.has(campo)) continue;
    const tsLocal = local._campoTs?.[campo] ?? local._lastModified;
    const tsRemoto = remoto._campoTs?.[campo] ?? remoto._lastModified;
    if (tsRemoto >= tsLocal) {
      resultado[campo] = remoto[campo];
      campoTs[campo] = tsRemoto;
    } else {
      resultado[campo] = local[campo];
      campoTs[campo] = tsLocal;
    }
  }

  resultado._lastModified =
    local._lastModified >= remoto._lastModified
      ? local._lastModified
      : remoto._lastModified;
  resultado._localVersion = Math.max(local._localVersion, remoto._localVersion) + 1;
  resultado._campoTs = campoTs;
  return resultado as T;
}
