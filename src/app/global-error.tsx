'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h2 className="text-3xl font-bold text-destructive">Error Crítico del Sistema</h2>
        <p className="max-w-md text-muted-foreground">
          La aplicación no pudo iniciarse correctamente debido a un fallo en el servidor global.
        </p>
        <div className="rounded-md bg-muted p-4 text-left font-mono text-xs overflow-auto max-w-full">
          {error.message}
        </div>
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          onClick={() => reset()}
        >
          Reiniciar Aplicación
        </button>
      </body>
    </html>
  )
}
