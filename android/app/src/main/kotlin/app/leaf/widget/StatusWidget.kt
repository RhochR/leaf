package app.leaf.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

/**
 * Zeigt den Status der PARTNER-Person (nicht der eigenen) — Anatomie exakt nach
 * docs/DESIGN.md: kleine Pillen (mit Icon) für Tätigkeit/Ort, große zentrierte
 * Überschrift für den Inhalt, dezenter Zeitstempel. Zwei Layout-Varianten je nach
 * Widget-Breite (breit vs. quadratisch), analog zu ScriptWidgets Widget-Familien auf iOS.
 *
 * Hinweis zur Schrift: Fraunces (die Serif-Schrift aus dem Web-Design) lässt sich hier
 * NICHT einbinden — anders als in LeafTheme.kt (die normale App) unterstützt
 * Glance/RemoteViews grundsätzlich keine eigenen .ttf-Dateien, nur die eingebauten
 * Systemschriften (siehe https://issuetracker.google.com/issues/223119081, offen seit
 * 2022). FontFamily.Serif ist die technisch bestmögliche Annäherung.
 */
class StatusWidget : GlanceAppWidget() {

    // Default ist SizeMode.Single — dabei liefert LocalSize.current (siehe WidgetContent
    // unten) IMMER die minWidth/minHeight aus leaf_widget_info.xml, nie die tatsächliche
    // Größe auf dem Homescreen. Die kompakte/breite Umschaltung unten würde damit nie
    // greifen, ganz unabhängig davon, wie klein man das Widget zieht.
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val session = SessionStore.load(context)

        // Der Netzwerk-Fetch passiert HIER, vor provideContent — nicht im
        // Composable-Block selbst. Glance kann den Inhalt einer Widget-Größe wegen
        // (LocalSize.current, siehe WidgetContent) mehrfach neu komponieren; ein
        // Seiteneffekt wie ein Netzwerk-Call gehört da nicht rein, das ruft ihn sonst
        // unnötig mehrfach auf. fetchStatus() ist außerdem bewusst suspend + eigener
        // Dispatchers.IO-Wechsel (siehe LeafApi.kt) statt hier drauf zu vertrauen, dass
        // provideGlance schon auf einem Hintergrund-Thread läuft.
        val status = session?.let { LeafApi.fetchStatus(it.baseUrl, it.token) }
        val partnerSlot = session?.let {
            when (it.role) {
                "a" -> status?.second
                else -> status?.first
            }
        }

        provideContent {
            if (session == null) {
                NotConfiguredContent()
            } else {
                WidgetContent(partnerSlot)
            }
        }
    }
}

@Composable
private fun NotConfiguredContent() {
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(Color(0xFF2B2A26))
            .padding(14.dp)
            .clickable(actionStartActivity<MainActivity>()),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "Leaf einrichten — antippen",
            style = TextStyle(color = ColorProvider(Color.White), textAlign = TextAlign.Center),
        )
    }
}

@Composable
private fun WidgetContent(slot: Slot?) {
    val size = LocalSize.current
    val isCompact = size.width < 160.dp
    val bg = backgroundFor(slot?.theme)

    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>()),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            provider = ImageProvider(bg),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = GlanceModifier.fillMaxSize(),
        )
        // Derselbe Lese-Schleier wie in web/styles.css (.widget-preview::before) —
        // die einzige zweckgebundene Verlaufsfläche im ganzen Design.
        Box(modifier = GlanceModifier.fillMaxSize().background(Color(0x55000000))) {}

        val hasContent = slot != null && (slot.message.isNotEmpty() || slot.activity.isNotEmpty())
        if (!hasContent) {
            Text("Noch nichts gesetzt", style = TextStyle(color = ColorProvider(Color.White)))
        } else if (isCompact) {
            CompactBody(slot!!)
        } else {
            WideBody(slot!!)
        }
    }
}

/** Aktivitäts-Label -> Icon, exakt wie iconFor() in web/presets.js (dort per Bugfix
    ebenfalls auf Label statt id umgestellt — das ist es, was in einem Slot tatsächlich
    steht, siehe currentFormSlot() in app.js). Alles Unbekannte (eigene Texte bei
    "Sonstiges") fällt auf das Spark-Icon zurück. */
private fun iconForActivity(label: String): Int = when (label) {
    "Training" -> R.drawable.ic_dumbbell
    "Arbeit" -> R.drawable.ic_briefcase
    "Kochen" -> R.drawable.ic_pot
    "Lesen" -> R.drawable.ic_book
    else -> R.drawable.ic_spark
}

@Composable
private fun Pill(icon: Int, text: String) {
    Box(
        modifier = GlanceModifier
            .background(Color(0x24FFFFFF))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(
                provider = ImageProvider(icon),
                contentDescription = null,
                modifier = GlanceModifier.size(11.dp),
            )
            Spacer(GlanceModifier.padding(horizontal = 2.dp))
            Text(text, style = TextStyle(color = ColorProvider(Color(0xDDFFFFFF)), fontSize = 10.sp))
        }
    }
}

@Composable
private fun WideBody(slot: Slot) {
    Column(
        modifier = GlanceModifier.fillMaxWidth().padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row {
            if (slot.activity.isNotEmpty()) Pill(iconForActivity(slot.activity), slot.activity)
            if (slot.activity.isNotEmpty() && slot.place.isNotEmpty()) Spacer(GlanceModifier.padding(3.dp))
            // Ort bekommt im Web-Design (styles.css/app.js) immer das Pin-Icon, egal
            // welcher Ort es ist — kein eigenes Icon pro Ort vorgesehen.
            if (slot.place.isNotEmpty()) Pill(R.drawable.ic_pin, slot.place)
        }
        Spacer(GlanceModifier.padding(5.dp))
        Text(
            text = slot.message.ifEmpty { slot.activity },
            style = TextStyle(
                color = ColorProvider(Color.White),
                fontSize = 19.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Serif,
                textAlign = TextAlign.Center,
            ),
        )
        Spacer(GlanceModifier.padding(5.dp))
        Text(
            text = relativeTime(slot.updatedAt),
            style = TextStyle(color = ColorProvider(Color(0xAAFFFFFF)), fontSize = 10.sp),
        )
    }
}

@Composable
private fun CompactBody(slot: Slot) {
    Column(
        modifier = GlanceModifier.fillMaxWidth().padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (slot.place.isNotEmpty()) {
            Pill(R.drawable.ic_pin, slot.place)
            Spacer(GlanceModifier.padding(4.dp))
        }
        Text(
            text = slot.activity.ifEmpty { slot.message },
            style = TextStyle(
                color = ColorProvider(Color.White),
                fontSize = 17.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Serif,
                textAlign = TextAlign.Center,
            ),
        )
        Spacer(GlanceModifier.padding(4.dp))
        Text(
            text = relativeTime(slot.updatedAt),
            style = TextStyle(color = ColorProvider(Color(0x99FFFFFF)), fontSize = 9.sp),
        )
    }
}

/** Dieselbe Logik wie relativeTime() in web/app.js. */
private fun relativeTime(updatedAt: Long): String {
    if (updatedAt <= 0L) return "noch nie"
    val diffMin = ((System.currentTimeMillis() - updatedAt) / 60_000).toInt()
    return when {
        diffMin < 1 -> "gerade eben"
        diffMin == 1 -> "vor 1 Min."
        diffMin < 60 -> "vor $diffMin Min."
        diffMin < 60 * 24 -> {
            val h = diffMin / 60
            if (h == 1) "vor 1 Std." else "vor $h Std."
        }
        else -> {
            val d = diffMin / (60 * 24)
            if (d == 1) "vor 1 Tag" else "vor $d Tagen"
        }
    }
}
