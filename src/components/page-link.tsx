import { Link, useRouter } from '@tanstack/react-router'
import type { CSSProperties, MouseEventHandler, FocusEventHandler, ReactNode } from 'react'

// A link to another page of the site. On the website it is the router's link (instant page
// changes, active-page marking); in the design editor, which has no router, it is a plain link
// so page blocks can be shown and arranged there unchanged.
type Extra = {
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLAnchorElement>
  onMouseEnter?: MouseEventHandler<HTMLAnchorElement>
  onMouseLeave?: MouseEventHandler<HTMLAnchorElement>
  onFocus?: FocusEventHandler<HTMLAnchorElement>
  onBlur?: FocusEventHandler<HTMLAnchorElement>
  'aria-label'?: string
}
export function PageLink({ to, children, className, current, exact, ...extra }: { to: string; children: ReactNode; className?: string; current?: boolean; exact?: boolean } & Extra) {
  const router = useRouter({ warn: false })
  if (!router) return <a href={to} className={className} aria-current={current ? 'page' : undefined} {...extra}>{children}</a>
  return <Link to={to as never} className={className} activeOptions={exact ? { exact: true } : undefined} {...extra}>{children}</Link>
}
