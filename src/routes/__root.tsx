import { Outlet, createRootRoute } from '@tanstack/react-router'

import '../styles.css'
import Header from '#/components/header'
import Footer from '#/components/footer'
import ErrorPage from '#/components/error-page'

export const Route = createRootRoute({
  errorComponent: ErrorPage,
  notFoundComponent: ErrorPage,
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
