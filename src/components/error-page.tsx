import { Link } from '@tanstack/react-router'
import { useTitle } from '#/lib/title'

function ErrorPage() {
  useTitle('Page not found')
  return (
    <main className="not-found">
      <span className="lab">404</span>
      <h1 className="c">Page not found</h1>
      <p>The page you are looking for does not exist or is no longer available.</p>
      <Link to="/" className="button">Back to home</Link>
    </main>
  )
}

export default ErrorPage
