import { test, expect, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";

/**
 * Scénario de bout en bout (GOAL §Définition de terminé 4) :
 * un urgentiste crée un patient, triage classe 2, demande un transfert ;
 * hôpital 1 refuse ; hôpital 2 expire (sans réponse) ; hôpital 3 accepte ;
 * lit réservé ; l'urgentiste voit la destination ; un brûlologue prend un
 * avis et répond ; le référent marque l'arrivée ; le régulateur voit tout.
 *
 * Pré-requis : docker compose up -d postgres && pnpm seed:e2e
 * (mailpit reste utile pour les emails de notification, pas pour l'auth)
 * (le webServer Playwright démarre l'app).
 *
 * L'expiration du hop 2 est provoquée en reculant hop_sent_at en base
 * (le job cron réel fait la bascule) — documenté dans docs/E2E-REPORT.md.
 */

const DB_URL =
  process.env.DATABASE_URL ?? "postgres://triage:triage@localhost:5433/triage";
const CAPTURES = "docs/e2e-captures";

const BRACELET = `E2E-${Date.now().toString(36).toUpperCase()}`;

let shot = 0;
async function capture(page: Page, name: string): Promise<void> {
  shot++;
  await page.screenshot({
    path: `${CAPTURES}/${String(shot).padStart(2, "0")}-${name}.png`,
    fullPage: true,
  });
}

async function loginByCode(browser: Browser, email: string): Promise<Page> {
  // Génère un code d'accès directement en base (ce que ferait le régulateur
  // via l'interface), puis se connecte par le formulaire — auth par codes
  // uniquement (DECISIONS D-012).
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[bytes[i]! % ALPHABET.length];
  const hash = createHash("sha256").update(code).digest("hex");

  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const res = await pg.query(
    `INSERT INTO access_codes (code_hash, user_id, created_by, expires_at)
     SELECT $1, u.id, u.id, now() + interval '1 hour'
     FROM users u WHERE u.email = $2 AND u.active
     RETURNING id`,
    [hash, email],
  );
  await pg.end();
  expect(res.rowCount, `compte actif pour ${email}`).toBe(1);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Code d'accès").fill(code);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/login/);
  return page;
}


/** goto + attendre l'hydratation React (chunks chargés) avant d'interagir. */
async function gotoReady(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test.describe.configure({ mode: "serial" });

test("scénario complet : triage → cascade (refus, expiration, acceptation) → avis → arrivée → journal", async ({ browser }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(CAPTURES, { recursive: true });

  // Isolation entre runs : annule les demandes fantômes et remet des
  // capacités fraîches (2 lits de réa) sur les trois hôpitaux E2E.
  {
    const pg0 = new Client({ connectionString: DB_URL });
    await pg0.connect();
    await pg0.query(
      `UPDATE transfer_requests SET status='cancelled', hop_sent_at=NULL
       WHERE status='pending' AND cascade->0->>'siteName' LIKE 'Hôpital E2E-%'`,
    );
    await pg0.query(
      `UPDATE sites SET active = true
       WHERE name LIKE 'Hôpital E2E-%' OR name = 'PMA E2E'`,
    );
    await pg0.query(
      `INSERT INTO capacity_snapshots
         (site_id, icu_beds_free, ward_beds_free, or_available,
          burn_surgeon_present, supplies_ok, declared_total_icu,
          declared_total_ward, created_by)
       SELECT s.id, 2, 5, true, false, true, 4, 10,
              (SELECT id FROM users WHERE email = 'refa@e2e.local')
       FROM sites s
       WHERE s.name IN ('Hôpital E2E-A', 'Hôpital E2E-B', 'Hôpital E2E-C')`,
    );
    await pg0.end();
  }

  /* ---- 1 · Urgentiste : création du patient ---- */
  const urg = await loginByCode(browser, "urg@e2e.local");
  await gotoReady(urg, "/patients/new");
  await urg.getByLabel(/ID bracelet/).fill(BRACELET);
  await urg.getByLabel("Âge (ans)").fill("34");
  await urg.getByLabel("Poids est. (kg)").fill("70");
  await urg.getByLabel("Délai (h)").fill("2");
  await capture(urg, "urgentiste-nouveau-patient");
  await urg.getByRole("button", { name: "Créer et passer au triage" }).click();
  await expect(urg).toHaveURL(/\/triage$/, { timeout: 60_000 });
  await urg.waitForLoadState("networkidle");

  /* ---- 2 · Triage classe 2 : tronc ant. + post. en 2e sup = 26 %, aucun signe ---- */
  for (const zone of ["Tronc antérieur", "Tronc postérieur"]) {
    await urg.getByLabel(zone).first().click();
    await urg.getByRole("button", { name: "Tout" }).click();
    await urg.getByRole("button", { name: "2e sup", exact: true }).click();
  }
  await expect(urg.getByText("26% SCB")).toBeVisible();
  await expect(urg.getByText("Réanimation", { exact: false }).first()).toBeVisible();
  await capture(urg, "urgentiste-triage-26pct-classe2");
  await urg.getByRole("button", { name: "Valider le triage" }).click();
  await expect(urg).toHaveURL(/\/patients\/[0-9a-f-]+$/, { timeout: 60_000 });
  const patientUrl = urg.url();

  /* ---- 3 · Demande de transfert ---- */
  await urg.getByRole("link", { name: "Demander un transfert" }).click();
  await urg.waitForLoadState("networkidle");
  await urg.getByRole("button", { name: "Lancer la recherche d'hôpital" }).click();
  await expect(urg.getByText("Recherche en cours")).toBeVisible({ timeout: 60_000 });
  await expect(urg.getByText("Hôpital E2E-A").first()).toBeVisible();
  await capture(urg, "urgentiste-cascade-lancee-hopA");
  const transferUrl = urg.url();

  /* ---- 4 · Hôpital A refuse (motif obligatoire) ---- */
  const refA = await loginByCode(browser, "refa@e2e.local");
  await gotoReady(refA, "/hopital/demandes");
  await refA.getByText(BRACELET).click();
  await expect(refA.getByText("Bilan clinique")).toBeVisible();
  await capture(refA, "referentA-demande-recue");
  await refA.getByRole("button", { name: /Refuser/ }).click();
  await refA.getByText("Plus de lit disponible").click();
  await refA.getByRole("button", { name: "Confirmer le refus" }).click();
  await expect(refA).toHaveURL(/\/hopital\/demandes$/);
  await capture(refA, "referentA-apres-refus");

  /* ---- 5 · Hôpital B ne répond pas → expiration par le job cron ---- */
  await gotoReady(urg, transferUrl);
  await expect(urg.getByText(/Hôpital sollicité : Hôpital E2E-B/)).toBeVisible({ timeout: 15_000 });
  await capture(urg, "urgentiste-bascule-hopB");

  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  await pg.query(
    `UPDATE transfer_requests SET hop_sent_at = hop_sent_at - interval '11 minutes'
     WHERE status = 'pending' AND cascade->0->>'siteName' = 'Hôpital E2E-A'`,
  );
  await pg.end();

  // Le job passe toutes les minutes ; on attend la bascule vers C
  // (on cible la ligne « Hôpital sollicité », pas la liste de cascade).
  await expect(async () => {
    await urg.reload();
    await expect(
      urg.getByText(/Hôpital sollicité : Hôpital E2E-C/),
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 150_000, intervals: [5_000] });
  await capture(urg, "urgentiste-expiration-hopC");

  /* ---- 6 · Hôpital C accepte → lit réservé ---- */
  const refC = await loginByCode(browser, "refc@e2e.local");
  await gotoReady(refC, "/hopital/demandes");
  // La liste est rendue côté serveur : recharge jusqu'à voir la demande.
  await expect(async () => {
    await refC.reload();
    await expect(refC.getByText(BRACELET)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 90_000, intervals: [3_000] });

  // Lits de réa de C avant acceptation (l'assert de réservation est relatif).
  const pgBefore = new Client({ connectionString: DB_URL });
  await pgBefore.connect();
  const bedsBefore = (
    await pgBefore.query(
      `SELECT c.icu_beds_free FROM capacity_snapshots c
       JOIN sites s ON s.id = c.site_id WHERE s.name = 'Hôpital E2E-C'
       ORDER BY c.created_at DESC LIMIT 1`,
    )
  ).rows[0].icu_beds_free as number;
  await pgBefore.end();

  await refC.getByText(BRACELET).click();
  await refC.getByRole("button", { name: /Accepter/ }).click();
  await expect(refC).toHaveURL(/\/hopital\/attendus$/, { timeout: 45_000 });
  await expect(refC.getByText(BRACELET)).toBeVisible();
  await capture(refC, "referentC-accepte-attendus");

  // Vérifie la réservation : le dernier snapshot de C a un lit de réa de moins.
  const pg2 = new Client({ connectionString: DB_URL });
  await pg2.connect();
  const bed = await pg2.query(
    `SELECT c.icu_beds_free FROM capacity_snapshots c
     JOIN sites s ON s.id = c.site_id WHERE s.name = 'Hôpital E2E-C'
     ORDER BY c.created_at DESC LIMIT 1`,
  );
  expect(bed.rows[0].icu_beds_free).toBe(bedsBefore - 1);
  await pg2.end();

  /* ---- 7 · L'urgentiste voit la destination et le téléphone ---- */
  await urg.reload();
  await expect(urg.getByText("Hôpital d'accueil confirmé")).toBeVisible();
  await expect(urg.getByText("Hôpital E2E-C").first()).toBeVisible();
  await expect(urg.getByText(/Appeler le service/)).toBeVisible();
  await capture(urg, "urgentiste-destination-confirmee");

  /* ---- 8 · Avis brûlologue : demande, prise exclusive, réponse ---- */
  await gotoReady(urg, patientUrl);
  await urg.getByRole("link", { name: "Demander un avis" }).click();
  await urg.waitForLoadState("networkidle");
  await urg
    .getByLabel(/Votre question/)
    .fill("Conduite du remplissage à H2 pour 26 % chez un adulte de 70 kg ?");
  await urg.getByRole("button", { name: "Envoyer la demande d'avis" }).click();
  await expect(urg).toHaveURL(/avis=envoye/);

  const bru = await loginByCode(browser, "bru@e2e.local");
  await gotoReady(bru, "/avis");
  await bru.getByText(BRACELET).click();
  await bru.waitForLoadState("networkidle");
  await capture(bru, "brulologue-fiche-clinique");
  await bru.getByRole("button", { name: "Prendre cette demande" }).click();
  await expect(bru.getByText("Pris par vous")).toBeVisible();
  await bru
    .getByLabel(/Votre réponse/)
    .fill("Poursuivre Parkland ≈ 455 ml/h jusqu'à H8, cible diurèse 0,5 ml/kg/h, réévaluation à H8.");
  await bru.getByRole("button", { name: "Envoyer la réponse" }).click();
  await expect(bru.getByText("Répondu")).toBeVisible();
  await capture(bru, "brulologue-reponse-envoyee");

  await urg.goto(patientUrl);
  await expect(urg.getByText(/Poursuivre Parkland/)).toBeVisible();
  await capture(urg, "urgentiste-avis-recu");

  /* ---- 9 · Référent C marque l'arrivée ---- */
  await gotoReady(refC, "/hopital/attendus");
  await refC
    .getByRole("listitem")
    .filter({ hasText: BRACELET })
    .getByRole("button", { name: "Marquer arrivé" })
    .click();
  await expect(refC.getByText("Arrivés récemment")).toBeVisible({ timeout: 15_000 });
  await capture(refC, "referentC-arrive");

  /* ---- 10 · Le régulateur voit tout dans le journal ---- */
  const reg = await loginByCode(browser, "reg@e2e.local");
  await gotoReady(reg, "/regulation/demandes");
  await reg.getByText(BRACELET).click();
  await expect(reg.getByText("Journal complet")).toBeVisible();
  await expect(reg.getByText(/Refusée — Plus de lit disponible/)).toBeVisible();
  await expect(reg.getByText(/Expirée/)).toBeVisible();
  await expect(reg.getByText(/Acceptée \(lit réservé\)/)).toBeVisible();
  await expect(reg.getByText(/^Arrivée$/).first()).toBeVisible();
  await capture(reg, "regulateur-journal-complet");
});
