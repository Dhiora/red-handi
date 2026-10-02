# Red Handi restaurant cartoon

Editable Blender source: `redhandi-restaurant.blend` (Blender 4.5).
Procedural source: `build_scene.py`. The supplied restaurant blueprint guided the red polo/cap, black branded apron, chef uniform and beard, seating, materials, and kitchen props. Models are original simplified interpretations for real-time rendering, not an exact reconstruction of the image.

Run from the repository root:

```sh
/path/to/Blender --background --python art/restaurant/build_scene.py -- "$PWD"
```

The script saves the editable scene, then joins static geometry and exports `frontend/public/models/redhandi-restaurant.glb` with Draco compression. It also renders `restaurant-poster.jpg` as a loading/error fallback. The browser renders the GLB with Three.js; the website is not playing a pre-rendered movie.

## Animation

30 fps. Frames 1–109: walk from the kitchen toward the customer. Frames 109–241: inviting greeting and attentive waiting. The browser plays the approach once, then loops frames 121–241 while the customer chooses. Frames 241–481: turn and carry the order slip to the counter. Named hierarchy joints remain editable in Blender. The GLB exporter produces per-object animation channels; `RestaurantScene.js` assembles them into a host clip and a separate looping kitchen clip. The delivery clip starts only when `/inperson` receives the server-confirmed order. `TicketFace` receives a browser-generated texture containing that order's number and items.

The source includes real Red Handi logo and menu imagery, packed in the Blender file and exported GLB. Three.js and Draco are loaded locally. The decoder files in `frontend/public/models/draco` come from the installed Three.js package (see its included README for the Draco Apache 2.0 license).

## Browser behavior

The scene fills the viewport. Mobile uses a closer portrait camera. Rendering is limited to 30 fps and 1.5 device pixel ratio; shadows use 1024px maps. Pause, sound, native fullscreen, replay, and view-bill controls are available. Reduced-motion preferences show the waiter already at the table and show the delivery end pose. Audio is opt-in browser speech synthesis; voice availability depends on the device. Missing WebGL or failed asset loading leaves a rendered poster and the order button available. GPU objects, textures, worker threads, and observers are released when the scene unmounts.

`npm test --prefix frontend` checks the exported GLB structure, movement timing, ticket visibility, and existing confirmation behavior. Visual checks cover desktop/mobile and a local isolated animation preview, without placing a real customer order.
