package studio.weichao.jpq

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class MetronomeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppAnalytics.start(this)
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(
                CHANNEL_ID, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_DEFAULT
            )
            ch.setSound(null, null)
            ch.enableVibration(false)
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    companion object {
        const val CHANNEL_ID = "metronome_playback_v2"
    }
}
