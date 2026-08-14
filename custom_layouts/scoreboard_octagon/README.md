# Octagon scoreboard

Use `scoreboard_octagon/index.html` as a 1920x1080 browser source for
Super Smash Bros. Ultimate.

The center crest uses the bundled Octagon event logo so the tournament identity
is preserved whenever this dedicated layout is selected.

The Captain Octo design combines the venue's sailing and octopus themes with a
warm canvas, brass, navy, purple, and teal palette. All imagery and effects stay
local for reliable OBS playback.

Its compact player bars, score-first hierarchy, centered event crest, and
secondary round strip follow the clarity patterns used by major broadcasts such
as Supernova, S Factor, Get On My Level, and Battle of BC without reproducing
their artwork.

Match and best-of context live in a separate captain's-log card, keeping the
central scoreboard shallow and preserving more vertical gameplay space. Flat
purple and teal score end caps share the player bars' silhouette, with a solid
navy outline and high-contrast white numerals. Score changes use an expanding
brass bell ring, rolling numeral, brass fitting flash, restrained particles, and
a 45-degree turn of the central crest toward the scoring side — the wordmark
counter-rotates so it stays upright. On load, and again whenever a new set is
loaded, the crest takes a longer full-turn helm spin that coasts to a stop under
simulated friction, landing back on its resting pose. All motion has a
reduced-motion fallback. Loading a new set replays the full entrance after both
entrants have rendered, while score-only updates retain the focused score effect.
