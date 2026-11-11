import { createElement, useEffect, useRef, useState } from 'react';

import { parseTideMapMessage, TIDE_MAP_HTML, TIDE_MAP_SOURCE, type StationPick, type TideMapData } from './tideMapHtml';

/** Web: the same tide map page in an iframe. */
export function TideMap({ data, onStation }: { data: TideMapData; onStation(s: StationPick): void }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const onStationRef = useRef(onStation);
  onStationRef.current = onStation;

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const msg = parseTideMapMessage(e.data);
      if (msg?.type === 'ready') setReady(true);
      else if (msg?.type === 'station') onStationRef.current(msg);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  useEffect(() => {
    if (ready) ref.current?.contentWindow?.postMessage({ source: TIDE_MAP_SOURCE, type: 'setData', data }, '*');
  }, [ready, data]);

  return createElement('iframe', {
    ref,
    srcDoc: TIDE_MAP_HTML,
    title: 'Tide map',
    style: { border: 0, flex: 1, width: '100%', height: '100%' },
  });
}
