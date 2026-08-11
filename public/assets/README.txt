ऑटो वाला · AUTO WALA — drop-in assets
=====================================

auto-rickshaw.png   (required for the vehicle graphic)
    Your supplied flat-illustration auto-rickshaw with driver:
    yellow roof / black body, TRANSPARENT background, PNG.
    Recommended export: ~1600px wide, trimmed tight to the artwork so the
    bottom edge of the wheels is the bottom edge of the image (the component
    anchors it with `object-position: bottom`).

    Until this file exists, RickshawGraphic.jsx shows a subtle dashed
    placeholder instead of a broken image.

horn.mp3            (optional)
    A short (~0.5s) auto-rickshaw honk. If it is missing, HornButton.jsx
    synthesises a three-tone honk with the Web Audio API instead — so the
    horn works either way.

Both paths are configurable in src/lib/theme.js
(RICKSHAW_SRC and HORN_SRC).
