# Open Graph coral art

Cut-outs used as the translucent background on blog cards.

| File | Source | Preparation |
|---|---|---|
| `coral-red.png` | `public/images/coral-red.avif` | black background keyed to alpha, resized to 460 px, 64-colour palette |
| `coral-blue.png` | `public/images/coral-blue.avif` | green background keyed to alpha, resized to 460 px, 64-colour palette |
| `coral-yellow.png` | `public/images/coral-yellow.avif` | green background keyed to alpha, resized to 460 px, 64-colour palette |

`og/render.js` picks one deterministically from the post slug, so a rebuild
never reshuffles the artwork.

Not used:

- `coral-purple.avif` decodes with a corrupted backdrop.
- `top-bar-coral-1.png` and `top-bar-coral-2.png` carry a green-to-dark gradient
  background that a flat colour key leaves as a visible rectangle.
