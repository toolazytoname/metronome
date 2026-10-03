package studio.weichao.jpq.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun DiagnosticsDialog(t: (String) -> String, report: suspend () -> String, clear: suspend () -> Unit,
    copy: (String) -> Boolean, send: (String) -> Boolean, close: () -> Unit) {
    var note by remember { mutableStateOf("") }
    var preview by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    suspend fun refresh(clearing: Boolean = false) {
        if (busy) return
        busy = true
        try {
            if (clearing) { clear(); note = "" }
            preview = report()
            status = if (clearing) t("diagnostic_cleared") else ""
        } catch (e: CancellationException) { throw e }
        catch (_: Exception) { preview = ""; status = t("diagnostic_failed") }
        finally { busy = false }
    }
    LaunchedEffect(Unit) { refresh() }
    AlertDialog(onDismissRequest = close,
        title = { Text(t("diagnostics")) },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(t("diagnostic_help"), fontSize = 12.sp)
                OutlinedTextField(value = note, onValueChange = { note = it.take(1200) }, label = { Text(t("diagnostic_note")) }, modifier = Modifier.fillMaxWidth(), maxLines = 4)
                TextButton(onClick = { scope.launch { refresh() } }, enabled = !busy) { Text(t("diagnostic_refresh")) }
                SelectionContainer {
                    Text(preview, fontSize = 11.sp, modifier = Modifier.fillMaxWidth().heightIn(max = 160.dp).verticalScroll(rememberScrollState()))
                }
                TextButton(onClick = {
                    val payload = "To: lazywc@gmail.com\n\n$note\n\n$preview"
                    status = t(if (send(payload)) "diagnostic_handoff" else "diagnostic_failed")
                }, enabled = !busy && preview.isNotEmpty()) { Text(t("diagnostic_send")) }
                TextButton(onClick = { status = t(if (copy("To: lazywc@gmail.com\n\n$note\n\n$preview")) "diagnostic_copied" else "diagnostic_failed") }, enabled = !busy && preview.isNotEmpty()) { Text(t("diagnostic_copy")) }
                TextButton(onClick = { scope.launch { refresh(clearing = true) } }, enabled = !busy) { Text(t("diagnostic_clear")) }
                Text(status, fontSize = 12.sp)
            }
        }, confirmButton = { TextButton(onClick = close) { Text(t("diagnostic_close")) } })
}
