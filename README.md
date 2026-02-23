# Rocket Typing Defense

Un jeu de typing browser-based en pixel-art où vous défendez votre base centrale contre des roquettes en tapant leur mot avant qu'elles ne vous atteignent.

## Gameplay

- Des roquettes apparaissent depuis les quatre bords de l'écran et foncent vers votre base
- Chaque roquette affiche un mot — tapez-le entièrement pour la détruire
- La roquette ciblée est sélectionnée automatiquement selon le préfixe tapé (en cas d'ambiguïté, la plus proche est choisie)
- Chaque roquette qui touche la base inflige 10 HP de dégâts
- La partie se termine quand la base atteint 0 HP
- Le score est sauvegardé dans un classement top-10 (localStorage)

## Prérequis

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)

```bash
npm install -g pnpm
```

## Installation

```bash
pnpm install
```

## Lancer le jeu

```bash
pnpm dev
```

Ouvrez ensuite [http://localhost:5173](http://localhost:5173) dans votre navigateur.

## Build de production

```bash
pnpm build
```

Les fichiers sont générés dans `dist/`. Pour prévisualiser le build :

```bash
pnpm preview
```

## Commandes disponibles

| Commande          | Description                              |
|-------------------|------------------------------------------|
| `pnpm dev`        | Serveur de développement (HMR)           |
| `pnpm build`      | Build TypeScript + bundle de production  |
| `pnpm preview`    | Prévisualise le build de production      |
| `pnpm typecheck`  | Vérification des types TypeScript        |
| `pnpm lint`       | Lint ESLint                              |

## Contrôles

| Touche      | Action                                      |
|-------------|---------------------------------------------|
| Lettres     | Taper le mot de la roquette ciblée          |
| Backspace   | Effacer le dernier caractère                |
| Entrée      | Démarrer la partie / valider le nom         |

## Progression de la difficulté

| Temps    | Niveau | Mots      | Intervalle de spawn | Vitesse      |
|----------|--------|-----------|---------------------|--------------|
| 0–30s    | 1      | Courts    | 4 s                 | 70 px/s      |
| 30–60s   | 2      | Courts    | 3,35 s              | 85 px/s      |
| 60–90s   | 3      | Moyens    | 2,7 s               | 100 px/s     |
| 90–120s  | 4      | Moyens    | 2,05 s              | 115 px/s     |
| 120–150s | 5      | Longs     | 1,4 s               | 130 px/s     |
| 150s+    | 6      | Longs     | 0,75 s              | 150 px/s     |

## Score

- Chaque roquette détruite rapporte **10 points par caractère** du mot
- Le classement des 10 meilleurs scores est persisté dans le `localStorage` du navigateur

## Structure du projet

```
src/
├── main.ts        # Boucle de jeu, machine d'états, HUD, écrans
├── base.ts        # Entité base (rendu, HP, flash)
├── rocket.ts      # Entité roquette (mouvement, rendu, label)
├── explosion.ts   # Effet d'explosion en particules
└── words.ts       # Dictionnaire de 2435 mots (court/moyen/long)
```

## Stack technique

- **TypeScript** — typage strict
- **Vite** — bundler et serveur de développement
- **HTML5 Canvas** — rendu pixel-art (`imageSmoothingEnabled = false`)
- **localStorage** — persistence du classement
