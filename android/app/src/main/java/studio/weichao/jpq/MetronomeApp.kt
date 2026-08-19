package studio.weichao.jpq

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class MetronomeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(
                CHANNEL_ID, "Metronome", NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    companion object {
        const val CHANNEL_ID = "metronome_playback"
    }
}
