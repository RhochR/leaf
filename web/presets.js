// Presets für Tätigkeit, Ort und Theme — siehe docs/DESIGN.md für die Bildsprache.
// Icons als Ids gehalten (nicht als fertiger Text), damit sich die Beschriftung später
// ändern lässt, ohne gespeicherte Daten zu berühren.

export const THEMES = [
  { id: "morgenrot", label: "Morgenrot", accent: "#B4703A" },
  { id: "tag", label: "Tag", accent: "#2D6CB4" },
  { id: "daemmerung", label: "Dämmerung", accent: "#1A655F" },
  { id: "nacht", label: "Nacht", accent: "#3B4A8C" },
];

export const ACTIVITIES = [
  { id: "training", label: "Training", icon: "dumbbell" },
  { id: "arbeit", label: "Arbeit", icon: "briefcase" },
  { id: "kochen", label: "Kochen", icon: "pot" },
  { id: "lesen", label: "Lesen", icon: "book" },
  { id: "sonstiges", label: "Sonstiges", icon: "spark", custom: true },
];

export const PLACES = [
  { id: "zuhause", label: "Zuhause" },
  { id: "arbeit", label: "Bei der Arbeit" },
  { id: "unterwegs", label: "Unterwegs" },
  { id: "sonstiges", label: "Sonstiges", custom: true },
];

// Handgezeichnete Outline-Icons im Stil aus docs/DESIGN.md:
// viewBox 0 0 24 24, stroke="currentColor", stroke-width 1.7–1.9, round caps/joins.
export const ICONS = {
  dumbbell:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9v6M17.5 9v6M3.5 10.5v3M20.5 10.5v3M6.5 12h11"/></svg>',
  briefcase:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3.5 12.5h17"/></svg>',
  pot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Z"/><path d="M2 11h20M8 11V8M16 11V8"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5C4 5.5 7 4.5 12 6c5-1.5 8-.5 8-.5v13s-3-1-8 .5c-5-1.5-8-.5-8-.5V5.5Z"/><path d="M12 6v13.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.4"/></svg>',
  spark:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5"/></svg>',
};

export function iconFor(activityId) {
  const a = ACTIVITIES.find((x) => x.id === activityId);
  return ICONS[a?.icon] || ICONS.spark;
}
