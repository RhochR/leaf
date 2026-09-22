package app.leaf.widget

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/** Einrichtungs-Bildschirm: Server-Adresse, Raum, Passphrase, eigene Rolle — dieselben drei
    Felder wie im Web-Editor (web/index.html). Wird sowohl beim ersten Start als auch über
    "Leaf einrichten"-Tap im unkonfigurierten Widget geöffnet. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SetupScreen(
                        onSaved = {
                            lifecycleScope.launch {
                                StatusWidget().updateAll(applicationContext)
                                RefreshWorker.schedulePeriodic(applicationContext)
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun SetupScreen(onSaved: () -> Unit) {
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    var baseUrl by remember { mutableStateOf("https://") }
    var room by remember { mutableStateOf("") }
    var passphrase by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("a") }
    var status by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("🌿 Leaf einrichten", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Zeigt auf deinem Homescreen, was dein Mensch gerade macht. " +
                "Server-Adresse, Raum und Passphrase bekommst du von der Person, die Leaf " +
                "für euch aufgesetzt hat.",
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
            value = room,
            onValueChange = { room = it },
            label = { Text("Raum") },
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
                SessionStore.save(context, baseUrl.trim(), room.trim(), role, passphrase)
                status = "Gespeichert. Das Widget aktualisiert sich in Kürze."
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
