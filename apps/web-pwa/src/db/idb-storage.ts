/**
 * Adaptador IndexedDB (via `idb`) para a porta MutationStorage do offline-core.
 * Toda leitura/escrita do app passa por aqui (ADR-0003).
 */
import { openDB, type IDBPDatabase } from "idb";
import type { Mutation, MutationStorage } from "@rotaviva/offline-core";

const DB_NAME = "rotaviva";
const DB_VERSION = 1;
const STORE_MUTATIONS = "mutations";
export const STORE_DELIVERIES = "deliveries";

export async function abrirBanco(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        db.createObjectStore(STORE_MUTATIONS, { keyPath: "idempotency_key" });
      }
      if (!db.objectStoreNames.contains(STORE_DELIVERIES)) {
        db.createObjectStore(STORE_DELIVERIES, { keyPath: "id" });
      }
    },
  });
}

export class IdbMutationStorage implements MutationStorage {
  private constructor(private db: IDBPDatabase) {}

  static async criar(): Promise<IdbMutationStorage> {
    return new IdbMutationStorage(await abrirBanco());
  }

  async put(m: Mutation): Promise<void> {
    await this.db.put(STORE_MUTATIONS, m);
  }

  async get(key: string): Promise<Mutation | undefined> {
    return this.db.get(STORE_MUTATIONS, key);
  }

  async pendentes(agora: Date = new Date()): Promise<Mutation[]> {
    const iso = agora.toISOString();
    const todas = (await this.db.getAll(STORE_MUTATIONS)) as Mutation[];
    return todas
      .filter(
        (m) =>
          (m._syncStatus === "pendente" || m._syncStatus === "erro") &&
          (m.proximaTentativa === null || m.proximaTentativa <= iso),
      )
      .sort((a, b) => a._lastModified.localeCompare(b._lastModified));
  }

  async remover(key: string): Promise<void> {
    await this.db.delete(STORE_MUTATIONS, key);
  }

  async todas(): Promise<Mutation[]> {
    return this.db.getAll(STORE_MUTATIONS);
  }
}
