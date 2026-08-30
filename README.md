# Triage brûlés — plateforme d'orientation en afflux massif

Triage des brûlés au point médical le plus proche, recensement temps réel des
capacités hospitalières, routage de proche en proche avec équilibrage de
charge, avis brûlologue à distance. Objectif clinique : **décharger les
centres des brûlés** en orientant vers chirurgie et réanimation tout ce qui
peut l'être selon les critères ISBI.

- Cahier des charges : [docs/GOAL.md](docs/GOAL.md)
- Grille clinique de référence (prototype validé) : [docs/triage-brulures-v3.html](docs/triage-brulures-v3.html)
- Décisions d'implémentation : [docs/DECISIONS.md](docs/DECISIONS.md)
- Matrice des rôles : [docs/ROLES.md](docs/ROLES.md)
- Conduite en incident : [docs/RUNBOOK.md](docs/RUNBOOK.md)
- Scénario de bout en bout joué : [docs/E2E-REPORT.md](docs/E2E-REPORT.md)

## Stack

Next.js 15 (App Router, TypeScript strict, full-stack) · PostgreSQL 16 +
Drizzle ORM (migrations versionnées) · auth maison (lien magique 15 min +
codes d'accès 8 caractères, sessions cookie httpOnly) · Nodemailer (SMTP) ·
web-push (VAPID) · OSRM self-hosted (secours haversine) · SDK Anthropic
(`claude-sonnet-4-6`, serveur uniquement, fail-open) · Tailwind 4 ·
Vitest + Playwright · Docker Compose (app, postgres, osrm, mailpit dev).

## Démarrage en développement

Prérequis : Node ≥ 20, pnpm ≥ 9, Docker.

```bash
docker compose up -d postgres mailpit   # Postgres sur localhost:5433, Mailpit UI sur :8025
pnpm install
cp .env.example .env.local              # puis compléter (voir tableau ci-dessous)
pnpm db:migrate
pnpm seed:demo                          # 10 sites, 4 comptes (1/rôle), capacités, codes d'accès affichés
pnpm dev                                # http://localhost:3000
```

Connexion : les codes d'accès imprimés par `seed:demo`, ou lien magique
(l'email arrive dans Mailpit : http://localhost:8025).

### Variables d'environnement (`.env.local`)

| Variable | Rôle | Dev |
|---|---|---|
| `DATABASE_URL` | Postgres | `postgres://triage:triage@localhost:5433/triage` |
| `APP_URL` | URL publique (liens magiques, emails) | `http://localhost:3000` |
| `SESSION_SECRET` | ≥ 32 caractères aléatoires | requis |
| `ANTHROPIC_API_KEY` | agent IA (vide = fonctions IA neutralisées, fail-open) | facultatif |
| `SMTP_HOST/PORT/USER/PASS/FROM` | envoi d'emails | `localhost:1025` (Mailpit) |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` | push web (`npx web-push generate-vapid-keys`) | requis pour le push |
| `OSRM_URL` | routage routier (vide = estimation haversine ×1,35 à 70 km/h) | facultatif |
| `RUN_MIGRATIONS_ON_BOOT` | `1` = migrations au démarrage (utilisé par Docker) | vide en dev |

### Tests

```bash
pnpm test        # unitaires : scoring clinique, routage, matrice des rôles
pnpm test:e2e    # scénario complet Playwright (nécessite postgres+mailpit et pnpm seed:e2e)
```

### Scripts

| Commande | Effet |
|---|---|
| `pnpm seed:demo` | données de démonstration + codes d'accès frais |
| `pnpm seed:sites data/sites.east-draft.csv` | import CSV de sites (inactifs, à vérifier) |
| `pnpm seed:e2e` | contexte du scénario Playwright |
| `pnpm distances:rebuild [--only-estimates]` | recalcul de la table de distances |
| `bash scripts/osrm-prepare.sh` | télécharge l'extrait Algérie et prépare OSRM |
| `bash scripts/backup.sh` | sauvegarde Postgres gzippée dans `backups/` (rotation 14 j) |

## OSRM

```bash
bash scripts/osrm-prepare.sh        # une fois : télécharge + osrm-extract + osrm-contract
docker compose up -d osrm           # sert sur :5000
# .env.local : OSRM_URL=http://localhost:5000
pnpm distances:rebuild --only-estimates   # remplace les estimations par du vrai routier
```

Sans OSRM, l'application fonctionne : les distances sont estimées (haversine
×1,35, 70 km/h), marquées « estimé » dans l'interface, et recalculées dès
qu'OSRM répond.

## Déploiement Dokploy (production) — pas à pas

> État : **en attente du VPS** (voir docs/DECISIONS.md D-001). La procédure
> ci-dessous est prête à être exécutée dès que `VPS_IP` est fourni.

1. VPS Ubuntu neuf : installer Dokploy (script officiel) :
   `curl -sSL https://dokploy.com/install.sh | sh`
2. Dans Dokploy : créer un projet « triage-brules », service **Compose**
   pointant sur ce dépôt (`docker-compose.yml` à la racine).
3. Variables d'environnement du service : recopier `.env.example` complété
   (`SESSION_SECRET` fort, `APP_URL=https://brules.iqmed.io`, SMTP réel,
   clés VAPID de production, `ANTHROPIC_API_KEY`). Ne jamais committer ces valeurs.
4. Domaine : `brules.iqmed.io` → port 3000 du service `app`, certificat
   Let's Encrypt via Dokploy/Traefik. DNS : enregistrement
   `A brules.iqmed.io → VPS_IP` (géré chez Hostinger via le connecteur MCP —
   confirmation avant toute écriture), + SPF/DKIM du fournisseur SMTP.
5. Volumes persistants : `pgdata` (Postgres) et `./osrm-data` (OSRM) — déclarés
   dans le compose. Préparer OSRM sur le VPS : `bash scripts/osrm-prepare.sh`.
6. Les migrations s'appliquent automatiquement au démarrage du conteneur
   (`RUN_MIGRATIONS_ON_BOOT=1` dans le compose).
7. Données : `pnpm seed:sites data/sites.east-draft.csv` puis vérification et
   activation des sites par le régulateur dans l'interface.
8. Sauvegardes : planifier `bash scripts/backup.sh` (cron hôte ou tâche
   planifiée Dokploy, quotidienne, 03:00).
9. Vérifications de bout en bout : DNS résout, HTTPS valide,
   `https://brules.iqmed.io/api/health` → `ok`, OSRM répond, un lien magique
   arrive dans une vraie boîte, une notification push arrive sur Android.

## Sécurité

Aucune donnée nominative patient (ID bracelet uniquement, rappelé dans l'UI).
HTTPS obligatoire en production, cookies `Secure`/`httpOnly`, rate-limit sur
la connexion, `audit_log` sur toute mutation (export CSV pour le régulateur),
secrets uniquement en variables d'environnement.
