package studio.weichao.jpq

import android.content.Context
import android.os.Build
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import studio.weichao.jpq.policy.*
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** FIFO disk work, private no-backup directory; a logging failure never breaks audio. */
class LocalDiagnostics private constructor(context: Context) {
    private val file = File(context.noBackupFilesDir, "diagnostics-v1.json")
    private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "metro-diagnostics").apply { isDaemon = true } }
    private val history = DiagnosticHistory()
    init {
        worker.execute {
            try {
                if (file.exists() && file.length() <= 128_000) {
                    val stored = JSONObject(AtomicFile(file).openRead().bufferedReader().use { it.readText() })
                    val input = if (stored.optInt("build") == BuildConfig.VERSION_CODE && stored.optString("version") == BuildConfig.VERSION_NAME && stored.optString("channel") == BuildConfig.FLAVOR) stored.getJSONArray("events") else JSONArray()
                    val events = (maxOf(0, input.length() - 80) until input.length()).mapNotNull { i ->
                        try {
                            val e = input.getJSONObject(i)
                            val s = e.optJSONObject("state")
                            DiagnosticEvent(e.getLong("at"), DiagnosticCode.valueOf(e.getString("code")), s?.let {
                                DiagnosticState(it.getInt("bpm"), it.getInt("beats"), SoundMode.parse(it.getString("mode")), it.getBoolean("playing"), it.getBoolean("ready"))
                            })
                        } catch (_: Exception) { null }
                    }
                    history.restore(events, System.currentTimeMillis())
                }
            } catch (_: Exception) { /* corrupt or unavailable cache: in-memory fallback */ }
            persist()
        }
    }
    private fun stateJSON(s: DiagnosticState) = JSONObject().apply {
        put("bpm", s.bpm); put("beats", s.beats); put("mode", s.mode.raw)
        put("playing", s.playing); put("ready", s.ready)
    }
    private fun eventsJSON() = JSONArray().apply {
        history.events.forEach { e -> put(JSONObject().apply {
            put("at", e.at); put("code", e.code.name); e.state?.let { put("state", stateJSON(it)) }
        }) }
    }
    private fun persist(): Boolean {
        val atomic = AtomicFile(file)
        var stream: java.io.FileOutputStream? = null
        try {
            val json = JSONObject().put("build", BuildConfig.VERSION_CODE).put("version", BuildConfig.VERSION_NAME).put("channel", BuildConfig.FLAVOR).put("events", eventsJSON())
            stream = atomic.startWrite()
            stream.write(json.toString().toByteArray(Charsets.UTF_8))
            atomic.finishWrite(stream)
            return true
        } catch (_: Exception) {
            try { atomic.failWrite(stream) } catch (_: Exception) {}
            return false
        }
    }
    fun record(code: DiagnosticCode, state: DiagnosticState? = null) {
        val now = System.currentTimeMillis()
        worker.execute { history.record(code, state, now); persist() }
    }
    fun clear() {
        val cleared = worker.submit<Boolean> {
            history.restore(emptyList(), System.currentTimeMillis())
            persist()
        }.get(2, TimeUnit.SECONDS)
        check(cleared) { "diagnostic_clear_failed" }
    }
    fun report(state: DiagnosticState?): String = worker.submit<String> {
        history.restore(history.events, System.currentTimeMillis()); persist()
        JSONObject().apply {
            put("product", "Bunny Metronome"); put("platform", "Android"); put("channel", BuildConfig.FLAVOR)
            put("version", BuildConfig.VERSION_NAME); put("build", BuildConfig.VERSION_CODE)
            put("osAPI", Build.VERSION.SDK_INT)
            state?.let { put("state", stateJSON(it.normalized())) }; put("events", eventsJSON())
        }.toString(2)
    }.get(2, TimeUnit.SECONDS)
    companion object {
        /** Logging must never interrupt service cleanup or a Play action. */
        fun record(context: Context, code: DiagnosticCode, state: DiagnosticState? = null) {
            try { get(context).record(code, state) } catch (_: Exception) { /* best effort */ }
        }
        @Volatile private var instance: LocalDiagnostics? = null
        fun get(context: Context): LocalDiagnostics = instance ?: synchronized(this) {
            instance ?: LocalDiagnostics(context.applicationContext).also { instance = it }
        }
    }
}
