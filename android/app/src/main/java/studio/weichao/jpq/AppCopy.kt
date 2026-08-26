package studio.weichao.jpq

import android.content.res.AssetManager
import org.json.JSONObject
import studio.weichao.jpq.policy.MetronomePolicy

object AppCopy {
    fun load(assets: AssetManager, lang: String): Map<String, String> {
        val name = if (lang == "en") "strings/en.json" else "strings/zh.json"
        return try {
            val raw = assets.open(name).bufferedReader().use { it.readText() }
            val obj = JSONObject(raw)
            val map = mutableMapOf<String, String>()
            obj.keys().forEach { map[it] = obj.getString(it) }
            map
        } catch (_: Exception) {
            emptyMap()
        }
    }

    fun t(table: Map<String, String>, key: String): String = table[key] ?: key

    fun bankLabel(table: Map<String, String>, bank: String, voice: Boolean): String =
        t(table, MetronomePolicy.bankLabelKey(bank, voice))
}
