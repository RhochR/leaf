// Speicher für Leaf: eine einzige JSON-Datei statt einer Datenbank.
//
// Warum keine SQLite? node:sqlite ist auf Node 22+ dabei, aber je nachdem, welche
// Node-Version am Ende auf dem Pi/VPS läuft, könnte sie noch hinter einem
// Experimental-Flag stecken. Für zwei Nutzer:innen mit ein paar Statuszeilen ist eine
// JSON-Datei mit atomarem Schreiben (temp-Datei + rename) genauso zuverlässig und hat
// null Versions-Abhängigkeiten.
//
// Datenform:
//   {
//     "rooms": {
//       "<room>": {
//         "authHash": "<sha256-hex, doppelt gehasht>",
//         "createdAt": 1730000000000,
//         "slots": {
//           "a": { message, activity, place, theme, reaction, updatedAt },
//           "b": { ... }
//         }
//       }
//     }
//   }

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
      if (err.code === "ENOENT") return { rooms: {} };
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

  /** Reiht eine Änderungsfunktion in die Schreib-Warteschlange ein und speichert das Ergebnis. */
  _mutate(fn) {
    const next = this._writeQueue.then(async () => {
      const data = await this._load();
      const result = fn(data);
      await this._save(data);
      return result;
    });
    // Folgefehler dürfen die Queue nicht verstopfen.
    this._writeQueue = next.catch(() => {});
    return next;
  }

  /** Beide Slots eines Rooms lesen. Gibt null zurück, wenn der Room noch nicht existiert. */
  async getRoom(room) {
    const data = await this._load();
    const r = data.rooms[room];
    if (!r) return null;
    return {
      a: r.slots.a ?? EMPTY_SLOT,
      b: r.slots.b ?? EMPTY_SLOT,
    };
  }

  /**
   * Schreibt einen Slot. Legt den Room beim allerersten Schreiben an (die Person, die
   * zuerst mit einer Passphrase in einen neuen Raumnamen schreibt, "gründet" ihn damit).
   * Wirft { code: "AUTH" }, wenn der Room existiert und der Token nicht passt.
   */
  async putSlot(room, slot, authHash, payload) {
    return this._mutate((data) => {
      let r = data.rooms[room];
      if (!r) {
        r = { authHash, createdAt: Date.now(), slots: {} };
        data.rooms[room] = r;
      } else if (r.authHash !== authHash) {
        throw Object.assign(new Error("auth mismatch"), { code: "AUTH" });
      }
      r.slots[slot] = { ...payload, updatedAt: Date.now() };
      return r.slots[slot];
    });
  }
}
