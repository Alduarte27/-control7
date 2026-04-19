'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h2 className="text-2xl font-bold text-destructive">¡Algo salió mal!</h2>
      <p className="max-w-md text-muted-foreground">
        Ha ocurrido un error inesperado en la aplicación.
      </p>
      <div className="rounded-md bg-muted p-4 text-left font-mono text-xs overflow-auto max-w-full">
        {error.message}
      </div>
      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        onClick={() => reset()}
      >
        Intentar de nuevo
      </button>
    </div>
  )
}
