# HEHE

Static browser game site ready for GitHub Pages.

## Local files

- `index.html`
- `styles.css`
- `game.js`
- `entity1.png`
- `entity1.mp3`

## Publish on GitHub Pages

1. Create a GitHub repository named `HEHE`.
2. Add it as this repo's remote:
   `git remote add origin git@github.com:<your-user>/HEHE.git`
3. Push the `main` branch:
   `git push -u origin main`
4. In GitHub, go to `Settings -> Pages` and confirm the source is `GitHub Actions`.

The included workflow deploys the repository root as a static site on every push to `main`.

