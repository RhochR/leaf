# Leaf — Android-App

Kleine Jetpack-Glance-Widget-App. Kein Play Store, keine Signing-Einrichtung nötig — der
GitHub-Actions-Workflow (`.github/workflows/build-apk.yml`) baut bei jedem Push eine
**Debug-APK** (automatisch mit einem Debug-Schlüssel signiert, genau richtig fürs
Sideloading für den privaten Gebrauch).

## Ehrlicher Stand

Dieser Code wurde **nicht lokal kompiliert** — auf der Entwicklungsmaschine war kein
Android SDK verfügbar. Er folgt den dokumentierten Jetpack-Glance/WorkManager-APIs
sorgfältig, aber der erste GitHub-Actions-Lauf ist der erste echte Kompilier-Test. Schlägt
er fehl, sind die Fehlermeldungen im Actions-Log meist sehr konkret (falscher Import,
falscher Parametername) und leicht behebbar — gerne nochmal herschicken.

Offene Punkte für die nächste Runde:
- **Fraunces-Schrift** ist noch nicht eingebunden (Widget nutzt aktuell die System-Schrift
  als Übergangslösung) — braucht eine `.ttf`-Datei unter `res/font/`.
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
