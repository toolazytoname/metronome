package studio.weichao.jpq

import android.app.Application
import android.os.Bundle
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics

/** Product analytics only. No advertising ID. No-ops until google-services.json is present. */
object AppAnalytics {
    @Volatile private var analytics: FirebaseAnalytics? = null

    fun start(app: Application) {
        if (FirebaseApp.getApps(app).isEmpty()) return
        val fa = FirebaseAnalytics.getInstance(app)
        fa.setAnalyticsCollectionEnabled(true)
        fa.setUserId(null)
        analytics = fa
    }

    fun event(name: String, params: Map<String, Any?> = emptyMap()) {
        val fa = analytics ?: return
        val b = Bundle()
        for ((k, v) in params) {
            when (v) {
                null -> {}
                is Int -> b.putLong(k, v.toLong())
                is Long -> b.putLong(k, v)
                is Double -> b.putDouble(k, v)
                is Boolean -> b.putString(k, if (v) "1" else "0")
                else -> b.putString(k, v.toString())
            }
        }
        fa.logEvent(name, b)
    }
}
