package studio.weichao.jpq.audio

import android.content.res.AssetManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import studio.weichao.jpq.policy.BeatScheduler
import studio.weichao.jpq.policy.MetronomePolicy
import studio.weichao.jpq.policy.PcmMixer
import studio.weichao.jpq.policy.PcmResample
import studio.weichao.jpq.policy.SoundMode
import studio.weichao.jpq.policy.SampleCatalog
import java.nio.ByteOrder
import kotlin.concurrent.thread

/**
 * Audio-thread clock: MediaCodec PCM at 44.1kHz mono, mixed at scheduled frame offsets.
 */
class AudioTrackClock(private val assets: AssetManager) {
    @Volatile var scheduler = BeatScheduler()
        private set
    @Volatile var mode: SoundMode = SoundMode.UNIFORM
    @Volatile var lang: String = "zh"
    @Volatile var clickBank: String = MetronomePolicy.DEFAULT_BANK
    @Volatile var voiceBank: String = MetronomePolicy.DEFAULT_BANK
    @Volatile var volume: Float = 0.85f
    @Volatile var onBeat: ((Int) -> Unit)? = null
    @Volatile var ready: Boolean = false
        private set

    private val sampleRate = 44100
    @Volatile private var buffers: Map<String, ShortArray> = emptyMap()
    private val main = Handler(Looper.getMainLooper())
    var onError: (() -> Unit)? = null
    @Volatile private var run: Run? = null

    // A stopped worker retains its own scheduler and cancellation flag. A rapid
    // restart cannot revive it or let it advance the new run's audio timeline.
    private class Run(val track: AudioTrack, val scheduler: BeatScheduler) {
        @Volatile var cancelled = false
    }

    private data class Voice(val pcm: ShortArray, val origin: Long, val gain: Double)
    private data class PendingBeat(val index: Int, val origin: Long)

    private val sampleLoadLock = Any()

    fun load() = synchronized(sampleLoadLock) {
        if (ready) return@synchronized
        val names = SampleCatalog.required.toMutableList()
        for (bank in MetronomePolicy.packClickBanks) {
            for (n in listOf("click-strong", "click-weak", "click-uniform")) names.add("pack/$bank/$n")
        }
        for (bank in MetronomePolicy.packVoiceBanks) {
            for (i in 1..16) names.add("pack/$bank/${SampleCatalog.id(i)}")
        }
        val decoded = HashMap<String, ShortArray>()
        for (name in names) {
            decodeMp3("sounds/$name.mp3")?.takeIf { it.isNotEmpty() }?.let { decoded[name] = it }
        }
        buffers = decoded
        ready = SampleCatalog.complete(decoded)
    }

    @Synchronized fun start() {
        if (run != null) return
        check(ready) { "Samples not ready" }
        val minBuf = AudioTrack.getMinBufferSize(
            sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
        check(minBuf > 0) { "AudioTrack unavailable: $minBuf" }
        val t = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(minBuf * 4)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        try {
            check(t.state == AudioTrack.STATE_INITIALIZED) { "AudioTrack not initialized" }
            t.play()
            val clock = BeatScheduler(scheduler.bpm, scheduler.beatsPerBar)
            clock.start(0.0)
            scheduler = clock
            val session = Run(t, clock)
            run = session
            thread(name = "metro-clock", isDaemon = true) { loop(session) }
        } catch (error: Exception) {
            run = null
            scheduler.stop()
            t.release()
            throw error
        }
    }

    @Synchronized fun stop() {
        val old = run
        run = null
        scheduler.stop()
        if (old != null) {
            old.cancelled = true
            // Unblock a blocking write without joining a worker on the UI thread.
            // The worker alone owns release(), in its finally block.
            try { old.track.pause(); old.track.flush() } catch (_: Exception) {}
        }
    }

    @Synchronized fun setBpm(bpm: Int) = scheduler.setBpm(bpm)
    @Synchronized fun setBeats(n: Int) = scheduler.setBeats(n)

    private fun loop(session: Run) {
        val t = session.track
        val clock = session.scheduler
        val chunk = ShortArray(512)
        var framesWritten = 0L
        val active = ArrayList<Voice>()
        val pendingBeats = ArrayList<PendingBeat>()
        try {
            while (!session.cancelled) {
                val chunkOrigin = framesWritten
                val chunkEnd = framesWritten + chunk.size
                val horizon = chunkEnd.toDouble() / sampleRate + 0.05
                for (beat in clock.pull(horizon)) {
                    val origin = PcmMixer.frameForTime(beat.time, sampleRate)
                    pendingBeats.add(PendingBeat(beat.index, origin))
                    val beatMode = mode
                    val beatLang = lang
                    val voices = MetronomePolicy.sampleVoices(beat.index, beatMode, beatLang, clickBank, voiceBank)
                    val fallbacks = MetronomePolicy.sampleVoices(beat.index, beatMode, beatLang, "default", "default")
                    for ((index, v) in voices.withIndex()) {
                        val pcm = buffers[v.key] ?: buffers[fallbacks[index].key] ?: continue
                        active.add(Voice(pcm, origin, v.gain * volume))
                    }
                }
                chunk.fill(0)
                val doneVoices = ArrayList<Voice>()
                for (v in active) {
                    PcmMixer.mix(chunk, chunkOrigin, v.pcm, v.origin, v.gain)
                    if (v.origin + v.pcm.size <= chunkEnd) doneVoices.add(v)
                }
                active.removeAll(doneVoices.toSet())
                val doneBeats = ArrayList<PendingBeat>()
                for (b in pendingBeats) {
                    if (b.origin >= chunkOrigin && b.origin < chunkEnd) {
                        main.post {
                            if (run === session && !session.cancelled) onBeat?.invoke(b.index)
                        }
                        doneBeats.add(b)
                    }
                }
                pendingBeats.removeAll(doneBeats.toSet())
                var offset = 0
                while (offset < chunk.size && !session.cancelled) {
                    val wrote = t.write(chunk, offset, chunk.size - offset)
                    if (session.cancelled) break
                    check(wrote > 0) { "AudioTrack write failed: $wrote" }
                    offset += wrote
                }
                framesWritten += offset
            }
        } catch (_: Exception) {
            main.post {
                if (run === session && !session.cancelled) onError?.invoke()
            }
        } finally {
            session.scheduler.stop()
            try { t.stop() } catch (_: Exception) {}
            try { t.release() } catch (_: Exception) {}
        }
    }

    private fun decodeMp3(path: String): ShortArray? {
        val extractor = MediaExtractor()
        var decoder: MediaCodec? = null
        return try {
            assets.openFd(path).use { fd ->
                extractor.setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
            }
            val trackFormat = extractor.getTrackFormat(0)
            extractor.selectTrack(0)
            val mime = trackFormat.getString(MediaFormat.KEY_MIME) ?: return null
            val codec = MediaCodec.createDecoderByType(mime)
            decoder = codec
            codec.configure(trackFormat, null, null, 0)
            codec.start()
            var srcRate = trackFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = trackFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            val pcm = ArrayList<Short>()
            val info = MediaCodec.BufferInfo()
            var inputEos = false
            var outputEos = false
            val deadline = SystemClock.elapsedRealtime() + 5_000
            while (!outputEos) {
                check(SystemClock.elapsedRealtime() < deadline) { "Sample decode timed out" }
                if (!inputEos) {
                    val inIx = codec.dequeueInputBuffer(10_000)
                    if (inIx >= 0) {
                        val inBuf = codec.getInputBuffer(inIx)!!
                        inBuf.clear()
                        val size = extractor.readSampleData(inBuf, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(inIx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputEos = true
                        } else {
                            codec.queueInputBuffer(inIx, 0, size, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }
                when (val outIx = codec.dequeueOutputBuffer(info, 10_000)) {
                    MediaCodec.INFO_TRY_AGAIN_LATER -> {}
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val out = codec.outputFormat
                        srcRate = out.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channels = out.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                    }
                    else -> if (outIx >= 0) {
                        val outBuf = codec.getOutputBuffer(outIx)!!
                        outBuf.position(info.offset)
                        outBuf.limit(info.offset + info.size)
                        outBuf.order(ByteOrder.LITTLE_ENDIAN)
                        while (outBuf.remaining() >= 2) pcm.add(outBuf.short)
                        codec.releaseOutputBuffer(outIx, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            outputEos = true
                        }
                    }
                }
            }
            if (pcm.isEmpty() || srcRate <= 0 || channels <= 0) null
            else PcmResample.toMono44100(pcm.toShortArray(), srcRate, channels)
        } catch (_: Exception) {
            null
        } finally {
            try { decoder?.stop() } catch (_: Exception) {}
            try { decoder?.release() } catch (_: Exception) {}
            extractor.release()
        }
    }
}
