/** The web app has no push alerts; the phone apps do. */
export const pushSupported = false;

export async function registerForPush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  return { ok: false, reason: 'Alerts are available in the iPhone and Android apps.' };
}

export function listenForTaps(): () => void {
  return () => {};
}
