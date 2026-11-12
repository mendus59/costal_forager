/**
 * Two fixes to expo-widgets (SDK 58) Android home-screen widgets:
 *
 * 1. Open the app when tapped. expo-widgets renders Android widgets with
 *    Glance but gives the widget itself no tap action, unlike iOS where
 *    `widgetURL` does this. The whole widget becomes clickable: it opens the
 *    widget's `url` prop (a coastalforager:// deep link) or, without one, the
 *    app's main screen.
 * 2. Tell the layout its size. The layout gets `widthDp` and `heightDp` in its
 *    environment (its second argument) so it can fit itself to the widget, as
 *    TideWidget does, and the size is saved to
 *    <files>/widget-size-<name>.txt so the app can draw the tide chart image
 *    at the shape it will be shown.
 * 3. Keep "now" current. The layout also gets `nowMs`, the time it renders,
 *    so it can draw the tide chart's now line and pick the next high and low
 *    itself, and the widget provider asks Android to redraw it every 30
 *    minutes (updatePeriodMillis, the shortest Android allows). A redraw only
 *    re-runs the layout with the saved props: no network and no app start.
 *
 * Runs after `npm install` / `npm ci` (postinstall). It only edits the
 * installed copy in node_modules, is idempotent, and fails loudly if
 * expo-widgets changes so the patch no longer applies, rather than silently
 * shipping widgets that do nothing when tapped.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules/expo-widgets/android/src/main/java/expo/modules/widgets/ExpoWidgetsPeekWidget.kt',
);
const MARK = '// coastal-forager: open the app on tap';
const SIZE_MARK = '// coastal-forager: widget size';
const NOW_MARK = '// coastal-forager: render time';
const plugin = path.join(__dirname, '..', 'node_modules/expo-widgets/plugin/build/android/withAndroidWidgetFiles.js');
const PERIOD = 'android:updatePeriodMillis="1800000"';

if (!fs.existsSync(file)) {
  console.log('patch-expo-widgets: expo-widgets not installed, skipping');
  process.exit(0);
}
let src = fs.readFileSync(file, 'utf8');
let pluginSrc = fs.readFileSync(plugin, 'utf8');
if (src.includes(MARK) && src.includes(SIZE_MARK) && src.includes(NOW_MARK) && pluginSrc.includes(PERIOD)) process.exit(0);

const replace = (from, to) => {
  if (!src.includes(from)) {
    console.error(`patch-expo-widgets: could not find:\n${from}\nin ${file}. Update scripts/patch-expo-widgets.cjs.`);
    process.exit(1);
  }
  src = src.replace(from, to);
};

if (!src.includes(MARK)) {
  replace(
    'import android.content.Context\n',
    [
      'import android.content.Context',
      'import android.content.Intent',
      'import android.net.Uri',
      'import androidx.glance.action.clickable',
      'import androidx.glance.appwidget.action.actionStartActivity',
      'import androidx.glance.layout.fillMaxSize',
      '',
    ].join('\n'),
  );
  replace(
    '    return node.toPeekRoot(appContext, InteractionSource.Widget(widgetName), size)\n',
    `    val root = node.toPeekRoot(appContext, InteractionSource.Widget(widgetName), size)
    ${MARK}
    val url = props?.get("url") as? String
    val intent = (
      url?.let { Intent(Intent.ACTION_VIEW, Uri.parse(it)).setPackage(appContext.packageName) }
        ?: appContext.packageManager.getLaunchIntentForPackage(appContext.packageName)
      )?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (intent != null) root.modifier = root.modifier.fillMaxSize().clickable(actionStartActivity(intent))
    return root
`,
  );
}
if (!src.includes(SIZE_MARK)) {
  replace(
    '    val environment = getWidgetEnvironment(appContext)\n',
    `    ${SIZE_MARK}
    runCatching {
      java.io.File(appContext.filesDir, "widget-size-$widgetName.txt").writeText("\${size.width.value},\${size.height.value}")
    }
    val environment = getWidgetEnvironment(appContext) +
      mapOf("widthDp" to size.width.value.toDouble(), "heightDp" to size.height.value.toDouble())
`,
  );
}
if (!src.includes(NOW_MARK)) {
  replace(
    '      mapOf("widthDp" to size.width.value.toDouble(), "heightDp" to size.height.value.toDouble())\n',
    `      mapOf("widthDp" to size.width.value.toDouble(), "heightDp" to size.height.value.toDouble()) +
      ${NOW_MARK}
      mapOf("nowMs" to System.currentTimeMillis().toDouble())
`,
  );
}
if (!pluginSrc.includes(PERIOD)) {
  const from = 'android:updatePeriodMillis="0"';
  if (!pluginSrc.includes(from)) {
    console.error(`patch-expo-widgets: could not find ${from} in ${plugin}. Update scripts/patch-expo-widgets.cjs.`);
    process.exit(1);
  }
  pluginSrc = pluginSrc.replace(from, PERIOD);
  fs.writeFileSync(plugin, pluginSrc);
}
fs.writeFileSync(file, src);
console.log('patch-expo-widgets: Android widgets now open the app on tap, know their size and time, and redraw every 30 minutes');
