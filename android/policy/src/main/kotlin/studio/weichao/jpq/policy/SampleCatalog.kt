package studio.weichao.jpq.policy

/** All free sounds are required: clicks alone cannot guarantee default voice playback. */
object SampleCatalog {
    val required: List<String> = listOf("click-strong", "click-weak", "click-uniform") +
        listOf("zh", "en").flatMap { lang -> (1..16).map { "voice/$lang/${id(it)}" } }

    fun id(number: Int): String = number.toString().padStart(2, '0')

    fun complete(buffers: Map<String, ShortArray>): Boolean =
        required.all { buffers[it]?.isNotEmpty() == true }
}
