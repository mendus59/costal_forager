import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

import { parseTideMapMessage, TIDE_MAP_HTML, type StationPick, type TideMapData } from './tideMapHtml';

// See BeachMap.tsx: react-native-webview's props type needs describing by hand.
interface WebViewHandle {
  injectJavaScript(script: string): void;
}
const WebView = RNWebView as unknown as ComponentType<{
  ref?: Ref<WebViewHandle>;
  style?: StyleProp<ViewStyle>;
  originWhitelist?: string[];
  source: { html: string; baseUrl?: string };
  onMessage?(e: { nativeEvent: { data: string } }): void;
  onLoadStart?(): void;
  setSupportMultipleWindows?: boolean;
}>;

/** Android/iOS: TideWidget's tide map in a WebView. */
export function TideMap({ data, onStation }: { data: TideMapData; onStation(s: StationPick): void }) {
  const ref = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.__twSetData(${JSON.stringify(data)});true;`);
  }, [ready, data]);

  return (
    <WebView
      ref={ref}
      style={styles.map}
      originWhitelist={['*']}
      source={{ html: TIDE_MAP_HTML, baseUrl: 'https://localhost/' }}
      onMessage={(e) => {
        const msg = parseTideMapMessage(e.nativeEvent.data);
        if (msg?.type === 'ready') setReady(true);
        else if (msg?.type === 'station') onStation(msg);
      }}
      onLoadStart={() => setReady(false)}
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({ map: { flex: 1, backgroundColor: 'transparent' } });
