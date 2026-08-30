#!/usr/bin/env bash
# Prépare les données OSRM (profil voiture) pour l'Algérie.
# À lancer une fois sur la machine qui héberge le conteneur osrm (ou en local).
# Durée : ~10-20 min selon la machine. Résultat dans ./osrm-data/.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/osrm-data"
PBF_URL="https://download.geofabrik.de/africa/algeria-latest.osm.pbf"
IMG="ghcr.io/project-osrm/osrm-backend:latest"

mkdir -p "$DIR"
cd "$DIR"

if [[ ! -f algeria-latest.osm.pbf ]]; then
  echo "Téléchargement de l'extrait Algérie (Geofabrik)…"
  curl -L -o algeria-latest.osm.pbf "$PBF_URL"
fi

echo "osrm-extract (profil car)…"
docker run --rm -v "$DIR:/data" "$IMG" osrm-extract -p /opt/car.lua /data/algeria-latest.osm.pbf

echo "osrm-contract…"
docker run --rm -v "$DIR:/data" "$IMG" osrm-contract /data/algeria-latest.osrm

echo
echo "Terminé. Démarrer le service :  docker compose up -d osrm"
echo "Puis recalculer les distances :  pnpm distances:rebuild --only-estimates"
