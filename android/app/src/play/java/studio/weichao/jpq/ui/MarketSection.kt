package studio.weichao.jpq.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.weichao.jpq.policy.MetronomePolicy
import studio.weichao.jpq.policy.MetronomePrefs

/** play 变体：音色工坊段（购买 / Restore / 包内银行），与原 SettingsSheet 内实现一致。 */
@Composable
fun MarketSection(
    prefs: MetronomePrefs,
    unlocked: Boolean,
    productPrice: String?,
    storeBusy: Boolean,
    storeMessage: String,
    storeAvailable: Boolean,
    cb: MacaronCallbacks
) {
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
                    MacaronPress(onClick = cb.onRestore, enabled = !storeBusy) {
                        Box(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Palette.coralSoft).padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) { Text(cb.t("restore"), color = Palette.coralDeep, fontWeight = FontWeight.SemiBold) }
                    }
                    if (storeMessage.isNotEmpty()) {
                        Text(storeMessage, color = Palette.fg2, fontSize = 13.sp)
                    }
                    BankBlock(cb.t("click_bank"), false, prefs, unlocked, cb)
                    BankBlock(cb.t("voice_bank"), true, prefs, unlocked, cb)
                }
            }
}
