package studio.weichao.jpq.policy

import org.junit.Assert.assertEquals
import org.junit.Test

class PcmMixerTest {
    @Test
    fun mixAtScheduledOffsetSpansChunks() {
        val src = shortArrayOf(1000, 2000, 3000, 4000)
        val chunk0 = ShortArray(3)
        val chunk1 = ShortArray(3)
        // src starts at absolute frame 2: first chunk [0,3) gets src[0] at dest[2]
        PcmMixer.mix(chunk0, destOrigin = 0, src = src, srcOrigin = 2, gain = 1.0)
        assertEquals(0, chunk0[0].toInt())
        assertEquals(0, chunk0[1].toInt())
        assertEquals(1000, chunk0[2].toInt())
        // next chunk [3,6) continues src at frames 3,4,5 -> samples 1,2,3
        PcmMixer.mix(chunk1, destOrigin = 3, src = src, srcOrigin = 2, gain = 1.0)
        assertEquals(2000, chunk1[0].toInt())
        assertEquals(3000, chunk1[1].toInt())
        assertEquals(4000, chunk1[2].toInt())
    }

    @Test
    fun mixAppliesGainAndFrameForTime() {
        val dest = ShortArray(2)
        val src = shortArrayOf(1000, 1000)
        PcmMixer.mix(dest, 0, src, 0, 0.28)
        assertEquals(280, dest[0].toInt())
        assertEquals(PcmMixer.frameForTime(1.0, 44100), 44100L)
        assertEquals(PcmMixer.frameForTime(0.02, 44100), 882L)
    }

    @Test
    fun resampleMono44100IdentityAndDownmix() {
        val ident = PcmResample.toMono44100(shortArrayOf(1, 2, 3), 44100, 1)
        assertEquals(3, ident.size)
        assertEquals(2, ident[1].toInt())
        val stereo = PcmResample.toMono44100(shortArrayOf(10, 30, 20, 40), 44100, 2)
        assertEquals(2, stereo.size)
        assertEquals(20, stereo[0].toInt())
        assertEquals(30, stereo[1].toInt())
    }
}
