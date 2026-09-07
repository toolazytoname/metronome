package studio.weichao.jpq.audio

import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import studio.weichao.jpq.MainActivity
import studio.weichao.jpq.MetronomeApp
import studio.weichao.jpq.R
import studio.weichao.jpq.policy.PlaybackBind
import studio.weichao.jpq.policy.PlaybackListenerGate
import studio.weichao.jpq.policy.SoundMode

class MetronomeService : Service() {
    inner class LocalBinder : Binder() {
        fun service(): MetronomeService = this@MetronomeService
    }

    private val binder = LocalBinder()
    lateinit var clock: AudioTrackClock
        private set
    var keepAwake = true
    var notificationTitle: String = "小兔头节拍器"
    var pauseLabel: String = "暂停"
    private val uiGate = PlaybackListenerGate()
    private var wakeLock: PowerManager.WakeLock? = null
    private var stopped = true
    private var focusRequest: AudioFocusRequest? = null
    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            stopPlayback()
            notifyStopped()
        }
    }

    override fun onCreate() {
        super.onCreate()
        clock = AudioTrackClock(assets)
        clock.load()
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopPlayback()
                notifyStopped()
            }
            ACTION_TOGGLE -> if (isPlaying()) {
                stopPlayback()
                notifyStopped()
            } else {
                startPlayback()
            }
        }
        return START_STICKY
    }

    fun configure(bpm: Int, beats: Int, mode: SoundMode, lang: String, vol: Int, click: String, voice: String) {
        clock.setBpm(bpm)
        clock.setBeats(beats)
        clock.mode = mode
        clock.lang = lang
        clock.volume = (vol / 100f).coerceIn(0.05f, 1f)
        clock.clickBank = click
        clock.voiceBank = voice
        if (!stopped) postNotification()
    }

    fun samplesReady(): Boolean = clock.ready

    fun isPlaying(): Boolean {
        val sched = this::clock.isInitialized && clock.scheduler.playing
        return PlaybackBind.isPlaying(stopped, sched)
    }

    fun setUiListener(owner: Any, onStopped: () -> Unit, onBeat: ((Int) -> Unit)?) {
        uiGate.set(owner, onStopped)
        if (this::clock.isInitialized) clock.onBeat = onBeat
    }

    fun clearUiListener(owner: Any) {
        uiGate.clear(owner)
        if (uiGate.owner == null && this::clock.isInitialized) clock.onBeat = null
    }

    private fun notifyStopped() {
        uiGate.dispatchStopped()
    }

    fun startPlayback(): Boolean {
        if (!clock.ready) return false
        stopped = false
        requestFocus()
        postNotification()
        if (keepAwake) {
            if (wakeLock == null) {
                wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
                    .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jpq:metro")
            }
            if (wakeLock?.isHeld != true) wakeLock?.acquire()
        }
        clock.start()
        return true
    }

    fun stopPlayback() {
        if (stopped && !clock.scheduler.playing) {
            releaseFocus()
            return
        }
        stopped = true
        clock.stop()
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        releaseFocus()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        stopPlayback()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        stopPlayback()
        super.onDestroy()
    }

    private fun postNotification() {
        val pending = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, MetronomeService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n = NotificationCompat.Builder(this, MetronomeApp.CHANNEL_ID)
            .setContentTitle(notificationTitle)
            .setContentText("${clock.scheduler.bpm} BPM")
            .setSmallIcon(R.drawable.ic_stat_metro)
            .setContentIntent(pending)
            .addAction(R.drawable.ic_stat_metro, pauseLabel, stop)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
        startForeground(42, n)
    }

    private fun requestFocus() {
        val am = getSystemService(AudioManager::class.java) ?: return
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        if (Build.VERSION.SDK_INT >= 26) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener(focusListener)
                .build()
            focusRequest = req
            am.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
        }
    }

    private fun releaseFocus() {
        val am = getSystemService(AudioManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 26) {
            focusRequest?.let { am.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            am.abandonAudioFocus(focusListener)
        }
        focusRequest = null
    }

    companion object {
        const val ACTION_STOP = "studio.weichao.jpq.STOP"
        const val ACTION_TOGGLE = "studio.weichao.jpq.TOGGLE"
    }
}
