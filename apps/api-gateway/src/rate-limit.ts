/**
 * Rate limiting por tenant + endpoint (Bloco 5, item 1): token bucket.
 * Relógio injetável para testes determinísticos.
 */

export interface RateLimitOptions {
  capacidade: number;
  refillPorSegundo: number;
  agora?: () => number; // ms
}

interface Balde {
  fichas: number;
  ultimaRecarga: number;
}

export class RateLimiter {
  private readonly baldes = new Map<string, Balde>();
  private readonly capacidade: number;
  private readonly refillPorSegundo: number;
  private readonly agora: () => number;

  constructor(opts: RateLimitOptions) {
    this.capacidade = opts.capacidade;
    this.refillPorSegundo = opts.refillPorSegundo;
    this.agora = opts.agora ?? Date.now;
  }

  /** Consome uma ficha; retorna false quando o balde está vazio. */
  permitir(chave: string): boolean {
    const agora = this.agora();
    let balde = this.baldes.get(chave);
    if (!balde) {
      balde = { fichas: this.capacidade, ultimaRecarga: agora };
      this.baldes.set(chave, balde);
    }
    const decorridoS = (agora - balde.ultimaRecarga) / 1000;
    balde.fichas = Math.min(
      this.capacidade,
      balde.fichas + decorridoS * this.refillPorSegundo,
    );
    balde.ultimaRecarga = agora;
    if (balde.fichas < 1) return false;
    balde.fichas -= 1;
    return true;
  }
}
