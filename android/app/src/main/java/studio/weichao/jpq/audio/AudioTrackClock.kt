package studio.weichao.jpq.audio

import android.content.res.AssetManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import studio.weichao.jpq.policy.BeatScheduler
import studio.weichao.jpq.policy.MetronomePolicy
import studio.weichao.jpq.policy.PcmMixer
import studio.weichao.jpq.policy.PcmResample
import studio.weichao.jpq.policy.SoundMode
import java.nio.ByteOrder
import kotlin.concurrent.thread

/**
 * Audio-thread clock: MediaCodec PCM at 44.1kHz mono, mixed at scheduled frame offsets.
 */
class AudioTrackClock(private val assets: AssetManager) {
    val scheduler = BeatScheduler()
    var mode: SoundMode = SoundMode.UNIFORM
    var lang: String = "zh"
    var clickBank: String = MetronomePolicy.DEFAULT_BANK
    var voiceBank: String = MetronomePolicy.DEFAULT_BANK
    var volume: Float = 0.85f
    var onBeat: ((Int) -> Unit)? = null
    var ready: Boolean = false
        private set

    private val sampleRate = 44100
    private val buffers = HashMap<String, ShortArray>()
    private var track: AudioTrack? = null
    private var worker: Thread? = null
    @Volatile private var running = false

    private data class Voice(val pcm: ShortArray, val origin: Long, val gain: Double)
    private data class PendingBeat(val index: Int, val origin: Long)

    fun load() {
        val names = mutableListOf("click-strong", "click-weak", "click-uniform")
        for (langCode in listOf("zh", "en")) {
            for (i in 1..16) names.add("voice/$langCode/%02d".format(i))
        }
        for (bank in MetronomePolicy.packClickBanks) {
            for (n in listOf("click-strong", "click-weak", "click-uniform")) {
                names.add("pack/$bank/$n")
            }
        }
        for (bank in MetronomePolicy.packVoiceBanks) {
            for (i in 1..16) names.add("pack/$bank/%02d".format(i))
        }
        for (name in names) {
            decodeMp3("sounds/$name.mp3")?.let { buffers[name] = it }
        }
        ready = buffers.containsKey("click-uniform") &&
            buffers.containsKey("click-strong") &&
            buffers.containsKey("click-weak")
    }

    fun start() {
        if (running) return
        running = true
        val minBuf = AudioTrack.getMinBufferSize(
            sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
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
        track = t
        t.play()
        scheduler.start(0.0)
        worker = thread(name = "metro-clock", isDaemon = true) { loop(t) }
    }

    fun stop() {
        running = false
        scheduler.stop()
        worker?.join(500)
        worker = null
        track?.stop()
        track?.release()
        track = null
    }

    fun setBpm(bpm: Int) = scheduler.setBpm(bpm)
    fun setBeats(n: Int) = scheduler.setBeats(n)

    private fun loop(t: AudioTrack) {
        val chunk = ShortArray(512)
        var framesWritten = 0L
        val active = ArrayList<Voice>()
        val pendingBeats = ArrayList<PendingBeat>()
        while (running) {
            val chunkOrigin = framesWritten
            val chunkEnd = framesWritten + chunk.size
            val horizon = chunkEnd.toDouble() / sampleRate + 0.05
            for (beat in scheduler.pull(horizon)) {
                val origin = PcmMixer.frameForTime(beat.time, sampleRate)
                pendingBeats.add(PendingBeat(beat.index, origin))
                val voices = MetronomePolicy.sampleVoices(beat.index, mode, lang, clickBank, voiceBank)
                for (v in voices) {
                    val pcm = buffers[v.key] ?: continue
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
                    onBeat?.invoke(b.index)
                    doneBeats.add(b)
                }
            }
            pendingBeats.removeAll(doneBeats.toSet())
            var offset = 0
            while (offset < chunk.size && running) {
                val wrote = t.write(chunk, offset, chunk.size - offset)
                if (wrote <= 0) break
                offset += wrote
            }
            framesWritten += offset
        }
    }

    private fun decodeMp3(path: String): ShortArray? {
        val extractor = MediaExtractor()
        return try {
            assets.openFd(path).use { fd ->
                extractor.setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
            }
            val trackFormat = extractor.getTrackFormat(0)
            extractor.selectTrack(0)
            val mime = trackFormat.getString(MediaFormat.KEY_MIME) ?: return null
            val codec = MediaCodec.createDecoderByType(mime)
            codec.configure(trackFormat, null, null, 0)
            codec.start()
            var srcRate = trackFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = trackFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            val pcm = ArrayList<Short>()
            val info = MediaCodec.BufferInfo()
            var inputEos = false
            var outputEos = false
            while (!outputEos) {
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
            codec.stop()
            codec.release()
            extractor.release()
            PcmResample.toMono44100(pcm.toShortArray(), srcRate, channels)
        } catch (_: Exception) {
            extractor.release()
            null
        }
    }
}
