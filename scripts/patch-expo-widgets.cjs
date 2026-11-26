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
 *    TideWidget does, and its recent sizes (newest first, one "w,h" per line;
 *    launchers give one for portrait and one for landscape) are saved to
 *    <files>/widget-size-<name>.txt so the app can draw the tide chart image
 *    at the shape it will be shown. When the widget renders at a size it
 *    hasn't seen (just placed or resized), the app's background task runs a
 *    few seconds later to redraw the chart for that shape.
 * 3. Keep "now" current. The layout also gets `nowMs`, the time it renders,
 *    so it can draw the tide chart's now line and pick the next high and low
 *    itself, and the widget provider asks Android to redraw it every 30
 *    minutes (updatePeriodMillis, the shortest Android allows). A redraw only
 *    re-runs the layout with the saved props: no network and no app start.
 * 4. Refresh on tap. A widget button with target "refresh" (the top-right
 *    corner) redraws the widget at once, marked with `refreshingAt`, so the
 *    now line jumps to the current time, and runs the app's background task
 *    (the WIDGET_TASK in lib/widget-sync.tsx) right away as one-off work, so
 *    it fetches fresh tides and publishes a new chart. The one-off run does
 *    not reschedule the periodic background worker.
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
const SIZE_MARK = '// coastal-forager: widget sizes';
const NOW_MARK = '// coastal-forager: render time';
const plugin = path.join(__dirname, '..', 'node_modules/expo-widgets/plugin/build/android/withAndroidWidgetFiles.js');
const PERIOD = 'android:updatePeriodMillis="1800000"';
const interaction = path.join(path.dirname(file), 'WidgetInteractionAction.kt');
const REFRESH_MARK = '// coastal-forager: refresh on tap';
const bgDir = path.join(__dirname, '..', 'node_modules/expo-background-task/android/src/main/java/expo/modules/backgroundtask');
const bgWork = path.join(bgDir, 'BackgroundTaskWork.kt');
const bgScheduler = path.join(bgDir, 'BackgroundTaskScheduler.kt');
const ONE_OFF_MARK = '// coastal-forager: one-off run';

if (!fs.existsSync(file)) {
  console.log('patch-expo-widgets: expo-widgets not installed, skipping');
  process.exit(0);
}
let src = fs.readFileSync(file, 'utf8');
let pluginSrc = fs.readFileSync(plugin, 'utf8');
let interactionSrc = fs.readFileSync(interaction, 'utf8');
let bgWorkSrc = fs.existsSync(bgWork) ? fs.readFileSync(bgWork, 'utf8') : null;
let bgSchedulerSrc = fs.existsSync(bgScheduler) ? fs.readFileSync(bgScheduler, 'utf8') : null;
if (bgWorkSrc === null || bgSchedulerSrc === null) {
  console.error('patch-expo-widgets: expo-background-task is missing; the widget refresh needs it. Update scripts/patch-expo-widgets.cjs.');
  process.exit(1);
}
if (
  src.includes(MARK) &&
  src.includes(SIZE_MARK) &&
  src.includes(NOW_MARK) &&
  pluginSrc.includes(PERIOD) &&
  interactionSrc.includes(REFRESH_MARK) &&
  bgWorkSrc.includes(ONE_OFF_MARK) &&
  bgSchedulerSrc.includes(ONE_OFF_MARK)
)
  process.exit(0);

const swap = (text, where, from, to) => {
  if (!text.includes(from)) {
    console.error(`patch-expo-widgets: could not find:\n${from}\nin ${where}. Update scripts/patch-expo-widgets.cjs.`);
    process.exit(1);
  }
  return text.replace(from, to);
};
const replace = (from, to) => {
  src = swap(src, file, from, to);
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
      val sizes = java.io.File(appContext.filesDir, "widget-size-$widgetName.txt")
      val here = "\${size.width.value},\${size.height.value}"
      val seen = if (sizes.exists()) sizes.readLines().filter { it.isNotBlank() } else emptyList()
      if (seen.firstOrNull() != here) sizes.writeText((listOf(here) + (seen - here)).take(4).joinToString("\\n"))
      if (here !in seen) {
        // A new size (just placed or resized): redraw the chart for it once the resize settles.
        val worker = Class.forName("expo.modules.backgroundtask.BackgroundTaskWork")
          .asSubclass(androidx.work.ListenableWorker::class.java)
        val request = androidx.work.OneTimeWorkRequest.Builder(worker)
          .setInitialDelay(3, java.util.concurrent.TimeUnit.SECONDS)
          .setInputData(
            androidx.work.Data.Builder()
              .putString("appScopeKey", appContext.packageName)
              .putBoolean("coastalForagerOneOff", true)
              .build()
          )
          .build()
        androidx.work.WorkManager.getInstance(appContext)
          .enqueueUniqueWork("coastal-forager-widget-resize", androidx.work.ExistingWorkPolicy.REPLACE, request)
      }
    }.onFailure { android.util.Log.e("ExpoWidgets", "Widget size bookkeeping failed", it) }
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
if (!interactionSrc.includes(REFRESH_MARK)) {
  interactionSrc = swap(
    interactionSrc,
    interaction,
    '  fun handle(context: Context, source: String, target: String) {\n',
    `  fun handle(context: Context, source: String, target: String) {
    ${REFRESH_MARK}
    if (target == "refresh") {
      val marked = WidgetsLayoutRegistry.props(context, source).orEmpty() +
        ("refreshingAt" to System.currentTimeMillis().toDouble())
      WidgetsStorage.set(context, "__expo_widgets_\${source}_props", marked)
      WidgetsUpdater.reload(context, source)
      runCatching {
        val worker = Class.forName("expo.modules.backgroundtask.BackgroundTaskWork")
          .asSubclass(androidx.work.ListenableWorker::class.java)
        val request = androidx.work.OneTimeWorkRequest.Builder(worker)
          .setInputData(
            androidx.work.Data.Builder()
              .putString("appScopeKey", context.packageName)
              .putBoolean("coastalForagerOneOff", true)
              .build()
          )
          .apply {
            if (android.os.Build.VERSION.SDK_INT >= 31) {
              setExpedited(androidx.work.OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            }
          }
          .build()
        androidx.work.WorkManager.getInstance(context)
          .enqueueUniqueWork("coastal-forager-widget-refresh", androidx.work.ExistingWorkPolicy.REPLACE, request)
      }.onFailure { android.util.Log.e("ExpoWidgets", "Widget refresh failed to start", it) }
      return
    }
`,
  );
  fs.writeFileSync(interaction, interactionSrc);
}
if (!bgWorkSrc.includes(ONE_OFF_MARK)) {
  bgWorkSrc = swap(
    bgWorkSrc,
    bgWork,
    '      BackgroundTaskScheduler.runTasks(applicationContext, appScopeKey)\n',
    `      ${ONE_OFF_MARK}
      BackgroundTaskScheduler.runTasks(applicationContext, appScopeKey, !inputData.getBoolean("coastalForagerOneOff", false))
`,
  );
  fs.writeFileSync(bgWork, bgWorkSrc);
}
if (!bgSchedulerSrc.includes(ONE_OFF_MARK)) {
  bgSchedulerSrc = swap(
    bgSchedulerSrc,
    bgScheduler,
    '  suspend fun runTasks(context: Context, appScopeKey: String) {\n',
    `  ${ONE_OFF_MARK}: reschedule = false runs the tasks once without touching the periodic worker.
  suspend fun runTasks(context: Context, appScopeKey: String, reschedule: Boolean = true) {
`,
  );
  bgSchedulerSrc = swap(
    bgSchedulerSrc,
    bgScheduler,
    '      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n        scheduleWorker(context, appScopeKey, false, 60L.coerceAtMost(intervalMinutes))',
    '      if (reschedule && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n        scheduleWorker(context, appScopeKey, false, 60L.coerceAtMost(intervalMinutes))',
  );
  bgSchedulerSrc = swap(
    bgSchedulerSrc,
    bgScheduler,
    '    // Schedule next task\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {',
    '    // Schedule next task\n    if (reschedule && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {',
  );
  fs.writeFileSync(bgScheduler, bgSchedulerSrc);
}
fs.writeFileSync(file, src);
console.log('patch-expo-widgets: Android widgets now open the app on tap, know their size and time, redraw every 30 minutes and refresh from the top-right corner');
