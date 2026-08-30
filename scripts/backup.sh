#!/usr/bin/env bash
# Sauvegarde quotidienne Postgres (pg_dump) dans le volume ./backups.
# À planifier sur l'hôte (cron) ou comme tâche planifiée Dokploy :
#   0 3 * * *  cd /chemin/du/projet && bash scripts/backup.sh
# Conserve 14 jours.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"

docker compose exec -T postgres pg_dump -U triage -d triage \
  | gzip > "backups/triage-${STAMP}.sql.gz"

# rotation : supprime les sauvegardes de plus de 14 jours
find backups -name "triage-*.sql.gz" -mtime +14 -delete

echo "Sauvegarde écrite : backups/triage-${STAMP}.sql.gz"
