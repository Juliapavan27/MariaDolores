// Ponte com os recursos do claude.ai (quando a plataforma roda publicada lá).
// Fora do claude.ai, window.claude não existe e tudo cai no modo local.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type DbSnapshot = { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
export type QuerySnap = { docs: DbSnapshot[] }
export type DbError = { code: string; message: string }
export interface DocRef {
  set(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  onSnapshot(next: (s: DbSnapshot) => void, err?: (e: DbError) => void): () => void
}
export interface CollRef {
  doc(id: string): DocRef
  onSnapshot(next: (s: QuerySnap) => void, err?: (e: DbError) => void): () => void
}
export interface SharedDB {
  doc(path: string): DocRef
  collection(path: string): CollRef
}
export interface UserCap {
  can(name: string): Promise<boolean | null>
  canEdit(): Promise<boolean>
  isOwner(): Promise<boolean>
}
export interface DownloadsCap {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: string }>
}

declare global {
  interface Window {
    claude?: { use(name: string): Promise<any> }
  }
}

export function useCapability<T>(name: string): Promise<T | null> {
  try {
    if (!window.claude?.use) return Promise.resolve(null)
    return window.claude.use(name).catch(() => null) as Promise<T | null>
  } catch {
    return Promise.resolve(null)
  }
}
