package studio.weichao.jpq.audio

import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import studio.weichao.jpq.MainActivity
import studio.weichao.jpq.MetronomeApp
import studio.weichao.jpq.policy.SoundMode

class MetronomeService : Service() {
    inner class LocalBinder : Binder() {
        fun service(): MetronomeService = this@MetronomeService
    }

    private val binder = LocalBinder()
    lateinit var clock: AudioTrackClock
        private set
    var keepAwake = true
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        clock = AudioTrackClock(assets)
        clock.load()
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopPlayback()
            ACTION_TOGGLE -> if (clock.scheduler.playing) stopPlayback() else startPlayback()
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
    }

    fun startPlayback() {
        val pending = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, MetronomeService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        val n = NotificationCompat.Builder(this, MetronomeApp.CHANNEL_ID)
            .setContentTitle("Bunny Metronome")
            .setContentText("${clock.scheduler.bpm} BPM")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pending)
            .addAction(android.R.drawable.ic_media_pause, "Pause", stop)
            .setOngoing(true)
            .build()
        startForeground(42, n)
        if (keepAwake) {
            wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jpq:metro").apply { acquire() }
        }
        clock.start()
    }

    fun stopPlayback() {
        clock.stop()
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopPlayback()
        super.onDestroy()
    }

    companion object {
        const val ACTION_STOP = "studio.weichao.jpq.STOP"
        const val ACTION_TOGGLE = "studio.weichao.jpq.TOGGLE"
    }
}
