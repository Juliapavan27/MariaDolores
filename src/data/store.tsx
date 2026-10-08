import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Cliente, Colecao, Configuracoes, Database, Lead } from './types'
import { foraDaArea } from './labels'
import { aplicarFiltros, type Filtros } from '../lib/filtros'
import { buildSeed, emptyDatabase } from './seed'
import { periodo as buildPeriodo, type Periodo, type PresetPeriodo } from '../lib/dates'
import { useCapability, type DbError, type SharedDB, type UserCap } from '../lib/claude'

const STORAGE_KEY = 'md-gestao-showroom-v2'
const CONFIG_DOC = 'config/main'
const COLECOES = Object.keys(emptyDatabase()).filter((k) => k !== 'config') as Colecao[]

type WithId = { id: string }

/**
 * - `local`: dados salvos só neste navegador (fora do claude.ai ou sem base compartilhada).
 * - `vitrine`: há base compartilhada, mas a equipe ainda não a iniciou — mostra a demonstração.
 * - `equipe`: todos leem e gravam a mesma base, com atualização ao vivo.
 */
export type Modo = 'local' | 'vitrine' | 'equipe'

/** Revendas e leads de UFs fora do Sudeste/Nordeste: ficam na base, mas fora das telas e das metas. */
export interface ForaDaArea {
  clientes: Cliente[]
  leads: Lead[]
  /** Faturamento líquido de todos os pedidos dessas revendas. */
  faturamento: number
}

interface StoreValue {
  /** Área do Showroom SP (Sudeste e Nordeste) com o filtro global aplicado. */
  db: Database
  /** Área do Showroom SP sem o filtro global: exclusividade e raios usam todas as revendas. */
  dbArea: Database
  filtros: Filtros
  setFiltros: (f: Filtros) => void
  /** Base inteira, inclusive o que está fora da área (backup e importação). */
  dbCompleto: Database
  foraArea: ForaDaArea
  modo: Modo
  podeEditar: boolean | null
  progresso: { feitos: number; total: number } | null
  aviso: string
  limparAviso: () => void
  periodo: Periodo
  setPeriodo: (p: PresetPeriodo) => void
  upsert: <K extends Colecao>(col: K, item: Database[K][number]) => void
  remove: (col: Colecao, id: string) => void
  bulkUpsert: <K extends Colecao>(col: K, items: Database[K]) => void
  setConfig: (c: Partial<Configuracoes>) => void
  replaceAll: (db: Database) => void
  resetDemo: () => void
  clearAll: () => void
  iniciarBaseEquipe: () => void
  /** Mostra a demonstração (só neste navegador) sem tocar na base da equipe. */
  verExemplos: boolean
  setVerExemplos: (v: boolean) => void
}

const Ctx = createContext<StoreValue | null>(null)

function loadLocal(): Database {
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

function separarArea(db: Database): { db: Database; fora: ForaDaArea } {
  const clientesFora = db.clientes.filter((c) => foraDaArea(c.uf))
  const leadsFora = db.leads.filter((l) => foraDaArea(l.uf))
  if (!clientesFora.length && !leadsFora.length && !db.territorios.some((t) => foraDaArea(t.uf))) {
    return { db, fora: { clientes: [], leads: [], faturamento: 0 } }
  }
  const ids = new Set(clientesFora.map((c) => c.id))
  const daArea = <T extends { clienteId?: string }>(xs: T[]) => xs.filter((x) => !x.clienteId || !ids.has(x.clienteId))
  return {
    db: {
      ...db,
      clientes: db.clientes.filter((c) => !ids.has(c.id)),
      pedidos: daArea(db.pedidos),
      devolucoes: daArea(db.devolucoes),
      reclamacoes: daArea(db.reclamacoes),
      titulos: daArea(db.titulos),
      movBrindes: daArea(db.movBrindes),
      visitas: daArea(db.visitas),
      atendimentos: daArea(db.atendimentos),
      leads: db.leads.filter((l) => !foraDaArea(l.uf)),
      territorios: db.territorios.filter((t) => !foraDaArea(t.uf)),
    },
    fora: {
      clientes: clientesFora,
      leads: leadsFora,
      faturamento: db.pedidos.filter((p) => ids.has(p.clienteId) && p.status !== 'cancelado').reduce((s, p) => s + p.valor, 0),
    },
  }
}

export const newId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** JSON puro: remove campos `undefined` antes de gravar. */
const limpo = (x: unknown) => JSON.parse(JSON.stringify(x)) as Record<string, unknown>

function mensagemErro(e: unknown) {
  const code = (e as DbError)?.code
  if (code === 'invalid_argument') return 'Seu acesso a esta página é só de leitura: a alteração não foi salva na base da equipe.'
  if (code === 'quota_exceeded') return 'A base da equipe atingiu o limite de armazenamento. Exclua registros antigos para continuar.'
  if (code === 'resource_exhausted') return 'Muitas alterações seguidas. Aguarde alguns segundos e tente de novo.'
  return 'Não foi possível salvar na base da equipe agora. Verifique a conexão e tente de novo.'
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<Database>(loadLocal)
  const [shared, setShared] = useState<Database>(emptyDatabase)
  const [modo, setModo] = useState<Modo>('local')
  const [podeEditar, setPodeEditar] = useState<boolean | null>(null)
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null)
  const [aviso, setAviso] = useState('')
  const sharedRef = useRef<SharedDB | null>(null)
  const sharedState = useRef(shared)
  sharedState.current = shared
  const [filtros, setFiltrosState] = useState<Filtros>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY + ':filtros') || '{}') as Filtros
    } catch {
      return {}
    }
  })
  const setFiltros = useCallback((f: Filtros) => {
    setFiltrosState(f)
    try { localStorage.setItem(STORAGE_KEY + ':filtros', JSON.stringify(f)) } catch { /* só não lembra o filtro */ }
  }, [])
  const [presetPeriodo, setPresetPeriodo] = useState<PresetPeriodo>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY + ':periodo') as PresetPeriodo) || 'mes'
    } catch {
      return 'mes'
    }
  })

  // Conecta à base compartilhada quando a página roda publicada no claude.ai
  useEffect(() => {
    let vivo = true
    const unsubs: (() => void)[] = []
    ;(async () => {
      const [sdb, user] = await Promise.all([useCapability<SharedDB>('db'), useCapability<UserCap>('user')])
      if (!vivo || !sdb) return
      sharedRef.current = sdb
      if (user) Promise.resolve().then(() => user.can('data.write')).then((v) => vivo && setPodeEditar(v ?? null), () => setPodeEditar(null))
      const falhou = (e: DbError) => e.code !== 'revoked' && setAviso('A conexão com a base da equipe caiu. Recarregue a página.')
      unsubs.push(
        sdb.doc(CONFIG_DOC).onSnapshot((s) => {
          if (s.exists) {
            setShared((p) => ({ ...p, config: { ...emptyDatabase().config, ...(s.data() as Partial<Configuracoes>) } }))
            setModo('equipe')
          } else setModo('vitrine')
        }, falhou),
      )
      COLECOES.forEach((col) => {
        unsubs.push(
          sdb.collection(col).onSnapshot((snap) => {
            setShared((p) => ({ ...p, [col]: snap.docs.map((d) => ({ ...d.data(), id: d.id })) }))
          }, falhou),
        )
      })
    })()
    return () => {
      vivo = false
      unsubs.forEach((u) => u())
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(local))
    } catch {
      /* ignora: modo privado ou cota excedida */
    }
  }, [local])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + ':periodo', presetPeriodo)
    } catch {
      /* ignora */
    }
  }, [presetPeriodo])

  const [verExemplos, setVerExemplos] = useState(false)
  const naEquipe = modo === 'equipe' && !verExemplos

  /** Grava vários documentos na base da equipe, poucos de cada vez, mostrando o progresso. */
  const gravarLote = useCallback(async (ops: (() => Promise<void>)[]) => {
    if (!ops.length) return
    setProgresso({ feitos: 0, total: ops.length })
    let i = 0
    let feitos = 0
    let erro: unknown = null
    const worker = async () => {
      while (i < ops.length && !erro) {
        const op = ops[i++]
        // limite de velocidade ou instabilidade: espera e tenta de novo algumas vezes
        for (let tentativa = 0; ; tentativa++) {
          try {
            await op()
            break
          } catch (e) {
            const code = (e as DbError)?.code
            if ((code === 'resource_exhausted' || code === 'unavailable') && tentativa < 6) {
              await new Promise((r) => setTimeout(r, 800 * 2 ** tentativa + Math.random() * 400))
              continue
            }
            erro = e
            break
          }
        }
        feitos++
        if (feitos % 10 === 0 || feitos === ops.length) setProgresso({ feitos, total: ops.length })
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    setProgresso(null)
    if (erro) setAviso(mensagemErro(erro))
  }, [])

  const upsert = useCallback(<K extends Colecao>(col: K, item: Database[K][number]) => {
    const it = item as unknown as WithId
    if (naEquipe && sharedRef.current) {
      sharedRef.current.collection(col).doc(it.id).set(limpo(it)).catch((e) => setAviso(mensagemErro(e)))
      return
    }
    setLocal((prev) => {
      const list = prev[col] as unknown as WithId[]
      const exists = list.some((x) => x.id === it.id)
      const next = exists ? list.map((x) => (x.id === it.id ? it : x)) : [it, ...list]
      return { ...prev, [col]: next }
    })
  }, [naEquipe])

  const bulkUpsert = useCallback(<K extends Colecao>(col: K, items: Database[K]) => {
    const sdb = sharedRef.current
    if (naEquipe && sdb) {
      void gravarLote((items as unknown as WithId[]).map((x) => () => sdb.collection(col).doc(x.id).set(limpo(x))))
      return
    }
    setLocal((prev) => {
      const map = new Map((prev[col] as unknown as WithId[]).map((x) => [x.id, x]))
      ;(items as unknown as WithId[]).forEach((x) => map.set(x.id, x))
      return { ...prev, [col]: Array.from(map.values()) }
    })
  }, [naEquipe, gravarLote])

  const remove = useCallback((col: Colecao, id: string) => {
    if (naEquipe && sharedRef.current) {
      sharedRef.current.collection(col).doc(id).delete().catch((e) => setAviso(mensagemErro(e)))
      return
    }
    setLocal((prev) => ({ ...prev, [col]: (prev[col] as unknown as WithId[]).filter((x) => x.id !== id) }))
  }, [naEquipe])

  const setConfig = useCallback((c: Partial<Configuracoes>) => {
    if (naEquipe && sharedRef.current) {
      sharedRef.current.doc(CONFIG_DOC).set(limpo({ ...sharedState.current.config, ...c })).catch((e) => setAviso(mensagemErro(e)))
      return
    }
    setLocal((prev) => ({ ...prev, config: { ...prev.config, ...c } }))
  }, [naEquipe])

  /** Substitui tudo (restaurar backup). Na base da equipe, grava registro a registro. */
  const replaceAll = useCallback((d: Database) => {
    const full = { ...emptyDatabase(), ...d }
    const sdb = sharedRef.current
    if (naEquipe && sdb) {
      const ops: (() => Promise<void>)[] = [() => sdb.doc(CONFIG_DOC).set(limpo(full.config))]
      COLECOES.forEach((col) => (full[col] as unknown as WithId[]).forEach((x) => ops.push(() => sdb.collection(col).doc(x.id).set(limpo(x)))))
      void gravarLote(ops)
      return
    }
    setLocal(full)
  }, [naEquipe, gravarLote])

  const clearAll = useCallback(() => {
    const sdb = sharedRef.current
    if (naEquipe && sdb) {
      const atual = sharedState.current
      const ops: (() => Promise<void>)[] = []
      COLECOES.forEach((col) => (atual[col] as unknown as WithId[]).forEach((x) => ops.push(() => sdb.collection(col).doc(x.id).delete())))
      void gravarLote(ops)
      return
    }
    setLocal(emptyDatabase())
  }, [naEquipe, gravarLote])

  const iniciarBaseEquipe = useCallback(() => {
    const sdb = sharedRef.current
    if (!sdb) return
    sdb.doc(CONFIG_DOC).set(limpo(emptyDatabase().config)).catch((e) => setAviso(mensagemErro(e)))
  }, [])

  const dbCompleto = naEquipe ? shared : local
  const area = useMemo(() => separarArea(dbCompleto), [dbCompleto])
  const filtrado = useMemo(() => aplicarFiltros(area.db, filtros), [area, filtros])

  const value = useMemo<StoreValue>(
    () => ({
      db: filtrado,
      dbArea: area.db,
      filtros,
      setFiltros,
      dbCompleto,
      foraArea: area.fora,
      modo,
      verExemplos,
      setVerExemplos: (v: boolean) => {
        if (v && !local.clientes.length) setLocal(buildSeed())
        setVerExemplos(v)
      },
      podeEditar,
      progresso,
      aviso,
      limparAviso: () => setAviso(''),
      periodo: buildPeriodo(presetPeriodo),
      setPeriodo: setPresetPeriodo,
      upsert,
      bulkUpsert,
      remove,
      setConfig,
      replaceAll,
      resetDemo: () => setLocal(buildSeed()),
      clearAll,
      iniciarBaseEquipe,
    }),
    [area, filtrado, filtros, setFiltros, dbCompleto, verExemplos, local, modo, podeEditar, progresso, aviso, presetPeriodo, upsert, bulkUpsert, remove, setConfig, replaceAll, clearAll, iniciarBaseEquipe],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore fora do StoreProvider')
  return v
}
