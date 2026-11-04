import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

import { MAP_HTML, parseMapMessage, type MapData } from './mapHtml';

// react-native-webview 14's published props type collapses to `never` with
// React Native 0.88's types, so describe the part of its API used here.
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

/** Android/iOS: the Leaflet map in a WebView. */
export function BeachMap({
  data,
  onOpen,
  onFavorite,
}: {
  data: MapData;
  onOpen(bidn: string): void;
  onFavorite(bidn: string): void;
}) {
  const ref = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.__cfSetData(${JSON.stringify(data)});true;`);
  }, [ready, data]);

  return (
    <WebView
      ref={ref}
      style={styles.map}
      originWhitelist={['*']}
      source={{ html: MAP_HTML, baseUrl: 'https://localhost/' }}
      onMessage={(e) => {
        const msg = parseMapMessage(e.nativeEvent.data);
        if (msg?.type === 'ready') setReady(true);
        else if (msg?.type === 'open') onOpen(msg.bidn);
        else if (msg?.type === 'favorite') onFavorite(msg.bidn);
      }}
      // A reload (e.g. after the WebView process is killed) needs the data again.
      onLoadStart={() => setReady(false)}
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({ map: { flex: 1, backgroundColor: 'transparent' } });
