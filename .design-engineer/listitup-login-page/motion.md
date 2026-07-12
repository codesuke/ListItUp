# Motion

## Motion System

- React Bits LineWaves WebGL layer on the left side behind the hero copy.
- Ambient canvas network behind the surface.
- Hover/focus transitions on controls and secondary paths.

## Reduced Motion

The canvas renders a static network when `prefers-reduced-motion: reduce` is set. Controls remain usable without animation.

## Performance Notes

Canvas particle count is capped and scales with surface area. No large image assets are required.
