import { statusGroup, type OverviewItem } from "./overview";
import type { Category } from "./types";

/**
 * Indicative certificate requirements per role (STCW and common practice). Real requirements
 * differ per flag state, vessel and company; the UI says so.
 */
export interface Requirement {
  id: string;
  /** International (STCW) name; localized ones come from the texts by id. */
  name: string;
  /** Lower-case fragments that identify the user's document type by its name. */
  keywords: string[];
  /** A document of this category also matches (e.g. any Medical certificate). */
  category?: Category;
  /** Names containing one of these never match (so "Medical First Aid" is not the medical). */
  exclude?: string[];
}

const R = (id: string, name: string, keywords: string[], extra: Partial<Requirement> = {}): Requirement => ({ id, name, keywords, ...extra });

export const REQUIREMENTS = {
  bst: R("bst", "Basic Safety Training", ["basic safety", "basisveiligheid", "bst", "personal survival", "grundausbildung", "formación básica", "formation de base"]),
  pscrb: R("pscrb", "Proficiency in Survival Craft and Rescue Boats", ["survival craft", "pscrb", "rescue boat", "reddingsboot", "reddingsmiddelen", "rettungsboot"]),
  aff: R("aff", "Advanced Fire Fighting", ["advanced fire", "aff", "brandbestrijding gevorderd", "geavanceerde brandbestrijding", "brandbekämpfung"]),
  mfa: R("mfa", "Medical First Aid", ["medical first aid", "mfa", "medische eerste hulp"]),
  medCare: R("medCare", "Medical Care", ["medical care", "medische zorg", "medizinische betreuung"]),
  sa: R("sa", "Security Awareness", ["security awareness", "beveiligingsbewustzijn", "sa training", "designated security", "dsd"]),
  sdsd: R("sdsd", "Designated Security Duties", ["designated security", "dsd", "ship security officer", "sso"]),
  goc: R("goc", "GMDSS General Operator's Certificate (GOC)", ["goc", "general operator", "algemeen certificaat maritieme radio"]),
  roc: R("roc", "GMDSS Restricted Operator's Certificate (ROC)", ["roc", "restricted operator", "beperkt certificaat maritieme radio", "goc"]),
  ecdis: R("ecdis", "ECDIS", ["ecdis"]),
  brm: R("brm", "Bridge Resource Management", ["bridge resource", "brm", "bridge team"]),
  erm: R("erm", "Engine Room Resource Management", ["engine room resource", "erm"]),
  radar: R("radar", "Radar / ARPA", ["radar", "arpa"]),
  tankerBasic: R("tankerBasic", "Basic Oil and Chemical Tanker Cargo Operations", ["oil and chemical tanker", "basic tanker", "tanker familiari", "tanker basis", "olie- en chemicaliëntanker", "oil tanker"]),
  tankerAdvanced: R("tankerAdvanced", "Advanced Oil or Chemical Tanker Cargo Operations", ["advanced oil tanker", "advanced chemical tanker", "advanced tanker", "gevorderd tanker"]),
  gasBasic: R("gasBasic", "Basic Liquefied Gas Tanker Cargo Operations", ["liquefied gas", "gas tanker", "gastanker", "lng", "lpg"]),
  coc: R("coc", "Certificate of Competency", ["certificate of competency", "coc", "vaarbevoegdheid", "befähigungszeugnis", "certificado de competencia", "brevet"]),
  medical: R("medical", "Seafarer's medical certificate", ["keuring", "medical certificate", "peme", "tauglichkeit", "certificado médico", "certificat médical"], {
    category: "Medical",
    exclude: ["first aid", "eerste hulp", "medical care", "medische zorg"],
  }),
  passport: R("passport", "Passport", ["passport", "paspoort", "reisepass", "pasaporte", "passeport", "pasaporte"], { category: "Identity", exclude: ["identity card", "identiteitskaart", "id card"] }),
  dischargeBook: R("dischargeBook", "Seaman's discharge book", ["monsterboek", "discharge book", "seaman's book", "seamans book", "sirb", "seefahrtbuch", "libreta", "livret"]),
} satisfies Record<string, Requirement>;

export type RequirementId = keyof typeof REQUIREMENTS;

const COMMON: RequirementId[] = ["medical", "passport", "dischargeBook"];
const OFFICER_DECK: RequirementId[] = ["coc", "bst", "pscrb", "aff", "mfa", "sdsd", "goc", "ecdis", "brm", "radar", ...COMMON];

export const ROLES = {
  deckRating: ["bst", "sa", ...COMMON],
  engineRating: ["bst", "sa", ...COMMON],
  cook: ["bst", "sa", ...COMMON],
  oow: OFFICER_DECK,
  oowTanker: [...OFFICER_DECK, "tankerBasic", "tankerAdvanced"],
  oowGas: [...OFFICER_DECK, "gasBasic"],
  master: ["coc", "bst", "pscrb", "aff", "medCare", "sdsd", "goc", "ecdis", "brm", "radar", ...COMMON],
  engineer: ["coc", "bst", "pscrb", "aff", "mfa", "sdsd", "erm", ...COMMON],
} satisfies Record<string, RequirementId[]>;

export type RoleId = keyof typeof ROLES;
export const ROLE_IDS = Object.keys(ROLES) as RoleId[];

export function isRoleId(v: unknown): v is RoleId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ROLES, v);
}

/** Whether the user's document type fulfils a requirement, by name keywords or category. */
export function matches(req: Requirement, item: OverviewItem): boolean {
  const name = item.documentClass.name.toLocaleLowerCase("nl");
  if (req.exclude?.some((x) => name.includes(x))) return false;
  if (req.category && item.documentClass.category === req.category) return true;
  // Short codes (bst, aff, goc …) only as whole words, so "aff" does not match "staff".
  return req.keywords.some((k) => (k.length <= 4 ? new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(name) : name.includes(k)));
}

export type RequirementState = "valid" | "soon" | "expired" | "missing";

export interface RequirementCheck {
  requirement: Requirement;
  state: RequirementState;
  /** The best matching document, if any. */
  item: OverviewItem | null;
}

const RANK: Record<RequirementState, number> = { valid: 0, soon: 1, expired: 2, missing: 3 };

/** For each requirement of the role, the best matching document and its state. */
export function checkRole(role: RoleId, items: OverviewItem[]): RequirementCheck[] {
  return ROLES[role].map((id) => {
    const requirement = REQUIREMENTS[id];
    let best: RequirementCheck = { requirement, state: "missing", item: null };
    for (const item of items) {
      if (!matches(requirement, item)) continue;
      const state: RequirementState = statusGroup(item.status) === "valid" ? "valid" : statusGroup(item.status);
      if (RANK[state] < RANK[best.state]) best = { requirement, state, item };
    }
    return best;
  });
}
