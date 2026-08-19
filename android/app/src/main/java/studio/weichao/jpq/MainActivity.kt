package studio.weichao.jpq

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.json.JSONObject
import studio.weichao.jpq.audio.MetronomeService
import studio.weichao.jpq.billing.PlayStoreAdapter
import studio.weichao.jpq.policy.MetronomePolicy
import studio.weichao.jpq.policy.MetronomePrefs
import studio.weichao.jpq.policy.SoundMode

class MainActivity : ComponentActivity() {
    private var service: MetronomeService? = null
    private lateinit var store: PlayStoreAdapter
    private var prefs by mutableStateOf(MetronomePrefs())
    private var playing by mutableStateOf(false)
    private var activeBeat by mutableIntStateOf(-1)
    private var unlocked by mutableStateOf(false)
    private var settings by mutableStateOf(false)

    private val conn = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as MetronomeService.LocalBinder).service()
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
        store = PlayStoreAdapter(this) { owned ->
            runOnUiThread {
                unlocked = owned
                prefs = prefs.copy(
                    clickBank = MetronomePolicy.resolveBank(prefs.clickBank, owned),
                    voiceBank = MetronomePolicy.resolveBank(prefs.voiceBank, owned)
                )
                applyToService()
            }
        }
        prefs = loadPrefs()
        refreshEntitlement()
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        bindService(Intent(this, MetronomeService::class.java), conn, Context.BIND_AUTO_CREATE)
        setContent { PracticeScreen() }
    }

    override fun onResume() {
        super.onResume()
        refreshEntitlement()
    }

    override fun onDestroy() {
        super.onDestroy()
        unbindService(conn)
    }

    private fun refreshEntitlement() {
        lifecycleScope.launch {
            unlocked = store.currentEntitlement()
            prefs = prefs.copy(
                clickBank = MetronomePolicy.resolveBank(prefs.clickBank, unlocked),
                voiceBank = MetronomePolicy.resolveBank(prefs.voiceBank, unlocked)
            )
            applyToService()
        }
    }

    private fun restorePurchases() {
        lifecycleScope.launch {
            store.restore()
            unlocked = store.currentEntitlement()
            applyToService()
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
            "voiceBank" to prefs.voiceBank
        ))
        getSharedPreferences("metro", MODE_PRIVATE).edit().putString("metronome", obj.toString()).apply()
    }

    private fun applyToService() {
        val click = MetronomePolicy.resolveBank(prefs.clickBank, unlocked)
        val voice = MetronomePolicy.resolveBank(prefs.voiceBank, unlocked)
        service?.keepAwake = prefs.keepAwake
        service?.configure(prefs.bpm, prefs.bc, prefs.mode, prefs.lang, prefs.vol, click, voice)
        savePrefs()
    }

    private fun toggle() {
        val svc = service ?: return
        applyToService()
        if (playing) {
            svc.stopPlayback()
            playing = false
            activeBeat = -1
        } else {
            startForegroundService(Intent(this, MetronomeService::class.java))
            svc.startPlayback()
            playing = true
        }
    }

    private fun vibrate(strong: Boolean) {
        val v = getSystemService(Vibrator::class.java) ?: return
        val ms = if (strong && unlocked) 30L else 12L
        v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    @Composable
    private fun PracticeScreen() {
        val coral = Color(0xFFE07A6A)
        val bg = Color(0xFFFFF6EE)
        Column(
            Modifier.fillMaxSize().background(bg).padding(24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("小兔头节拍器", fontSize = 20.sp)
            Text("${prefs.bpm}", fontSize = 72.sp, color = coral)
            Text("BPM")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(prefs.bc) { i ->
                    Box(
                        Modifier.size(28.dp).clip(CircleShape)
                            .background(if (i == activeBeat) coral else Color.White)
                    )
                }
            }
            Slider(
                value = prefs.bpm.toFloat(),
                onValueChange = {
                    prefs = prefs.copy(bpm = MetronomePolicy.clampBpm(it.toInt()))
                    applyToService()
                },
                valueRange = 40f..208f
            )
            Button(
                onClick = { toggle() },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp)
            ) { Text(if (playing) "暂停" else "播放") }
            TextButton(onClick = { settings = !settings }) { Text("设置") }
            if (settings) {
                Row {
                    listOf(SoundMode.TRADITIONAL, SoundMode.UNIFORM, SoundMode.VOICE).forEach { m ->
                        TextButton(onClick = {
                            prefs = prefs.copy(sm = m.raw)
                            applyToService()
                        }) { Text(m.raw) }
                    }
                }
                Row {
                    listOf(4 to 4, 3 to 4, 2 to 4, 6 to 8, 5 to 4, 7 to 8).forEach { (b, u) ->
                        TextButton(onClick = {
                            prefs = prefs.copy(bc = b, bu = u)
                            applyToService()
                        }) { Text("$b/$u") }
                    }
                }
                Text("自定义拍数 ${prefs.bc}")
                Slider(
                    value = prefs.bc.toFloat(),
                    onValueChange = {
                        prefs = prefs.copy(bc = MetronomePolicy.clampBeats(it.toInt()))
                        applyToService()
                    },
                    valueRange = 1f..16f,
                    steps = 14
                )
                Text("音量 ${prefs.vol}")
                Slider(
                    value = prefs.vol.toFloat(),
                    onValueChange = {
                        prefs = prefs.copy(vol = MetronomePolicy.clampVolume(it.toInt()))
                        applyToService()
                    },
                    valueRange = 10f..100f
                )
                TextButton(onClick = { prefs = prefs.copy(lang = if (prefs.lang == "zh") "en" else "zh"); applyToService() }) {
                    Text(if (prefs.lang == "zh") "EN" else "中文")
                }
                TextButton(onClick = { prefs = prefs.copy(haptic = !prefs.haptic); applyToService() }) {
                    Text(if (prefs.haptic) "震动开" else "震动关")
                }
                Text("音色工坊 · SKU ${MetronomePolicy.PRODUCT_ID}")
                if (unlocked) {
                    Text("已解锁")
                    MetronomePolicy.packClickBanks.forEach { bank ->
                        TextButton(onClick = {
                            if (MetronomePolicy.canUsePackBank(bank, unlocked)) {
                                prefs = prefs.copy(clickBank = bank)
                                applyToService()
                            }
                        }) { Text(bank) }
                    }
                } else {
                    Button(onClick = { store.launch(this@MainActivity) }) { Text("解锁") }
                }
                TextButton(onClick = { restorePurchases() }) { Text("恢复购买") }
            }
        }
    }
}
