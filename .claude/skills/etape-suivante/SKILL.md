---
name: etape-suivante
description: Réalise la prochaine étape de docs/BACKLOG.md puis la fait valider par l'agent sawwa-validateur, en corrigeant jusqu'au verdict VALIDÉ. À utiliser quand le porteur dit « next », « suite », « étape suivante ».
---

# Étape suivante (boucle construire → valider)

1. Lis `docs/BACKLOG.md`. S'il existe une étape 🔎 (à valider), commence par la point 4 pour elle.
   Sinon, prends la première étape ⏳ dont les critères ne dépendent pas tous du porteur (🧑‍💼). Si elle dépend
   d'une action du porteur, demande-la-lui en une phrase et prends l'étape suivante faisable.
2. Annonce l'étape en une ligne au porteur, puis réalise-la en respectant `CLAUDE.md`.
   Ne lis que les fichiers utiles. Ajoute les tests demandés par les critères.
3. Quand tout est fait : passe l'étape en 🔎 dans `docs/BACKLOG.md`, mets à jour la documentation, commite et pousse.
4. Lance l'agent `sawwa-validateur` (outil Agent, `subagent_type: "sawwa-validateur"`) avec le numéro de l'étape.
   Si ce type d'agent n'est pas disponible dans la session, lance un agent généraliste en lui donnant pour consigne le
   contenu de `.claude/agents/sawwa-validateur.md`.
5. Si le verdict est **À CORRIGER** : corrige chaque point, commite, pousse, relance le validateur. Trois allers-retours
   maximum ; au-delà, explique le blocage au porteur.
6. Si le verdict est **VALIDÉ** : coche l'étape (✅) dans `docs/BACKLOG.md`, commite et pousse, puis résume au porteur
   en quelques lignes ce qui est fait, ce qui reste en attente de lui, et quelle est l'étape suivante.
