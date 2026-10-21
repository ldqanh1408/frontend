import { QueryClient } from '@tanstack/react-query';
import { app } from './app-store';

// Imported only when an authenticated collection is requested. No disk persistence or cross-SPA cache.
export const serviceQuery = new QueryClient({ defaultOptions: { queries: {
  retry: false, staleTime: 0, gcTime: 60_000, refetchOnWindowFocus: false,
} } });
let current = app.get().session;
app.subscribe(() => {
  if (app.get().session !== current) {
    current = app.get().session;
    // Remove old identities immediately. In-flight readers still perform the session identity check in service.ts.
    serviceQuery.clear();
  }
});
