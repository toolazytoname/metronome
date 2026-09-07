package studio.weichao.jpq.policy

/** Bind/toggle UI from the Service clock, not from a stale Activity `playing` flag. */
object PlaybackBind {
    fun isPlaying(stopped: Boolean, schedulerPlaying: Boolean): Boolean =
        !stopped || schedulerPlaying

    data class Ui(
        val playing: Boolean,
        val clearBeat: Boolean,
        val keepAwakeOn: Boolean
    )

    fun uiFromService(servicePlaying: Boolean, keepAwakePref: Boolean) = Ui(
        playing = servicePlaying,
        clearBeat = !servicePlaying,
        keepAwakeOn = servicePlaying && keepAwakePref
    )

    enum class Toggle { Stop, Start }

    /** Ignore stale UI `playing`; only the service clock decides. */
    fun toggleAction(servicePlaying: Boolean): Toggle =
        if (servicePlaying) Toggle.Stop else Toggle.Start
}

/** One Activity at a time may own Service UI callbacks. */
class PlaybackListenerGate {
    var owner: Any? = null
        private set
    var onStopped: (() -> Unit)? = null
        private set

    fun set(owner: Any, onStopped: () -> Unit) {
        this.owner = owner
        this.onStopped = onStopped
    }

    fun clear(owner: Any) {
        if (this.owner !== owner) return
        this.owner = null
        this.onStopped = null
    }

    fun shouldDispatch(owner: Any?): Boolean = this.owner === owner

    fun dispatchStopped() {
        onStopped?.invoke()
    }
}
