/**
 * Makes Android home-screen widgets open the app when tapped.
 *
 * expo-widgets (SDK 58) renders Android widgets with Glance but gives the
 * widget itself no tap action, unlike iOS where `widgetURL` does this. This
 * patch makes the whole widget clickable: it opens the widget's `url` prop
 * (a coastalforager:// deep link) or, without one, the app's main screen.
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

if (!fs.existsSync(file)) {
  console.log('patch-expo-widgets: expo-widgets not installed, skipping');
  process.exit(0);
}
let src = fs.readFileSync(file, 'utf8');
if (src.includes(MARK)) process.exit(0);

const replace = (from, to) => {
  if (!src.includes(from)) {
    console.error(`patch-expo-widgets: could not find:\n${from}\nin ${file}. Update scripts/patch-expo-widgets.cjs.`);
    process.exit(1);
  }
  src = src.replace(from, to);
};

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
fs.writeFileSync(file, src);
console.log('patch-expo-widgets: Android widgets now open the app on tap');
