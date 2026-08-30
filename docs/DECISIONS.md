# DECISIONS — choix non tranchés par le GOAL, consignés ici

## D-001 — Déploiement différé (décision utilisateur, 2026-08-30)
Le VPS n'existe pas encore. Tout se construit et se vérifie en local (Docker : postgres, mailpit,
osrm). Le jalon M11 (Dokploy, DNS Hostinger, SPF/DKIM, HTTPS) sera exécuté quand l'utilisateur
fournira `VPS_IP` et les accès. Rien d'autre n'est bloqué par ce report.

## D-002 — Codes d'accès : usage unique, validité 24 h
Le GOAL impose « code à 8 caractères transmis oralement » sans préciser durée ni réutilisation.
Choix : usage unique, expiration 24 h, alphabet sans ambiguïté orale (A-Z sans I/O, 2-9).
Le régulateur peut en générer autant que nécessaire. Stockage haché (SHA-256), jamais en clair.

## D-003 — Sessions : 30 jours, cookie httpOnly SameSite=Lax
Durée choisie pour un usage de crise (éviter les reconnexions sur le terrain). Token aléatoire
32 octets, haché en base. `Secure` activé quand HTTPS.

## D-004 — Distances : OSRM d'abord, estimation haversine en secours
`distance_cache` est rempli via OSRM (profil car). Si OSRM est indisponible (dev sans extrait
Geofabrik, panne), on calcule une estimation : distance haversine × 1,35 (facteur routier),
vitesse moyenne 70 km/h, marquée `source='estimate'` en base et visible comme « estimé » dans
l'UI régulateur. Recalcul automatique en `source='osrm'` dès qu'OSRM répond (`distances:rebuild`).
Justification : l'outil doit fonctionner cette semaine même si la préparation OSRM (extraction +
contraction de l'extrait Algérie) n'est pas terminée.

## D-005 — Occupation estimée sans capacité totale déclarée
Conformément au GOAL §Routage 2 : le snapshot porte un champ optionnel `declared_total_icu` /
`declared_total_ward`. S'il est renseigné, occupation = 1 − libres/total. Sinon, approximation :
total supposé = max(lits libres déclarés sur les dernières 24 h, lits libres courants, 1) ;
occupation = 1 − libres/max(...). Approximation documentée dans l'UI (« occupation estimée »).

## D-006 — Rate-limit en mémoire (mono-instance)
Le déploiement cible est un seul conteneur `app`. Fenêtre glissante en mémoire :
10 tentatives / 15 min par IP et par identifiant sur `/login` (email et code). Pas de Redis.

## D-007 — pnpm en mode `node-linker=hoisted`
Le dossier de travail est sous OneDrive (Windows). Les liens symboliques du store pnpm y sont
fragiles ; le mode hoisted copie les fichiers. Recommandation utilisateur : exclure
`node_modules/` de la synchronisation OneDrive.

## D-008 — Postgres dev exposé sur le port hôte 5433
Pour éviter tout conflit avec un Postgres local existant. Dans Docker, le service reste `postgres:5432`.

## D-009 — Périmètre brûlologue « fiche clinique »
Le brûlologue voit la fiche clinique pseudonymisée du patient concerné par la demande d'avis
(drapeaux, assessments, classe, Parkland) et l'historique des avis de ce patient — pas la cascade
de transfert ni les capacités (matrice des rôles).

## D-010 — PDF de la fiche de transfert
Généré côté serveur sans dépendance lourde : rendu HTML → impression navigateur (`window.print`)
sur une route dédiée `print`, plus export texte. Si un vrai PDF binaire devient nécessaire,
`@react-pdf/renderer` sera ajouté (non requis par le GOAL, qui demande « exportable en PDF »).
