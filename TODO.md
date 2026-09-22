# Leaf — To-Do

Fahrplan in Meilensteinen. Details & Begründungen stehen in [`docs/PLAN.md`](docs/PLAN.md).

## ✅ Setup
- [x] Git-Repo initialisiert
- [x] Projektstruktur angelegt (`server/`, `web/`, `ios/`, `android/`, `docs/`, `deploy/`)
- [x] `README.md`, `docs/PLAN.md` geschrieben

## 🎨 Design-Richtung
- [x] Visuelle Richtung mit dir besprechen (vier Stimmungen: Morgenrot/Tag/Dämmerung/Nacht,
      Fraunces-Serif-Überschriften, gestaffelte Landschafts-Illustrationen) — bestätigt im
      [Design-Artifact](https://claude.ai/artifact/9p4L7FSjBFUC6NRfuGxyFo)
- [x] `docs/DESIGN.md` geschrieben — die eine Quelle der Wahrheit fürs Aussehen
- [x] Illustrations-Quelldateien gesichert in `docs/assets/illustrations/`

## 🧪 M0 — Machbarkeits-Spikes
- [ ] Android: Minimal-Projekt baut über GitHub Actions zu einer installierbaren `.apk`
- [ ] Android: Sideloading auf einem echten Gerät testen (Reibungslosigkeit prüfen)
- [ ] iOS: ScriptWidget installieren, Test-Skript rendert etwas Einfaches aufs Homescreen
      *(sobald ein iPhone zum Testen verfügbar ist)*

## 🖥️ M1 — Server & Web-Editor ✅
- [x] `server/server.js` — Node, ohne externe Abhängigkeiten
- [x] Datenbank/Storage (`server/store.js`, JSON-Datei mit atomarem Schreiben)
- [x] `GET /api/:room` und `PUT /api/:room/:slot` inkl. Token-Auth & Rate-Limit
- [x] `web/` — Editor-Seite: Passphrase, Status-Formular (Nachricht/Tätigkeit/Ort/Theme),
      Presets für Tätigkeit & Ort, Live-Vorschau der eigenen & der Partner-Karte
- [x] Lokal end-to-end getestet (Node via WSL, da auf dieser Maschine kein Node installiert
      war): statisches Ausliefern, Rundlauf Speichern → Lesen, falscher Token → 403,
      zu große Anfrage → 413, zwei Browser-Tabs als Person A/B mit Live-Update übers
      Polling — alles grün. Ein Rendering-Bug unterwegs gefunden & behoben: SVGs
      brauchen explizite `width`/`height`, sonst berechnet `background-size: cover`
      falsch (betraf `docs/assets/` und `web/assets/` gleichermaßen).

## 📱 M2 — iOS-Renderer (ScriptWidget)
- [ ] `ios/widget.js` schreiben (`fetch()` + JSX-Rendering nach `docs/DESIGN.md`)
- [ ] Layouts für klein/mittel/groß (ScriptWidgets Widget-Familien)
- [ ] Auf echtem Gerät testen, tatsächliches Update-Intervall beobachten

## 🤖 M3 — Android-Renderer (eigene Kotlin-App)
- [x] Gradle-Projekt-Grundgerüst (`android/`)
- [x] Glance-Widget-UI nach `docs/DESIGN.md` (breites + quadratisches Layout,
      Illustrationen als PNG-Ressourcen aus den SVG-Quellen gerendert)
- [x] `RefreshWorker` — periodischer Abruf via WorkManager (15 Min)
- [x] Tap öffnet `MainActivity` (Einrichtung); Widget selbst ist nur Anzeige
- [x] `.github/workflows/build-apk.yml` — baut eine **Debug-APK** (signiert, installierbar)
      als Artifact bei jedem Push
- [x] **Baut erfolgreich über GitHub Actions** (4. Anlauf) — drei echte Fehler unterwegs
      gefunden und behoben: veraltetes `tools`-Paket in der setup-android-Action, fehlendes
      Compose-Compiler-Plugin (Pflicht seit Kotlin 2.0), fehlende `content`-Lambda bei einem
      Glance-`Box()`-Aufruf. APK liegt als Artifact im jeweils neuesten Actions-Lauf.
      Offene Politur (Fraunces-Font, App-Icon) weiterhin in `android/README.md`.
- [ ] Auf echtem Gerät installieren & testen

## 🚀 M4 — Deployment
- [ ] `deploy/Caddyfile` — automatisches HTTPS
- [ ] `deploy/couple-widget.service` — systemd, läuft als eigener Nutzer, nur lokal erreichbar
- [ ] Auf VPS/Raspberry Pi deployen, mit echter Domain testen

## ✨ M5 — Feinschliff
- [ ] `docs/SETUP.md` — Schritt-für-Schritt-Anleitung für beide Partner:innen
- [ ] "Veraltet"-Anzeige, wenn ein Status älter als ~30 Min ist
- [ ] Tap-to-React (kurze Reaktion zurückschicken)
- [ ] Gemeinsamer Testlauf mit beiden Geräten über ein paar Tage
