export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)]">
      <div className="text-center">
        <h1 className="text-xl font-medium text-[var(--foreground)] mb-2">Page not found</h1>
        <a href="/" className="text-sm text-[var(--accent-blue)] hover:underline">
          Go home
        </a>
      </div>
    </div>
  );
}
