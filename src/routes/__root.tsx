import { Outlet, createRootRoute } from '@tanstack/react-router'

import '@fontsource-variable/instrument-sans/wdth.css'
import '../styles.css'
import Header from '#/components/header'
import Footer from '#/components/footer'
import { NotFound, PageError } from '#/components/error-page'

export const Route = createRootRoute({
  errorComponent: PageError,
  notFoundComponent: NotFound,
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="page" id="top">
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}
