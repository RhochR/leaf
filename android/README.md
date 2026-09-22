# Leaf — Android-App

Kleine Jetpack-Glance-Widget-App. Kein Play Store, keine Signing-Einrichtung nötig — der
GitHub-Actions-Workflow (`.github/workflows/build-apk.yml`) baut bei jedem Push eine
**Debug-APK** (automatisch mit einem Debug-Schlüssel signiert, genau richtig fürs
Sideloading für den privaten Gebrauch).

## Ehrlicher Stand

Dieser Code wurde nie lokal kompiliert — auf der Entwicklungsmaschine ist kein Android SDK
verfügbar, jeder Kompilier-Test läuft über GitHub Actions. Läuft mittlerweile durchgehend
grün. Auf einem echten Gerät getestet: Widget-Refresh, Verbindungstest, eingebetteter
Status-Editor. Fraunces/Work Sans (`res/font/`) und die Aktivitäts-Icons (`res/drawable/
ic_*.xml`) sind eingebunden — Details siehe `THIRD_PARTY_NOTICES.md` bzw. die Kommentare
in `LeafTheme.kt` / `StatusWidget.kt` (Glance kann eigene Schriften technisch nicht laden,
nur die App selbst).

Offene Punkte für die nächste Runde:
- **App-Icon** fehlt (Manifest verzichtet bewusst auf `android:icon`, damit der Build nicht
  an einer fehlenden Ressource scheitert) — Android zeigt dafür ein Standard-Icon.
- Tap-to-React aus `docs/PLAN.md`/M5 ist hier noch nicht umgesetzt.

## Lokal bauen (falls gewünscht, statt CI)

Braucht ein Android SDK (`ANDROID_HOME` gesetzt) und Gradle. Ohne eigenen Wrapper im Repo:

```bash
cd android
gradle assembleDebug
```

Die APK landet in `app/build/outputs/apk/debug/`.
