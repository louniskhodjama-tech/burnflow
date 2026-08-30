# ROLES — matrice des permissions

Source de vérité applicative : `src/lib/policy.ts` (fonctions pures).
Tests correspondants : `tests/unit/policy.test.ts` — chaque cellule « peut » /
« ne peut pas » de cette matrice y est un assert.

Chaque utilisateur a **exactement un rôle**. Toute route serveur vérifie le rôle
**et** l'appartenance (site) avant d'agir, via `requireActor()` + `can.*`.

| Rôle | Périmètre | Peut | Ne peut pas |
|---|---|---|---|
| **Urgentiste** | Un ou plusieurs points médicaux | Créer un patient pseudonymisé, saisir le triage, créer une demande de transfert, demander un avis brûlologue, voir l'état de ses propres demandes | Voir les patients d'autres sites, voir les capacités détaillées des hôpitaux, forcer une destination |
| **Référent hôpital** | Son hôpital uniquement | Mettre à jour la capacité de son hôpital, accepter/refuser une demande adressée à son hôpital, voir la fiche des patients qu'il a acceptés, marquer l'arrivée | Voir ou agir sur un autre hôpital, créer des patients |
| **Régulateur** | National | Tout voir, forcer/réassigner une destination, annuler une demande, modifier les seuils, gérer hôpitaux et utilisateurs, générer des codes d'accès, lire les rapports | Modifier un triage saisi par un urgentiste (il peut commenter), répondre à un avis brûlologue |
| **Brûlologue consultant** | File nationale des avis | Voir la file, **prendre** une demande (verrou exclusif), répondre, relâcher, voir la fiche clinique pseudonymisée du patient concerné | Voir les capacités, modifier un triage, agir sur les transferts |

Compte `admin` technique : flag `is_admin` sur un régulateur (`can.systemConfig`).
Pas de cinquième rôle.

## Correspondance code ↔ matrice

| Cellule | Fonction `can.*` |
|---|---|
| Créer patient / triage / transfert / avis (urgentiste, son site) | `createPatient`, `createAssessment`, `createTransferRequest`, `createAdviceRequest` |
| Suivi de ses demandes (urgentiste) | `viewTransferRequest` |
| Capacité (référent, son hôpital) | `updateCapacity`, `viewCapacityDetail` |
| Accepter/refuser (référent, hôpital sollicité) | `respondTransfer` |
| Fiche des patients acceptés + arrivée (référent) | `viewPatient` (acceptedBySiteId), `markArrived` |
| Tout voir / forcer / annuler / gérer / seuils / codes / rapports (régulateur) | `viewDashboard`, `forceTransfer`, `cancelTransfer`, `manageSites`, `manageUsers`, `updateRules`, `generateAccessCodes`, `viewReports`, `exportAudit` |
| Interdiction de modifier un triage (régulateur) | `modifyAssessment` → toujours `false` (commentaire : `commentAssessment`) |
| File d'avis, prise exclusive, réponse, relâche (brûlologue) | `viewAdviceQueue`, `claimAdvice`, `answerAdvice`, `releaseAdvice` |
| Fiche clinique du patient concerné (brûlologue) | `viewPatient` (hasAdviceRequest) |
