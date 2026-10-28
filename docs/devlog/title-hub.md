# Title and hub pass

Working notes for the title screen and the agent hub. The science content, shared motion system, and quality tiers stay as they are.

## What felt thin

- The title wordmark glowed evenly, so the letters read as a flat neon sign. The phone frame had a large empty sky above them.
- Hub case buttons told you they were pressable mainly on hover. The 3D markers grew on hover and did not show a press.
- Idle motion on the title and hub ignored `?still=1`, so a still frame was still mid-orbit.

## What this pass does

- A front key and a cool rear rim sit on the shared deck lights. A floor pool, a horizon band (medium and up), and a small night body fill the title sky. The hub map gets a short light column on medium and up.
- Marker scale and glow come from one function: rest, attention (hover or focus, same result), and press. The round hit target grows up to a cap so it stays at least 44 px when the map is far, without covering the other marker.
- Reduced motion and `?still=1` hold the camera, the logo sweep, the radar, the drone, and the new atmosphere. Dust stays, because its motion lives in the shared floor component.
- Type uses the existing scale. Pressed buttons change fill and shadow, so the cue remains when motion is reduced and transforms are turned off.
