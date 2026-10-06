import { Component, useEffect, useMemo, useState, type ComponentType, type ErrorInfo, type ReactNode, type SVGProps } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from './lib/router'
import { StoreProvider, useStore } from './data/store'
import { PRESETS, type PresetPeriodo, today, addDays } from './lib/dates'
import { date, MESES_LONGOS } from './lib/format'

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const hojeExtenso = () => {
  const d = new Date()
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES_LONGOS[d.getMonth()].toLowerCase()}`
}
import * as I from './components/Icons'
import { Logo } from './components/Logo'
import { ConfirmButton } from './components/ui'
import Dashboard from './pages/Dashboard'
import Equipe from './pages/Equipe'
import Carteira from './pages/Carteira'
import Faturamento from './pages/Faturamento'
import PosVenda from './pages/PosVenda'
import Financeiro from './pages/Financeiro'
import Brindes from './pages/Brindes'
import Eventos from './pages/Eventos'
import Agenda from './pages/Agenda'
import Leads from './pages/Leads'
import Trafego from './pages/Trafego'
import Expansao from './pages/Expansao'
import Configuracoes from './pages/Configuracoes'

interface NavItem { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; badge?: number }

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { db } = useStore()
  const badges = useMemo(() => {
    const hoje = today()
    return {
      reclamacoes: db.reclamacoes.filter((r) => r.status !== 'resolvida').length + db.devolucoes.filter((d) => d.status === 'solicitada' || d.status === 'em_analise').length,
      expansao: db.clientes.filter((c) => c.status === 'em_queda' && c.quedaData && c.quedaData >= hoje && c.quedaData <= addDays(hoje, 30)).length,
      leads: db.leads.filter((l) => l.etapa === 'novo').length,
    }
  }, [db])

  const groups: { title: string; items: NavItem[] }[] = [
    { title: 'Gestão à vista', items: [
      { to: '/', label: 'Visão geral', icon: I.IcHome },
      { to: '/equipe', label: 'Equipe & metas', icon: I.IcTeam },
      { to: '/carteira', label: 'Carteira de revendas', icon: I.IcStore },
    ] },
    { title: 'Comercial', items: [
      { to: '/faturamento', label: 'Faturamento', icon: I.IcMoney },
      { to: '/pos-venda', label: 'Devoluções & reclamações', icon: I.IcReturn, badge: badges.reclamacoes },
      { to: '/financeiro', label: 'Débitos', icon: I.IcCard },
      { to: '/brindes', label: 'Brindes', icon: I.IcGift },
    ] },
    { title: 'Showroom', items: [
      { to: '/eventos', label: 'Eventos', icon: I.IcCalendar },
      { to: '/agenda', label: 'Agenda & tarefas', icon: I.IcAgenda },
    ] },
    { title: 'Crescimento', items: [
      { to: '/leads', label: 'Leads', icon: I.IcFunnel, badge: badges.leads },
      { to: '/trafego', label: 'Tráfego & criativos', icon: I.IcMegaphone },
      { to: '/expansao', label: 'Expansão & territórios', icon: I.IcMap, badge: badges.expansao },
    ] },
  ]

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <Logo className="brand-logo" />
        <div className="brand-mark">Maria Dolores</div>
        <div className="brand-sub">{db.config.nomeUnidade}</div>
      </div>
      {groups.map((g) => (
        <div key={g.title}>
          <div className="nav-group">{g.title}</div>
          {g.items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onNavigate}>
              <it.icon />
              {it.label}
              {!!it.badge && <span className="nav-badge">{it.badge}</span>}
            </NavLink>
          ))}
        </div>
      ))}
      <NavLink to="/config" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onNavigate} style={{ marginTop: 12 }}>
        <I.IcSettings /> Configurações
      </NavLink>
      <div className="sidebar-foot">Design, irreverência<br />e paixão pelos detalhes.</div>
    </aside>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { periodo, setPeriodo, modo } = useStore()
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('md-theme') || '' } catch { return '' }
  })
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
    try { localStorage.setItem('md-theme', theme) } catch { /* ignora */ }
  }, [theme])
  const isDark = theme === 'dark'
  return (
    <header className="topbar">
      <button className="btn ghost menu-btn" onClick={onMenu} aria-label="Menu"><I.IcMenu /></button>
      <span className="today">{hojeExtenso()}</span>
      <span className="range">{date(periodo.inicio)} — {date(periodo.fim)}</span>
      <div className="spacer" />
      <span className={`modo-base ${modo}`} title={modo === 'equipe' ? 'Dados compartilhados com a equipe, atualizados ao vivo' : 'Dados salvos só neste navegador'}>
        <i />{modo === 'equipe' ? 'Base da equipe' : modo === 'vitrine' ? 'Demonstração' : 'Neste navegador'}
      </span>
      <select className="input" style={{ width: 'auto' }} value={periodo.chave} onChange={(e) => setPeriodo(e.target.value as PresetPeriodo)} aria-label="Período">
        {PRESETS.map((p) => <option key={p.chave} value={p.chave}>{p.label}</option>)}
      </select>
      <button className="btn ghost" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Alternar tema">
        {isDark ? <I.IcSun /> : <I.IcMoon />}
      </button>
    </header>
  )
}

/** Faixa sob o topo: modo da base, progresso de gravação e avisos. */
function Faixa() {
  const { db, modo, podeEditar, progresso, aviso, limparAviso, iniciarBaseEquipe, resetDemo } = useStore()
  const vazio = modo !== 'equipe' && !db.clientes.length && !db.colaboradores.length
  return (
    <>
      {vazio && (
        <div className="faixa">
          <span><b>Não há dados salvos neste navegador.</b> Carregue a demonstração para explorar a plataforma, ou comece cadastrando a equipe.</span>
          <button className="btn primary sm" onClick={resetDemo}>Carregar demonstração</button>
        </div>
      )}
      {modo === 'vitrine' && (
        <div className="faixa">
          <span><b>Você está vendo dados de demonstração.</b> A base da equipe ainda não foi iniciada: ao iniciá-la, todos que têm acesso a esta página passam a ver e editar os mesmos dados, ao vivo.</span>
          {podeEditar !== false && <ConfirmButton className="btn primary sm" confirmLabel="Iniciar base vazia?" onConfirm={iniciarBaseEquipe}>Iniciar base da equipe</ConfirmButton>}
        </div>
      )}
      {modo === 'equipe' && podeEditar === false && (
        <div className="faixa"><span>Base da equipe · seu acesso é <b>somente leitura</b>. Peça à responsável para mudar seu acesso para Colaborador ou Editor.</span></div>
      )}
      {progresso && (
        <div className="faixa"><span>Gravando na base da equipe… {progresso.feitos} de {progresso.total}</span><div className="meter" style={{ flex: 1, maxWidth: 240 }}><span style={{ width: `${(progresso.feitos / progresso.total) * 100}%` }} /></div></div>
      )}
      {aviso && (
        <div className="faixa erro" role="alert"><span>{aviso}</span><button className="btn sm ghost" onClick={limparAviso}>Fechar</button></div>
      )}
    </>
  )
}

/** Mostra o erro na tela (em vez de uma página em branco) e permite tentar de novo. */
class Protecao extends Component<{ children: ReactNode; chave: string }, { erro: string }> {
  state = { erro: '' }
  static getDerivedStateFromError(e: Error) {
    return { erro: e.message || String(e) }
  }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error(e, info.componentStack)
  }
  componentDidUpdate(prev: { chave: string }) {
    if (prev.chave !== this.props.chave && this.state.erro) this.setState({ erro: '' })
  }
  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-head"><h3>Esta tela não abriu</h3></div>
        <p className="small" style={{ marginTop: 0 }}>Algo nos dados impediu esta aba de carregar. As outras abas continuam funcionando.</p>
        <p className="small muted">Detalhe técnico: {this.state.erro}</p>
        <button className="btn" onClick={() => this.setState({ erro: '' })}>Tentar de novo</button>
      </div>
    )
  }
}

function Shell() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => window.scrollTo(0, 0), [loc.pathname])
  return (
    <div className="app">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open && <div className="overlay" style={{ zIndex: 30 }} onClick={() => setOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <Faixa />
        <main className="content">
          <Protecao chave={loc.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/carteira" element={<Carteira />} />
            <Route path="/faturamento" element={<Faturamento />} />
            <Route path="/pos-venda" element={<PosVenda />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/brindes" element={<Brindes />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/trafego" element={<Trafego />} />
            <Route path="/expansao" element={<Expansao />} />
            <Route path="/config" element={<Configuracoes />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
          </Protecao>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  )
}
