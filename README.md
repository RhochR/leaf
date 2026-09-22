# 🌿 Leaf

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
              │  GET  /api/:room          │  → aktueller Status beider Partner:innen
              │  PUT  /api/:room/:slot    │  → eigenen Status setzen (mit Token)
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
Icons, Layout) ist einmal in [`docs/DESIGN.md`](docs/DESIGN.md) festgelegt und wird auf
jeder Plattform nativ umgesetzt — kein HTML/CSS-Rendering im Widget selbst, sondern echte
native Oberflächen, die sich schnell und zuverlässig anfühlen.

**Kein Ende-zu-Ende-verschlüsselt.** Es gibt eine gemeinsame Passphrase, die als
Schreibschutz dient (nur wer sie kennt, kann Status-Updates posten), aber der Server
selbst sieht die Inhalte im Klartext. Das war eine bewusste Entscheidung — siehe
[`docs/PLAN.md`](docs/PLAN.md) für die Abwägung.

## Projektstruktur

```
server/     Node.js-Server (Storage + API), keine externen Abhängigkeiten
web/        Die Editor-Website — hier setzt man seinen eigenen Status
ios/        Das ScriptWidget-Skript fürs iPhone
android/    Die eigene kleine Kotlin-Widget-App für Android
docs/       PLAN.md (Architektur & Entscheidungen), DESIGN.md (visuelle Sprache), SETUP.md
deploy/     Caddy-Konfiguration & systemd-Service fürs eigene Hosting
```

## Status

Frisch aufgesetzt — siehe [`TODO.md`](TODO.md) für den aktuellen Baufortschritt und
[`docs/PLAN.md`](docs/PLAN.md) für die vollständige Architektur inklusive aller bisherigen
Entscheidungen und warum wir sie so getroffen haben.
