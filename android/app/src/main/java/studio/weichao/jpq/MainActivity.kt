package studio.weichao.jpq

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.graphics.Color as AndroidColor
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.json.JSONObject
import studio.weichao.jpq.audio.MetronomeService
import studio.weichao.jpq.billing.PlayStoreAdapter
import studio.weichao.jpq.policy.MetronomePolicy
import studio.weichao.jpq.policy.MetronomePrefs
import studio.weichao.jpq.ui.MacaronApp
import studio.weichao.jpq.ui.MacaronCallbacks

class MainActivity : ComponentActivity() {
    private var service: MetronomeService? = null
    private lateinit var store: PlayStoreAdapter
    private var prefs by mutableStateOf(MetronomePrefs())
    private var playing by mutableStateOf(false)
    private var activeBeat by mutableIntStateOf(-1)
    private var unlocked by mutableStateOf(false)
    private var settings by mutableStateOf(false)
    private var copy by mutableStateOf<Map<String, String>>(emptyMap())
    private var storeMessage by mutableStateOf("")
    private var productPrice by mutableStateOf<String?>(null)
    private var storeBusy by mutableStateOf(false)
    private var storeAvailable by mutableStateOf(false)

    private val conn = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as MetronomeService.LocalBinder).service()
            service?.onStopped = {
                runOnUiThread {
                    playing = false
                    activeBeat = -1
                    applyKeepAwake()
                }
            }
            service?.clock?.onBeat = { beat ->
                runOnUiThread {
                    activeBeat = beat
                    if (prefs.haptic) vibrate(beat == 0)
                }
            }
            applyToService()
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
        }
    }

    private val notifPerm = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = AndroidColor.TRANSPARENT
        window.navigationBarColor = AndroidColor.TRANSPARENT
        prefs = loadPrefs()
        copy = AppCopy.load(assets, prefs.lang)
        store = PlayStoreAdapter(
            this,
            onEntitlementChange = { owned ->
                runOnUiThread {
                    unlocked = owned
                    prefs = prefs.copy(
                        clickBank = MetronomePolicy.resolveBank(prefs.clickBank, owned),
                        voiceBank = MetronomePolicy.resolveBank(prefs.voiceBank, owned),
                        hapticPattern = MetronomePolicy.resolveHapticPattern(prefs.hapticPattern, owned),
                        hapticFeel = MetronomePolicy.resolveHapticFeel(prefs.hapticFeel, owned)
                    )
                    applyToService()
                    if (owned) storeMessage = t("owned")
                }
            },
            onMessage = { key ->
                runOnUiThread { storeMessage = t(key) }
            },
            onPrice = { price ->
                runOnUiThread { productPrice = price }
            },
            onAvailable = { ok ->
                runOnUiThread { storeAvailable = ok }
            }
        )
        refreshEntitlement()
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        bindService(Intent(this, MetronomeService::class.java), conn, Context.BIND_AUTO_CREATE)
        setContent {
            MacaronApp(
                prefs = prefs,
                playing = playing,
                activeBeat = activeBeat,
                unlocked = unlocked,
                settings = settings,
                storeMessage = storeMessage,
                productPrice = productPrice,
                storeBusy = storeBusy,
                storeAvailable = storeAvailable,
                cb = MacaronCallbacks(
                    t = { t(it) },
                    bankLabel = { bank, voice -> AppCopy.bankLabel(copy, bank, voice) },
                    onToggle = { toggle() },
                    onBpm = {
                        prefs = prefs.copy(bpm = MetronomePolicy.clampBpm(it))
                        applyToService()
                    },
                    onMode = {
                        prefs = prefs.copy(sm = it.raw)
                        applyToService()
                    },
                    onSignature = { bc, bu ->
                        prefs = prefs.copy(
                            bc = MetronomePolicy.clampBeats(bc),
                            bu = MetronomePolicy.clampBeatUnit(bu)
                        )
                        applyToService()
                    },
                    onVolume = {
                        prefs = prefs.copy(vol = MetronomePolicy.clampVolume(it))
                        applyToService()
                    },
                    onLang = { setLang(it) },
                    onHaptic = { prefs = prefs.copy(haptic = it); applyToService() },
                    onKeepAwake = { prefs = prefs.copy(keepAwake = it); applyToService() },
                    onClickBank = { requestClick(it) },
                    onVoiceBank = { requestVoice(it) },
                    onHapticPattern = { requestHapticPattern(it) },
                    onHapticFeel = { requestHapticFeel(it) },
                    onBuy = { if (!storeBusy) store.launch(this) },
                    onRestore = { restorePurchases() },
                    onShare = { share() },
                    onSupport = { openUrl("/support", "/en/support") },
                    onPrivacy = { openUrl("/privacy", "/en/privacy") },
                    onOpenSettings = { settings = true },
                    onCloseSettings = { settings = false }
                )
            )
        }
    }

    private fun share() {
        val base = if (prefs.lang == "en") "https://jpq.weichao.studio/en/" else "https://jpq.weichao.studio/"
        val url = "${base}?bpm=${prefs.bpm}&sig=${prefs.bc}/${prefs.bu}&mode=${prefs.mode.raw}"
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "${t("share_text")} $url")
        }
        startActivity(Intent.createChooser(send, t("share")))
    }

    override fun onResume() {
        super.onResume()
        refreshEntitlement()
    }

    override fun onDestroy() {
        super.onDestroy()
        try { unbindService(conn) } catch (_: Exception) {}
    }

    private fun t(key: String) = AppCopy.t(copy, key)

    private fun refreshEntitlement() {
        lifecycleScope.launch {
            unlocked = store.currentEntitlement()
            productPrice = store.productPrice()
            prefs = prefs.copy(
                clickBank = MetronomePolicy.resolveBank(prefs.clickBank, unlocked),
                voiceBank = MetronomePolicy.resolveBank(prefs.voiceBank, unlocked)
            )
            applyToService()
        }
    }

    private fun restorePurchases() {
        if (storeBusy) return
        storeBusy = true
        lifecycleScope.launch {
            try {
                store.restore()
                unlocked = store.currentEntitlement()
                applyToService()
                storeMessage = t(if (unlocked) "restore_ok" else "restore_none")
            } catch (_: Exception) {
                storeMessage = t("restore_failed")
            } finally {
                storeBusy = false
            }
        }
    }

    private fun loadPrefs(): MetronomePrefs {
        val raw = getSharedPreferences("metro", MODE_PRIVATE).getString("metronome", null) ?: return MetronomePrefs()
        val obj = JSONObject(raw)
        val map = mutableMapOf<String, Any?>()
        obj.keys().forEach { map[it] = obj.get(it) }
        return MetronomePrefs.from(map)
    }

    private fun savePrefs() {
        val obj = JSONObject(prefs.coreMap() + mapOf(
            "lang" to prefs.lang,
            "haptic" to prefs.haptic,
            "keepAwake" to prefs.keepAwake,
            "clickBank" to prefs.clickBank,
            "voiceBank" to prefs.voiceBank,
            "hapticPattern" to prefs.hapticPattern,
            "hapticFeel" to prefs.hapticFeel
        ))
        getSharedPreferences("metro", MODE_PRIVATE).edit().putString("metronome", obj.toString()).apply()
    }

    private fun applyKeepAwake() {
        val on = playing && prefs.keepAwake
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun applyToService() {
        val click = MetronomePolicy.resolveBank(prefs.clickBank, unlocked)
        val voice = MetronomePolicy.resolveBank(prefs.voiceBank, unlocked)
        service?.keepAwake = prefs.keepAwake
        service?.notificationTitle = t("app_name")
        service?.pauseLabel = t("pause")
        service?.configure(prefs.bpm, prefs.bc, prefs.mode, prefs.lang, prefs.vol, click, voice)
        savePrefs()
        applyKeepAwake()
    }

    private fun toggle() {
        val svc = service ?: return
        applyToService()
        if (playing) {
            svc.stopPlayback()
            playing = false
            activeBeat = -1
        } else {
            if (!svc.samplesReady()) {
                storeMessage = t("play_error")
                return
            }
            startForegroundService(Intent(this, MetronomeService::class.java))
            if (!svc.startPlayback()) {
                storeMessage = t("play_error")
                return
            }
            playing = true
            storeMessage = ""
        }
        applyKeepAwake()
    }

    private fun vibrate(strong: Boolean) {
        if (!MetronomePolicy.shouldHapticTick(strong, prefs.hapticPattern, unlocked)) return
        val pulse = MetronomePolicy.hapticPulse(strong, prefs.hapticFeel, unlocked)
        val v = getSystemService(Vibrator::class.java) ?: return
        val amp = (pulse.intensity * 255).toInt().coerceIn(1, 255)
        v.vibrate(VibrationEffect.createOneShot(pulse.durationMs.toLong(), amp))
    }

    private fun setLang(lang: String) {
        prefs = prefs.copy(lang = if (lang == "en") "en" else "zh")
        copy = AppCopy.load(assets, prefs.lang)
        applyToService()
    }

    private fun openUrl(pathZh: String, pathEn: String) {
        val path = if (prefs.lang == "en") pathEn else pathZh
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://jpq.weichao.studio$path")))
    }

    private fun requestClick(bank: String) {
        if (MetronomePolicy.canUsePackBank(bank, unlocked)) {
            prefs = prefs.copy(clickBank = bank)
            applyToService()
        } else {
            store.launch(this)
        }
    }

    private fun requestVoice(bank: String) {
        if (MetronomePolicy.canUsePackBank(bank, unlocked)) {
            prefs = prefs.copy(voiceBank = bank)
            applyToService()
        } else {
            store.launch(this)
        }
    }

    private fun requestHapticPattern(pattern: String) {
        if (MetronomePolicy.canUseHapticPattern(pattern, unlocked)) {
            prefs = prefs.copy(hapticPattern = pattern)
            applyToService()
        } else {
            store.launch(this)
        }
    }

    private fun requestHapticFeel(feel: String) {
        if (MetronomePolicy.canUseHapticFeel(feel, unlocked)) {
            prefs = prefs.copy(hapticFeel = feel)
            applyToService()
        } else {
            store.launch(this)
        }
    }

}
