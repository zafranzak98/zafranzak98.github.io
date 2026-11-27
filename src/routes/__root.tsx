import { Outlet, createRootRoute } from '@tanstack/react-router'

import '@fontsource-variable/instrument-sans/wdth.css'
import '../styles.css'
import Header from '#/components/header'
import Footer from '#/components/footer'
import { NotFound, PageError } from '#/components/error-page'
import { sharedElements } from '#/lib/page-layouts'

export const Route = createRootRoute({
  errorComponent: PageError,
  notFoundComponent: NotFound,
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="page" id="top">
      <a href="#main" className="skip">Skip to content</a>
      <Header elements={sharedElements('header')} />
      <Outlet />
      <Footer elements={sharedElements('footer')} />
    </div>
  )
}
