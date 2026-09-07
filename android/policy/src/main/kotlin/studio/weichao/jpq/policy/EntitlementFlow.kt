package studio.weichao.jpq.policy

/**
 * MainActivity 用的存储 / 展示 / 播放三态。未知未购只门控展示与音频，不写回存储。
 */
object EntitlementFlow {
    enum class Confidence { Unknown, Verified }

    data class State(
        val stored: MetronomePrefs,
        val unlocked: Boolean,
        val confidence: Confidence = Confidence.Unknown
    ) {
        val display: MetronomePrefs
            get() = MetronomePolicy.applyAuthoritativeUnlock(stored, unlocked)
        val playbackClick: String
            get() = MetronomePolicy.resolveBank(stored.clickBank, unlocked)
        val playbackVoice: String
            get() = MetronomePolicy.resolveBank(stored.voiceBank, unlocked)
    }

    fun unknownOrFailed(state: State) = state.copy(
        unlocked = false,
        confidence = Confidence.Unknown
    )

    fun authoritative(state: State, owned: Boolean) = state.copy(
        unlocked = owned,
        confidence = Confidence.Verified,
        stored = MetronomePolicy.applyAuthoritativeUnlock(state.stored, owned)
    )

    sealed class Pick {
        data class Save(val stored: MetronomePrefs) : Pick()
        object LaunchPurchase : Pick()
        object KeepStored : Pick()
    }

    fun pickClick(state: State, bank: String): Pick {
        if (!MetronomePolicy.canUsePackBank(bank, state.unlocked)) return Pick.LaunchPurchase
        if (!state.unlocked &&
            bank == MetronomePolicy.DEFAULT_BANK &&
            MetronomePolicy.isPackBank(state.stored.clickBank)
        ) {
            return Pick.KeepStored
        }
        return Pick.Save(state.stored.copy(clickBank = bank))
    }

    fun pickVoice(state: State, bank: String): Pick {
        if (!MetronomePolicy.canUsePackBank(bank, state.unlocked)) return Pick.LaunchPurchase
        if (!state.unlocked &&
            bank == MetronomePolicy.DEFAULT_BANK &&
            MetronomePolicy.isPackBank(state.stored.voiceBank)
        ) {
            return Pick.KeepStored
        }
        return Pick.Save(state.stored.copy(voiceBank = bank))
    }

    fun pickHapticPattern(state: State, pattern: String): Pick {
        if (!MetronomePolicy.canUseHapticPattern(pattern, state.unlocked)) return Pick.LaunchPurchase
        if (!state.unlocked &&
            pattern == MetronomePolicy.HAPTIC_PATTERN_ALL &&
            state.stored.hapticPattern == MetronomePolicy.HAPTIC_PATTERN_DOWNBEAT
        ) {
            return Pick.KeepStored
        }
        return Pick.Save(state.stored.copy(hapticPattern = pattern))
    }

    fun pickHapticFeel(state: State, feel: String): Pick {
        if (!MetronomePolicy.canUseHapticFeel(feel, state.unlocked)) return Pick.LaunchPurchase
        if (!state.unlocked &&
            feel == MetronomePolicy.HAPTIC_FEEL_STANDARD &&
            (state.stored.hapticFeel == MetronomePolicy.HAPTIC_FEEL_LIGHT ||
                state.stored.hapticFeel == MetronomePolicy.HAPTIC_FEEL_HEAVY)
        ) {
            return Pick.KeepStored
        }
        return Pick.Save(state.stored.copy(hapticFeel = feel))
    }
}
