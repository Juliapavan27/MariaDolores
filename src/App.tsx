import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { StoreProvider, useStore } from './data/store'
import { PRESETS, type PresetPeriodo, today, addDays } from './lib/dates'
import { date } from './lib/format'
import * as I from './components/Icons'
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
      <div className="sidebar-foot">Design, irreverência e paixão pelos detalhes.</div>
    </aside>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { periodo, setPeriodo } = useStore()
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('md-theme') || '' } catch { return '' }
  })
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
    try { localStorage.setItem('md-theme', theme) } catch { /* ignora */ }
  }, [theme])
  const isDark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  return (
    <header className="topbar">
      <button className="btn ghost menu-btn" onClick={onMenu} aria-label="Menu"><I.IcMenu /></button>
      <div className="small muted">
        Hoje, {date(today())} · Período: <b style={{ color: 'var(--ink)' }}>{date(periodo.inicio)} a {date(periodo.fim)}</b>
      </div>
      <div className="spacer" />
      <select className="input" style={{ width: 'auto' }} value={periodo.chave} onChange={(e) => setPeriodo(e.target.value as PresetPeriodo)} aria-label="Período">
        {PRESETS.map((p) => <option key={p.chave} value={p.chave}>{p.label}</option>)}
      </select>
      <button className="btn ghost" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Alternar tema">
        {isDark ? <I.IcSun /> : <I.IcMoon />}
      </button>
    </header>
  )
}

function Shell() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => window.scrollTo(0, 0), [loc.pathname])
  return (
    <div className="app">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open && <div className="overlay" style={{ zIndex: 30, background: 'rgba(0,0,0,.3)' }} onClick={() => setOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="content">
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
