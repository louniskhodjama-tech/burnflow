# RUNBOOK — que faire quand ça casse

Public : régulateur/admin et toute personne d'astreinte. Les commandes se
lancent depuis le dossier du projet sur le serveur (ou en local en dev).

## 1 · OSRM est tombé (ou n'est pas encore prêt)

**Symptôme** : `/api/health` → `"osrm": "injoignable (estimation haversine utilisée)"`,
distances marquées « estimé » dans les cascades.

**Impact réel : aucun blocage.** Le routage bascule automatiquement sur une
estimation (haversine ×1,35, 70 km/h). Les cascades restent correctes en ordre
de grandeur.

Rétablir :

```bash
docker compose ps osrm            # état du conteneur
docker compose logs --tail 50 osrm
docker compose up -d osrm         # redémarrage
# si les données manquent (premier démarrage) :
bash scripts/osrm-prepare.sh && docker compose up -d osrm
# une fois OSRM revenu, remplacer les estimations :
pnpm distances:rebuild --only-estimates
```

## 2 · Les emails ne partent pas

**Symptôme** : pas de lien magique reçu, colonne `error` remplie dans la table
`notifications` (canal email), logs `[email] échec d'envoi`.

1. Vérifier les variables `SMTP_*` du service `app` (Dokploy → Environment).
2. Tester depuis le conteneur : `docker compose exec app node -e "..."` ou
   plus simple : régénérer un lien magique et lire les logs :
   `docker compose logs --tail 100 app | grep email`.
3. Fournisseur : vérifier SPF/DKIM du domaine d'envoi (sinon spam/rejet).
4. **Contournement immédiat** : la connexion par **code d'accès** ne dépend pas
   de l'email — le régulateur génère un code dans /regulation/utilisateurs et
   le transmet oralement. Les notifications push continuent de fonctionner.
5. En dev : Mailpit doit tourner (`docker compose up -d mailpit`, UI :8025).

## 3 · Forcer un transfert à la main

Cas : cascade épuisée, hôpital hors ligne, décision de régulation.

Interface (voie normale) : `/regulation/demandes/<id>` → « Forcer / réassigner
la destination » → choisir l'hôpital, motif obligatoire. L'action libère
l'éventuel lit réservé ailleurs et tente d'en réserver un dans la cible
(tracé dans le journal si aucun lit libre).

Secours SQL (si l'interface est indisponible) — à n'utiliser qu'en dernier
recours, tout est audité :

```bash
docker compose exec postgres psql -U triage -d triage
-- identifier la demande et l'hôpital cible
SELECT id, status FROM transfer_requests ORDER BY created_at DESC LIMIT 5;
SELECT id, name FROM sites WHERE kind <> 'triage_point' AND active;
-- forcer
UPDATE transfer_requests
   SET status='forced', accepted_by_site_id='<SITE_ID>', accepted_at=now(), hop_sent_at=NULL
 WHERE id='<REQ_ID>';
INSERT INTO transfer_events (request_id, type, site_id, reason)
VALUES ('<REQ_ID>', 'forced', '<SITE_ID>', 'Forçage manuel SQL — interface indisponible');
```

Puis prévenir l'hôpital par téléphone (numéro sur la fiche du site).

## 4 · Ajouter un hôpital en urgence

1. `/regulation/sites` → « + Ajouter un site (en urgence) » : type, nom,
   wilaya, coordonnées (depuis n'importe quelle carte en ligne), téléphone.
2. Le site est créé « à vérifier » : cliquer **Marquer vérifié** puis **Activer**.
3. Le référent : `/regulation/utilisateurs` → créer un compte rôle « Référent »
   rattaché à ce site → **Code** → transmettre le code oralement.
4. Le référent saisit sa capacité (obligatoire : sans capacité fraîche,
   l'hôpital n'entre pas dans les cascades).
5. Distances : calculées automatiquement au premier routage ; pour peupler
   tout de suite : `pnpm distances:rebuild`.

## 5 · Capacité périmée / hôpital absent des cascades

Un hôpital n'est candidat que si sa capacité date de moins de
`capacityStaleHours` (6 h par défaut) **et** a des lits libres du bon type.
Le référent reçoit une relance automatique (push/email) après péremption.
Bouton « Confirmer inchangé » suffit à rafraîchir l'horodatage.

## 6 · Codes d'accès / connexion

- Code invalide = déjà utilisé (usage unique), expiré (24 h) ou mal saisi.
  → en générer un nouveau : /regulation/utilisateurs → « Code ».
- Trop de tentatives → rate-limit 15 min. Attendre ou changer de réseau.

## 7 · Sauvegarde et restauration Postgres

```bash
bash scripts/backup.sh                       # sauvegarde manuelle immédiate
# restauration (ATTENTION : écrase la base) :
gunzip -c backups/triage-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T postgres psql -U triage -d triage
```

La sauvegarde quotidienne est planifiée à 03:00 (cron hôte ou tâche Dokploy).

## 8 · Migrations / mise à jour applicative

Le conteneur `app` applique les migrations au démarrage
(`RUN_MIGRATIONS_ON_BOOT=1`). En cas d'échec au boot : lire
`docker compose logs app`, corriger, redéployer. Manuellement :
`pnpm db:migrate` (utilise `DATABASE_URL`).

## 9 · L'agent IA ne répond plus

Toutes les capacités IA sont **fail-open** : sans clé, en timeout ou en panne,
la validation du triage passe sans contrôle de cohérence, les fiches partent
sans synthèse rédigée (la fiche déterministe reste jointe). Vérifier
`ANTHROPIC_API_KEY` et les logs `[agent]`. Rien d'autre à faire.

## 10 · Santé générale

- `GET /api/health` : `database` + `osrm`.
- `docker compose ps` / `docker compose logs --tail 100 app postgres osrm`.
- Jobs : logs `[jobs]` (expirations chaque minute, relances 30 min, rapport 6 h).
