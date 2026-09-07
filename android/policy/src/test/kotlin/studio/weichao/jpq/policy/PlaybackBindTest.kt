package studio.weichao.jpq.policy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PlaybackBindTest {
    @Test
    fun servicePlayingTrueAlignsUiEvenIfActivityStartedIdle() {
        assertTrue(PlaybackBind.isPlaying(stopped = false, schedulerPlaying = true))
        val ui = PlaybackBind.uiFromService(servicePlaying = true, keepAwakePref = true)
        assertTrue(ui.playing)
        assertFalse(ui.clearBeat)
        assertTrue(ui.keepAwakeOn)
    }

    @Test
    fun idleBindClearsBeatAndKeepAwake() {
        val ui = PlaybackBind.uiFromService(servicePlaying = false, keepAwakePref = true)
        assertFalse(ui.playing)
        assertTrue(ui.clearBeat)
        assertFalse(ui.keepAwakeOn)
    }

    @Test
    fun toggleStopsWhenServicePlayingEvenIfUiFalse() {
        assertEquals(
            PlaybackBind.Toggle.Stop,
            PlaybackBind.toggleAction(servicePlaying = true)
        )
    }

    @Test
    fun toggleStartsWhenServiceIdle() {
        assertEquals(
            PlaybackBind.Toggle.Start,
            PlaybackBind.toggleAction(servicePlaying = false)
        )
    }

    @Test
    fun eitherServiceFlagMeansPlaying() {
        assertTrue(PlaybackBind.isPlaying(stopped = false, schedulerPlaying = false))
        assertTrue(PlaybackBind.isPlaying(stopped = true, schedulerPlaying = true))
        assertFalse(PlaybackBind.isPlaying(stopped = true, schedulerPlaying = false))
    }
}

class PlaybackListenerGateTest {
    @Test
    fun oldOwnerReleaseDoesNotClearNewOwnerCallback() {
        val gate = PlaybackListenerGate()
        val old = Any()
        val new = Any()
        var fromOld = 0
        var fromNew = 0
        gate.set(old) { fromOld++ }
        gate.set(new) { fromNew++ }
        gate.clear(old)
        assertTrue(gate.shouldDispatch(new))
        assertFalse(gate.shouldDispatch(old))
        gate.dispatchStopped()
        assertEquals(0, fromOld)
        assertEquals(1, fromNew)
        assertEquals(new, gate.owner)
    }

    @Test
    fun matchingOwnerClearDropsCallback() {
        val gate = PlaybackListenerGate()
        val a = Any()
        var n = 0
        gate.set(a) { n++ }
        gate.clear(a)
        assertNull(gate.owner)
        gate.dispatchStopped()
        assertEquals(0, n)
    }
}

class PlaybackActivityWiringTest {
    @Test
    fun mainActivityUsesBindToggleAndOwnedListenerClear() {
        val src = listOf(
            File("app/src/main/java/studio/weichao/jpq/MainActivity.kt"),
            File("../app/src/main/java/studio/weichao/jpq/MainActivity.kt")
        ).first { it.isFile }.readText()
        assertTrue(src.contains("PlaybackBind.toggleAction"))
        assertTrue(src.contains("PlaybackBind.uiFromService"))
        assertTrue(src.contains("syncFromService"))
        assertTrue(src.contains("setUiListener"))
        assertTrue(src.contains("clearUiListener"))
        val toggle = src.substringAfter("private fun toggle()").substringBefore("private fun vibrate")
        assertFalse(toggle.contains("if (playing)"))
        val destroy = src.substringAfter("override fun onDestroy()").substringBefore("private fun t(")
        assertTrue(destroy.contains("clearUiListener"))
        assertFalse(destroy.contains("onStopped = null"))
        assertFalse(destroy.contains("stopPlayback"))
    }
}
