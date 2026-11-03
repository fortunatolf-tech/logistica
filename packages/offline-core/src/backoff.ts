/**
 * Backoff exponencial com "equal jitter" (AWS Architecture Blog):
 * espera = exp/2 + aleatório * exp/2, com teto configurável.
 *
 * `rand` injetável torna o comportamento determinístico em testes.
 */

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  rand?: () => number;
}

export function backoffMs(tentativas: number, opts: BackoffOptions = {}): number {
  const base = opts.baseMs ?? 1_000;
  const max = opts.maxMs ?? 60_000;
  const rand = opts.rand ?? Math.random;
  const exp = Math.min(max, base * 2 ** Math.max(0, tentativas));
  return Math.round(exp / 2 + rand() * (exp / 2));
}
