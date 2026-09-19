package studio.weichao.jpq.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.weichao.jpq.R
import studio.weichao.jpq.policy.MetronomePrefs

/**
 * cn 变体：设置里的「投喂打赏」段（P6）。cn 包全功能免费、无内购、无工坊段；
 * 打赏纯自愿，只展示微信 / 支付宝收款码，不解锁任何功能。
 */
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
    var open by remember { mutableStateOf(false) }
    SettingsGroup(cb.t("donate")) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(cb.t("donate_blurb"), color = Palette.fg2, fontSize = 13.sp)
            MacaronPress(onClick = { open = true }) {
                Box(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                        .background(Brush.verticalGradient(listOf(Palette.coral, Palette.coralDeep)))
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) { Text(cb.t("donate"), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp) }
            }
        }
    }
    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                MacaronPress(onClick = { open = false }) {
                    Text(cb.t("done"), color = Palette.coralDeep, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                }
            },
            title = {
                Text(cb.t("donate_title"), color = Palette.ink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(cb.t("donate_blurb"), color = Palette.fg2, fontSize = 13.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Image(
                                painter = painterResource(R.drawable.qr_wechat),
                                contentDescription = cb.t("donate_wechat"),
                                contentScale = ContentScale.Fit,
                                modifier = Modifier.size(128.dp).clip(RoundedCornerShape(10.dp)).background(Color.White).padding(6.dp)
                            )
                            Text(cb.t("donate_wechat"), color = Palette.fg2, fontSize = 12.sp, textAlign = TextAlign.Center)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Image(
                                painter = painterResource(R.drawable.qr_alipay),
                                contentDescription = cb.t("donate_alipay"),
                                contentScale = ContentScale.Fit,
                                modifier = Modifier.size(128.dp).clip(RoundedCornerShape(10.dp)).background(Color.White).padding(6.dp)
                            )
                            Text(cb.t("donate_alipay"), color = Palette.fg2, fontSize = 12.sp, textAlign = TextAlign.Center)
                        }
                    }
                }
            },
            containerColor = Palette.bg
        )
    }
}
