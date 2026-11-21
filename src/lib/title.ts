import { useEffect } from 'react'
import { site } from '#/lib/site'

export function useTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} · ${site.name}` : site.site_title
  }, [page])
}
