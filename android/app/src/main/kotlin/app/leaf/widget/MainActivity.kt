package app.leaf.widget

import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** Einziger Einstiegspunkt der App — sowohl beim Start aus dem Launcher als auch beim
    Antippen des Widgets (siehe StatusWidget.kt). Zeigt je nach gespeicherter Session
    entweder die Einrichtung oder den Status-Bildschirm. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    LeafApp()
                }
            }
        }
    }

    // onCreate (und damit der Compose-seitige Refresh in StatusScreen unten) läuft nur
    // beim allerersten Start der Activity. Holt man die App aus dem Hintergrund zurück
    // (Home-Button, App-Switcher, ohne sie vorher zu beenden), ruft Android nur noch
    // onResume — deshalb hier zusätzlich und unabhängig vom Compose-Baum, damit "App
    // öffnen" wirklich JEDES Mal einen Widget-Refresh auslöst, nicht nur beim Kaltstart.
    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            StatusWidget().updateAll(applicationContext)
        }
    }
}

@Composable
private fun LeafApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var session by remember { mutableStateOf<Session?>(null) }
    var loaded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        session = SessionStore.load(context)
        loaded = true
    }

    if (!loaded) return

    val current = session
    if (current == null) {
        SetupScreen(
            onSaved = {
                scope.launch {
                    session = SessionStore.load(context)
                    StatusWidget().updateAll(context)
                    RefreshWorker.schedulePeriodic(context)
                }
            },
        )
    } else {
        StatusScreen(
            session = current,
            onReconfigure = {
                scope.launch {
                    SessionStore.clear(context)
                    session = null
                }
            },
        )
    }
}

/** Zeigt Server-Adresse, Rolle, einen echten Verbindungstest und den Einstieg in den
    Status-Editor — vorher gab es nach dem Einrichten keinerlei Rückmeldung mehr, ob der
    Server überhaupt erreichbar ist, und keinen Weg zurück zum eigentlichen Editor. */
@Composable
private fun StatusScreen(session: Session, onReconfigure: () -> Unit) {
    var showEditor by remember { mutableStateOf(false) }
    BackHandler(enabled = showEditor) { showEditor = false }

    if (showEditor) {
        EditorWebView(session = session, onBack = { showEditor = false })
        return
    }

    val context = LocalContext.current
    var checking by remember { mutableStateOf(false) }
    var check by remember { mutableStateOf<ConnectionCheck?>(null) }
    val scope = rememberCoroutineScope()

    // Die 15-Minuten-Grenze aus RefreshWorker gilt nur für den automatischen
    // Hintergrund-Timer (WorkManager-Vorgabe) — ein Refresh, den man selbst im
    // Vordergrund auslöst, ist davon nicht betroffen. Also bei jedem Öffnen des
    // Status-Bildschirms (App-Start, Zurück aus dem Editor, "Erneut testen") das
    // Widget direkt mit aktuellen Daten neu zeichnen, statt auf den Timer zu warten.
    fun runCheck() {
        checking = true
        scope.launch {
            check = withContext(Dispatchers.IO) {
                LeafApi.testConnection(session.baseUrl, session.token)
            }
            checking = false
            StatusWidget().updateAll(context)
        }
    }

    LaunchedEffect(session) { runCheck() }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("🌿 Leaf", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Person ${session.role.uppercase()} · ${session.baseUrl}",
            style = MaterialTheme.typography.bodyMedium,
        )

        ConnectionStatusRow(checking = checking, check = check, onRetry = { runCheck() })

        Button(onClick = { showEditor = true }, modifier = Modifier.fillMaxWidth()) {
            Text("Status bearbeiten")
        }
        OutlinedButton(onClick = onReconfigure, modifier = Modifier.fillMaxWidth()) {
            Text("Server neu einrichten")
        }
    }
}

@Composable
private fun ConnectionStatusRow(checking: Boolean, check: ConnectionCheck?, onRetry: () -> Unit) {
    val ok = Color(0xFF2E7D32)
    val err = MaterialTheme.colorScheme.error
    val (text, color) = when {
        checking -> "Prüfe Verbindung …" to MaterialTheme.colorScheme.onSurfaceVariant
        check is ConnectionCheck.Ok -> "✓ Verbunden" to ok
        check is ConnectionCheck.WrongPassphrase -> "✗ Falsche Passphrase" to err
        check is ConnectionCheck.Failed -> "✗ Nicht erreichbar (${check.reason})" to err
        else -> "" to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(text, color = color, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        TextButton(onClick = onRetry, enabled = !checking) { Text("Erneut testen") }
    }
}

/** Der eigentliche Status-Editor ist und bleibt web/index.html — hier eingebettet statt
    in einem externen Browser, und mit vorab gesetzter Session (dieselbe localStorage-Key
    wie web/app.js benutzt), damit die Passphrase nicht ein zweites Mal eingetippt werden
    muss. */
@Composable
private fun EditorWebView(session: Session, onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        TextButton(onClick = onBack) { Text("← Zurück") }
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    var injected = false
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView, url: String?) {
                            if (injected) return
                            injected = true
                            val payload = JSONObject().apply {
                                put("role", session.role)
                                put("token", session.token)
                            }.toString()
                            view.evaluateJavascript(
                                "localStorage.setItem('leaf.session', ${JSONObject.quote(payload)}); location.reload();",
                                null,
                            )
                        }
                    }
                    loadUrl(session.baseUrl)
                }
            },
        )
    }
}

@Composable
private fun SetupScreen(onSaved: () -> Unit) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var baseUrl by remember { mutableStateOf("https://") }
    var passphrase by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("a") }
    var status by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("🌿 Leaf einrichten", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Zeigt auf deinem Homescreen, was dein Mensch gerade macht. Server-Adresse und " +
                "Passphrase bekommst du von der Person, die Leaf für euch aufgesetzt hat.",
            style = MaterialTheme.typography.bodyMedium,
        )

        OutlinedTextField(
            value = baseUrl,
            onValueChange = { baseUrl = it },
            label = { Text("Server-Adresse") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        OutlinedTextField(
            value = passphrase,
            onValueChange = { passphrase = it },
            label = { Text("Passphrase") },
            singleLine = true,
        )

        Text("Wer bist du?", style = MaterialTheme.typography.labelLarge)
        Row {
            RadioButton(selected = role == "a", onClick = { role = "a" })
            Text("Person A", modifier = Modifier.padding(top = 12.dp, end = 16.dp))
            RadioButton(selected = role == "b", onClick = { role = "b" })
            Text("Person B", modifier = Modifier.padding(top = 12.dp))
        }

        Button(onClick = {
            scope.launch {
                SessionStore.save(context, baseUrl.trim(), role, passphrase)
                status = "Gespeichert."
                onSaved()
            }
        }) {
            Text("Speichern")
        }

        if (status.isNotEmpty()) {
            Text(status, style = MaterialTheme.typography.bodySmall)
        }
    }
}
