package studio.weichao.jpq.policy

class StoreBusyGuard {
    enum class Op { None, Purchase, Restore }

    @Volatile
    var current: Op = Op.None
        private set

    @Synchronized
    fun tryBegin(op: Op): Boolean {
        if (op == Op.None) return false
        if (current != Op.None) return false
        current = op
        return true
    }

    @Synchronized
    fun end(op: Op): Boolean {
        if (current != op) return false
        current = Op.None
        return true
    }

    val busy: Boolean get() = current != Op.None
}
