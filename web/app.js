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
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
