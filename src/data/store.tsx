import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Colecao, Configuracoes, Database } from './types'
import { buildSeed, emptyDatabase } from './seed'
import { periodo as buildPeriodo, type Periodo, type PresetPeriodo } from '../lib/dates'

const STORAGE_KEY = 'md-gestao-showroom-v1'

type WithId = { id: string }

interface StoreValue {
  db: Database
  periodo: Periodo
  setPeriodo: (p: PresetPeriodo) => void
  upsert: <K extends Colecao>(col: K, item: Database[K][number]) => void
  remove: (col: Colecao, id: string) => void
  bulkUpsert: <K extends Colecao>(col: K, items: Database[K]) => void
  setConfig: (c: Partial<Configuracoes>) => void
  replaceAll: (db: Database) => void
  resetDemo: () => void
  clearAll: () => void
}

const Ctx = createContext<StoreValue | null>(null)

function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Database
      // garante coleções novas em bases salvas por versões anteriores
      return { ...emptyDatabase(), ...parsed, config: { ...emptyDatabase().config, ...parsed.config } }
    }
  } catch {
    /* armazenamento indisponível: segue com dados de demonstração */
  }
  return buildSeed()
}

export const newId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(load)
  const [presetPeriodo, setPresetPeriodo] = useState<PresetPeriodo>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY + ':periodo') as PresetPeriodo) || 'mes'
    } catch {
      return 'mes'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch {
      /* ignora: modo privado ou cota excedida */
    }
  }, [db])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + ':periodo', presetPeriodo)
    } catch {
      /* ignora */
    }
  }, [presetPeriodo])

  const upsert = useCallback(<K extends Colecao>(col: K, item: Database[K][number]) => {
    setDb((prev) => {
      const list = prev[col] as unknown as WithId[]
      const it = item as unknown as WithId
      const exists = list.some((x) => x.id === it.id)
      const next = exists ? list.map((x) => (x.id === it.id ? it : x)) : [it, ...list]
      return { ...prev, [col]: next }
    })
  }, [])

  const bulkUpsert = useCallback(<K extends Colecao>(col: K, items: Database[K]) => {
    setDb((prev) => {
      const map = new Map((prev[col] as unknown as WithId[]).map((x) => [x.id, x]))
      ;(items as unknown as WithId[]).forEach((x) => map.set(x.id, x))
      return { ...prev, [col]: Array.from(map.values()) }
    })
  }, [])

  const remove = useCallback((col: Colecao, id: string) => {
    setDb((prev) => ({ ...prev, [col]: (prev[col] as unknown as WithId[]).filter((x) => x.id !== id) }))
  }, [])

  const setConfig = useCallback((c: Partial<Configuracoes>) => setDb((prev) => ({ ...prev, config: { ...prev.config, ...c } })), [])

  const value = useMemo<StoreValue>(
    () => ({
      db,
      periodo: buildPeriodo(presetPeriodo),
      setPeriodo: setPresetPeriodo,
      upsert,
      bulkUpsert,
      remove,
      setConfig,
      replaceAll: (d) => setDb({ ...emptyDatabase(), ...d }),
      resetDemo: () => setDb(buildSeed()),
      clearAll: () => setDb(emptyDatabase()),
    }),
    [db, presetPeriodo, upsert, bulkUpsert, remove, setConfig],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore fora do StoreProvider')
  return v
}
