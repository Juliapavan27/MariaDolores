// Navegação interna da plataforma, feita só com estado e botões.
// Não usa links (<a href>) nem altera o endereço da página: o visualizador do
// claude.ai intercepta cliques em links e trata endereços com "#/…" de forma
// própria, o que deixava as telas sem conteúdo.
import {
  Children, createContext, isValidElement, useCallback, useContext, useMemo, useState,
  type ButtonHTMLAttributes, type ReactElement, type ReactNode,
} from 'react'

interface RouterValue {
  pathname: string
  navigate: (to: string) => void
}

const Ctx = createContext<RouterValue>({ pathname: '/', navigate: () => {} })

export function HashRouter({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState('/')
  const navigate = useCallback((to: string) => setPathname(to), [])
  const value = useMemo(() => ({ pathname, navigate }), [pathname, navigate])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useLocation = () => ({ pathname: useContext(Ctx).pathname })
export const useNavigate = () => useContext(Ctx).navigate

type LinkProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'> & { to: string }

/** Botão com aparência de link que troca de tela. */
export function Link({ to, onClick, className, ...rest }: LinkProps & { className?: string }) {
  const { navigate } = useContext(Ctx)
  return (
    <button
      {...rest}
      type="button"
      className={`lnk ${className || ''}`}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) navigate(to)
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
