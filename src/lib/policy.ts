/**
 * Matrice des rôles (docs/GOAL.md §Rôles, docs/ROLES.md) sous forme de
 * fonctions pures, testées unitairement. Toute route serveur passe par ici :
 * vérification du rôle ET de l'appartenance avant d'agir.
 */

export type Role = "urgentiste" | "referent" | "regulateur" | "brulologue";

export type Actor = {
  userId: string;
  role: Role;
  isAdmin: boolean;
  siteIds: string[]; // points médicaux (urgentiste) ou hôpital (référent)
};

const isMember = (a: Actor, siteId: string) => a.siteIds.includes(siteId);

export const can = {
  /* ---- Urgentiste ---- */
  createPatient: (a: Actor, triageSiteId: string) =>
    a.role === "urgentiste" && isMember(a, triageSiteId),

  /** Voir un patient : urgentiste de son site, régulateur, référent de l'hôpital
   *  qui a accepté le transfert, brûlologue via une demande d'avis. */
  viewPatient: (
    a: Actor,
    p: {
      triageSiteId: string;
      acceptedBySiteId?: string | null;
      hasAdviceRequest?: boolean;
    },
  ) => {
    switch (a.role) {
      case "urgentiste":
        return isMember(a, p.triageSiteId);
      case "regulateur":
        return true;
      case "referent":
        return p.acceptedBySiteId != null && isMember(a, p.acceptedBySiteId);
      case "brulologue":
        return p.hasAdviceRequest === true;
    }
  },

  createAssessment: (a: Actor, patientTriageSiteId: string) =>
    a.role === "urgentiste" && isMember(a, patientTriageSiteId),

  createTransferRequest: (a: Actor, patientTriageSiteId: string) =>
    a.role === "urgentiste" && isMember(a, patientTriageSiteId),

  createAdviceRequest: (a: Actor, patientTriageSiteId: string) =>
    a.role === "urgentiste" && isMember(a, patientTriageSiteId),

  /** Suivi d'une demande de transfert. L'urgentiste ne voit que celles de ses sites. */
  viewTransferRequest: (
    a: Actor,
    r: { patientTriageSiteId: string; currentHopSiteId?: string | null; acceptedBySiteId?: string | null },
  ) => {
    switch (a.role) {
      case "urgentiste":
        return isMember(a, r.patientTriageSiteId);
      case "regulateur":
        return true;
      case "referent":
        return (
          (r.currentHopSiteId != null && isMember(a, r.currentHopSiteId)) ||
          (r.acceptedBySiteId != null && isMember(a, r.acceptedBySiteId))
        );
      case "brulologue":
        return false;
    }
  },

  /* ---- Référent hôpital ---- */
  updateCapacity: (a: Actor, hospitalSiteId: string) =>
    (a.role === "referent" && isMember(a, hospitalSiteId)) ||
    a.role === "regulateur",

  /** Voir la capacité détaillée d'un hôpital. Urgentiste : jamais. */
  viewCapacityDetail: (a: Actor, hospitalSiteId: string) =>
    a.role === "regulateur" ||
    (a.role === "referent" && isMember(a, hospitalSiteId)),

  /** Accepter/refuser une demande : uniquement le référent de l'hôpital
   *  actuellement sollicité dans la cascade. */
  respondTransfer: (a: Actor, currentHopSiteId: string) =>
    a.role === "referent" && isMember(a, currentHopSiteId),

  markArrived: (a: Actor, acceptedBySiteId: string | null) =>
    (a.role === "referent" &&
      acceptedBySiteId != null &&
      isMember(a, acceptedBySiteId)) ||
    a.role === "regulateur",

  /* ---- Régulateur ---- */
  forceTransfer: (a: Actor) => a.role === "regulateur",
  cancelTransfer: (a: Actor, patientTriageSiteId?: string) =>
    a.role === "regulateur" ||
    (a.role === "urgentiste" &&
      patientTriageSiteId != null &&
      isMember(a, patientTriageSiteId)),
  manageSites: (a: Actor) => a.role === "regulateur",
  manageUsers: (a: Actor) => a.role === "regulateur",
  generateAccessCodes: (a: Actor) => a.role === "regulateur",
  updateRules: (a: Actor) => a.role === "regulateur",
  viewDashboard: (a: Actor) => a.role === "regulateur",
  viewReports: (a: Actor) => a.role === "regulateur",
  exportAudit: (a: Actor) => a.role === "regulateur",
  commentAssessment: (a: Actor) => a.role === "regulateur",

  /** Le régulateur ne modifie JAMAIS un triage (il commente). */
  modifyAssessment: (_a: Actor) => false,

  /* ---- Brûlologue ---- */
  viewAdviceQueue: (a: Actor) => a.role === "brulologue",
  claimAdvice: (a: Actor) => a.role === "brulologue",
  answerAdvice: (a: Actor, claimedBy: string | null) =>
    a.role === "brulologue" && claimedBy === a.userId,
  releaseAdvice: (a: Actor, claimedBy: string | null) =>
    a.role === "brulologue" && claimedBy === a.userId,

  /** Voir une demande d'avis. Régulateur : lecture seule (tout voir). */
  viewAdviceRequest: (
    a: Actor,
    r: { patientTriageSiteId: string },
  ) => {
    switch (a.role) {
      case "brulologue":
        return true;
      case "regulateur":
        return true;
      case "urgentiste":
        return isMember(a, r.patientTriageSiteId);
      case "referent":
        return false;
    }
  },

  /* ---- Admin technique ---- */
  systemConfig: (a: Actor) => a.role === "regulateur" && a.isAdmin,
};

export type Permission = keyof typeof can;
