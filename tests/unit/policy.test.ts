import { describe, it, expect } from "vitest";
import { can, type Actor } from "@/lib/policy";

/**
 * Matrice des rôles du GOAL, ligne par ligne (voir docs/ROLES.md).
 * S1/S2 : points médicaux · H1/H2 : hôpitaux.
 */

const urg: Actor = { userId: "u1", role: "urgentiste", isAdmin: false, siteIds: ["S1", "S2"] };
const ref: Actor = { userId: "r1", role: "referent", isAdmin: false, siteIds: ["H1"] };
const reg: Actor = { userId: "g1", role: "regulateur", isAdmin: false, siteIds: [] };
const admin: Actor = { userId: "g2", role: "regulateur", isAdmin: true, siteIds: [] };
const bru: Actor = { userId: "b1", role: "brulologue", isAdmin: false, siteIds: [] };

describe("urgentiste", () => {
  it("peut : créer un patient et un triage sur SON site", () => {
    expect(can.createPatient(urg, "S1")).toBe(true);
    expect(can.createAssessment(urg, "S2")).toBe(true);
    expect(can.createTransferRequest(urg, "S1")).toBe(true);
    expect(can.createAdviceRequest(urg, "S1")).toBe(true);
    expect(can.viewPatient(urg, { triageSiteId: "S1" })).toBe(true);
    expect(can.viewTransferRequest(urg, { patientTriageSiteId: "S1" })).toBe(true);
  });

  it("ne peut pas : agir hors de ses sites", () => {
    expect(can.createPatient(urg, "S9")).toBe(false);
    expect(can.createAssessment(urg, "S9")).toBe(false);
    expect(can.viewPatient(urg, { triageSiteId: "S9" })).toBe(false);
    expect(can.viewTransferRequest(urg, { patientTriageSiteId: "S9" })).toBe(false);
  });

  it("ne peut pas : capacités détaillées, forçage, gestion", () => {
    expect(can.viewCapacityDetail(urg, "H1")).toBe(false);
    expect(can.forceTransfer(urg)).toBe(false);
    expect(can.respondTransfer(urg, "H1")).toBe(false);
    expect(can.manageSites(urg)).toBe(false);
    expect(can.viewAdviceQueue(urg)).toBe(false);
    expect(can.viewDashboard(urg)).toBe(false);
  });
});

describe("référent hôpital", () => {
  it("peut : capacité et demandes de SON hôpital", () => {
    expect(can.updateCapacity(ref, "H1")).toBe(true);
    expect(can.viewCapacityDetail(ref, "H1")).toBe(true);
    expect(can.respondTransfer(ref, "H1")).toBe(true);
    expect(can.markArrived(ref, "H1")).toBe(true);
    expect(
      can.viewPatient(ref, { triageSiteId: "S1", acceptedBySiteId: "H1" }),
    ).toBe(true);
    expect(
      can.viewTransferRequest(ref, { patientTriageSiteId: "S1", currentHopSiteId: "H1" }),
    ).toBe(true);
  });

  it("ne peut pas : un autre hôpital", () => {
    expect(can.updateCapacity(ref, "H2")).toBe(false);
    expect(can.viewCapacityDetail(ref, "H2")).toBe(false);
    expect(can.respondTransfer(ref, "H2")).toBe(false);
    expect(can.markArrived(ref, "H2")).toBe(false);
    expect(
      can.viewPatient(ref, { triageSiteId: "S1", acceptedBySiteId: "H2" }),
    ).toBe(false);
    expect(
      can.viewTransferRequest(ref, { patientTriageSiteId: "S1", currentHopSiteId: "H2" }),
    ).toBe(false);
  });

  it("ne peut pas : créer des patients ni voir un patient non accepté", () => {
    expect(can.createPatient(ref, "H1")).toBe(false);
    expect(can.viewPatient(ref, { triageSiteId: "S1" })).toBe(false);
    expect(can.viewAdviceQueue(ref)).toBe(false);
    expect(can.forceTransfer(ref)).toBe(false);
  });
});

describe("régulateur", () => {
  it("peut : tout voir, forcer, annuler, gérer, seuils, codes, rapports", () => {
    expect(can.viewPatient(reg, { triageSiteId: "S1" })).toBe(true);
    expect(can.viewTransferRequest(reg, { patientTriageSiteId: "S1" })).toBe(true);
    expect(can.viewCapacityDetail(reg, "H2")).toBe(true);
    expect(can.forceTransfer(reg)).toBe(true);
    expect(can.cancelTransfer(reg)).toBe(true);
    expect(can.manageSites(reg)).toBe(true);
    expect(can.manageUsers(reg)).toBe(true);
    expect(can.generateAccessCodes(reg)).toBe(true);
    expect(can.updateRules(reg)).toBe(true);
    expect(can.viewDashboard(reg)).toBe(true);
    expect(can.viewReports(reg)).toBe(true);
    expect(can.exportAudit(reg)).toBe(true);
    expect(can.commentAssessment(reg)).toBe(true);
    expect(can.viewAdviceRequest(reg, { patientTriageSiteId: "S1" })).toBe(true);
  });

  it("ne peut pas : modifier un triage ni répondre à un avis", () => {
    expect(can.modifyAssessment(reg)).toBe(false);
    expect(can.createAssessment(reg, "S1")).toBe(false);
    expect(can.answerAdvice(reg, "g1")).toBe(false);
    expect(can.claimAdvice(reg)).toBe(false);
    expect(can.createPatient(reg, "S1")).toBe(false);
  });

  it("admin technique : flag sur un régulateur uniquement", () => {
    expect(can.systemConfig(admin)).toBe(true);
    expect(can.systemConfig(reg)).toBe(false);
    expect(can.systemConfig({ ...bru, isAdmin: true })).toBe(false);
  });
});

describe("brûlologue", () => {
  it("peut : file des avis, prendre, répondre et relâcher SES avis, fiche clinique", () => {
    expect(can.viewAdviceQueue(bru)).toBe(true);
    expect(can.claimAdvice(bru)).toBe(true);
    expect(can.answerAdvice(bru, "b1")).toBe(true);
    expect(can.releaseAdvice(bru, "b1")).toBe(true);
    expect(can.viewAdviceRequest(bru, { patientTriageSiteId: "S1" })).toBe(true);
    expect(
      can.viewPatient(bru, { triageSiteId: "S1", hasAdviceRequest: true }),
    ).toBe(true);
  });

  it("ne peut pas : répondre à un avis pris par un autre", () => {
    expect(can.answerAdvice(bru, "b2")).toBe(false);
    expect(can.releaseAdvice(bru, "b2")).toBe(false);
    expect(can.answerAdvice(bru, null)).toBe(false);
  });

  it("ne peut pas : capacités, triage, transferts, patients sans avis", () => {
    expect(can.viewCapacityDetail(bru, "H1")).toBe(false);
    expect(can.createAssessment(bru, "S1")).toBe(false);
    expect(can.modifyAssessment(bru)).toBe(false);
    expect(can.respondTransfer(bru, "H1")).toBe(false);
    expect(can.forceTransfer(bru)).toBe(false);
    expect(can.viewTransferRequest(bru, { patientTriageSiteId: "S1" })).toBe(false);
    expect(can.viewPatient(bru, { triageSiteId: "S1" })).toBe(false);
    expect(can.updateCapacity(bru, "H1")).toBe(false);
  });
});
