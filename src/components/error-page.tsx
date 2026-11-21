import { Link } from '@tanstack/react-router'
import { useTitle } from '#/lib/title'

function ErrorPage({ label, title, text }: { label: string; title: string; text: string }) {
  useTitle(title)
  return (
    <main className="not-found">
      <span className="lab">{label}</span>
      <h1 className="c">{title}</h1>
      <p>{text}</p>
      <Link to="/" className="text-link">Back to home →</Link>
    </main>
  )
}

export const NotFound = () => (
  <ErrorPage label="404" title="Page not found" text="The page you are looking for does not exist or is no longer available." />
)

export const PageError = () => (
  <ErrorPage label="Error" title="Something went wrong" text="This page could not be shown. Please reload, or go back to the home page." />
)
