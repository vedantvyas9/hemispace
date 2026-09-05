# Hemispace

A spatial simulation of hemispatial neglect — the stroke condition where half
the world stops being represented by the brain, and the person has no idea.

Not a medical device. Assessment and awareness only.

## Run it

```bash
npm install
npm run dev
```

## Where things live

| file | what it is |
|---|---|
| `src/neglect.js` | **The attention model.** All neglect logic lives here and nowhere else. |
| `src/FirstPerson.jsx` | Pointer-lock controller. Camera forward = body midline. |
| `src/Scene.jsx` | Room, targets, crosshair raycast, dwell-to-register. |
| `src/App.jsx` | Run flow: clean run → neglect run → declare → reveal. |
| `public/scene.json` | The contract with Track B. See `CONTRACT.md`. |
| `convex/schema.ts` | The contract with the live view. |

## Branches

- `main` — shared scaffold
- `track_a` — the experience: controller, neglect model, mechanics, reveal
- `track_b` — world, assets, Convex, results view

Read `CONTRACT.md` before changing either contract.
