/**
 * Runs once when the server starts. Starts the notification clock - only in
 * the Node runtime, where the database is.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startNotifier } = await import('./lib/server/notifier');
  startNotifier();
}
