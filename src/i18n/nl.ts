/** All UI text (Dutch). To add a language: copy this file, translate, and register it in index.ts. */
export const nl = {
  app: { name: "Vaarpapieren", splashHint: "Klik om verder te gaan" },
  tabs: { overview: "Overzicht", add: "Toevoegen", settings: "Instellingen" },
  overview: {
    title: "Overzicht",
    viewGrid: "Raster",
    viewList: "Lijst",
    searchPlaceholder: "Zoek op naam…",
    allCategories: "Alle categorieën",
    empty: "Nog geen documenten. Voeg je eerste document toe via het tabblad Toevoegen.",
    noResults: "Geen documenten gevonden.",
  },
  add: { title: "Document toevoegen" },
  settings: { title: "Instellingen" },
  categories: {
    STCW: "STCW",
    Medical: "Medisch",
    Competency: "Vaarbevoegdheid",
    Identity: "Identiteit",
    Other: "Overig",
  },
  status: {
    valid: "Geldig",
    warning: "Verloopt binnenkort",
    critical: "Verloopt zeer binnenkort",
    expired: "Verlopen",
    noExpiry: "Verloopt niet",
  },
  expiry: {
    validFor: (days: number) => (days === 1 ? "nog 1 dag geldig" : `nog ${days} dagen geldig`),
    expiresToday: "verloopt vandaag",
    expiredAgo: (days: number) => (days === 1 ? "1 dag geleden verlopen" : `${days} dagen geleden verlopen`),
    noExpiry: "verloopt niet",
  },
  version: { superseded: "Vervangen", current: "Actueel" },
} as const;

export type Messages = typeof nl;
