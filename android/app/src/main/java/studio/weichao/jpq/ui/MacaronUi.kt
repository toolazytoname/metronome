package studio.weichao.jpq.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.RowScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.weichao.jpq.R
import studio.weichao.jpq.policy.MetronomePolicy
import studio.weichao.jpq.policy.MetronomePrefs
import studio.weichao.jpq.policy.SoundMode

object Palette {
    val bg = Color(0xFFFDF7F1)
    val surface = Color.White
    val surface2 = Color(0xFFFBF6F3)
    val ink = Color(0xFF251E1A)
    val muted = Color(0xFF8C7D73)
    val fg2 = Color(0xFF6B5E57)
    val border = Color(0xFFEEE3DB)
    val coral = Color(0xFFE07A6A)
    val coralDeep = Color(0xFFB85147)
    val coralSoft = Color(0xFFFAECE8)
    val mint = Color(0xFF73D1B3)
    val mintSoft = Color(0xFFEBFAF0)
    val mintDeep = Color(0xFF2E7A66)
    val lemon = Color(0xFFF5DB6B)
    val lemonSoft = Color(0xFFFCF2D1)
    val lemonDeep = Color(0xFF856B1A)
    val lavender = Color(0xFFC7B8E6)
    val lavenderSoft = Color(0xFFF5F0FA)
    val lavenderDeep = Color(0xFF5C477D)
}

data class MacaronCallbacks(
    val t: (String) -> String,
    val bankLabel: (String, Boolean) -> String,
    val onToggle: () -> Unit,
    val onBpm: (Int) -> Unit,
    val onMode: (SoundMode) -> Unit,
    val onSignature: (Int, Int) -> Unit,
    val onVolume: (Int) -> Unit,
    val onLang: (String) -> Unit,
    val onHaptic: (Boolean) -> Unit,
    val onKeepAwake: (Boolean) -> Unit,
    val onClickBank: (String) -> Unit,
    val onVoiceBank: (String) -> Unit,
    val onHapticPattern: (String) -> Unit,
    val onHapticFeel: (String) -> Unit,
    val onBuy: () -> Unit,
    val onRestore: () -> Unit,
    val onShare: () -> Unit,
    val onSupport: () -> Unit,
    val onPrivacy: () -> Unit,
    val onOpenSettings: () -> Unit,
    val onCloseSettings: () -> Unit
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MacaronApp(
    prefs: MetronomePrefs,
    playing: Boolean,
    activeBeat: Int,
    unlocked: Boolean,
    settings: Boolean,
    storeMessage: String,
    productPrice: String?,
    storeBusy: Boolean,
    storeAvailable: Boolean,
    cb: MacaronCallbacks
) {
    Box(Modifier.fillMaxSize().background(Palette.bg)) {
        Box(
            Modifier.fillMaxSize().background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFFFFD1C7).copy(alpha = 0.45f), Color.Transparent),
                    center = Offset(40f, 40f),
                    radius = 700f
                )
            )
        )
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp)
        ) {
            TopBeans(prefs.lang, cb)
            Box(Modifier.weight(1f).fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.TopCenter) {
                HeroCard(
                    prefs = prefs,
                    playing = playing,
                    activeBeat = activeBeat,
                    storeMessage = if (storeAvailable) storeMessage else "",
                    cb = cb,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            SettingsBar(cb.t("settings"), cb.onOpenSettings)
            Spacer(Modifier.height(10.dp))
        }
        if (settings) {
            ModalBottomSheet(
                onDismissRequest = cb.onCloseSettings,
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false),
                containerColor = Palette.bg,
                tonalElevation = 0.dp
            ) {
                SettingsSheet(
                    prefs = prefs,
                    unlocked = unlocked,
                    productPrice = productPrice,
                    storeBusy = storeBusy,
                    storeMessage = storeMessage,
                    storeAvailable = storeAvailable,
                    cb = cb
                )
            }
        }
    }
}

@Composable
private fun TopBeans(lang: String, cb: MacaronCallbacks) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
        MacaronPress(onClick = cb.onShare) {
            Box(
                Modifier.size(36.dp).shadow(6.dp, RoundedCornerShape(12.dp)).clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFFCF2B8), Palette.lemon))),
                contentAlignment = Alignment.Center
            ) {
                Text("↗", color = Palette.lemonDeep, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
        Spacer(Modifier.width(6.dp))
        MacaronPress(onClick = { cb.onLang(if (lang == "zh") "en" else "zh") }) {
            Box(
                Modifier.height(36.dp).padding(0.dp).shadow(6.dp, RoundedCornerShape(12.dp))
                    .clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFEEE6FA), Color(0xFFD1C7F0))))
                    .padding(horizontal = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (lang == "zh") "EN" else "中文",
                    color = Palette.lavenderDeep,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
private fun HeroCard(
    prefs: MetronomePrefs,
    playing: Boolean,
    activeBeat: Int,
    storeMessage: String,
    cb: MacaronCallbacks,
    modifier: Modifier = Modifier
) {
    Column(
        modifier
            .fillMaxWidth()
            .shadow(20.dp, RoundedCornerShape(36.dp), spotColor = Palette.ink.copy(alpha = 0.18f))
            .clip(RoundedCornerShape(36.dp))
            .background(Palette.surface)
            .border(1.dp, Color.White.copy(alpha = 0.85f), RoundedCornerShape(36.dp))
            .padding(horizontal = 20.dp, vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            Modifier.size(124.dp).shadow(10.dp, CircleShape, spotColor = Palette.coral.copy(alpha = 0.35f)),
            contentAlignment = Alignment.Center
        ) {
            Box(
                Modifier.size(124.dp).clip(CircleShape).background(
                    Brush.sweepGradient(
                        listOf(Palette.coral, Palette.lemon, Palette.mint, Palette.lavender, Palette.coral)
                    )
                )
            )
            Image(
                painter = painterResource(R.drawable.bunny),
                contentDescription = null,
                modifier = Modifier
                    .requiredSize(116.dp)
                    .clip(CircleShape)
                    .graphicsLayer {
                        scaleX = 1.28f
                        scaleY = 1.28f
                        translationY = 8f
                    },
                contentScale = ContentScale.Crop
            )
        }
        Row(Modifier.padding(top = 10.dp)) {
            Text(cb.t("app_name_lead"), color = Palette.ink, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text(cb.t("app_name_em"), color = Palette.coralDeep, fontSize = 24.sp, fontWeight = FontWeight.Black)
        }
        Text(cb.t("tagline"), color = Palette.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
        BeatGrid(prefs, playing, activeBeat, Modifier.padding(top = 16.dp).fillMaxWidth())
        Text(
            "${prefs.bpm}",
            color = Palette.ink,
            fontSize = 72.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = (-1).sp,
            modifier = Modifier.padding(top = 8.dp)
        )
        Box(
            Modifier.clip(RoundedCornerShape(50)).background(Palette.coralSoft).padding(horizontal = 10.dp, vertical = 3.dp)
        ) {
            Text("BPM", color = Palette.coralDeep, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.6.sp)
        }
        StatusPill(prefs, playing, cb)
        Row(
            Modifier.fillMaxWidth().padding(top = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            LemonChip("−") { cb.onBpm(prefs.bpm - 1) }
            MacaronSlider(
                value = prefs.bpm.toFloat(),
                onChange = { cb.onBpm(it.toInt()) },
                range = 40f..208f,
                modifier = Modifier.weight(1f).padding(horizontal = 10.dp)
            )
            LemonChip("+") { cb.onBpm(prefs.bpm + 1) }
        }
        PlayButton(playing, cb.onToggle)
        if (storeMessage.isNotEmpty()) {
            Text(
                storeMessage,
                color = Palette.fg2,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

@Composable
private fun StatusPill(prefs: MetronomePrefs, playing: Boolean, cb: MacaronCallbacks) {
    val mode = when (prefs.mode) {
        SoundMode.TRADITIONAL -> cb.t("sound_traditional")
        SoundMode.UNIFORM -> cb.t("sound_uniform")
        SoundMode.VOICE -> cb.t("sound_voice")
    }
    val line = "${cb.t(if (playing) "status_playing" else "status_idle")} · ${prefs.bpm} BPM · ${prefs.bc}/${prefs.bu} · $mode"
    Row(
        Modifier.padding(top = 8.dp).clip(RoundedCornerShape(50))
            .background(Color.White.copy(alpha = 0.7f))
            .border(1.dp, Palette.border, RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(7.dp).clip(CircleShape)
                .background(if (playing) Palette.coral else Color(0xFFD1C7BD))
        )
        Spacer(Modifier.width(6.dp))
        Text(line, color = Palette.fg2, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
private fun BeatGrid(prefs: MetronomePrefs, playing: Boolean, activeBeat: Int, modifier: Modifier = Modifier) {
    val n = prefs.bc.coerceIn(1, 16)
    val rows = (n + 3) / 4
    val (fillTop, fillBot, text, ring) = when (prefs.mode) {
        SoundMode.TRADITIONAL -> Quad(Palette.lemonSoft, Palette.lemon, Palette.lemonDeep, Color(0xFFD9BF59))
        SoundMode.UNIFORM -> Quad(Palette.mintSoft, Color(0xFFC7EBD8), Palette.mintDeep, Color(0xFF8CD1B8))
        SoundMode.VOICE -> Quad(Palette.lavenderSoft, Color(0xFFE0D6F5), Palette.lavenderDeep, Palette.lavender)
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(rows) { r ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(4) { c ->
                    val i = r * 4 + c
                    Box(Modifier.weight(1f).aspectRatio(1f)) {
                        if (i < n) {
                            val active = playing && i == activeBeat
                            val strong = prefs.mode == SoundMode.TRADITIONAL && i == 0
                            Box(
                                Modifier.fillMaxSize()
                                    .graphicsLayer { val s = if (active) 1.05f else 1f; scaleX = s; scaleY = s }
                                    .shadow(if (active) 8.dp else 3.dp, RoundedCornerShape(16.dp))
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(
                                        if (strong) Brush.verticalGradient(listOf(Palette.coral, Palette.coralDeep))
                                        else Brush.linearGradient(listOf(fillTop, fillBot))
                                    )
                                    .border(1.5.dp, if (strong) Palette.coralDeep else ring, RoundedCornerShape(16.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "${i + 1}",
                                    color = if (strong) Color.White else text,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = if (n >= 8) 16.sp else 20.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private data class Quad(val a: Color, val b: Color, val c: Color, val d: Color)

@Composable
private fun PlayButton(playing: Boolean, onToggle: () -> Unit) {
    val top = if (playing) Palette.coral else Color(0xFF8CDBC0)
    val bot = if (playing) Palette.coralDeep else Palette.mintDeep.copy(alpha = 0.85f)
    val glow = if (playing) Palette.coral else Palette.mint
    MacaronPress(onClick = onToggle) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(top = 14.dp)) {
            Box(Modifier.size(94.dp).clip(CircleShape).background(glow.copy(alpha = 0.22f)))
            Box(
                Modifier.size(78.dp).shadow(16.dp, CircleShape, spotColor = bot.copy(alpha = 0.45f))
                    .clip(CircleShape)
                    .background(Brush.verticalGradient(listOf(top, bot))),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (playing) "❚❚" else "▶",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun SettingsBar(title: String, onOpen: () -> Unit) {
    MacaronPress(onClick = onOpen) {
        Row(
            Modifier.fillMaxWidth().padding(top = 12.dp)
                .shadow(8.dp, RoundedCornerShape(24.dp), spotColor = Palette.ink.copy(alpha = 0.08f))
                .clip(RoundedCornerShape(24.dp))
                .background(Palette.surface)
                .padding(horizontal = 18.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(title, color = Palette.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Box(
                Modifier.size(22.dp).clip(CircleShape).background(Palette.coralSoft),
                contentAlignment = Alignment.Center
            ) {
                Text("⌃", color = Palette.coralDeep, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun SettingsSheet(
    prefs: MetronomePrefs,
    unlocked: Boolean,
    productPrice: String?,
    storeBusy: Boolean,
    storeMessage: String,
    storeAvailable: Boolean,
    cb: MacaronCallbacks
) {
    Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(cb.t("done"), color = Color.Transparent, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(cb.t("settings"), color = Palette.ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            MacaronPress(onClick = cb.onCloseSettings) {
                Text(cb.t("done"), color = Palette.coralDeep, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }
        }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SettingsGroup(cb.t("sound_mode")) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ModeTile("🥁", cb.t("sound_traditional"), prefs.mode == SoundMode.TRADITIONAL, Modifier.weight(1f)) { cb.onMode(SoundMode.TRADITIONAL) }
                    ModeTile("🎵", cb.t("sound_uniform"), prefs.mode == SoundMode.UNIFORM, Modifier.weight(1f)) { cb.onMode(SoundMode.UNIFORM) }
                    ModeTile("🗣️", cb.t("sound_voice"), prefs.mode == SoundMode.VOICE, Modifier.weight(1f)) { cb.onMode(SoundMode.VOICE) }
                }
            }
            SettingsGroup(cb.t("time_signature")) {
                val presets = listOf(
                    Triple(4, 4, "sig_44"), Triple(3, 4, "sig_34"), Triple(2, 4, "sig_24"),
                    Triple(6, 8, "sig_68"), Triple(5, 4, "sig_54"), Triple(7, 8, "sig_78")
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    presets.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { (bc, bu, key) ->
                                val on = prefs.bc == bc && prefs.bu == bu
                                Chip(
                                    title = "$bc/$bu",
                                    caption = cb.t(key),
                                    on = on,
                                    modifier = Modifier.weight(1f)
                                ) { cb.onSignature(bc, bu) }
                            }
                            if (row.size < 3) repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Stepper(cb.t("beats"), prefs.bc, 1..16, { cb.onSignature(it, prefs.bu) })
                        Text("/", color = Palette.muted, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Stepper(cb.t("beat_unit"), prefs.bu, 1..16, { cb.onSignature(prefs.bc, it) })
                    }
                }
            }
            SettingsGroup(cb.t("volume")) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${prefs.vol}", color = Palette.coralDeep, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.width(36.dp))
                    MacaronSlider(prefs.vol.toFloat(), { cb.onVolume(it.toInt()) }, 10f..100f, Modifier.weight(1f))
                }
            }
            SettingsGroup(cb.t("language")) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SelectChip("中文", prefs.lang == "zh", Modifier.weight(1f)) { cb.onLang("zh") }
                    SelectChip("English", prefs.lang == "en", Modifier.weight(1f)) { cb.onLang("en") }
                }
            }
            SettingsGroup(cb.t("practice_opts")) {
                ToggleRow(cb.t("haptic"), prefs.haptic, cb.onHaptic)
                Box(Modifier.fillMaxWidth().height(1.dp).background(Palette.border))
                ToggleRow(cb.t("keep_awake"), prefs.keepAwake, cb.onKeepAwake)
            }
            SettingsGroup(cb.t("sound_workshop")) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (!storeAvailable && !unlocked) {
                        Text(cb.t("workshop_play_only"), color = Palette.fg2, fontSize = 13.sp)
                        return@Column
                    }
                    Text(cb.t("sound_workshop_blurb"), color = Palette.fg2, fontSize = 13.sp)
                    Text(cb.t("haptic_pack_blurb"), color = Palette.fg2, fontSize = 13.sp)
                    OptionRow(
                        cb.t("haptic_pattern"),
                        listOf(
                            MetronomePolicy.HAPTIC_PATTERN_ALL to cb.t("haptic_all"),
                            MetronomePolicy.HAPTIC_PATTERN_DOWNBEAT to cb.t("haptic_downbeat")
                        ),
                        MetronomePolicy.resolveHapticPattern(prefs.hapticPattern, unlocked),
                        unlocked,
                        MetronomePolicy.HAPTIC_PATTERN_ALL,
                        cb.onHapticPattern
                    )
                    OptionRow(
                        cb.t("haptic_feel"),
                        listOf(
                            MetronomePolicy.HAPTIC_FEEL_LIGHT to cb.t("haptic_light"),
                            MetronomePolicy.HAPTIC_FEEL_STANDARD to cb.t("haptic_standard"),
                            MetronomePolicy.HAPTIC_FEEL_HEAVY to cb.t("haptic_heavy")
                        ),
                        MetronomePolicy.resolveHapticFeel(prefs.hapticFeel, unlocked),
                        unlocked,
                        MetronomePolicy.HAPTIC_FEEL_STANDARD,
                        cb.onHapticFeel
                    )
                    if (unlocked) {
                        Text(cb.t("owned"), color = Palette.mintDeep, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    } else {
                        val buy = if (productPrice.isNullOrBlank()) cb.t("buy") else "${cb.t("buy")} $productPrice"
                        MacaronPress(onClick = cb.onBuy, enabled = !storeBusy) {
                            Box(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                                    .background(Brush.verticalGradient(listOf(Palette.coral, Palette.coralDeep)))
                                    .padding(vertical = 12.dp),
                                contentAlignment = Alignment.Center
                            ) { Text(buy, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp) }
                        }
                    }
                    BankBlock(cb.t("click_bank"), false, prefs, unlocked, cb)
                    BankBlock(cb.t("voice_bank"), true, prefs, unlocked, cb)
                    MacaronPress(onClick = cb.onRestore, enabled = !storeBusy) {
                        Box(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Palette.coralSoft).padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) { Text(cb.t("restore"), color = Palette.coralDeep, fontWeight = FontWeight.SemiBold) }
                    }
                    if (storeMessage.isNotEmpty()) {
                        Text(storeMessage, color = Palette.fg2, fontSize = 13.sp)
                    }
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.Center) {
                MacaronPress(onClick = cb.onSupport) {
                    Text(cb.t("support"), color = Palette.coral, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
                Spacer(Modifier.width(20.dp))
                MacaronPress(onClick = cb.onPrivacy) {
                    Text(cb.t("privacy"), color = Palette.coral, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BankBlock(title: String, voice: Boolean, prefs: MetronomePrefs, unlocked: Boolean, cb: MacaronCallbacks) {
    val current = if (voice) prefs.voiceBank else prefs.clickBank
    val banks = listOf(MetronomePolicy.DEFAULT_BANK) + if (voice) MetronomePolicy.packVoiceBanks else MetronomePolicy.packClickBanks
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, color = Palette.muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            banks.forEach { bank ->
                val on = current == bank
                val locked = !unlocked && bank != MetronomePolicy.DEFAULT_BANK
                val label = cb.bankLabel(bank, voice)
                SelectChip(if (locked) "$label 🔒" else label, on, fill = false) {
                    if (voice) cb.onVoiceBank(bank) else cb.onClickBank(bank)
                }
            }
        }
    }
}

@Composable
private fun OptionRow(
    title: String,
    options: List<Pair<String, String>>,
    current: String,
    unlocked: Boolean,
    freeId: String,
    onPick: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, color = Palette.muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { (id, label) ->
                val on = current == id
                val locked = !unlocked && id != freeId
                SelectChip(if (locked) "🔒 $label" else label, on, Modifier.weight(1f)) { onPick(id) }
            }
        }
    }
}

@Composable
private fun SettingsGroup(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, color = Palette.muted, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 4.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Palette.surface).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            content()
        }
    }
}

@Composable
private fun ModeTile(icon: String, label: String, on: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    MacaronPress(onClick = onClick, modifier = modifier) {
        Column(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(if (on) Palette.coralSoft else Palette.surface2)
                .border(1.5.dp, if (on) Palette.coral.copy(alpha = 0.45f) else Color.Transparent, RoundedCornerShape(14.dp))
                .padding(vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(icon, fontSize = 20.sp)
            Text(label, color = if (on) Palette.coralDeep else Palette.fg2, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun Chip(title: String, caption: String, on: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    MacaronPress(onClick = onClick, modifier = modifier) {
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                .background(if (on) Palette.coralSoft else Palette.surface2)
                .padding(vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(title, color = if (on) Palette.coralDeep else Palette.ink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(caption, color = if (on) Palette.coralDeep.copy(alpha = 0.8f) else Palette.muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun SelectChip(label: String, on: Boolean, modifier: Modifier = Modifier, fill: Boolean = true, onClick: () -> Unit) {
    MacaronPress(onClick = onClick, modifier = modifier) {
        Box(
            (if (fill) Modifier.fillMaxWidth() else Modifier)
                .clip(RoundedCornerShape(12.dp))
                .background(if (on) Palette.coralSoft else Palette.surface2)
                .padding(vertical = 10.dp, horizontal = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(label, color = if (on) Palette.coralDeep else Palette.fg2, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun RowScope.Stepper(label: String, value: Int, range: IntRange, onChange: (Int) -> Unit) {
    Row(
        Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Palette.surface2).padding(vertical = 6.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Palette.muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        MacaronPress(onClick = { onChange((value - 1).coerceIn(range.first, range.last)) }) {
            Text("−", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(horizontal = 8.dp))
        }
        Text("$value", color = Palette.ink, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        MacaronPress(onClick = { onChange((value + 1).coerceIn(range.first, range.last)) }) {
            Text("+", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(horizontal = 8.dp))
        }
    }
}

@Composable
private fun ToggleRow(title: String, on: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            title,
            color = Palette.ink,
            fontSize = 15.sp,
            modifier = Modifier.weight(1f).padding(end = 12.dp)
        )
        Switch(
            checked = on,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Palette.coral,
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = Palette.border
            )
        )
    }
}

@Composable
private fun LemonChip(label: String, onClick: () -> Unit) {
    MacaronPress(onClick = onClick) {
        Box(
            Modifier.size(36.dp).shadow(4.dp, RoundedCornerShape(12.dp), spotColor = Palette.lemon.copy(alpha = 0.4f))
                .clip(RoundedCornerShape(12.dp))
                .background(Brush.verticalGradient(listOf(Palette.lemonSoft, Palette.lemon))),
            contentAlignment = Alignment.Center
        ) {
            Text(label, color = Palette.lemonDeep, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        }
    }
}

@Composable
fun MacaronSlider(
    value: Float,
    onChange: (Float) -> Unit,
    range: ClosedFloatingPointRange<Float>,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(modifier.height(28.dp).fillMaxWidth()) {
        val w = maxWidth
        val t = ((value - range.start) / (range.endInclusive - range.start)).coerceIn(0f, 1f)
        val thumb = 24.dp
        Box(
            Modifier.fillMaxWidth().height(10.dp).align(Alignment.Center)
                .clip(RoundedCornerShape(50))
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            Palette.mint.copy(alpha = 0.85f),
                            Palette.lemon.copy(alpha = 0.85f),
                            Palette.coral.copy(alpha = 0.85f)
                        )
                    )
                )
        )
        Box(
            Modifier.offset(x = (w - thumb) * t).size(thumb).align(Alignment.CenterStart)
                .shadow(5.dp, CircleShape, spotColor = Palette.coral.copy(alpha = 0.35f))
                .clip(CircleShape)
                .background(Color.White)
                .border(2.5.dp, Palette.coral, CircleShape)
        )
        Box(
            Modifier
                .fillMaxSize()
                .pointerInput(range) {
                    fun at(x: Float) {
                        val p = (x / size.width).coerceIn(0f, 1f)
                        onChange(range.start + p * (range.endInclusive - range.start))
                    }
                    detectTapGestures { at(it.x) }
                }
                .pointerInput(range) {
                    fun at(x: Float) {
                        val p = (x / size.width).coerceIn(0f, 1f)
                        onChange(range.start + p * (range.endInclusive - range.start))
                    }
                    detectDragGestures { change, _ -> at(change.position.x) }
                }
        )
    }
}

@Composable
fun MacaronPress(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable () -> Unit
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed && enabled) 0.97f else 1f, tween(120), label = "press")
    Box(
        modifier.scale(scale).clickable(
            interactionSource = interaction,
            indication = null,
            enabled = enabled,
            onClick = onClick
        )
    ) { content() }
}
