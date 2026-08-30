# Politique de sécurité

BurnFlow est destiné à des situations de crise sanitaire : les failles de
sécurité y ont un poids particulier.

## Signaler une vulnérabilité

**Ne créez pas d'issue publique.** Utilisez l'onglet
[Security → Report a vulnerability](https://github.com/louniskhodjama-tech/burnflow/security/advisories/new)
de GitHub (signalement privé). Décrivez le scénario d'exploitation et, si
possible, les étapes de reproduction. Vous recevrez une réponse aussi vite
que possible, et un correctif sera priorisé avant toute divulgation.

## Périmètre

Sont particulièrement sensibles : contournement du cloisonnement des rôles,
accès aux données d'un autre site, contournement de l'authentification par
codes, injection via les champs libres, fuite d'informations vers des tiers.

## Bonnes pratiques de déploiement

HTTPS obligatoire, `SESSION_SECRET` fort et unique, base de données non
exposée publiquement, sauvegardes chiffrées, mises à jour régulières des
dépendances. Voir [docs/RUNBOOK.md](docs/RUNBOOK.md).
