// Leaf — Editor-Logik. Reines Browser-JS, kein Build-Schritt, ES-Module direkt geladen.
import { THEMES, ACTIVITIES, PLACES, ICONS, iconFor } from "./presets.js";

const THEME_FILES = {
  morgenrot: "Morgenrot",
  tag: "Tag",
  daemmerung: "Daemmerung",
  nacht: "Nacht",
};

const STORAGE_KEY = "leaf.session";
const PARTNER_POLL_MS = 20_000;

const els = {
  unlockSection: document.getElementById("unlock-section"),
  unlockForm: document.getElementById("unlock-form"),
  unlockError: document.getElementById("unlock-error"),
  editorSection: document.getElementById("editor-section"),
  editorRoomLabel: document.getElementById("editor-room-label"),
  logoutButton: document.getElementById("logout-button"),
  previewSelf: document.getElementById("preview-self"),
  previewPartner: document.getElementById("preview-partner"),
  statusForm: document.getElementById("status-form"),
  themePicker: document.getElementById("theme-picker"),
  activityPicker: document.getElementById("activity-picker"),
  activityCustom: document.getElementById("activity-custom"),
  placePicker: document.getElementById("place-picker"),
  placeCustom: document.getElementById("place-custom"),
  messageField: document.getElementById("field-message"),
  saveButton: document.getElementById("save-button"),
  saveStatus: document.getElementById("save-status"),
};

/** @type {{ role: "a"|"b", token: string } | null} */
let session = null;
let selectedTheme = THEMES[0].id;
let selectedActivity = ACTIVITIES[0].id;
let selectedPlace = PLACES[0].id;
let partnerPollTimer = null;

// --- Session (Rolle + abgeleiteter Token) -------------------------------------------
// Kein "Raum" mehr — dieser Server ist für genau ein Paar, ein einziger gemeinsamer
// Status. Die Passphrase ist das einzige Geheimnis.

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Der Server sieht nie die Passphrase selbst, nur diesen abgeleiteten Token — exakt
    dieselbe Herleitung wie server.js beim Start aus LEAF_PASSPHRASE macht. */
async function deriveToken(passphrase) {
  const bytes = new TextEncoder().encode(passphrase);
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // crypto.subtle gibt's nur in "sicheren Kontexten" (https:// oder localhost) — bei
  // reinem http:// auf der eigenen Server-IP (z. B. Selbsthosting ohne TLS, siehe M4)
  // ist es schlicht undefined. Reine JS-Implementierung als Fallback, exakt derselbe Hash.
  return sha256Fallback(bytes);
}

/** SHA-256 nach FIPS 180-4, ohne SubtleCrypto — siehe deriveToken() oben. */
function sha256Fallback(bytes) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 9 + 63) >> 6) << 6));
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => (v >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function partnerRole(role) {
  return role === "a" ? "b" : "a";
}

// --- Kleine Render-Helfer -----------------------------------------------------------

function relativeTime(updatedAt) {
  if (!updatedAt) return "noch nie";
  const diffMin = Math.round((Date.now() - updatedAt) / 60_000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin === 1) return "vor 1 Min.";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.round(diffMin / 60);
  if (diffH === 1) return "vor 1 Std.";
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.round(diffH / 24);
  return diffD === 1 ? "vor 1 Tag" : `vor ${diffD} Tagen`;
}

function labelFor(list, id, fallback) {
  return list.find((x) => x.id === id)?.label ?? fallback;
}

function themeBackground(themeId) {
  const file = THEME_FILES[themeId] || THEME_FILES[THEMES[0].id];
  return `/assets/illustrations/${file}.svg`;
}

/** Rendert eine Status-Karte exakt nach der Widget-Anatomie aus docs/DESIGN.md. */
function renderPreview(container, slot) {
  const hasContent = slot && (slot.message || slot.activity || slot.place);
  container.style.backgroundImage = `url(${themeBackground(slot?.theme || THEMES[0].id)})`;

  if (!hasContent) {
    container.innerHTML = `<span class="wp-empty">Noch nichts gesetzt</span>`;
    return;
  }

  const activityLabel = slot.activity ? labelFor(ACTIVITIES, slot.activity, slot.activity) : "";
  const placeLabel = slot.place ? labelFor(PLACES, slot.place, slot.place) : "";
  const activityIcon = slot.activity ? iconFor(slot.activity) : "";
  const message = slot.message || activityLabel || "…";

  container.innerHTML = `
    <div class="wp-content">
      <div class="wp-pills">
        ${activityLabel ? `<span class="wp-pill">${activityIcon}${escapeHtml(activityLabel)}</span>` : ""}
        ${placeLabel ? `<span class="wp-pill">${ICONS.pin}${escapeHtml(placeLabel)}</span>` : ""}
      </div>
      <div class="wp-message">${escapeHtml(message)}</div>
      <span class="wp-time">${activityIcon}${relativeTime(slot.updatedAt)}</span>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Picker (Theme / Tätigkeit / Ort) aufbauen --------------------------------------

function buildThemePicker() {
  els.themePicker.innerHTML = "";
  for (const theme of THEMES) {
    const el = document.createElement("div");
    el.className = "theme-swatch";
    el.style.backgroundImage = `url(${themeBackground(theme.id)})`;
    el.dataset.id = theme.id;
    el.innerHTML = `<span>${escapeHtml(theme.label)}</span>`;
    el.addEventListener("click", () => {
      selectedTheme = theme.id;
      syncThemePicker();
      renderPreview(els.previewSelf, currentFormSlot());
    });
    els.themePicker.appendChild(el);
  }
  syncThemePicker();
}

function syncThemePicker() {
  for (const el of els.themePicker.children) {
    el.classList.toggle("selected", el.dataset.id === selectedTheme);
  }
}

function buildChipPicker(container, list, getSelected, onSelect, iconForItem) {
  container.innerHTML = "";
  for (const item of list) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.id = item.id;
    const icon = iconForItem ? iconForItem(item) : "";
    chip.innerHTML = `${icon}${escapeHtml(item.label)}`;
    chip.addEventListener("click", () => onSelect(item));
    container.appendChild(chip);
  }
  syncChipPicker(container, getSelected());
}

function syncChipPicker(container, selectedId) {
  for (const el of container.children) {
    el.classList.toggle("selected", el.dataset.id === selectedId);
  }
}

function buildPickers() {
  buildThemePicker();

  buildChipPicker(
    els.activityPicker,
    ACTIVITIES,
    () => selectedActivity,
    (item) => {
      selectedActivity = item.id;
      syncChipPicker(els.activityPicker, selectedActivity);
      els.activityCustom.hidden = !item.custom;
      if (item.custom) els.activityCustom.focus();
      renderPreview(els.previewSelf, currentFormSlot());
    },
    (item) => ICONS[item.icon] || ""
  );

  buildChipPicker(
    els.placePicker,
    PLACES,
    () => selectedPlace,
    (item) => {
      selectedPlace = item.id;
      syncChipPicker(els.placePicker, selectedPlace);
      els.placeCustom.hidden = !item.custom;
      if (item.custom) els.placeCustom.focus();
      renderPreview(els.previewSelf, currentFormSlot());
    },
    () => ICONS.pin
  );
}

// --- Formularzustand -----------------------------------------------------------------

function currentFormSlot() {
  const activityLabel =
    selectedActivity === "sonstiges"
      ? els.activityCustom.value.trim()
      : labelFor(ACTIVITIES, selectedActivity, "");
  const placeLabel =
    selectedPlace === "sonstiges" ? els.placeCustom.value.trim() : labelFor(PLACES, selectedPlace, "");
  return {
    message: els.messageField.value.trim(),
    activity: activityLabel,
    place: placeLabel,
    theme: selectedTheme,
    updatedAt: Date.now(),
  };
}

function fillFormFromSlot(slot) {
  if (!slot) return;
  if (slot.theme && THEME_FILES[slot.theme]) selectedTheme = slot.theme;
  els.messageField.value = slot.message || "";

  const presetActivity = ACTIVITIES.find((a) => a.label === slot.activity);
  if (presetActivity) {
    selectedActivity = presetActivity.id;
    els.activityCustom.hidden = true;
  } else if (slot.activity) {
    selectedActivity = "sonstiges";
    els.activityCustom.hidden = false;
    els.activityCustom.value = slot.activity;
  }

  const presetPlace = PLACES.find((p) => p.label === slot.place);
  if (presetPlace) {
    selectedPlace = presetPlace.id;
    els.placeCustom.hidden = true;
  } else if (slot.place) {
    selectedPlace = "sonstiges";
    els.placeCustom.hidden = false;
    els.placeCustom.value = slot.place;
  }

  syncThemePicker();
  syncChipPicker(els.activityPicker, selectedActivity);
  syncChipPicker(els.placePicker, selectedPlace);
}

// --- Netzwerk ---------------------------------------------------------------------
// Beide Endpunkte verlangen jetzt den Bearer-Token — ohne die richtige Passphrase gibt
// es weder Lesen noch Schreiben.

async function fetchStatus() {
  const res = await fetch("/api/status", {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`GET fehlgeschlagen (${res.status})`);
  return res.json();
}

async function saveSlot() {
  const payload = currentFormSlot();
  els.saveButton.disabled = true;
  els.saveStatus.textContent = "Speichert …";
  els.saveStatus.classList.remove("ok");
  try {
    const res = await fetch(`/api/status/${session.role}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      els.saveStatus.textContent = "Falsche Passphrase.";
      return;
    }
    if (!res.ok) throw new Error(`PUT fehlgeschlagen (${res.status})`);
    const saved = await res.json();
    els.saveStatus.textContent = "Gespeichert.";
    els.saveStatus.classList.add("ok");
    renderPreview(els.previewSelf, saved);
  } catch (err) {
    console.error(err);
    els.saveStatus.textContent = "Netzwerkfehler — nochmal versuchen?";
  } finally {
    els.saveButton.disabled = false;
  }
}

async function refreshPartnerPreview() {
  try {
    const state = await fetchStatus();
    if (state === "unauthorized") return;
    renderPreview(els.previewPartner, state[partnerRole(session.role)]);
  } catch (err) {
    console.error(err);
  }
}

// --- Einstieg -----------------------------------------------------------------------

async function enterEditor() {
  els.unlockSection.hidden = true;
  els.editorSection.hidden = false;
  els.editorRoomLabel.textContent = `Person ${session.role.toUpperCase()}`;

  buildPickers();

  try {
    const state = await fetchStatus();
    if (state === "unauthorized") {
      els.unlockError.textContent = "Falsche Passphrase.";
      els.unlockError.hidden = false;
      clearSession();
      session = null;
      els.editorSection.hidden = true;
      els.unlockSection.hidden = false;
      return;
    }
    fillFormFromSlot(state[session.role]);
    renderPreview(els.previewSelf, state[session.role]);
    renderPreview(els.previewPartner, state[partnerRole(session.role)]);
  } catch (err) {
    console.error(err);
    renderPreview(els.previewSelf, currentFormSlot());
  }

  clearInterval(partnerPollTimer);
  partnerPollTimer = setInterval(refreshPartnerPreview, PARTNER_POLL_MS);
}

els.unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.unlockError.hidden = true;
  const passphrase = document.getElementById("field-passphrase").value;
  const role = els.unlockForm.querySelector('input[name="role"]:checked').value;
  if (!passphrase) return;

  const token = await deriveToken(passphrase);
  session = { role, token };
  saveSession(session);
  await enterEditor();
});

els.statusForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSlot();
});

els.logoutButton.addEventListener("click", () => {
  clearSession();
  clearInterval(partnerPollTimer);
  session = null;
  els.editorSection.hidden = true;
  els.unlockSection.hidden = false;
  els.unlockForm.reset();
});

// Beim Laden: gespeicherte Session direkt weiterverwenden, falls vorhanden.
const saved = loadSession();
if (saved) {
  session = saved;
  enterEditor();
}
