package studio.weichao.jpq.policy

enum class SoundMode(val raw: String) {
    TRADITIONAL("traditional"),
    UNIFORM("uniform"),
    VOICE("voice");

    companion object {
        fun parse(raw: String?): SoundMode =
            entries.firstOrNull { it.raw == raw } ?: UNIFORM
    }
}

data class SampleVoice(val key: String, val gain: Double)

object MetronomePolicy {
    const val MIN_BPM = 40
    const val MAX_BPM = 208
    const val MIN_BEATS = 1
    const val MAX_BEATS = 16
    const val PRODUCT_ID = "studio.weichao.jpq.soundpack"
    const val DEFAULT_BANK = "default"
    val packClickBanks = listOf("click-stick", "click-kick", "click-tip")
    val packVoiceBanks = listOf("voice-zh-yunxi", "voice-zh-soft", "voice-en-deep")

    fun clampBpm(n: Int) = n.coerceIn(MIN_BPM, MAX_BPM)
    fun clampBeats(n: Int) = n.coerceIn(MIN_BEATS, MAX_BEATS)
    fun clampBeatUnit(n: Int) = n.coerceIn(1, 16)
    fun clampVolume(n: Int) = n.coerceIn(10, 100)
    fun clampEngineVolume(v: Double) = v.coerceIn(0.05, 1.0)

    fun intervalSeconds(bpm: Int): Double = 60.0 / clampBpm(bpm).toDouble()

    fun isPackBank(bank: String) = bank in packClickBanks || bank in packVoiceBanks

    fun canUsePackBank(bank: String, unlocked: Boolean): Boolean {
        if (bank == DEFAULT_BANK || bank.isEmpty()) return true
        return unlocked && isPackBank(bank)
    }

    fun resolveBank(requested: String, unlocked: Boolean): String =
        if (canUsePackBank(requested, unlocked)) {
            requested.ifEmpty { DEFAULT_BANK }
        } else {
            DEFAULT_BANK
        }

    fun canStartDefaultVoice(unlocked: Boolean): Boolean {
        @Suppress("UNUSED_VARIABLE") val ignore = unlocked
        return true
    }

    fun sampleVoices(
        beat: Int,
        mode: SoundMode,
        lang: String,
        clickBank: String,
        voiceBank: String
    ): List<SampleVoice> = when (mode) {
        SoundMode.TRADITIONAL -> {
            val name = if (beat == 0) "click-strong" else "click-weak"
            listOf(SampleVoice(clickKey(clickBank, name), 1.0))
        }
        SoundMode.UNIFORM -> listOf(SampleVoice(clickKey(clickBank, "click-uniform"), 1.0))
        SoundMode.VOICE -> {
            val n = (beat + 1).coerceIn(1, MAX_BEATS)
            val id = "%02d".format(n)
            listOf(
                SampleVoice(voiceKey(voiceBank, lang, id), 1.0),
                SampleVoice(clickKey(clickBank, "click-weak"), 0.28)
            )
        }
    }

    fun clickKey(bank: String, file: String): String =
        if (bank == DEFAULT_BANK || bank.isEmpty()) file else "pack/$bank/$file"

    fun voiceKey(bank: String, lang: String, file: String): String =
        if (bank == DEFAULT_BANK || bank.isEmpty()) "voice/$lang/$file" else "pack/$bank/$file"

    fun bankLabelKey(bank: String, voice: Boolean): String {
        if (bank == DEFAULT_BANK || bank.isEmpty()) {
            return if (voice) "voice_default" else "click_default"
        }
        return bank.replace("-", "_")
    }

    const val HAPTIC_PATTERN_ALL = "all"
    const val HAPTIC_PATTERN_DOWNBEAT = "downbeat"
    const val HAPTIC_FEEL_LIGHT = "light"
    const val HAPTIC_FEEL_STANDARD = "standard"
    const val HAPTIC_FEEL_HEAVY = "heavy"

    fun canUseHapticPattern(pattern: String, unlocked: Boolean): Boolean {
        if (pattern == HAPTIC_PATTERN_ALL || pattern.isEmpty()) return true
        return unlocked && pattern == HAPTIC_PATTERN_DOWNBEAT
    }

    fun canUseHapticFeel(feel: String, unlocked: Boolean): Boolean {
        if (feel == HAPTIC_FEEL_STANDARD || feel.isEmpty()) return true
        return unlocked && (feel == HAPTIC_FEEL_LIGHT || feel == HAPTIC_FEEL_HEAVY)
    }

    fun resolveHapticPattern(requested: String, unlocked: Boolean): String =
        if (canUseHapticPattern(requested, unlocked)) {
            requested.ifEmpty { HAPTIC_PATTERN_ALL }
        } else {
            HAPTIC_PATTERN_ALL
        }

    fun resolveHapticFeel(requested: String, unlocked: Boolean): String =
        if (canUseHapticFeel(requested, unlocked)) {
            requested.ifEmpty { HAPTIC_FEEL_STANDARD }
        } else {
            HAPTIC_FEEL_STANDARD
        }

    fun shouldHapticTick(strong: Boolean, pattern: String, unlocked: Boolean): Boolean =
        if (resolveHapticPattern(pattern, unlocked) == HAPTIC_PATTERN_DOWNBEAT) strong else true

    /** intensity/sharpness 0..1 for iOS; durationMs for Android one-shots. */
    fun hapticPulse(strong: Boolean, feel: String, unlocked: Boolean): HapticPulse {
        if (!unlocked) return HapticPulse(0.38, 0.42, 12)
        return when (resolveHapticFeel(feel, true)) {
            HAPTIC_FEEL_LIGHT -> if (strong) HapticPulse(0.45, 0.45, 14) else HapticPulse(0.22, 0.30, 8)
            HAPTIC_FEEL_HEAVY -> if (strong) HapticPulse(1.0, 0.90, 36) else HapticPulse(0.55, 0.50, 18)
            else -> if (strong) HapticPulse(0.92, 0.75, 28) else HapticPulse(0.42, 0.40, 12)
        }
    }
}

data class HapticPulse(val intensity: Double, val sharpness: Double, val durationMs: Int)

data class MetronomePrefs(
    var bpm: Int = 120,
    var bc: Int = 4,
    var bu: Int = 4,
    var sm: String = SoundMode.UNIFORM.raw,
    var vol: Int = 85,
    var lang: String = "zh",
    var haptic: Boolean = false,
    var keepAwake: Boolean = true,
    var clickBank: String = MetronomePolicy.DEFAULT_BANK,
    var voiceBank: String = MetronomePolicy.DEFAULT_BANK,
    var hapticPattern: String = MetronomePolicy.HAPTIC_PATTERN_ALL,
    var hapticFeel: String = MetronomePolicy.HAPTIC_FEEL_STANDARD
) {
    val mode: SoundMode get() = SoundMode.parse(sm)

    fun coreMap(): Map<String, Any> = mapOf(
        "bpm" to bpm, "bc" to bc, "bu" to bu, "sm" to sm, "vol" to vol
    )

    companion object {
        fun from(raw: Map<String, Any?>): MetronomePrefs {
            val p = MetronomePrefs()
            (raw["bpm"] as? Number)?.let { p.bpm = MetronomePolicy.clampBpm(it.toInt()) }
            (raw["bc"] as? Number)?.let { p.bc = MetronomePolicy.clampBeats(it.toInt()) }
            (raw["bu"] as? Number)?.let { p.bu = MetronomePolicy.clampBeatUnit(it.toInt()) }
            p.sm = SoundMode.parse(raw["sm"] as? String).raw
            (raw["vol"] as? Number)?.let { p.vol = MetronomePolicy.clampVolume(it.toInt()) }
            (raw["lang"] as? String)?.let { if (it == "en" || it == "zh") p.lang = it }
            (raw["haptic"] as? Boolean)?.let { p.haptic = it }
            (raw["keepAwake"] as? Boolean)?.let { p.keepAwake = it }
            (raw["clickBank"] as? String)?.let { p.clickBank = it }
            (raw["voiceBank"] as? String)?.let { p.voiceBank = it }
            (raw["hapticPattern"] as? String)?.let { p.hapticPattern = it }
            (raw["hapticFeel"] as? String)?.let { p.hapticFeel = it }
            return p
        }
    }
}

data class ScheduledBeat(val index: Int, val time: Double)

class BeatScheduler(bpm: Int = 120, beatsPerBar: Int = 4) {
    var bpm: Int = MetronomePolicy.clampBpm(bpm)
        private set
    var beatsPerBar: Int = MetronomePolicy.clampBeats(beatsPerBar)
        private set
    var beatIndex: Int = 0
        private set
    var nextNoteTime: Double = 0.0
        private set
    var playing: Boolean = false
        private set

    fun start(now: Double) {
        playing = true
        beatIndex = 0
        nextNoteTime = now + 0.02
    }

    fun stop() {
        playing = false
    }

    fun setBpm(value: Int) {
        bpm = MetronomePolicy.clampBpm(value)
    }

    fun setBeats(value: Int) {
        beatsPerBar = MetronomePolicy.clampBeats(value)
        if (beatIndex >= beatsPerBar) beatIndex = 0
    }

    fun pull(untilHorizon: Double): List<ScheduledBeat> {
        if (!playing) return emptyList()
        val out = ArrayList<ScheduledBeat>()
        while (nextNoteTime < untilHorizon) {
            out.add(ScheduledBeat(beatIndex, nextNoteTime))
            nextNoteTime += MetronomePolicy.intervalSeconds(bpm)
            beatIndex = (beatIndex + 1) % beatsPerBar
        }
        return out
    }
}

interface StoreAdapter {
    suspend fun currentEntitlement(): Boolean
    suspend fun productPrice(): String?
    suspend fun purchase()
    suspend fun restore()
}

class FakeStoreAdapter(var unlocked: Boolean = false) : StoreAdapter {
    var purchaseCalls = 0
    var restoreCalls = 0
    var price: String? = "¥12.00"
    override suspend fun currentEntitlement() = unlocked
    override suspend fun productPrice() = price
    override suspend fun purchase() {
        purchaseCalls += 1
        unlocked = true
    }
    override suspend fun restore() {
        restoreCalls += 1
    }
}
