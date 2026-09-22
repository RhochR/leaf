package app.leaf.widget

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

/**
 * Bringt die native App (Einrichtung/Status-Bildschirm) auf dieselbe Bildsprache wie
 * web/styles.css — dieselben Farben (siehe :root dort) und dieselben zwei Schriften
 * (Fraunces für große Überschriften, Work Sans für UI-Text).
 *
 * Das Homescreen-Widget selbst (StatusWidget.kt) kann diese Schriften NICHT bekommen —
 * Glance/RemoteViews unterstützt nur die eingebauten Systemschriften (sans-serif, serif,
 * monospace, cursive), keine eigenen .ttf-Dateien. Das ist keine Zeitfrage, sondern eine
 * Einschränkung der Plattform (siehe https://issuetracker.google.com/issues/223119081,
 * offen seit 2022). Hier in der normalen Compose-Activity gilt diese Einschränkung nicht.
 */

private val Fraunces = FontFamily(
    Font(R.font.fraunces_regular, FontWeight.Normal),
    Font(R.font.fraunces_semibold, FontWeight.SemiBold),
    Font(R.font.fraunces_semibold, FontWeight.Bold),
)

private val WorkSans = FontFamily(
    Font(R.font.work_sans_regular, FontWeight.Normal),
    Font(R.font.work_sans_medium, FontWeight.Medium),
    Font(R.font.work_sans_semibold, FontWeight.SemiBold),
)

// Exakt die :root-Variablen aus web/styles.css.
private val LeafBackground = Color(0xFFEEECE5)
private val LeafSurface = Color(0xFFFFFFFF)
private val LeafSurfaceVariant = Color(0xFFF6F4EE)
private val LeafBorder = Color(0xFFE0DDD2)
private val LeafText = Color(0xFF2B2A26)
private val LeafTextMuted = Color(0xFF726F64)
private val LeafAccent = Color(0xFF2F4A3C)
private val LeafError = Color(0xFFA3372A)

val LeafColorScheme = lightColorScheme(
    primary = LeafAccent,
    onPrimary = Color.White,
    secondary = LeafAccent,
    onSecondary = Color.White,
    background = LeafBackground,
    onBackground = LeafText,
    surface = LeafSurface,
    onSurface = LeafText,
    surfaceVariant = LeafSurfaceVariant,
    onSurfaceVariant = LeafTextMuted,
    outline = LeafBorder,
    error = LeafError,
)

private val baseTypography = Typography()

private val LeafTypography = baseTypography.copy(
    headlineSmall = baseTypography.headlineSmall.copy(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold),
    headlineMedium = baseTypography.headlineMedium.copy(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold),
    titleLarge = baseTypography.titleLarge.copy(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold),
    titleMedium = baseTypography.titleMedium.copy(fontFamily = WorkSans, fontWeight = FontWeight.Medium),
    bodyLarge = baseTypography.bodyLarge.copy(fontFamily = WorkSans),
    bodyMedium = baseTypography.bodyMedium.copy(fontFamily = WorkSans),
    bodySmall = baseTypography.bodySmall.copy(fontFamily = WorkSans),
    labelLarge = baseTypography.labelLarge.copy(fontFamily = WorkSans, fontWeight = FontWeight.Medium),
    labelMedium = baseTypography.labelMedium.copy(fontFamily = WorkSans),
    labelSmall = baseTypography.labelSmall.copy(fontFamily = WorkSans),
)

@Composable
fun LeafTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = LeafColorScheme, typography = LeafTypography, content = content)
}
