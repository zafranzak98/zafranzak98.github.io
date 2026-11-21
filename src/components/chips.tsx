import { Link } from '@tanstack/react-router'
import { categories } from '#/lib/site'

// Category filter: All, then every category that has at least one project.
export default function Chips({ active, used }: { active: string; used: Set<string> }) {
  return (
    <nav aria-label="Filter by category" className="chips">
      <Link to="/projects" className={`chip ${active === 'all' ? 'chip-on' : ''}`} aria-current={active === 'all' ? 'page' : undefined}>All</Link>
      {categories.filter((c) => used.has(c.slug)).map((c) => (
        <Link key={c.slug} to="/projects/$projectCat" params={{ projectCat: c.slug }} className={`chip ${active === c.slug ? 'chip-on' : ''}`} aria-current={active === c.slug ? 'page' : undefined}>
          {c.name}
        </Link>
      ))}
    </nav>
  )
}
