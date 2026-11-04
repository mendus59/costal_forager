import { createElement, useEffect, useRef, useState } from 'react';

import { MAP_HTML, MAP_SOURCE, parseMapMessage, type MapData } from './mapHtml';

/** Web: the same Leaflet page in an iframe, so web and mobile share one map. */
export function BeachMap({ data, onOpen }: { data: MapData; onOpen(bidn: string): void }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const msg = parseMapMessage(e.data);
      if (msg?.type === 'ready') setReady(true);
      else if (msg?.type === 'open') onOpenRef.current(msg.bidn);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  useEffect(() => {
    if (ready) ref.current?.contentWindow?.postMessage({ source: MAP_SOURCE, type: 'setData', data }, '*');
  }, [ready, data]);

  return createElement('iframe', {
    ref,
    srcDoc: MAP_HTML,
    title: 'Map of shellfish beaches',
    style: { border: 0, flex: 1, width: '100%', height: '100%' },
  });
}
