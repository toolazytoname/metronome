package studio.weichao.jpq

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File

/** Shell snapshots of this package only. Not ear. */
object DeviceProbe {
    const val PKG = "studio.weichao.jpq"
    const val TAG = "JpqDevice"
    private val ourMarks = listOf(
        "小兔头", "节拍器", "Bunny", "Metronome", "jpq", "weichao",
        "暂停", "Pause", "BPM", "正在播放", "Playing", "待开始", "Ready"
    )

    fun device(): UiDevice = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())

    fun dumpsysService(): String =
        device().executeShellCommand("dumpsys activity services $PKG") ?: ""

    fun dumpsysPower(): String =
        device().executeShellCommand("dumpsys power") ?: ""

    fun notifKeys(): List<String> =
        (device().executeShellCommand("cmd notification list") ?: "")
            .lineSequence()
            .filter { PKG in it }
            .map { it.trim().take(180) }
            .toList()

    fun notificationDump(): String {
        val raw = device().executeShellCommand("dumpsys notification --noredact") ?: ""
        return raw.lineSequence()
            .filter { line -> ourMarks.any { it in line } || PKG in line || "ACTION_STOP" in line || "metro" in line }
            .joinToString("\n")
            .take(6000)
    }

    fun wakelockHeld(): Boolean {
        val p = dumpsysPower()
        val m = Regex("Wake Locks:\\s*size=(\\d+)").find(p) ?: return false
        val block = p.substring(m.range.last + 1).lineSequence().take(40)
        for (line in block) {
            if (Regex("^\\s+\\d{2}-\\d{2}\\s").containsMatchIn(line)) break
            if ("jpq:metro" in line) return true
        }
        return false
    }

    fun fgsOrLock(): Boolean {
        val s = dumpsysService()
        if ("MetronomeService" !in s) return wakelockHeld()
        return "startRequested=true" in s ||
            "isForeground=true" in s ||
            wakelockHeld()
    }

    fun serviceRecord(): Boolean =
        "MetronomeService" in dumpsysService() && "ServiceRecord" in dumpsysService()

    fun pid(): String? =
        device().executeShellCommand("pidof $PKG")?.trim()?.takeIf { it.isNotEmpty() }

    /** Wake + one upward swipe if the keyguard is showing. Does not change lock settings. */
    fun ensureScreenReady() {
        val d = device()
        if (!d.isScreenOn) {
            runCatching { d.wakeUp() }
            d.executeShellCommand("input keyevent 224")
            Thread.sleep(400)
        }
        val policy = d.executeShellCommand("dumpsys window policy")
        if ("mIsShowing=true" in policy || "showing=true" in policy && "Keyguard" in policy) {
            d.executeShellCommand("input swipe 540 1800 540 400 200")
            Thread.sleep(600)
        }
    }

    fun recentsMentionsUs(): Boolean {
        val recents = device().executeShellCommand("dumpsys activity recents") ?: ""
        return PKG in recents || "小兔头" in recents || "BunnyMetronome" in recents
    }

    fun recentsDumpFiltered(): String {
        val recents = device().executeShellCommand("dumpsys activity recents") ?: ""
        return recents.lineSequence()
            .filter { PKG in it || "小兔头" in it || "Bunny" in it || "taskId" in it || "Activities=" in it }
            .joinToString("\n")
            .take(4000)
    }

    fun screenAsleep(power: String = dumpsysPower()): Boolean {
        val p = power
        return "mWakefulness=Asleep" in p ||
            "mWakefulness=Dozing" in p ||
            Regex("Display Power: state=OFF").containsMatchIn(p) ||
            "mScreenOn=false" in p ||
            Regex("mHoldingDisplaySuspendBlocker=false").containsMatchIn(p) && "mWakefulness=Asleep" in p
    }

    /** Accessibility dump; logs only lines that mention this app. */
    fun dumpHierarchyFiltered(tag: String): String {
        val dir = InstrumentationRegistry.getInstrumentation().targetContext.cacheDir
        val f = File(dir, "hier-$tag.xml")
        device().dumpWindowHierarchy(f)
        val xml = if (f.exists()) f.readText() else ""
        val kept = xml.lineSequence()
            .filter { line -> ourMarks.any { m -> m in line } || PKG in line }
            .joinToString("\n")
        Log.i(TAG, "DUMP $tag bytes=${xml.length} ourLines=${kept.lines().size}\n${kept.take(2500)}")
        return xml
    }

    data class Bounds(val l: Int, val t: Int, val r: Int, val b: Int) {
        val cx: Int get() = (l + r) / 2
        val cy: Int get() = (t + b) / 2
        fun containsKeywords(xmlNode: String, keys: List<String>): Boolean =
            keys.any { it in xmlNode }
    }

    fun boundsFor(xml: String, keys: List<String>): Bounds? {
        val rx = Regex(
            """<node[^>]*?(?:text|content-desc)="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*/>""" +
                """|<node[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?(?:text|content-desc)="([^"]*)"[^>]*/>""",
            RegexOption.IGNORE_CASE
        )
        for (m in rx.findAll(xml)) {
            val text = (m.groupValues[1] + m.groupValues[10]).trim()
            if (keys.none { it.isNotEmpty() && it in text }) continue
            val l = listOf(m.groupValues[2], m.groupValues[6]).first { it.isNotEmpty() }.toInt()
            val t = listOf(m.groupValues[3], m.groupValues[7]).first { it.isNotEmpty() }.toInt()
            val r = listOf(m.groupValues[4], m.groupValues[8]).first { it.isNotEmpty() }.toInt()
            val b = listOf(m.groupValues[5], m.groupValues[9]).first { it.isNotEmpty() }.toInt()
            if (r - l < 8 || b - t < 8) continue
            return Bounds(l, t, r, b)
        }
        return null
    }

    fun log(msg: String) {
        Log.i(TAG, msg)
    }
}
