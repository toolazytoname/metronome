package studio.weichao.jpq.policy

/**
 * Mix a source sample into a destination chunk in absolute frame coordinates.
 * dest covers frames [destOrigin, destOrigin + dest.size).
 * src plays starting at srcOrigin.
 */
object PcmMixer {
    fun mix(
        dest: ShortArray,
        destOrigin: Long,
        src: ShortArray,
        srcOrigin: Long,
        gain: Double
    ) {
        val destEnd = destOrigin + dest.size
        val srcEnd = srcOrigin + src.size
        val start = maxOf(destOrigin, srcOrigin)
        val end = minOf(destEnd, srcEnd)
        if (start >= end) return
        var frame = start
        while (frame < end) {
            val di = (frame - destOrigin).toInt()
            val si = (frame - srcOrigin).toInt()
            val mixed = dest[di] + (src[si] * gain).toInt()
            dest[di] = mixed.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
            frame++
        }
    }

    fun frameForTime(seconds: Double, sampleRate: Int): Long {
        return Math.round(seconds * sampleRate)
    }
}

object PcmResample {
    fun toMono44100(input: ShortArray, srcRate: Int, channels: Int): ShortArray {
        if (input.isEmpty()) return shortArrayOf(0)
        val ch = channels.coerceAtLeast(1)
        val frames = input.size / ch
        val mono = ShortArray(frames)
        for (i in 0 until frames) {
            var acc = 0
            for (c in 0 until ch) acc += input[i * ch + c].toInt()
            mono[i] = (acc / ch).toShort()
        }
        if (srcRate == 44100) return mono
        if (srcRate <= 0) return mono
        val outLen = ((mono.size.toLong() * 44100L) / srcRate).toInt().coerceAtLeast(1)
        val out = ShortArray(outLen)
        for (i in 0 until outLen) {
            val srcPos = i.toDouble() * (mono.size - 1).coerceAtLeast(0) / (outLen - 1).coerceAtLeast(1)
            val lo = srcPos.toInt().coerceIn(0, mono.lastIndex)
            val hi = (lo + 1).coerceAtMost(mono.lastIndex)
            val t = srcPos - lo
            out[i] = (mono[lo] * (1 - t) + mono[hi] * t).toInt().toShort()
        }
        return out
    }
}
