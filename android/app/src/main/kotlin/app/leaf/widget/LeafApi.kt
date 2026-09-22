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

    /** Holt beide Slots eines Rooms. Gibt null zurück bei 404 oder jedem Netzwerkfehler —
        der Aufrufer entscheidet dann, ob er den letzten bekannten Stand weiter zeigt. */
    fun fetchRoom(baseUrl: String, room: String): Pair<Slot, Slot>? {
        return runCatching {
            val url = URL("$baseUrl/api/$room")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
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
}
