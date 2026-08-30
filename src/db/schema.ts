import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  bigserial,
  serial,
  doublePrecision,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

/* ============================== Énumérations ============================== */

export const siteKindEnum = pgEnum("site_kind", [
  "triage_point",
  "hospital",
  "burn_center",
]);

export const roleEnum = pgEnum("user_role", [
  "urgentiste",
  "referent",
  "regulateur",
  "brulologue",
]);

export const mechanismEnum = pgEnum("burn_mechanism", [
  "flamme",
  "contact",
  "elec",
  "chim",
]);

export const bedTypeEnum = pgEnum("bed_type", ["ward", "icu", "burn_center"]);

export const transferStatusEnum = pgEnum("transfer_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "forced",
  "cancelled",
  "arrived",
]);

export const transferEventTypeEnum = pgEnum("transfer_event_type", [
  "created",
  "sent",
  "declined",
  "expired",
  "accepted",
  "forced",
  "reassigned",
  "cancelled",
  "arrived",
  "exhausted",
]);

export const adviceStatusEnum = pgEnum("advice_status", [
  "open",
  "claimed",
  "answered",
  "released",
]);

export const notifChannelEnum = pgEnum("notif_channel", ["push", "email"]);

export const distanceSourceEnum = pgEnum("distance_source", [
  "osrm",
  "estimate",
]);

/* ============================== Sites ============================== */

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: siteKindEnum("kind").notNull(),
    name: text("name").notNull(),
    wilaya: text("wilaya").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    phone: text("phone"),
    active: boolean("active").notNull().default(false),
    toVerify: boolean("to_verify").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sites_kind_idx").on(t.kind), index("sites_active_idx").on(t.active)],
);

/* ============================== Utilisateurs & auth ============================== */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    displayName: text("display_name").notNull(),
    role: roleEnum("role").notNull(),
    isAdmin: boolean("is_admin").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.siteId] })],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash)],
);

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("magic_links_token_uq").on(t.tokenHash)],
);

export const accessCodes = pgTable(
  "access_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeHash: text("code_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("access_codes_hash_uq").on(t.codeHash)],
);

/* ============================== Capacités ============================== */

export const capacitySnapshots = pgTable(
  "capacity_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    icuBedsFree: integer("icu_beds_free").notNull().default(0),
    wardBedsFree: integer("ward_beds_free").notNull().default(0),
    orAvailable: boolean("or_available").notNull().default(false),
    burnSurgeonPresent: boolean("burn_surgeon_present").notNull().default(false),
    suppliesOk: boolean("supplies_ok").notNull().default(true),
    note: text("note"),
    // Optionnels — permettent une occupation exacte (voir DECISIONS D-005)
    declaredTotalIcu: integer("declared_total_icu"),
    declaredTotalWard: integer("declared_total_ward"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("capacity_site_created_idx").on(t.siteId, t.createdAt)],
);

/* ============================== Patients & triage ============================== */

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    braceletId: text("bracelet_id").notNull(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    age: numeric("age", { precision: 5, scale: 1 }),
    weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
    mechanism: mechanismEnum("mechanism").notNull().default("flamme"),
    burnedAt: timestamp("burned_at", { withTimezone: true }),
    inhalation: boolean("inhalation").notNull().default(false),
    closedSpace: boolean("closed_space").notNull().default(false),
    trauma: boolean("trauma").notNull().default(false),
    comorbidity: boolean("comorbidity").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("patients_site_bracelet_uq").on(t.siteId, t.braceletId),
    index("patients_site_idx").on(t.siteId),
  ],
);

export type RegionState = { frac: number; depth: "1" | "2s" | "2p" | "3"; circ: boolean };
export type RegionsJson = Record<string, RegionState>;
export type ParklandJson = {
  totalMl: number;
  first8hMl: number;
  ratePerHourMl: number | null;
  remainingHours: number | null;
  maintenanceChildMlH: number;
  text: string;
} | null;

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    regions: jsonb("regions").$type<RegionsJson>().notNull(),
    scbTotal: numeric("scb_total", { precision: 5, scale: 1 }).notNull(),
    scbDeep: numeric("scb_deep", { precision: 5, scale: 1 }).notNull(),
    scbThird: numeric("scb_third", { precision: 5, scale: 1 }).notNull(),
    signs: jsonb("signs").$type<string[]>().notNull(),
    orientationClass: integer("orientation_class").notNull(), // 1 chirurgie / 2 réa / 3 centre
    adviceRecommended: boolean("advice_recommended").notNull().default(false),
    rulesVersion: integer("rules_version").notNull(),
    parkland: jsonb("parkland").$type<ParklandJson>(),
    aiChecks: jsonb("ai_checks").$type<string[] | null>(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("assessments_patient_version_uq").on(t.patientId, t.version),
  ],
);

/* ============================== Transferts ============================== */

export type CascadeEntry = {
  siteId: string;
  siteName: string;
  minutes: number;
  km: number;
  occupancy: number;
  score: number;
  distanceSource: "osrm" | "estimate";
};

export const transferRequests = pgTable(
  "transfer_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id),
    orientationClass: integer("orientation_class").notNull(),
    bedType: bedTypeEnum("bed_type").notNull(),
    cascade: jsonb("cascade").$type<CascadeEntry[]>().notNull(),
    currentIndex: integer("current_index").notNull().default(0),
    status: transferStatusEnum("status").notNull().default("pending"),
    hopSentAt: timestamp("hop_sent_at", { withTimezone: true }),
    timeoutMinutes: integer("timeout_minutes").notNull().default(10),
    acceptedBySiteId: uuid("accepted_by_site_id").references(() => sites.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    exhausted: boolean("exhausted").notNull().default(false),
    summary: text("summary"), // fiche de transfert rédigée (agent IA)
    rulesVersion: integer("rules_version").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("transfer_status_idx").on(t.status),
    index("transfer_patient_idx").on(t.patientId),
  ],
);

export const transferEvents = pgTable(
  "transfer_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => transferRequests.id, { onDelete: "cascade" }),
    type: transferEventTypeEnum("type").notNull(),
    siteId: uuid("site_id").references(() => sites.id),
    byUserId: uuid("by_user_id").references(() => users.id),
    reason: text("reason"),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("transfer_events_request_idx").on(t.requestId)],
);

/* ============================== Avis brûlologue ============================== */

export const adviceRequests = pgTable(
  "advice_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    assessmentId: uuid("assessment_id").references(() => assessments.id),
    question: text("question").notNull(),
    aiSummary: text("ai_summary"),
    status: adviceStatusEnum("status").notNull().default("open"),
    claimedBy: uuid("claimed_by").references(() => users.id),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    answer: text("answer"),
    answeredBy: uuid("answered_by").references(() => users.id),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("advice_status_idx").on(t.status)],
);

/* ============================== Notifications ============================== */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("push_endpoint_uq").on(t.endpoint)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: notifChannelEnum("channel").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    relatedType: text("related_type"),
    relatedId: text("related_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/* ============================== Configuration des règles ============================== */

export type RulesJson = {
  reaSCB: number; // SCB ≥ x % → réa (sans signe)
  childBelow: number; // âge < x ans = signe
  elderlyAbove: number; // âge > x ans = signe
  thirdDegreeSign: number; // 3e degré ≥ x % = signe
  parklandMlKgPct: number;
  routing: {
    lambda: number; // pondération occupation
    saturationThreshold: number; // occupation ≥ x → fin de cascade
    cascadeMax: number;
    timeoutMinutes: number;
    protectedCenters: boolean; // mode centre protégé
    capacityStaleHours: number; // capacité périmée après x h
    adviceReleaseMinutes: number; // avis non répondu → retour en file
  };
};

export const rulesConfig = pgTable("rules_config", {
  version: serial("version").primaryKey(),
  config: jsonb("config").$type<RulesJson>().notNull(),
  comment: text("comment"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ============================== Distances ============================== */

export const distanceCache = pgTable(
  "distance_cache",
  {
    fromSiteId: uuid("from_site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    toSiteId: uuid("to_site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    minutes: numeric("minutes", { precision: 7, scale: 1 }).notNull(),
    km: numeric("km", { precision: 7, scale: 1 }).notNull(),
    source: distanceSourceEnum("source").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.fromSiteId, t.toSiteId] })],
);

/* ============================== Audit ============================== */

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    role: text("role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
