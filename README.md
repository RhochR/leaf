# 🌿 Leaf

> **Hinweis:** Der Code in diesem Repo ist größtenteils KI-generiert (Claude, Anthropic) —
> entstanden im Gespräch mit mir als eine Art Pair-Programming, inklusive Design, Server,
> Web-Editor und der Android-App.

Eine winzige App für zwei Menschen. Jede:r hat ein Widget auf dem Homescreen, das zeigt,
was der/die andere gerade macht — eine Nachricht, eine Tätigkeit ("arbeitet", "trainiert",
"lernt"), ein Ort ("zuhause", "unterwegs") und ein selbstgewähltes Theme. Tippt man aufs
Widget, öffnet sich die Seite, auf der man den eigenen Status setzt.

Keine App-Store-Veröffentlichung, kein Firmenkonstrukt — ein privates, selbst gehostetes
Geschenk für ein Paar. Entsprechend bewusst einfach gehalten: kleiner Server, kein
Build-Prozess wo es sich vermeiden lässt, und auf beiden Plattformen wird ausschließlich
Open-Source-Software ohne Werbung oder Bezahlschranken verwendet, um das Widget überhaupt
aufs Homescreen zu bringen.

## Wie es funktioniert

```
              ┌──────────────────────────┐
              │   Leaf-Server (Node.js)   │
              │  GET  /api/status         │  → aktueller Status beider Partner:innen
              │  PUT  /api/status/:slot   │  → eigenen Status setzen (mit Token)
              │  liefert die Web-Oberfläche│
              └────────────┬──────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        │                                          │
   iOS: ScriptWidget                       Android: Leaf-Widget-App
   (App Store, Open Source,                 (eigene kleine Kotlin-App,
    kostenlos, werbefrei)                    selbst gebaut & installiert)
   holt JSON, rendert nativ                  Jetpack-Glance-Widget,
   Update alle ~15–40 Min                     Update alle ~15 Min
   (vom Betriebssystem begrenzt)              (Batterie-Limit von Android)
```

Beide Seiten sprechen mit derselben schlichten JSON-Schnittstelle. Das Design (Farben,
Icons, Layout) ist einmal festgelegt und wird auf jeder Plattform nativ umgesetzt — kein
HTML/CSS-Rendering im Widget selbst, sondern echte native Oberflächen, die sich schnell
und zuverlässig anfühlen.

**Ein Server, ein Paar.** Es gibt genau einen gemeinsamen Status (keine "Räume" für
mehrere Paare) und eine gemeinsame Passphrase, die sowohl zum Lesen als auch zum Schreiben
nötig ist (`LEAF_PASSPHRASE`, siehe unten). **Nicht Ende-zu-Ende-verschlüsselt** — der
Server selbst sieht die Inhalte im Klartext, die Passphrase schützt nur vor fremdem
Zugriff von außen.

## Projektstruktur

```
server/     Node.js-Server (Storage + API), keine externen Abhängigkeiten
web/        Die Editor-Website — hier setzt man seinen eigenen Status
ios/        Das ScriptWidget-Skript fürs iPhone
android/    Die eigene kleine Kotlin-Widget-App für Android
deploy/     Caddy-Konfiguration & systemd-Service fürs eigene Hosting
```

## Lokal starten

Braucht nur Node.js 22+, sonst nichts. Die gemeinsame Passphrase kommt als
Umgebungsvariable — ohne sie startet der Server bewusst gar nicht:

```bash
LEAF_PASSPHRASE="eure-gemeinsame-passphrase" npm start
```

Standardmäßig läuft der Server auf Port 8080, also `http://localhost:8080`. Ein anderer
Port geht per Umgebungsvariable: `PORT=3000 LEAF_PASSPHRASE=... npm start`. Die Daten
landen in `server/data/db.json` (wird beim ersten Schreiben angelegt, ist in
`.gitignore`).

## Status

Server, Web-Editor und die Android-App stehen, sind lokal durchgetestet und bauen grün
über GitHub Actions — siehe [`TODO.md`](TODO.md) für den genauen Baufortschritt.
