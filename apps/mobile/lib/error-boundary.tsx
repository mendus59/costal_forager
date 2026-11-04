import { ErrorBoundary as RouterErrorBoundary, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// On web, each deploy replaces the hashed JS chunks. A tab opened before the
// deploy still asks for the old chunk names, which now 404, so opening a screen
// that wasn't loaded yet fails. Reload once to pick up the new build.
const STALE_CHUNK = /Loading module|dynamically imported module|Loading chunk|Importing a module script failed/i;
const RELOAD_KEY = 'stale-chunk-reload-at';
let reloading = false;

function claimReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false; // just reloaded; don't loop
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: reload anyway.
  }
  return true;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  const stale = Platform.OS === 'web' && STALE_CHUNK.test(String(props.error?.message));
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!stale) return;
    if (reloading) return;
    if (claimReload()) {
      reloading = true;
      window.location.reload();
    }
    else setGaveUp(true);
  }, [stale]);
  if (stale && !gaveUp) return null;
  return <RouterErrorBoundary {...props} />;
}
