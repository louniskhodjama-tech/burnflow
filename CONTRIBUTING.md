# Contribuer à BurnFlow

Merci de votre intérêt ! Retours de terrain, rapports de bogues, corrections,
traductions et données hospitalières vérifiées sont tous bienvenus.
*(English: issues and PRs in English are welcome too.)*

## Démarrer

```bash
git clone https://github.com/louniskhodjama-tech/burnflow.git
cd burnflow
docker compose up -d postgres mailpit
pnpm install && cp .env.example .env.local
pnpm db:migrate && pnpm seed:demo
pnpm dev
```

## Avant d'ouvrir une pull request

1. `pnpm typecheck` et `pnpm test` doivent passer (la CI les rejoue).
2. Pour un changement de comportement, ajoutez ou adaptez les tests
   (`tests/unit/` pour le scoring/routage/rôles, `tests/e2e/` pour les parcours).
3. Gardez le français de l'interface ; les traductions de docs sont bienvenues.
4. Une PR = un sujet. Décrivez le problème avant la solution.

## Règles spécifiques au domaine médical

- **Toute modification de la logique clinique** (`src/lib/burn-scoring.ts`,
  seuils par défaut, classes d'orientation) doit citer une source (ISBI, ABA,
  publication) et sera examinée avec une exigence particulière. Les seuils
  restent configurables par le régulateur de chaque déploiement.
- **Jamais de donnée réelle de patient** dans les issues, PR, captures d'écran
  ou jeux de test — uniquement des données fictives.
- L'outil est une aide à la décision : les PR qui le rendraient prescriptif
  (décision automatique sans validation humaine) seront refusées.

## Idées de contributions utiles

- Données vérifiées d'hôpitaux (`data/*.csv`) pour d'autres wilayas ou pays ;
- profils OSRM et scripts pour d'autres régions ;
- accessibilité, contraste, utilisabilité terrain (gants, plein soleil) ;
- traductions (arabe en priorité) ;
- durcissement sécurité et revues du modèle de permissions.

## Licence des contributions

En soumettant une contribution, vous acceptez qu'elle soit publiée sous la
licence [Apache 2.0](LICENSE) du projet.
