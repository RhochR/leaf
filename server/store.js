// Speicher für Leaf: eine einzige JSON-Datei statt einer Datenbank.
//
// Es gibt genau EINEN Status (zwei Slots, a und b) — keine "Räume" mehr. Dieser Server
// ist für genau ein Paar gedacht, nicht als Mehrmandanten-Dienst; ein Raum-Konzept hätte
// nur ein Problem erzeugt, das es sonst gar nicht gäbe (jede:r Fremde hätte sich einen
// eigenen Raum anlegen können). Die Passphrase kommt jetzt komplett von außen (Server-
// Konfiguration, siehe server.js) statt "wer zuerst schreibt, legt sie fest".
//
// Warum keine SQLite? node:sqlite ist auf Node 22+ dabei, aber je nachdem, welche
// Node-Version am Ende auf dem Pi/VPS läuft, könnte sie noch hinter einem
// Experimental-Flag stecken. Für zwei Nutzer:innen mit ein paar Statuszeilen ist eine
// JSON-Datei mit atomarem Schreiben (temp-Datei + rename) genauso zuverlässig und hat
// null Versions-Abhängigkeiten.
//
// Datenform:
//   { "slots": { "a": { message, activity, place, theme, reaction, updatedAt }, "b": {...} } }

import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const EMPTY_SLOT = Object.freeze({
  message: "",
  activity: "",
  place: "",
  theme: "",
  reaction: "",
  updatedAt: 0,
});

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    // Ein simpler Schreib-Lock: jede Änderung hängt sich an die vorherige an, statt
    // parallel zu laufen. Bei zwei Nutzer:innen reicht das völlig — verhindert, dass
    // zwei gleichzeitige PUTs sich beim Lesen-Ändern-Schreiben gegenseitig überschreiben.
    this._writeQueue = Promise.resolve();
  }

  async _load() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === "ENOENT") return { slots: {} };
      throw err;
    }
  }

  async _save(data) {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
    // rename ist auf POSIX atomar und überschreibt auf Windows/Node ebenfalls sauber —
    // so gibt es nie einen Moment, in dem die Datei halb geschrieben daliegt.
    await rename(tmpPath, this.filePath);
  }

  _mutate(fn) {
    const next = this._writeQueue.then(async () => {
      const data = await this._load();
      const result = fn(data);
      await this._save(data);
      return result;
    });
    this._writeQueue = next.catch(() => {});
    return next;
  }

  /** Beide Slots lesen. */
  async getStatus() {
    const data = await this._load();
    return {
      a: data.slots.a ?? EMPTY_SLOT,
      b: data.slots.b ?? EMPTY_SLOT,
    };
  }

  /** Schreibt einen Slot. Die Passphrase-Prüfung passiert bereits in server.js, bevor das
      hier aufgerufen wird — der Store selbst kennt gar keine Auth mehr. */
  async putSlot(slot, payload) {
    return this._mutate((data) => {
      data.slots[slot] = { ...payload, updatedAt: Date.now() };
      return data.slots[slot];
    });
  }
}
