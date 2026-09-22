# Leaf — Architektur & Entscheidungen

Dieses Dokument hält fest, *was* wir bauen und *warum* — speziell die Entscheidungen, die
nicht offensichtlich aus dem Code hervorgehen. Wenn du (oder ein zukünftiges Ich) sich
fragt "warum haben wir das nicht einfach mit X gelöst", steht die Antwort hier.

## Die Idee

Zwei Personen, zwei Homescreen-Widgets. Jede:r setzt über eine kleine Website den eigenen
Status: eine Nachricht, eine Tätigkeit, einen Ort, ein Theme. Das Widget der anderen
Person zeigt das an. Tippen aufs Widget öffnet die Website zum Bearbeiten.

## Wichtige Entscheidungen

### Kein natives App-Store-Deployment
Eine "echte" iOS/Android-App wäre für ein privates Geschenk an ein Paar unverhältnismäßig
aufwändig (Apple Developer Program, Code-Signing, Review-Prozesse). Stattdessen nutzen wir
existierende Open-Source-Widget-Hosts, wo sie gut genug sind, und bauen nur dort selbst,
wo es nötig ist.

### iOS: ScriptWidget statt eigener App
[ScriptWidget](https://github.com/everettjf/scriptwidget) ist eine bestehende, im App
Store verfügbare App: MIT-lizenziert, Open Source, kostenlos, keine Werbung, keine
In-App-Käufe (4.6★, 96 Bewertungen). Man schreibt ein kleines JavaScript/JSX-Skript, das
per `fetch()` unsere API abruft und das Ergebnis **nativ** als SwiftUI-Widget rendert —
kein Screenshot, kein WebView. Das spart uns eine komplette native App-Entwicklung mit
Xcode und Apple Developer Account.

*Verworfen:* Scriptable (die bekannteste App dieser Art) ist nicht Open Source. Diverse
"Website als Widget"-Screenshot-Apps (Web Widget, Widget Web 26, AnyWidget) sind
Closed-Source mit Werbung/Bezahlschranken — beides schließt sie aus.

### Android: eigene kleine Kotlin-App
Anders als bei iOS gibt es **keine** vertrauenswürdige Open-Source-App, die eine Webseite
oder JSON-Daten hübsch als Android-Widget rendert. Die Recherche fand nur:
- Closed-Source-Apps mit Werbung/Bezahlschranken (AnyWidget, WebsiteWidget) — ausgeschlossen.
- Hobby-Projekte mit 1–3 GitHub-Stars und unfertigen Features (ImageWidget,
  ScriptableDroid) — zu instabil für ein Geschenk, auf das sich zwei Menschen täglich
  verlassen sollen.
- [HomeFeed – RSS Widget](https://github.com/byter11/rss-widget) (44 Stars, aktiv
  gepflegt, F-Droid, Apache-2.0) wäre eine echte Option gewesen — der Server könnte einen
  RSS-Feed pro Person ausliefern. Verworfen, weil HomeFeeds Widget-Optik vom
  Material-You-System-Theme bestimmt wird, nicht von unseren Inhalten — "eigenes Theme
  wählen" hätte sich damit nicht wirklich umsetzen lassen.

Deshalb bauen wir eine eigene, sehr kleine Kotlin-App (Jetpack Glance für das Widget,
WorkManager für den periodischen Abruf). Das ist mehr Aufwand als "eine bestehende App
nutzen", aber:
- **Volle Design-Kontrolle** — das Widget sieht exakt so aus, wie wir es entwerfen.
- **Garantiert werbefrei und Open Source** — es ist ja unser eigener Code.
- **Kein Play-Store-Konto, keine Xcode-ähnliche Hürde** — man baut die App per GitHub
  Actions zu einer `.apk`-Datei, aktiviert einmalig "Installation aus unbekannten
  Quellen" und installiert sie direkt. Keine Kosten, kein Entwickler-Account.

### Kein Ende-zu-Ende-verschlüsselt
Ursprünglich war eine Verschlüsselung angedacht, bei der der Server nie Klartext sieht.
Das Problem: Die JavaScript-Engine, die ScriptWidget (und auch Scriptable) auf iOS nutzt
(JavaScriptCore), hat **keine** eingebaute Web-Crypto-Unterstützung — echte Verschlüsselung
hätte eine selbstgebaute, reine JS-Kryptobibliothek gebraucht, nur um auf iOS zu
funktionieren. Da Verschlüsselung ausdrücklich "nice to have, aber kein Muss" war, haben
wir sie gestrichen, um die App insgesamt einfacher und robuster zu halten.

Geblieben ist eine gemeinsame Passphrase als **Schreibschutz**: Nur wer sie kennt, kann
einen Status posten. Der Server selbst kann die Inhalte aber lesen — wer den Server
hostet (also du), könnte theoretisch reinschauen. Für ein privates Hobby-Projekt auf der
eigenen Hardware ist das ein akzeptabler Kompromiss, sollte aber den beiden Nutzer:innen
gegenüber ehrlich kommuniziert werden.

### Update-Intervall: ~15 Minuten, nicht "sofort"
Ursprünglicher Wunsch war ein Update innerhalb von 2 Minuten. Das ist auf beiden
Plattformen technisch nicht ohne Weiteres möglich, unabhängig davon wie effizient unser
Code ist:

- **Android:** `WorkManager` erzwingt ein Mindestintervall von 15 Minuten für periodische
  Hintergrund-Jobs — eine harte Betriebssystem-Grenze zum Akkuschutz. Kürzer geht nur mit
  Tricks, die genau das umgehen, was Android bewusst verhindern will.
- **iOS:** WidgetKit gewährt jedem Widget nur etwa 40–70 Hintergrund-Updates pro Tag
  (hartes Limit: 72). Verteilt über den Tag sind das realistisch 15–40 Minuten zwischen
  zwei Updates — und dieses Budget wird von Apple je nach Nutzungsverhalten vergeben, wir
  können es nicht direkt beeinflussen.

Um zuverlässig unter 15 Minuten zu kommen, bräuchte es Push-Benachrichtigungen. Auf
Android wäre das mit Firebase Cloud Messaging günstig und batterieschonend machbar (kann
später nachgerüstet werden, da wir ohnehin eine eigene App bauen). Auf iOS bräuchte es
dafür zwingend eine "echte" native App mit Apple-Developer-Account und Push-Zertifikaten
— also genau der Aufwand, den wir mit ScriptWidget vermeiden wollten. Wir akzeptieren
daher ~15 Minuten auf beiden Seiten als guten Kompromiss.

## Architektur im Detail

### Datenmodell
Jede Person schreibt "ihren" Slot; die andere Person liest ihn. Reaktionen (z. B. ein
Herz zurückschicken) werden im eigenen Payload mitgeschickt, damit nie zwei Leute
gleichzeitig denselben Datensatz schreiben.

```
rooms(room TEXT PRIMARY KEY, auth_hash TEXT, created_at INTEGER)
slots(room TEXT, slot TEXT, message TEXT, activity TEXT, place TEXT,
      theme TEXT, reaction TEXT, updated_at INTEGER, PRIMARY KEY(room, slot))
```

### API
- `GET  /api/:room` → Status beider Slots als JSON
- `PUT  /api/:room/:slot` → eigenen Status setzen, `Authorization: Bearer <token>`
  erforderlich (Token = Hash der gemeinsamen Passphrase)

Bodies über ~2 KB werden abgelehnt, Schreibzugriffe werden grob rate-limitiert (ein paar
pro Minute pro Room) — mehr braucht es für zwei Nutzer:innen nicht.

### Warum genau dieser Zuschnitt
Server und Web-Editor sind bewusst dependency-frei gehalten (reines `node:http`, kein
Build-Schritt) — das einzige Stück "echtes" Engineering mit Build-Prozess ist die
Android-App, weil es dort nicht anders geht.

## Nächste Schritte
Siehe [`TODO.md`](../TODO.md) für den konkreten, abhakbaren Fahrplan.
