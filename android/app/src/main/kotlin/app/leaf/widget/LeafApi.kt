package app.leaf.widget

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/** Entspricht exakt dem Slot-Objekt aus server/store.js. */
data class Slot(
    val message: String,
    val activity: String,
    val place: String,
    val theme: String,
    val reaction: String,
    val updatedAt: Long,
)

val EMPTY_SLOT = Slot("", "", "", "", "", 0L)

/** Ergebnis eines expliziten Verbindungstests aus MainActivity — im Gegensatz zu
    fetchStatus() (die für den Widget-Refresh jeden Fehler stillschweigend zu null
    zusammenfaltet) soll der Nutzer hier sehen, WAS genau nicht geht. */
sealed class ConnectionCheck {
    object Ok : ConnectionCheck()
    object WrongPassphrase : ConnectionCheck()
    data class Failed(val reason: String) : ConnectionCheck()
}

/** Schlanker Netzwerk-Client — bewusst ohne OkHttp, java.net + org.json reichen völlig
    und sind schon im Android-SDK dabei. */
object LeafApi {

    private fun parseSlot(obj: JSONObject): Slot = Slot(
        message = obj.optString("message", ""),
        activity = obj.optString("activity", ""),
        place = obj.optString("place", ""),
        theme = obj.optString("theme", ""),
        reaction = obj.optString("reaction", ""),
        updatedAt = obj.optLong("updatedAt", 0L),
    )

    /** Holt beide Slots. Erfordert denselben Bearer-Token wie zum Schreiben — der Server
        verlangt die Passphrase inzwischen auch zum Lesen. Gibt null zurück bei falscher
        Passphrase oder jedem Netzwerkfehler; der Aufrufer zeigt dann den letzten bekannten
        Stand weiter. */
    fun fetchStatus(baseUrl: String, token: String): Pair<Slot, Slot>? {
        return runCatching {
            val url = URL("$baseUrl/api/status")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000
            try {
                if (conn.responseCode != 200) return@runCatching null
                val body = conn.inputStream.bufferedReader(StandardCharsets.UTF_8).readText()
                val json = JSONObject(body)
                parseSlot(json.getJSONObject("a")) to parseSlot(json.getJSONObject("b"))
            } finally {
                conn.disconnect()
            }
        }.getOrNull()
    }

    /** Blockierender Aufruf — vom Aufrufer auf Dispatchers.IO auszuführen. Anders als
        fetchStatus() unterscheidet das hier falsche Passphrase von "Server nicht
        erreichbar", damit MainActivity dem Nutzer sagen kann, woran es liegt. */
    fun testConnection(baseUrl: String, token: String): ConnectionCheck {
        if (baseUrl.isBlank()) return ConnectionCheck.Failed("keine Server-Adresse eingetragen")
        return try {
            val url = URL("$baseUrl/api/status")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.connectTimeout = 8_000
            conn.readTimeout = 8_000
            try {
                when (conn.responseCode) {
                    200 -> ConnectionCheck.Ok
                    401, 403 -> ConnectionCheck.WrongPassphrase
                    else -> ConnectionCheck.Failed("Server antwortet mit ${conn.responseCode}")
                }
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            ConnectionCheck.Failed(e.message ?: e::class.simpleName ?: "unbekannter Fehler")
        }
    }
}
