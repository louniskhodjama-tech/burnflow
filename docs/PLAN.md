# PLAN — Plateforme triage brûlés

Réfère : `docs/GOAL.md`. Ordre imposé par la section « Méthode de travail ».
Chaque jalon se termine par : tests verts + commit.

## Jalons

- [ ] **M0 — Socle** : Next.js 15 (App Router, TS strict), Tailwind, Drizzle + Postgres 16 (Docker),
  Mailpit, `/api/health`, Vitest + Playwright configurés, docker-compose (app, postgres, osrm, mailpit profil dev).
- [ ] **M1 — Schéma + auth + rôles** : schéma Drizzle complet + migrations ; lien magique email (15 min,
  usage unique) ; codes d'accès 8 caractères ; sessions cookie httpOnly ; garde-fous serveur par rôle
  et par appartenance ; `audit_log` ; tests de la matrice des rôles ; `docs/ROLES.md`.
- [ ] **M2 — Scoring + carte corporelle** : `lib/burn-scoring.ts` pur (port fidèle du prototype),
  tests unitaires imposés ; `rules_config` versionnée avec valeurs du bloc CONFIG ; composant React
  carte corporelle (SVG + bulle du prototype) ; écrans urgentiste : patients du site, nouveau patient,
  triage, fiche patient (classe, Parkland).
- [ ] **M3 — Capacités référent** : formulaire 6 champs (gros ±, « Confirmer inchangé »), snapshots
  horodatés, péremption > 6 h visible.
- [ ] **M4 — Routage + transferts** : `lib/routing.ts` pur + tests (candidats, occupation, score
  `minutes × (1 + λ·occ²)`, saturation 0.85, mode centre protégé, cascade max 6) ; `distance_cache`
  (OSRM, secours haversine estimé) ; demandes de transfert, acceptation avec réservation du lit
  (transaction + verrou), refus motivé, forçage régulateur ; job d'expiration/bascule toutes les minutes ;
  `transfer_events` immuable.
- [ ] **M5 — Avis brûlologue** : file nationale « premier qui prend » (verrou), relâche, réponse,
  retour auto en file après 15 min.
- [ ] **M6 — Notifications** : web-push (VAPID, service worker, abonnement par appareil), emails SMTP,
  table `notifications`, push cliquable vers l'écran concerné.
- [ ] **M7 — Agent IA** : `lib/agent/` (LLMClient unique, claude-sonnet-4-6, prompts versionnés,
  sorties Zod, fail-open) : contrôle de cohérence, fiche de transfert rédigée (+ PDF), synthèse d'avis.
  Rapport de situation 6 h et relances : déterministes.
- [ ] **M8 — Dashboard régulateur** : patients en attente par classe, hôpitaux (occupation, fraîcheur),
  carte Leaflet, détail demande + forçage, gestion sites/utilisateurs/codes, seuils, rapports,
  export CSV audit.
- [ ] **M9 — Données** : `data/sites.template.csv`, `data/sites.east-draft.csv` (`to_verify=true`),
  `pnpm seed:sites`, `pnpm seed:demo`, `pnpm distances:rebuild`, validation des sites dans l'UI.
- [ ] **M10 — E2E local** : scénario Playwright complet (création → triage classe 2 → cascade
  refus/expiration/acceptation → réservation → avis pris + répondu → arrivée → journal régulateur) ;
  `docs/E2E-REPORT.md` avec captures ; `docs/RUNBOOK.md` ; README complet.
- [ ] **M11 — Déploiement** *(en attente : pas encore de VPS)* : Dokploy, DNS Hostinger
  (`A brules.iqmed.io`), SPF/DKIM, HTTPS, vérifications de bout en bout. Voir DECISIONS D-001.

## État d'avancement

Mis à jour à chaque commit de jalon.

| Jalon | Statut |
|---|---|
| M0 | ✅ fait (commit 1aec353) |
| M1 | ✅ fait (commit 1aec353) — UI codes d'accès en M8 |
| M2 | ✅ fait (commit c16eac7) — vérifié en navigateur |
| M3 | ✅ fait — capacité, ± , confirmer inchangé, péremption |
| M4 | ✅ fait — cascade, refus, expiration cron, acceptation + lit réservé, forçage lib |
| M5 | ✅ fait — file, prise exclusive, réponse, relâche auto 15 min |
| M6 | ✅ fait — SW, abonnement par appareil, push cliquable |
| M7 | ✅ fait — cohérence, fiche rédigée, synthèse avis (fail-open) ; rapport 6 h déterministe |
| M8 | ✅ fait (commit fa19deb) |
| M9 | ✅ fait — CSV Est importé, vérifications via interface |
| M10 | ✅ **fait — scénario E2E PASSÉ (37 s, build prod)** + docs |
| M11 | **bloqué — VPS non fourni** |
