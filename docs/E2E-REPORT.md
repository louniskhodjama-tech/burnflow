# E2E-REPORT — scénario de bout en bout joué et documenté

Scénario imposé (GOAL §Définition de terminé 4), joué automatiquement par
`tests/e2e/scenario.spec.ts` (Playwright, viewport mobile Pixel 7) contre
l'application complète : Postgres + Mailpit réels, emails de connexion
réellement reçus, job cron réel pour l'expiration.

Rejouer : `docker compose up -d postgres mailpit && pnpm seed:e2e && pnpm test:e2e`

## Statut

✅ **PASSÉ** — exécution du 2026-08-30, 03:24 (heure locale), en 36,9 s contre
un build de production (`next build` + `next start`), Postgres 16 et Mailpit
réels, job cron réel pour la bascule d'expiration.

```
Running 1 test using 1 worker
  ok 1 tests\e2e\scenario.spec.ts › scénario complet : triage → cascade
       (refus, expiration, acceptation) → avis → arrivée → journal (36.9s)
  1 passed (37.5s)
```

Les 14 captures d'écran de la même exécution sont dans `docs/e2e-captures/`
(01 → 14, nommées par étape). En complément, la **vérification des sites par
le régulateur via l'interface** (GOAL, condition 3) a été réalisée : centres
des brûlés de Zéralda et d'Oran + 6 hôpitaux du brouillon Est marqués vérifiés
(9 entrées `site.update` au journal d'audit).

## Déroulé et preuves (captures dans `docs/e2e-captures/`)

| # | Étape | Acteur | Vérification | Capture |
|---|---|---|---|---|
| 1 | Connexion par lien magique (email réellement reçu via SMTP/Mailpit) | Urgentiste | arrivée sur /patients | (login de chaque rôle) |
| 2 | Création du patient pseudonymisé (ID bracelet uniquement) | Urgentiste | redirection vers le triage | 01 |
| 3 | Triage carte corporelle : tronc antérieur + postérieur, « Tout », 2e superficiel → **SCB 26 %, aucun signe → classe 2 · Réanimation** | Urgentiste | bandeau temps réel : 26 % SCB, classe 2 | 02 |
| 4 | Demande de transfert → cascade calculée, **Hôpital E2E-A sollicité (1/…)** avec compte à rebours | Urgentiste | écran « Recherche en cours » | 03 |
| 5 | **Hôpital A refuse** (motif obligatoire : « Plus de lit disponible ») | Référent A | bilan clinique reçu, refus tracé | 04, 05 |
| 6 | Bascule automatique → **Hôpital E2E-B sollicité** | — | suivi urgentiste à jour | 06 |
| 7 | **Hôpital B ne répond pas → expiration** : `hop_sent_at` reculé de 11 min en base, puis **le job cron réel** (toutes les minutes) constate le dépassement du délai (10 min) et bascule | — | suivi urgentiste passe à E2E-C | 07 |
| 8 | **Hôpital C accepte** → **lit de réanimation réservé** (vérifié en base : 2 → 1, snapshot « Réservation transfert ») | Référent C | page « Patients attendus » | 08 |
| 9 | L'urgentiste voit **la destination confirmée + téléphone du service** | Urgentiste | carte verte « Hôpital d'accueil confirmé » | 09 |
| 10 | Demande d'**avis brûlologue** (question libre, fiche clinique jointe) | Urgentiste | file nationale alimentée | 10 |
| 11 | Le brûlologue **prend** la demande (verrou exclusif) et **répond** | Brûlologue | statut « Pris par vous » puis « Répondu » | 10, 11 |
| 12 | L'urgentiste **voit la réponse** sur la fiche patient | Urgentiste | réponse visible | 12 |
| 13 | Le référent **marque le patient arrivé** | Référent C | liste « Arrivés récemment » | 13 |
| 14 | Le régulateur **voit tout dans le journal** : refus motivé, expiration, acceptation avec lit réservé, arrivée | Régulateur | journal complet de la demande | 14 |

## Notes de méthode

- L'« absence de réponse » de l'hôpital B est simulée en reculant
  `hop_sent_at` de 11 minutes en base (une vraie attente de 10 min par hop
  rendrait la CI impraticable). La **bascule elle-même est faite par le vrai
  job** (`minuteTick` → `expireDueTransfers`), pas par le test.
- Les connexions passent par le **vrai circuit** lien magique → email SMTP →
  boîte Mailpit → clic sur le lien (usage unique, 15 min).
- La réservation du lit est vérifiée **en base** (dernier snapshot de capacité
  décrémenté) en plus de l'UI.
