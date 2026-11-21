import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// Addresses end in a slash, matching the folders GitHub Pages serves, so links never pass through a redirect.
const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true, trailingSlash: 'always' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('app')!).render(<RouterProvider router={router} />)
