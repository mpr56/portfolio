# Portfolio 

```bash
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle
npm run models     # rebuild public/models from internet3dmodels/
```

## How it fits together

The `<Canvas>` lives outside `<Routes>`, so navigating never tears the scene
down — the route only swaps the DOM panel and tells the camera rig which
framing to ease toward. That continuity is the whole point of the format.

```
src/
  data/scene.ts        layout, camera shots, day/night palettes — start here
  store.ts             zustand: dark mode, mute, hover, playback
  three/
    Experience.tsx     the <Canvas> and everything in it
    Rig.tsx            camera: route framing + pointer parallax
    Lighting.tsx       day/night lights, including the lamp's warm pool
    theme.ts           the shared 0..1 day→night mix all materials sample
    Interactive.tsx    hover contract: cursor, label, lift, click
    Model.tsx          GLB loading, cloning, and part pivots
    props/             one file per object in the scene
  ui/                  HUD, panels, pages
scripts/
  optimize.mjs         raw downloads → web-weight GLBs
  inspect.mjs          size, origin, mesh names, licence of any GLB
  measure.mjs          world bounds of every prop in the *running* scene
  shot.mjs             screenshot the scene (--dark, --focus=x,y,z)
  credits.mjs          regenerate CREDITS.md from model metadata
```

## The asset pipeline

Sketchfab downloads are far too heavy to ship — the raw set here is **174MB**,
mostly 4096² textures. `npm run models` gets that to **~4MB**:

1. `metalRough()` — converts the retired `KHR_materials_pbrSpecularGlossiness`,
   which three.js no longer supports (models using it render untextured white)
2. `normalize()` — isolates one object from files that ship a whole product
   range, then rescales to real metres with the origin at floor-centre
3. texture resize + WebP, geometry simplify, Draco

Because step 2 bakes real-world scale into the asset, the scene code carries no
per-model magic numbers: props sit at their `LAYOUT` position and that's it.

Budgets live in the `MODELS` map in `scripts/optimize.mjs`. If a model won't hit
its triangle target, raise its `error` — meshopt stops early when the error
budget would be exceeded, which silently overrides `ratio`.


## Credits

Model attributions are in [CREDITS.md](CREDITS.md), generated from licence
metadata embedded in the source files. **Several are CC-BY and require visible
attribution wherever this is published.**
