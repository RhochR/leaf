# Leaf — Design-Spezifikation

Die eine Quelle der Wahrheit fürs Aussehen. `ios/widget.js` (ScriptWidget) und die
Android-Kotlin-App (`android/`) setzen genau das hier um — jeweils nativ, nicht als
HTML/CSS-Rendering. Bestätigtes Design, siehe das Artifact: [Leaf — Design-Richtungen](https://claude.ai/artifact/9p4L7FSjBFUC6NRfuGxyFo).

## Grundidee

Eine große, zentrierte Serif-Überschrift trägt den Inhalt (die Nachricht bzw. bei kleinen
Widgets die Tätigkeit). Tätigkeit, Ort und Zeitstempel sind bewusst klein und an den Rand
gerückt — Status-Metadaten, nicht der Blickfang. Der Hintergrund ist eine ruhige,
illustrierte Landschaft, die die gewählte Tageszeit/Stimmung trägt.

## Typografie

- **Überschrift/Nachricht:** `Fraunces` (Serif, Gewicht 400/600) — warm, organisch, trägt
  Gewicht ohne laut zu wirken.
- **UI/Meta-Text** (Labels, Zeitstempel, Chrome außerhalb des Widgets): `Work Sans`
  (400/500/600) — klar, zurückhaltend.
- **Implementierungshinweis:** Beide sind Google Fonts und müssen pro Plattform gebundelt
  werden (iOS: Font-Datei in ScriptWidget einbetten oder auf eine native Serif wie
  `New York` ausweichen, falls das Laden von Custom Fonts in ScriptWidgets Sandbox
  einschränkt ist; Android: als Font-Resource im Gradle-Projekt bundlen). Das wird bei
  M2/M3 konkret geprüft — siehe TODO.

## Die vier Stimmungen

Jede Stimmung ist ein eigenständiges Landschaftsbild (gestaffelte Silhouetten: Himmel,
2–3 Bergketten in Tiefenschichtung, Tannen-Baumreihe, je nach Tageszeit Sonne/Mond/Sterne/
Vögel) plus ein Akzentfarbton, der nur im Editor-Chrome verwendet wird (nicht im Widget
selbst — dort trägt die Illustration die Farbe).

| Stimmung | Beschreibung | Akzent (Editor-UI) | Quelldatei |
|---|---|---|---|
| **Morgenrot** | Ruhig, warm, erwachend — Pfirsich/Lavendel-Himmel, tiefstehende Sonne | `#B4703A` | `assets/illustrations/Morgenrot.svg` |
| **Tag** | Klar, hell, in Bewegung — Blauer Himmel, kleine helle Sonne | `#2D6CB4` | `assets/illustrations/Tag.svg` |
| **Dämmerung** | Warm, weich, zur Ruhe kommend — Tiefes Türkis-Grün, erste Sterne, warmes Glühen am Horizont | `#1A655F` | `assets/illustrations/Daemmerung.svg` |
| **Nacht** | Still, nächtlich, gesammelt — Fast Schwarz-Indigo, voller Sternenhimmel, Mond | `#3B4A8C` | `assets/illustrations/Nacht.svg` |

**Wichtig für die native Umsetzung:** Diese Illustrationen sind als reine `<svg>`-Quelle
entstanden (per Illustrations-Agent erzeugt, ~30 Elemente pro Bild: Gradient, Bergschichten,
Baumreihe, Details). Sie werden **nicht** live als Vektorgrafik nativ nachgebaut — das wäre
auf beiden Plattformen unverhältnismäßig aufwändig (Jetpack Glance/`RemoteViews` kann gar
keine freien Pfade zeichnen, nur Bitmaps anzeigen; SwiftUI könnte es technisch, aber der
manuelle Portierungsaufwand lohnt sich nicht für ein statisches Hintergrundbild). Stattdessen
werden die vier SVGs bei M2/M3 einmalig zu PNGs exportiert und als Bild-Ressource gebundelt
(Android: `drawable/`, iOS: in `ios/widget.js` eingebettet oder per Asset-URL geladen). Nur
Text, Icons und Farben sind pro Update dynamisch — der Landschaftshintergrund ist statisch
pro gewähltem Theme.

## Layout-Anatomie

Zwei Widget-Größen, beide auf derselben Illustration, aber unterschiedlich stark
zugeschnitten (die Illustration füllt die Karte per "Ausschnitt/Zuschneiden", nie gestaucht):

### Breites Widget (~300×150, z. B. iOS "medium")
```
┌────────────────────────────────┐
│                                  │
│      [🏋 Training]  [📍 Ort]     │  ← zwei kleine Pillen nebeneinander
│                                  │
│     Fast fertig, ruf gleich an   │  ← große Serif-Nachricht, zentriert
│                                  │
│         🏋  vor 6 Min.           │  ← Icon + Zeitstempel, klein, leise
└────────────────────────────────┘
```

### Quadratisches Widget (~150×150, z. B. iOS "small")
```
┌───────────────┐
│                 │
│    [📍 Ort]      │  ← eine Pille (Ort)
│                 │
│    Training      │  ← große Serif-Zeile: die Tätigkeit (Nachricht passt hier nicht)
│                 │
│   vor 6 Min.     │  ← nur Zeitstempel, kein Icon
└───────────────┘
```

**Inhalts-Zuordnung:**
- Breites Widget: Pillen = Tätigkeit + Ort (Kontext) · große Serif-Zeile = **Nachricht**
  (der eigentliche Inhalt) · unten = Icon der Tätigkeit + relative Zeit
- Quadratisches Widget: Pille = Ort · große Serif-Zeile = **Tätigkeit** (die Nachricht
  passt bei der Größe nicht mehr verlässlich) · unten = nur die Zeit

### Pillen (Tätigkeit/Ort-Badges)
- Hintergrund: `rgba(255,255,255,0.14)`, voll abgerundet (`border-radius: 999px`)
- Icon (11–12px) + Text (9–10px), Textfarbe `rgba(255,255,255,0.85)`
- Bewusst unauffällig — Kontext, kein Blickfang

### Lesbarkeit über der Illustration
Ein sanfter, rein funktionaler Verlaufs-Schleier (dunkel oben/unten, heller in der Mitte —
`rgba(8,8,10,0.42) → rgba(8,8,10,0.08) → rgba(8,8,10,0.32)`) liegt über der Illustration,
damit weißer Text unabhängig vom Motiv darunter lesbar bleibt. Das ist die einzige
zweckgebundene Verlaufsfläche im Design — alles andere bleibt flach.

## Icons

Handgezeichnete Outline-Icons, keine Emojis. `viewBox="0 0 24 24"`, `stroke="currentColor"`,
`stroke-width` 1.7–1.9, `stroke-linecap`/`stroke-linejoin: round`, `fill: none`.

| Tätigkeit | Icon |
|---|---|
| Training | Hantel (zwei Gewichte + Stange) |
| Arbeit | Aktenkoffer |
| Kochen | Topf mit zwei Griffen |
| Lesen | Aufgeschlagenes Buch |
| *(Ort, alle Pillen)* | Pin/Standort-Tropfen |

Weitere Tätigkeits-Presets brauchen weitere Icons nach demselben Strichstil — siehe
`web/presets.js`, sobald das existiert.

## Was der Web-Editor daraus macht

Der Editor (`web/`) ist die einzige Stelle mit echtem HTML/CSS — dort kann (und sollte) die
Illustration live als CSS-Hintergrund verwendet werden, exakt wie im Artifact gezeigt, da der
Browser beliebiges SVG problemlos rendert. Die "nur Bitmap"-Einschränkung gilt ausschließlich
für die beiden nativen Widget-Renderer.
