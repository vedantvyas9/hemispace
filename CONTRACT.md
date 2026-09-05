# Hemispace — the two contracts

Both tracks build against these. Do not change them without telling the other person.

## 1. `public/scene.json`  — produced by Track B, consumed by Track A

```json
{
  "world":  { "splatUrl": null, "colliderUrl": null },
  "spawn":  { "position": [0, 1.6, 0], "yaw": 0 },
  "targets": [
    { "id": "t1", "url": null, "position": [-3.2, 0.9, -4.0], "scale": 1 }
  ]
}
```

- `url: null` means Track A draws a placeholder box. Track B swaps in a Tripo `.glb` path.
- Three.js convention: with `yaw: 0` the camera looks down **-Z**, so **-X is the participant's left**.
- **At least half the targets must sit at negative X relative to spawn**, or the experiment measures nothing.

## 2. Convex tables — produced by Track A, consumed by Track B

| table | fields |
|---|---|
| `sessions` | `code` (string), `run` (`"clean"` \| `"neglect"`), `startedAt` (number), `finishedAt` (number, optional) |
| `poses` | `sessionId`, `t` (ms since start), `yaw` (deg, signed, + is right), `pitch` (deg) |
| `finds` | `sessionId`, `t`, `targetId`, `azimuth` (deg, signed — where it was when it registered) |

Write `poses` at **3 Hz**, not more. One row per tick is fine at this rate; interpolate client-side in the viewer.

## Merge points

1. A has placeholder boxes + B has GLBs → swap `url` in scene.json. Nothing else changes.
2. A emits events + B has the live view → real data flows.
3. B has the Marble world raycasting → swap the grey room. **Do this last.**
