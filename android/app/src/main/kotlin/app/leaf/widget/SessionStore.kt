package app.leaf.widget

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import java.security.MessageDigest

private val Context.dataStore by preferencesDataStore(name = "leaf_session")

private object Keys {
    val BASE_URL = stringPreferencesKey("base_url")
    val ROLE = stringPreferencesKey("role") // "a" oder "b"
    val TOKEN = stringPreferencesKey("token")
}

// Kein "Raum" mehr — ein Server bedient genau ein Paar, ein einziger gemeinsamer Status.
data class Session(val baseUrl: String, val role: String, val token: String) {
    val partnerRole: String get() = if (role == "a") "b" else "a"
}

/** Speichert Server-Adresse, Rolle und den abgeleiteten Token lokal (DataStore).
    Die Passphrase selbst wird nie gespeichert — nur ihr Hash, wie im Web-Editor auch. */
object SessionStore {

    suspend fun save(context: Context, baseUrl: String, role: String, passphrase: String) {
        val token = deriveToken(passphrase)
        context.dataStore.edit { prefs ->
            prefs[Keys.BASE_URL] = baseUrl.trimEnd('/')
            prefs[Keys.ROLE] = role
            prefs[Keys.TOKEN] = token
        }
    }

    suspend fun load(context: Context): Session? {
        val prefs = context.dataStore.data.first()
        val baseUrl = prefs[Keys.BASE_URL] ?: return null
        val role = prefs[Keys.ROLE] ?: return null
        val token = prefs[Keys.TOKEN] ?: return null
        return Session(baseUrl, role, token)
    }

    /** Exakt dieselbe Herleitung wie web/app.js und server.js: sha256(passphrase) als Hex. */
    private fun deriveToken(passphrase: String): String {
        val bytes = passphrase.toByteArray(Charsets.UTF_8)
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString("") { "%02x".format(it) }
    }
}
