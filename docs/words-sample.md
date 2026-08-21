# Random word generator — 50-word sample (roadmap 2.4 process gate)

Written 2026-08-21 for Jack's sign-off before the remaining 1,950 words get
written. Roughly 12-13 per tier, so the thing being signed off is the
**gradient**, not just the vocabulary.

Constraints checked mechanically: 50 words, all unique, all lowercase a-z,
longest is `cantankerous` at 12 characters (cap is 14).

The category labels below are review aids only. They are an authoring balance
guideline and never get stored in `words.json`.

## Tier 1 — everyday

dog · rain · money · kitchen · angry · run · mother · broken · sunday · leave ·
town · lonely · teeth

Nouns 5, adjective/mood 3, verbs 2, location 1, figure 1, calendar 1.

## Tier 2 — common, a step off the everyday

harbour · thunder · restless · wander · bargain · stranger · hollow · ladder ·
jealous · orchard · velvet · rescue · cathedral

Nouns 5, adjective/mood 3, verbs 2, locations 2, figure 1.

## Tier 3 — less common, still instantly understood

lantern · brittle · smuggler · reckless · tundra · squander · mutiny · feral ·
gallows · atlantis · sulphur · unravel

Nouns 4, adjective/mood 3, verbs 2, geography 1, occupational figure 1, myth 1.

## Tier 4 — rare but vivid

calamitous · cantankerous · gormless · ramshackle · kraken · scoundrel ·
ravenous · treachery · quagmire · curmudgeon · brimstone · maelstrom

Adjectives 5, nouns 5, myth 1, figures 2 (counted across both).

Every tier 4 word here is picturable and sayable on stage. Nothing academic:
`cantankerous` and `curmudgeon` are in, `perspicacious` and `lugubrious` are
out, which is the guard the sample exists to prove.

Recalibrated 2026-08-21 on Jack's note that the tier averaged slightly too
rare. `flotsam`, `malarkey` and `skulduggery` were judged just past the line
and came out; `scoundrel`, `ravenous` and `treachery` replace them, pitched at
the `kraken` / `cantankerous` level he confirmed as the target. The line is
therefore: rare enough that it is not an everyday word, familiar enough that
nobody in the room has to stop and parse it.

## Notes for review

- UK spellings throughout (`harbour`, `sulphur`, `skulduggery`).
- Proper nouns stay inside the archetype/myth/geography rule: `atlantis`,
  `kraken`. No real people, no politically weighted places.
- `sunday` is the only calendar word in the sample. It earns a slot because a
  named day drops a singer straight into a scene, but if it reads as a cheat
  the whole calendar category can come out.
- Reading a banner top to bottom, a sample draw looks like:
  `rain · orchard · gallows · ravenous`.

## Sign-off

- [x] Gradient approved by Jack 2026-08-21, after the tier 4 recalibration
  above. All 2,000 words now live in `data/words.json`; this file stays as the
  record of what the gradient was signed off against.
