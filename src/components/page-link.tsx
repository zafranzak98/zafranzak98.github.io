import { Link, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

// A link to another page of the site. On the website it is the router's link (instant page
// changes, active-page marking); in the design editor, which has no router, it is a plain link
// so page blocks can be shown and arranged there unchanged.
export function PageLink({ to, children, className, current, exact }: { to: string; children: ReactNode; className?: string; current?: boolean; exact?: boolean }) {
  const router = useRouter({ warn: false })
  if (!router) return <a href={to} className={className} aria-current={current ? 'page' : undefined}>{children}</a>
  return <Link to={to as never} className={className} activeOptions={exact ? { exact: true } : undefined}>{children}</Link>
}
