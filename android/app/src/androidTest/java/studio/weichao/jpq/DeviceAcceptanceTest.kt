package studio.weichao.jpq

import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import androidx.test.uiautomator.Until
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import studio.weichao.jpq.audio.MetronomeService

@LargeTest
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class DeviceAcceptanceTest {
    @get:Rule(order = 0)
    val watcher = object : TestWatcher() {
        override fun starting(description: Description) {
            DeviceProbe.log("BEGIN ${description.methodName}")
        }
        override fun succeeded(description: Description) {
            DeviceProbe.log("PASS ${description.methodName}")
        }
        override fun failed(e: Throwable, description: Description) {
            DeviceProbe.log("FAIL ${description.methodName} ${e.javaClass.simpleName}: ${e.message}")
        }
    }

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<MainActivity>()

    private val device get() = DeviceProbe.device()
    private val inst get() = InstrumentationRegistry.getInstrumentation()

    @Before
    fun settle() {
        DeviceProbe.ensureScreenReady()
        device.wait(Until.hasObject(By.pkg(DeviceProbe.PKG).depth(0)), 8000)
        var ready = false
        var tries = 0
        while (!ready && tries++ < 25) {
            ready = runCatching {
                compose.onAllNodesWithText("▶").fetchSemanticsNodes().isNotEmpty() ||
                    compose.onAllNodesWithText("❚❚").fetchSemanticsNodes().isNotEmpty()
            }.getOrDefault(false)
            if (!ready) Thread.sleep(400)
        }
        assertTrue("compose practice screen visible", ready)
        DeviceProbe.log("settle fgs=${DeviceProbe.fgsOrLock()} pid=${DeviceProbe.pid()}")
        closeSettingsIfOpen()
        ensureZhPracticeScreen()
        ensureStopped()
        DeviceProbe.log("settle-done fgs=${DeviceProbe.fgsOrLock()}")
    }

    @After
    fun tearDown() {
        runCatching { ensureStopped() }
        DeviceProbe.log("teardown fgs=${DeviceProbe.fgsOrLock()} pid=${DeviceProbe.pid()}")
    }

    private data class ClockSnap(
        val servicePlaying: Boolean,
        val schedPlaying: Boolean,
        val bpm: Int,
        val beatIndex: Int,
        val nextNoteTime: Double
    )

    private fun nodes(text: String, substring: Boolean = false): List<SemanticsNode> =
        compose.onAllNodes(hasText(text, substring = substring)).fetchSemanticsNodes()

    private fun hasAny(vararg labels: String, substring: Boolean = false): Boolean =
        labels.any { nodes(it, substring).isNotEmpty() }

    private fun clickFirst(vararg labels: String) {
        for (l in labels) {
            val all = compose.onAllNodesWithText(l)
            if (all.fetchSemanticsNodes().isNotEmpty()) {
                all.onFirst().performClick()
                compose.waitForIdle()
                return
            }
        }
        error("none of ${labels.toList()} clickable")
    }

    private fun closeSettingsIfOpen() {
        repeat(4) {
            when {
                nodes("完成").isNotEmpty() -> {
                    compose.onAllNodesWithText("完成").onFirst().performClick()
                    compose.waitForIdle()
                }
                nodes("Done").isNotEmpty() -> {
                    compose.onAllNodesWithText("Done").onFirst().performClick()
                    compose.waitForIdle()
                }
                else -> return
            }
        }
        runCatching { device.pressBack(); compose.waitForIdle() }
    }

    private fun ensureZhPracticeScreen() {
        closeSettingsIfOpen()
        // EN practice screen shows top bean "中文"; ZH shows "EN".
        if (nodes("中文").isNotEmpty() && nodes("完成").isEmpty() && nodes("Done").isEmpty()) {
            compose.onAllNodesWithText("中文").onFirst().performClick()
            compose.waitForIdle()
        }
    }

    private fun ensureStopped() {
        closeSettingsIfOpen()
        compose.waitForIdle()
        if (nodes("❚❚").isNotEmpty()) {
            compose.onAllNodesWithText("❚❚").onFirst().performClick()
            compose.waitForIdle()
        }
        inst.runOnMainSync {
            val act = runCatching { compose.activity }.getOrNull()
            if (act != null) {
                val f = MainActivity::class.java.getDeclaredField("service")
                f.isAccessible = true
                (f.get(act) as? MetronomeService)?.stopPlayback()
            }
        }
        waitReleased(2500)
        if (DeviceProbe.fgsOrLock()) {
            DeviceProbe.log("WARN still FGS after stopPlayback (no force-stop in-process)")
        }
    }

    private fun playingUi(): Boolean =
        hasAny("正在播放", "Playing", substring = true)

    private fun idleUi(): Boolean =
        hasAny("待开始", "Ready", substring = true)

    private fun waitPlayingUi(ms: Long = 12_000) {
        compose.waitUntil(ms) { playingUi() }
    }

    private fun waitIdleUi(ms: Long = 12_000) {
        compose.waitUntil(ms) { idleUi() }
    }

    private fun waitReleased(ms: Long = 5000) {
        val t0 = System.currentTimeMillis()
        while (System.currentTimeMillis() - t0 < ms) {
            if (!DeviceProbe.fgsOrLock()) return
            Thread.sleep(200)
        }
    }

    private fun tapPlay() {
        closeSettingsIfOpen()
        compose.onAllNodesWithText("▶").onFirst().performClick()
        compose.waitForIdle()
        waitPlayingUi()
        compose.waitUntil(8000) { DeviceProbe.fgsOrLock() }
    }

    private fun tapPause() {
        closeSettingsIfOpen()
        if (nodes("❚❚").isNotEmpty()) {
            compose.onAllNodesWithText("❚❚").onFirst().performClick()
            compose.waitForIdle()
        }
        waitIdleUi()
        waitReleased(5000)
        assertFalse("FGS/WakeLock still held after pause", DeviceProbe.fgsOrLock())
    }

    private fun pillHasBpm(bpm: Int): Boolean {
        val nodes = compose.onAllNodes(hasText("BPM", substring = true)).fetchSemanticsNodes()
        return nodes.any { "$bpm BPM" in it.toString() } ||
            runCatching {
                compose.onAllNodes(hasText("$bpm BPM", substring = true)).fetchSemanticsNodes().isNotEmpty()
            }.getOrDefault(false)
    }

    private fun assertBpm(bpm: Int) {
        compose.waitUntil(8000) { pillHasBpm(bpm) }
        assertTrue("UI BPM $bpm", pillHasBpm(bpm))
    }

    private fun currentBpm(): Int? {
        val rx = Regex("(\\d+)\\s*BPM")
        val nodes = compose.onAllNodes(hasText("BPM", substring = true)).fetchSemanticsNodes()
        for (n in nodes) {
            val m = rx.find(n.toString())
            if (m != null) return m.groupValues[1].toInt()
        }
        return null
    }

    private fun nudgeToBpm(target: Int) {
        closeSettingsIfOpen()
        compose.waitForIdle()
        var guard = 0
        while (guard++ < 200) {
            compose.waitForIdle()
            val cur = currentBpm()
            if (cur == target || pillHasBpm(target)) break
            val label = if ((cur ?: (target - 1)) < target) "+" else "−"
            val buttons = compose.onAllNodesWithText(label)
            assertTrue(
                "bpm $label on practice screen (cur=$cur target=$target)",
                buttons.fetchSemanticsNodes().isNotEmpty()
            )
            buttons.onFirst().performClick()
            compose.waitForIdle()
        }
        assertBpm(target)
    }

    private fun clockSnap(): ClockSnap {
        var snap: ClockSnap? = null
        inst.runOnMainSync {
            val svc = metronomeServiceSync()
            val sch = svc?.clock?.scheduler
            snap = ClockSnap(
                servicePlaying = svc?.isPlaying() == true,
                schedPlaying = sch?.playing == true,
                bpm = sch?.bpm ?: -1,
                beatIndex = sch?.beatIndex ?: -1,
                nextNoteTime = sch?.nextNoteTime ?: -1.0
            )
        }
        return snap!!
    }

    private fun metronomeServiceSync(): MetronomeService? {
        val act = runCatching { compose.activity }.getOrNull() ?: return null
        val f = MainActivity::class.java.getDeclaredField("service")
        f.isAccessible = true
        return f.get(act) as? MetronomeService
    }

    private fun openSettings() {
        closeSettingsIfOpen()
        when {
            nodes("设置").isNotEmpty() -> compose.onAllNodesWithText("设置").onFirst().performClick()
            else -> compose.onAllNodes(hasText("Settings") and hasClickAction()).onFirst().performClick()
        }
        compose.waitForIdle()
        compose.waitUntil(8000) { hasAny("完成", "Done") || hasAny("传统", "Traditional") }
    }

    @Test
    fun a01_playRecreateThenPauseReleasesFgs() {
        tapPlay()
        assertTrue("FGS/lock after play", DeviceProbe.fgsOrLock())
        assertTrue("playing UI after play", playingUi())
        val snapPlay = clockSnap()
        assertTrue("service playing after tap", snapPlay.servicePlaying && snapPlay.schedPlaying)
        val pidBefore = DeviceProbe.pid()
        compose.activityRule.scenario.recreate()
        compose.waitForIdle()
        waitPlayingUi()
        compose.waitUntil(10_000) {
            playingUi() && DeviceProbe.fgsOrLock() && (clockSnap().servicePlaying)
        }
        val snapRecreate = clockSnap()
        assertTrue("playing UI after recreate", playingUi())
        assertTrue("FGS after recreate", DeviceProbe.fgsOrLock())
        assertTrue(
            "service still playing after recreate ui=${playingUi()} svc=${snapRecreate.servicePlaying}",
            snapRecreate.servicePlaying && snapRecreate.schedPlaying
        )
        tapPause()
        assertFalse("FGS/lock after one pause", DeviceProbe.fgsOrLock())
        assertTrue("idle UI after pause", idleUi())
        DeviceProbe.log("play-recreate-pause pidBefore=$pidBefore pidAfter=${DeviceProbe.pid()} snap=$snapRecreate")
    }

    @Test
    fun a02_bpm40Hold60s() {
        holdBpm(40)
    }

    @Test
    fun a03_bpm120Hold60s() {
        holdBpm(120)
    }

    @Test
    fun a04_bpm208Hold60s() {
        holdBpm(208)
    }

    private fun holdBpm(target: Int) {
        nudgeToBpm(target)
        assertBpm(target)
        tapPlay()
        val t0 = System.currentTimeMillis()
        var lastSnap = clockSnap()
        assertTrue("clock bpm $target", lastSnap.bpm == target && lastSnap.schedPlaying)
        while (System.currentTimeMillis() - t0 < 60_000) {
            Thread.sleep(15_000)
            compose.waitForIdle()
            assertBpm(target)
            assertTrue("playing UI during $target hold", playingUi())
            assertTrue("FGS during $target hold", DeviceProbe.fgsOrLock())
            lastSnap = clockSnap()
            assertTrue("scheduler still $target", lastSnap.bpm == target && lastSnap.schedPlaying)
            assertTrue("clock timeline advanced", lastSnap.nextNoteTime > 1.0)
        }
        tapPause()
        DeviceProbe.log("bpm-$target-60s UI+FGS+scheduler not ear next=${lastSnap.nextNoteTime}")
    }

    @Test
    fun a05_changeBpmWhilePlaying() {
        nudgeToBpm(80)
        tapPlay()
        val before = clockSnap()
        val uiBefore = currentBpm()
        compose.onAllNodesWithText("+").onFirst().performClick()
        compose.waitForIdle()
        val after = clockSnap()
        val uiAfter = currentBpm()
        assertTrue("still FGS", DeviceProbe.fgsOrLock())
        assertTrue("playing UI", playingUi())
        assertTrue("ui bpm changed $uiBefore -> $uiAfter", uiAfter != null && uiBefore != null && uiAfter != uiBefore)
        assertTrue("scheduler bpm changed ${before.bpm} -> ${after.bpm}", after.bpm != before.bpm && after.bpm == uiAfter)
        assertTrue("service still playing", after.servicePlaying && after.schedPlaying)
        // start() would reset nextNoteTime to ~0.02; live setBpm keeps the timeline.
        assertTrue(
            "clock not restarted before.next=${before.nextNoteTime} after.next=${after.nextNoteTime}",
            after.nextNoteTime > 1.0 && after.nextNoteTime + 0.05 >= before.nextNoteTime
        )
        tapPause()
        DeviceProbe.log("bpm-while-playing before=$before after=$after ui=$uiBefore->$uiAfter")
    }

    @Test
    fun a06_homeReturnKeepsPlaying() {
        tapPlay()
        device.pressHome()
        Thread.sleep(1200)
        assertTrue("FGS while HOME", DeviceProbe.fgsOrLock())
        device.executeShellCommand("am start -n ${DeviceProbe.PKG}/.MainActivity")
        device.wait(Until.hasObject(By.pkg(DeviceProbe.PKG).depth(0)), 8000)
        compose.waitForIdle()
        waitPlayingUi()
        assertTrue("FGS after return", DeviceProbe.fgsOrLock())
        assertTrue("service after return", clockSnap().servicePlaying)
        tapPause()
        DeviceProbe.log("home-return PASS")
    }

    @Test
    fun a07_notificationPause() {
        tapPlay()
        Thread.sleep(1000)
        val keys = DeviceProbe.notifKeys()
        val nDump = DeviceProbe.notificationDump()
        DeviceProbe.log("notif keys=$keys dump=${nDump.take(1500)}")
        assertTrue("FGS notification expected while playing keys=$keys", DeviceProbe.fgsOrLock())
        device.openNotification()
        device.waitForIdle()
        Thread.sleep(800)
        val xml = DeviceProbe.dumpHierarchyFiltered("shade")
        var tapped = false
        val pauseSel = listOf(
            UiSelector().text("暂停"),
            UiSelector().text("Pause"),
            UiSelector().description("暂停"),
            UiSelector().description("Pause"),
            UiSelector().textContains("暂停"),
            UiSelector().textContains("Pause")
        )
        for (sel in pauseSel) {
            val obj = device.findObject(sel)
            if (obj.waitForExists(600)) {
                obj.click()
                tapped = true
                DeviceProbe.log("shade clicked selector=$sel")
                break
            }
        }
        if (!tapped) {
            runCatching {
                val scroll = UiScrollable(UiSelector().scrollable(true))
                scroll.scrollIntoView(UiSelector().textContains("BPM"))
            }
            val bounds = DeviceProbe.boundsFor(xml, listOf("暂停", "Pause"))
                ?: DeviceProbe.boundsFor(DeviceProbe.dumpHierarchyFiltered("shade2"), listOf("暂停", "Pause"))
            if (bounds != null) {
                device.click(bounds.cx, bounds.cy)
                tapped = true
                DeviceProbe.log("shade clicked bounds=$bounds")
            }
        }
        if (!tapped) {
            DeviceProbe.log("shade Pause not hit; ACTION_STOP cleanup only, not PASS")
            device.executeShellCommand(
                "am startservice -n ${DeviceProbe.PKG}/.audio.MetronomeService -a ${MetronomeService.ACTION_STOP}"
            )
            waitReleased(5000)
        }
        runCatching { device.pressBack() }
        Thread.sleep(800)
        runCatching { device.pressBack() }
        device.wait(Until.hasObject(By.pkg(DeviceProbe.PKG).depth(0)), 5000)
        compose.waitForIdle()
        assertTrue("notification Pause tapped in shade (ACTION_STOP is cleanup, not PASS)", tapped)
        waitReleased(8000)
        assertFalse("FGS after notification pause tapped=$tapped", DeviceProbe.fgsOrLock())
        DeviceProbe.log("notification-pause PASS tapped=$tapped keys=$keys")
    }

    @Test
    fun a08_settingsModesSignatureLangAndSideloadWorkshop() {
        openSettings()
        clickFirst("传统", "Traditional")
        clickFirst("均匀", "Uniform")
        clickFirst("童声", "Voice")
        for (sig in listOf("4/4", "3/4", "2/4", "6/8", "5/4", "7/8")) {
            compose.onAllNodesWithText(sig).onFirst().performClick()
            compose.waitForIdle()
        }
        clickFirst("3/4")
        assertTrue("中文 chip", hasAny("中文"))
        clickFirst("English")
        compose.waitForIdle()
        assertTrue(
            "English settings",
            compose.onAllNodesWithText("Settings").fetchSemanticsNodes().isNotEmpty() ||
                hasAny("Traditional", "Uniform", "Voice")
        )
        clickFirst("中文")
        compose.waitForIdle()
        var blob = semanticsBlob()
        var guard = 0
        while (guard++ < 10 && listOf("音色工坊", "Sound Workshop", "工坊内购只在", "Google Play").none { it in blob }) {
            device.swipe(device.displayWidth / 2, (device.displayHeight * 0.78).toInt(), device.displayWidth / 2, (device.displayHeight * 0.35).toInt(), 12)
            compose.waitForIdle()
            blob = semanticsBlob()
        }
        val sawWorkshop = "音色工坊" in blob || "Sound Workshop" in blob
        val sawSideload = "工坊内购只在" in blob || "Google Play" in blob || "Workshop purchases only work" in blob
        val sawRestore = "恢复购买" in blob || "Restore" in blob
        val sawUnlock = "解锁" in blob || "Unlock" in blob
        closeSettingsIfOpen()
        assertTrue("workshop visible blob=${blob.take(400)}", sawWorkshop)
        assertTrue("sideload workshop limit copy", sawSideload)
        DeviceProbe.log("settings workshop=$sawWorkshop sideload=$sawSideload restore=$sawRestore unlockShown=$sawUnlock")
    }

    private fun semanticsBlob(): String =
        compose.onAllNodes(hasText("", substring = true)).fetchSemanticsNodes().joinToString("\n") { it.toString() }

    @Test
    fun a09_restorePracticePrefsViaUi() {
        closeSettingsIfOpen()
        ensureZhPracticeScreen()
        openSettings()
        clickFirst("童声", "Voice")
        clickFirst("3/4")
        clickFirst("中文")
        closeSettingsIfOpen()
        nudgeToBpm(85)
        assertBpm(85)
        assertTrue("3/4 on pill", hasAny("3/4", substring = true))
        assertTrue("voice/zh pill", hasAny("童声", substring = true))
        DeviceProbe.log("restore-prefs-ui PASS 85/3/4/voice/zh")
    }

    @Test
    fun a10_lockScreenBackgroundStillFgs() {
        tapPlay()
        assertTrue(DeviceProbe.fgsOrLock())
        device.pressHome()
        Thread.sleep(800)
        assertTrue("FGS after HOME before sleep", DeviceProbe.fgsOrLock())
        device.executeShellCommand("input keyevent 223")
        Thread.sleep(2500)
        val power = DeviceProbe.dumpsysPower()
        val asleep = DeviceProbe.screenAsleep(power)
        val playingWhileOff = DeviceProbe.fgsOrLock()
        DeviceProbe.log("lock powerAsleep=$asleep fgs=$playingWhileOff wakeful=${power.lineSequence().filter { "mWakefulness" in it || "Display Power" in it }.joinToString()}")
        device.executeShellCommand("input keyevent 224")
        Thread.sleep(500)
        DeviceProbe.ensureScreenReady()
        assertTrue("FGS while screen-off/home attempted asleep=$asleep", playingWhileOff)
        runCatching {
            device.executeShellCommand("am start -n ${DeviceProbe.PKG}/.MainActivity")
            Thread.sleep(800)
            compose.waitForIdle()
            tapPause()
        }
        DeviceProbe.log("lock-background PASS fgsWhileOff=$playingWhileOff asleep=$asleep (not ear)")
    }

    @Ignore("instrumentation shares the app process; swiping this recents card kills the runner. Recents removal is NOT covered by scripts/test_android_device.py; a separate external UI harness is required.")
    @Test
    fun a11_recentsSwipeThisAppOnly() {
        tapPlay()
        Thread.sleep(600)
        device.pressRecentApps()
        device.waitForIdle()
        Thread.sleep(1200)
        val xml = DeviceProbe.dumpHierarchyFiltered("recents")
        val recentsSys = DeviceProbe.recentsDumpFiltered()
        DeviceProbe.log("recents sys=${recentsSys.take(1200)}")
        val keys = listOf("小兔头", "节拍器", "Bunny Metronome", "Bunny", "Metronome")
        var card = DeviceProbe.boundsFor(xml, keys)
        if (card == null) {
            for (k in keys) {
                val obj = device.findObject(UiSelector().textContains(k))
                if (obj.waitForExists(400)) {
                    val r = obj.visibleBounds
                    card = DeviceProbe.Bounds(r.left, r.top, r.right, r.bottom)
                    break
                }
                val obj2 = device.findObject(UiSelector().descriptionContains(k))
                if (obj2.waitForExists(200)) {
                    val r = obj2.visibleBounds
                    card = DeviceProbe.Bounds(r.left, r.top, r.right, r.bottom)
                    break
                }
            }
        }
        assertTrue("our recents card located xmlKeys=${keys} card=$card", card != null)
        val c = card!!
        DeviceProbe.log("RECENTS_SWIPE_NOW card=$c")
        // Dismiss this card only. Swiping our task may kill this process (tests share the app process).
        val startY = (c.t - 120).coerceAtLeast(c.cy).coerceAtMost(device.displayHeight - 80)
        device.swipe(c.cx, startY, c.cx, 8, 18)
        Thread.sleep(1000)
        if (DeviceProbe.recentsMentionsUs() && DeviceProbe.fgsOrLock()) {
            device.swipe(c.cx, (c.t + c.b) / 2, c.cx, 8, 22)
            Thread.sleep(800)
        }
        runCatching { device.pressHome() }
        Thread.sleep(700)
        val gone = !DeviceProbe.recentsMentionsUs()
        val released = !DeviceProbe.fgsOrLock()
        DeviceProbe.log("RECENTS_AFTER gone=$gone released=$released card=$c")
        assertTrue("task gone from recents gone=$gone released=$released", gone || released)
        assertTrue("FGS/lock released after recents swipe", released)
    }
}
