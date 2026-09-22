package app.leaf.widget

/** Theme-Id (aus web/presets.js) -> gebündeltes Hintergrundbild.
    Die Illustrationen sind bewusst statische PNGs, keine live gerenderte Vektorgrafik —
    Begründung in docs/DESIGN.md ("Wichtig für die native Umsetzung"). Erzeugt aus den
    SVG-Quellen in docs/assets/illustrations/ per resvg. */
fun backgroundFor(theme: String?): Int = when (theme) {
    "tag" -> R.drawable.bg_tag
    "daemmerung" -> R.drawable.bg_daemmerung
    "nacht" -> R.drawable.bg_nacht
    else -> R.drawable.bg_morgenrot // Morgenrot ist auch der Default im Web-Editor
}
