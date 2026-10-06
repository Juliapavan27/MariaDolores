// Roteador mínimo por hash (#/carteira), no lugar do React Router.
// Funciona também em quadros isolados (sem endereço próprio), onde o React Router
// quebra ao montar URLs. Se o hash não puder ser lido ou gravado, a navegação
// continua só na memória.
import {
  Children, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useState,
  type AnchorHTMLAttributes, type MouseEvent, type ReactElement, type ReactNode,
} from 'react'

interface RouterValue {
  pathname: string
  navigate: (to: string) => void
}

const Ctx = createContext<RouterValue>({ pathname: '/', navigate: () => {} })

function lerHash() {
  try {
    const h = window.location.hash.replace(/^#/, '')
    return h.startsWith('/') ? h : '/'
  } catch {
    return '/'
  }
}

export function HashRouter({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(lerHash)
  useEffect(() => {
    const onHash = () => setPathname(lerHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = useCallback((to: string) => {
    setPathname(to)
    try {
      if (window.location.hash !== '#' + to) window.location.hash = to
    } catch {
      /* ambiente sem hash: segue só na memória */
    }
  }, [])
  const value = useMemo(() => ({ pathname, navigate }), [pathname, navigate])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useLocation = () => ({ pathname: useContext(Ctx).pathname })

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'> & { to: string }

export function Link({ to, onClick, ...rest }: LinkProps & { className?: string }) {
  const { navigate } = useContext(Ctx)
  return (
    <a
      {...rest}
      href={'#' + to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(to)
      }}
    />
  )
}

export function NavLink({ to, end, className, ...rest }: LinkProps & { end?: boolean; className?: string | ((s: { isActive: boolean }) => string) }) {
  const { pathname } = useContext(Ctx)
  const isActive = end || to === '/' ? pathname === to : pathname === to || pathname.startsWith(to + '/')
  return <Link {...rest} to={to} className={typeof className === 'function' ? className({ isActive }) : className} aria-current={isActive ? 'page' : undefined} />
}

export function Route(_: { path: string; element: ReactNode }) {
  return null
}

export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useContext(Ctx)
  let fallback: ReactNode = null
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue
    const { path, element } = (child as ReactElement<{ path: string; element: ReactNode }>).props
    if (path === pathname) return <>{element}</>
    if (path === '*') fallback = element
  }
  return <>{fallback}</>
}
