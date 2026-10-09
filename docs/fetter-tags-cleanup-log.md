# Fetter/Tags Frontmatter Cleanup Log

Scope: all discourses under `src/content/en` whose frontmatter still carried the
legacy `fetter:` and `tags:` keys. For each file the legacy keys are removed, and
missing `qualities:` / `theme:` keys are assigned from the site vocabularies
(`src/data/qualities.json`, `src/data/themes.json`, and topic slugs from
`src/pages/topic/_topics/`).

**Curation rule:** a quality or topic is only assigned when the discourse
substantively develops it — through a simile, a cause-and-result structure, a
dependent clarification, or some other expansion — not on a mere mention.

Every change to an English file is mirrored in the frontmatter block of its
Pāli counterpart under `src/content/pli/` (same path, `.md` extension), keeping
the Pāli file's own title, description, and commentary.

Sections: [Non-SN](#non-sn-collections) · [SN batch 1](#sn-batch-1) · [SN batch 2](#sn-batch-2) · [SN batch 3](#sn-batch-3) · [SN batch 4](#sn-batch-4) · [Missing theme pass](#missing-theme-pass)

---

## Non-SN collections

### src/content/en/index.mdx
- Removed `tags:` and `fetter:`. Site landing page — not a discourse; no
  `qualities`/`theme` assigned. No Pāli counterpart exists.

### src/content/en/dhp/dhp90-99.mdx (+ pli mirror)
- Removed `fetter: ignorance` and `tags:`.
- No curation needed — `qualities` and `theme` were already present.

### src/content/en/dhp/dhp100-115.mdx (+ pli mirror)
- Removed `fetter: doubt, ignorance` and `tags:`.
- No curation needed — `qualities` and `theme` already present.

### src/content/en/dhp/dhp116-128.mdx (+ pli mirror)
- Removed `fetter:` (six fetters listed) and `tags:`.
- No curation needed — `qualities` and `theme` already present.

### src/content/en/dhp/dhp129-145.mdx (+ pli mirror)
- Removed `fetter:` (four fetters listed) and `tags:`.
- No curation needed — `qualities` and `theme` already present.

### src/content/en/iti/iti80.mdx (+ pli mirror)
- Removed `fetter: personal existence, ignorance` and `tags:`.
- No curation needed — `qualities` and `theme` already present.

### src/content/en/iti/iti100.mdx (+ pli mirror)
- Removed `fetter: doubt, adherence to rules and observances, ignorance` and `tags:`.
- No curation needed — `qualities` and `theme` already present.

### src/content/en/iti/iti112.mdx (+ pli mirror)
- Removed `fetter: ignorance, doubt` and `tags:`.
- No curation needed — `qualities` and `theme` already present.

### src/content/en/mn/mn20.mdx (+ pli mirror)
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: unwholesome, harm, giving up, collectedness, cultivation`
  — Rationale: the discourse's subject is harmful, unwholesome thoughts
  associated with desire, aversion, and delusion, and the five methods for
  their giving up; the stated result of abandoning them is a mind that is
  internally steady, calmed, unified, and collected. The whole sutta is an
  exercise in cultivating the higher mind.
- Added `theme: training guideline, cultivating discernment`
  — Rationale: the Buddha gives a five-step, gradually-sequenced instruction
  (shifting the sign, examining drawbacks, disregarding, stilling thought
  formations, restraint) for handling unwholesome thoughts.

### src/content/en/mn/mn28.mdx (+ pli mirror)
- Removed `fetter: personal existence, conceit, ignorance` and `tags:`.
- Added `theme: principle`
  — Rationale: the discourse establishes the governing principle that all
  wholesome, purified teachings are encompassed by the Four Noble Truths, then
  works it out through the four elements. (`qualities` was already present.)

### src/content/en/mn/mn39.mdx (+ pli mirror)
- Removed `fetter: doubt` and `tags:`.
- No curation needed — `qualities` and `theme` already present.

### src/content/en/mn/mn61.mdx (+ pli mirror)
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: right speech, ethical conduct, conscience`
  — Rationale: the core teaching is feeling shame at telling an intentional
  lie (truthfulness as the foundation of ethical conduct, elaborated through
  the water-vessel and king's-elephant similes), and reflecting repeatedly on
  the consequences of bodily, verbal, and mental action.
- Added `theme: training guideline, cultivating discernment`
  — Rationale: the Buddha trains Rāhula step by step — truthfulness first,
  then the mirror simile of reflecting repeatedly before, during, and after
  each act of body, speech, and mind.

### src/content/en/snp/snp4.1.mdx (+ pli mirror)
- Removed `fetter: sensual desire` and `tags:`.
- No curation needed — `qualities` and `theme` already present.

### src/content/en/snp/snp4.9.mdx (+ pli mirror)
- Removed `fetter:` (four fetters listed) and `tags:`.
- Added `theme: principle, story`
  — Rationale: the discourse argues the principle that purity is not attained
  through views, rules and observances, or status, and it is framed by the
  narrative of Māgaṇḍiya's offer of his daughter and the closing sage-at-ease
  verses. (`qualities` was already present.)

### src/content/en/ud/ud1.7.mdx (+ pli mirror)
- Removed `fetter:` (four fetters listed) and `tags:`.
- Added `qualities: without fear, giving up`
  — Rationale: the native spirit Ajakalāpaka tries to arouse fear, but the
  verse states the cause-and-result directly: when a sage has gone beyond his
  own attachments, he transcends fear itself — fear is overcome by giving up
  attachments.
- Added `theme: principle, inspiration`
  — Rationale: the utterance states a general principle about the awakened
  one's transcendence, and it is an inspired utterance (udāna) proclaimed at
  the moment of understanding.

### src/content/en/ud/ud2.3.mdx (+ pli mirror)
- Removed `fetter: ill will` and `tags:`.
- Added `qualities: harm, non-harm, happiness`
  — Rationale: the verse is a cause-and-result teaching: one who harms beings
  desiring happiness with a stick does not find happiness after passing away,
  while one who does not harm finds it — harm and non-harm as dependent on the
  wish for happiness.
- Added `theme: principle, inspiration`
  — Rationale: a general kamma principle expressed as an inspired utterance,
  prompted by seeing boys hitting snakes with sticks.

---

SN batch 1 (sn1–sn15, sn12 dependent origination, sn14 elements)

# SN frontmatter cleanup — part 0

### src/content/en/sn/sn1.16.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: drowsiness, dullness, discontentment, vigour` — Rationale: The verse presents a cause–result chain: excessive sleep, sluggishness, yawning, discontent, and post-meal drowsiness are the causes for which "the noble path does not appear," and dispelling them "with energy" (vīriya) clears the path, so the obstructing states and the energy countering them are the substance of the discourse.
- Added `theme: principle` — Rationale: A general cause–effect truth about what obscures and what clears the noble path.
- Mirrored to `src/content/pli/sn/sn1.16.md`.

### src/content/en/sn/sn1.19.mdx
- Removed `fetter: personal existence, conceit, ignorance` and `tags:`.
- Added `qualities: craving, attachment, free from attachment` — Rationale: The Q&A dependently clarifies each image — the "little hut" is a mother, the "nest" a wife, the "ties that extend" children, and "bondage" is craving — so craving/attachment and the freedom from it are what the dialogue substantively develops.
- Added `theme: principle` — Rationale: A general truth stated through verse: craving is bondage, and freedom from it is the happy state.
- Mirrored to `src/content/pli/sn/sn1.19.md`.

### src/content/en/sn/sn12.1.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: ignorance, craving, intentional-constructs, dependent-co-arising, arising-and-passing-away` — Rationale: The discourse teaches the twelve links of dependent co-arising from ignorance through craving and clinging to birth, aging and death, and then their ending — the arising and ending of the whole heap of suffering is dependently clarified link by link.
- Added `theme: principle` — Rationale: A systematic statement of the general truth of how suffering arises and ceases.
- Mirrored to `src/content/pli/sn/sn12.1.md`.

### src/content/en/sn/sn12.4.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: radical attention, insight, vision` — Rationale: The repeated refrain "through radical attention, insight arose for Bodhisatta Vipassī with this breakthrough" presents radical attention as the cause of the insight and vision through which each link's arising and ending was discovered.
- Added `theme: directly knowing` — Rationale: An experiential discovery of dependent co-arising "concerning doctrine previously unheard of."
- Mirrored to `src/content/pli/sn/sn12.4.md`.

### src/content/en/sn/sn12.5.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: radical attention, insight, vision` — Rationale: The repeated refrain "through radical attention, insight arose for Bodhisatta Sikhī with this breakthrough" presents radical attention as the cause of the insight and vision through which each link's arising and ending was discovered.
- Added `theme: directly knowing` — Rationale: An experiential discovery of dependent co-arising "concerning doctrine previously unheard of."
- Mirrored to `src/content/pli/sn/sn12.5.md`.

### src/content/en/sn/sn12.6.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: radical attention, insight, vision` — Rationale: The repeated refrain "through radical attention, insight arose for Bodhisatta Vessabhū with this breakthrough" presents radical attention as the cause of the insight and vision through which each link's arising and ending was discovered.
- Added `theme: directly knowing` — Rationale: An experiential discovery of dependent co-arising "concerning doctrine previously unheard of."
- Mirrored to `src/content/pli/sn/sn12.6.md`.

### src/content/en/sn/sn12.7.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: radical attention, insight, vision` — Rationale: The repeated refrain "through radical attention, insight arose for Bodhisatta Kakusandha with this breakthrough" presents radical attention as the cause of the insight and vision through which each link's arising and ending was discovered.
- Added `theme: directly knowing` — Rationale: An experiential discovery of dependent co-arising "concerning doctrine previously unheard of."
- Mirrored to `src/content/pli/sn/sn12.7.md`.

### src/content/en/sn/sn12.8.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: radical attention, insight, vision` — Rationale: The repeated refrain "through radical attention, insight arose for Bodhisatta Koṇāgamana with this breakthrough" presents radical attention as the cause of the insight and vision through which each link's arising and ending was discovered.
- Added `theme: directly knowing` — Rationale: An experiential discovery of dependent co-arising "concerning doctrine previously unheard of."
- Mirrored to `src/content/pli/sn/sn12.8.md`.

### src/content/en/sn/sn12.9.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: radical attention, insight, vision` — Rationale: The repeated refrain "through radical attention, insight arose for Bodhisatta Kassapa with this breakthrough" presents radical attention as the cause of the insight and vision through which each link's arising and ending was discovered.
- Added `theme: directly knowing` — Rationale: An experiential discovery of dependent co-arising "concerning doctrine previously unheard of."
- Mirrored to `src/content/pli/sn/sn12.9.md`.

### src/content/en/sn/sn12.10.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: radical attention, insight, vision, true knowledge` — Rationale: The repeated refrain "through radical attention, insight arose in me with this breakthrough" presents radical attention as the cause of insight, and the refrain "'Arising, arising' … vision, insight, wisdom, true knowledge, and clarity arose in me" names true knowledge as the result.
- Added `theme: directly knowing` — Rationale: The Buddha's own experiential discovery of dependent co-arising before awakening.
- Mirrored to `src/content/pli/sn/sn12.10.md`.

### src/content/en/sn/sn12.12.mdx
- Removed `fetter: personal existence, conceit, ignorance` and `tags:`.
- Added `qualities: craving, attachment, intentional-constructs, dependent-co-arising` — Rationale: The Buddha rejects the agentive questions ("who consumes?", "who craves?") and reformulates them dependently — nutriments are supports for renewed existence and the chain from craving to clinging, existence, and birth is developed with no consumer or agent anywhere.
- Added `theme: principle` — Rationale: A general cause-and-effect account of experience as a process rather than an agentive sequence.
- Mirrored to `src/content/pli/sn/sn12.12.md`.

### src/content/en/sn/sn12.15.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `theme: principle` — Rationale: The Buddha states a general truth about the world's duality of existence and non-existence and teaches the middle way of dependent co-arising as the definition of right view.
- Mirrored to `src/content/pli/sn/sn12.15.md`.

### src/content/en/sn/sn12.19.mdx
- Removed `fetter: doubt, personal existence, conceit, ignorance` and `tags:`.
- Added `qualities: immaturity, wisdom, ignorance, craving, suffering` — Rationale: A comparative teaching: both the immature and the wise have a body arisen through ignorance and craving, but because the immature person has not fulfilled the spiritual life they fare on to a new body, while the wise person is freed from suffering — the wisdom-versus-immaturity contrast is the developed distinction.
- Added `theme: cultivating discernment` — Rationale: A systematic dichotomy between the immature and the wise person.
- Mirrored to `src/content/pli/sn/sn12.19.md`.

### src/content/en/sn/sn12.23.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: faith, joy, collectedness, disenchantment, dispassion, liberation` — Rationale: Each factor is presented as the proximate cause of the next — suffering conditions faith, faith joy, joy uplifting joy, tranquility, ease, collectedness, knowledge-and-vision, disenchantment, dispassion, liberation, and finally knowledge of the wearing away of the taints — illustrated by the mountain-downpour simile.
- Added `theme: principle` — Rationale: A universal chain of conditionality stated as proximate causes leading to the end of the taints.
- Mirrored to `src/content/pli/sn/sn12.23.md`.

### src/content/en/sn/sn12.51.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `theme: cultivating discernment` — Rationale: A step-by-step systematic examination in which the bhikkhu investigates each link's source, arising, characteristic, and ending as the method for the complete cessation of suffering.
- Mirrored to `src/content/pli/sn/sn12.51.md`.

### src/content/en/sn/sn12.52.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `theme: principle` — Rationale: A general cause–effect law illustrated by the bonfire simile: perceiving gratification feeds craving like fuel on a fire, while perceiving drawback extinguishes it through the links to cessation.
- Mirrored to `src/content/pli/sn/sn12.52.md`.

### src/content/en/sn/sn12.59.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `theme: principle` — Rationale: A general cause–effect truth illustrated by the great-tree simile: perceiving enjoyment in fetter-basis things gives descent of consciousness, while perceiving drawback cuts it at the root.
- Mirrored to `src/content/pli/sn/sn12.59.md`.

### src/content/en/sn/sn14.11.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `theme: principle` — Rationale: The discourse enumerates the seven elements and states general truths about them — each is discerned in dependence on its opposite and each is realized as a specific kind of attainment.
- Mirrored to `src/content/pli/sn/sn14.11.md`.

### src/content/en/sn/sn14.12.mdx
- Removed `fetter: sensual desire, ill will` and `tags:`.
- Mirrored to `src/content/pli/sn/sn14.12.md`.

### src/content/en/sn/sn14.30.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: form` — Rationale: The discourse substantively defines the four great elements — earth, water, fire, and wind — the constituents of material form.
- Added `theme: principle` — Rationale: A brief definitional teaching of foundational terms.
- Mirrored to `src/content/pli/sn/sn14.30.md`.

### src/content/en/sn/sn14.31.mdx
- Removed `fetter: sensual desire, ignorance` and `tags:`.
- Added `qualities: perceiving gratification, perceiving drawback, discerning escape` — Rationale: The Bodhisatta's pre-awakening reflection is structured entirely around finding the gratification, the drawback, and the escape in each of the four elements.
- Added `theme: directly knowing` — Rationale: The Buddha's own direct realization before awakening.
- Mirrored to `src/content/pli/sn/sn14.31.md`.

### src/content/en/sn/sn14.32.mdx
- Removed `fetter: sensual desire, ignorance` and `tags:`.
- Added `qualities: perceiving gratification, perceiving drawback, discerning escape, direct knowledge` — Rationale: The Buddha recounts directly experiencing the gratification, drawback, and escape in each element, each "thoroughly seen by me with wisdom."
- Added `theme: directly knowing` — Rationale: The Buddha's firsthand experiential investigation of the four elements.
- Mirrored to `src/content/pli/sn/sn14.32.md`.

### src/content/en/sn/sn14.35.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: delight, suffering, liberation` — Rationale: A cause and its result: delighting in each of the four elements is delighting in what is subject to suffering and blocks freedom from suffering, while not delighting in them is what frees.
- Added `theme: principle` — Rationale: A general cause–effect truth repeated through the four elements.
- Mirrored to `src/content/pli/sn/sn14.35.md`.

### src/content/en/sn/sn14.36.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: suffering, ending` — Rationale: Both poles are developed: the arising of the four elements is the arising of suffering, the persistence of disease, and the appearance of aging and death, and their cessation is the cessation of suffering.
- Added `theme: principle` — Rationale: A general identity stated between the elements' arising/ending and suffering's arising/ending.
- Mirrored to `src/content/pli/sn/sn14.36.md`.

### src/content/en/sn/sn14.37.mdx
- Removed `fetter: sensual desire, ignorance` and `tags:`.
- Added `qualities: perceiving gratification, perceiving drawback, discerning escape` — Rationale: Understanding these three in the four elements is the stated criterion for being a true ascetic or brahmin who attains the goal by direct knowledge in this very life.
- Added `theme: principle` — Rationale: A general criterion of true asceticism and brahminhood.
- Mirrored to `src/content/pli/sn/sn14.37.md`.

### src/content/en/sn/sn14.38.mdx
- Removed `fetter: sensual desire, ignorance` and `tags:`.
- Added `qualities: perceiving gratification, perceiving drawback, discerning escape, recognition of impermanence` — Rationale: Adds the arising and passing away of the four elements — their impermanence — to the gratification/drawback/escape triad as the criterion for attaining the goal.
- Added `theme: principle` — Rationale: A general criterion of true asceticism and brahminhood.
- Mirrored to `src/content/pli/sn/sn14.38.md`.

### src/content/en/sn/sn14.39.mdx
- Removed `fetter: sensual desire, desire for fine-material existence, desire for immaterial existence, ignorance` and `tags:`.
- Added `qualities: suffering, ending, cultivation` — Rationale: Understanding each element's arising, cessation, and the way of practice leading to its ending is the criterion for attaining the goal, so both the ending of suffering and the practice that cultivates it are substantively developed.
- Added `theme: principle` — Rationale: A general criterion of true asceticism and brahminhood.
- Mirrored to `src/content/pli/sn/sn14.39.md`.

### src/content/en/sn/sn14.6.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: recognition of diversity, form` — Rationale: The discourse substantively teaches the "diversity of elements" — the six external bases of form, sound, odor, taste, tangibles, and mental objects.
- Added `theme: principle` — Rationale: A definitional teaching of what the diversity of elements is.
- Mirrored to `src/content/pli/sn/sn14.6.md`.

### src/content/en/sn/sn15.1.mdx
- Removed `fetter: sensual desire, desire for fine-material existence, ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: The discourse closes with the developed result: because saṁsāra's beginning is inconceivable — illustrated by the simile of marking grass and sticks for each mother — "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The inconceivable span of saṁsāra and the charnel ground filled with one's bones press the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.1.md`.

### src/content/en/sn/sn15.2.mdx
- Removed `fetter: sensual desire, desire for fine-material existence, ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: The discourse closes with the developed result: because saṁsāra's beginning is inconceivable — illustrated by the simile of clay balls marking each father — "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The inconceivable span of saṁsāra and the charnel ground filled with one's bones press the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.2.md`.

### src/content/en/sn/sn15.5.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: The discourse closes with the developed result: because saṁsāra's beginning is inconceivable — illustrated by the simile of wearing away a solid rock mountain with fine Kāsi cloth once a century — "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The vastness of even a single aeon of wandering emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.5.md`.

### src/content/en/sn/sn15.11.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: Seeing anyone faring badly leads to the developed conclusion that you too have suffered likewise over the inconceivable span of saṁsāra, so "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The charnel ground filled with one's bones over countless lives emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.11.md`.

### src/content/en/sn/sn15.12.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: Seeing anyone faring well leads to the developed conclusion that you too have experienced the same over the inconceivable span of saṁsāra, so "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The charnel ground filled with one's bones over countless lives emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.12.md`.

### src/content/en/sn/sn15.14.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: Because it is not easy to find a being who has not been your mother over the inconceivable span of saṁsāra, the discourse concludes "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The charnel ground filled with one's bones over countless lives emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.14.md`.

### src/content/en/sn/sn15.15.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: Because it is not easy to find a being who has not been your father over the inconceivable span of saṁsāra, the discourse concludes "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The charnel ground filled with one's bones over countless lives emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.15.md`.

### src/content/en/sn/sn15.16.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: Because it is not easy to find a being who has not been your brother over the inconceivable span of saṁsāra, the discourse concludes "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The charnel ground filled with one's bones over countless lives emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.16.md`.

### src/content/en/sn/sn15.17.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: Because it is not easy to find a being who has not been your sister over the inconceivable span of saṁsāra, the discourse concludes "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The charnel ground filled with one's bones over countless lives emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.17.md`.

### src/content/en/sn/sn15.18.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: Because it is not easy to find a being who has not been your son over the inconceivable span of saṁsāra, the discourse concludes "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The charnel ground filled with one's bones over countless lives emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.18.md`.

### src/content/en/sn/sn15.19.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, liberation` — Rationale: Because it is not easy to find a being who has not been your daughter over the inconceivable span of saṁsāra, the discourse concludes "it is enough to become disenchanted, detached, and liberated."
- Added `theme: urgency` — Rationale: The charnel ground filled with one's bones over countless lives emphasizes the immediacy of practice.
- Mirrored to `src/content/pli/sn/sn15.19.md`.

SN batch 2 (sn15–sn17, sn20, sn22 aggregates, sn3, sn33, sn34)

### src/content/en/sn/sn15.6.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: suffering, disenchantment, dispassion, liberation` — Rationale: The mustard-seed simile concretizes the inconceivable length of an aeon, and the discourse closes by presenting disenchantment, dispassion, and liberation from all conditions as the fitting response to the suffering already endured across beginningless saṁsāra.
- Added `theme: urgency, principle` — Rationale: Establishes the principle that saṁsāra has an inconceivable beginning — ignorance and craving as cause — and presses urgency: it is enough to become disenchanted and free.
- Mirrored to `src/content/pli/sn/sn15.6.md`.

### src/content/en/sn/sn15.7.mdx
- Removed `fetter: sensual desire, desire for fine-material existence, desire for immaterial existence, ignorance` and `tags:`.
- Added `qualities: suffering, disenchantment, dispassion, liberation` — Rationale: The simile of four hundred-year disciples each recollecting a hundred thousand aeons daily and still unable to count them conveys the vastness of saṁsāra, ending with the exhortation to disenchantment, dispassion, and liberation from all conditions.
- Added `theme: urgency, principle` — Rationale: Establishes the principle that saṁsāra has an inconceivable beginning and urges disenchantment in view of the immeasurable suffering already endured.
- Mirrored to `src/content/pli/sn/sn15.7.md`.

### src/content/en/sn/sn15.9.mdx
- Removed `fetter: sensual desire, desire for fine-material existence, desire for immaterial existence, conceit, ignorance` and `tags:`.
- Added `qualities: suffering, disenchantment, dispassion, liberation` — Rationale: The stick simile shows beings, obstructed by ignorance and fettered by craving, tumbling between this world and the next like a stick landing on either end, culminating in the exhortation to disenchantment, dispassion, and liberation.
- Added `theme: urgency, principle` — Rationale: Presents the principle that saṁsāra has no evident first point, with urgency since immeasurable suffering has already been endured.
- Mirrored to `src/content/pli/sn/sn15.9.md`.

### src/content/en/sn/sn17.1.mdx
- Removed `fetter: sensual desire, conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: perceiving drawback, giving up` — Rationale: Acquisitions, respect, and popularity are presented as the cause that obstructs the unsurpassed safety from bondage, and the discourse closes with the training to abandon them so they do not occupy the mind.
- Added `theme: training guideline, urgency` — Rationale: An explicit “you should train yourselves” instruction, delivered with urgency since these acquisitions block the highest safety.
- Mirrored to `src/content/pli/sn/sn17.1.md`.

### src/content/en/sn/sn17.10.mdx
- Removed `fetter: conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: perceiving drawback, collectedness, giving up` — Rationale: The Buddha presents the result of being overwhelmed by respect or disrespect — rebirth in a state of loss and hell — while the closing verse praises unwavering collectedness with a boundless mind as what makes one a true person.
- Added `theme: training guideline, urgency` — Rationale: An explicit training instruction backed by the urgent consequence of hell for the mind consumed by honor or dishonor.
- Mirrored to `src/content/pli/sn/sn17.10.md`.

### src/content/en/sn/sn17.11.mdx
- Removed `fetter: sensual desire, conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: perceiving drawback, sincerity, giving up` — Rationale: The golden-bowl simile shows how gain, respect, and popularity cause even one who would not deliberately lie for them to later speak deliberate lies — a concrete drawback — closed with the training to abandon them.
- Added `theme: training guideline` — Rationale: An explicit “you should train yourselves” instruction on not letting acquisitions occupy the mind.
- Mirrored to `src/content/pli/sn/sn17.11.md`.

### src/content/en/sn/sn17.12.mdx
- Removed `fetter: sensual desire, conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: perceiving drawback, sincerity, giving up` — Rationale: The silver-bowl simile shows how gain, respect, and popularity cause even one who would not deliberately lie for them to later speak deliberate lies — a concrete drawback — closed with the training to abandon them.
- Added `theme: training guideline` — Rationale: An explicit “you should train yourselves” instruction on not letting acquisitions occupy the mind.
- Mirrored to `src/content/pli/sn/sn17.12.md`.

### src/content/en/sn/sn17.13-20.mdx
- Removed `fetter: sensual desire, conceit, personal existence, desire for fine-material existence, desire for immaterial existence, ignorance` and `tags:`.
- Mirrored to `src/content/pli/sn/sn17.13-20.md`.

### src/content/en/sn/sn17.2.mdx
- Removed `fetter: sensual desire, conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: perceiving drawback, giving up` — Rationale: The baited-hook simile identifies gain, respect, and popularity as Māra's hook: the bhikkhu who relishes them has swallowed the hook and meets misfortune and disaster, prompting the training to abandon them.
- Added `theme: training guideline, urgency` — Rationale: An explicit training instruction with the urgent image of Māra the Evil One doing with him as he wishes.
- Mirrored to `src/content/pli/sn/sn17.2.md`.

### src/content/en/sn/sn17.4.mdx
- Removed `fetter: sensual desire, conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: perceiving drawback, giving up` — Rationale: The wooly goat in a thicket of thorns pictures the bhikkhu overwhelmed by gain, attached, caught, and trapped here and there, ending in misfortune and disaster, prompting the training to abandon them.
- Added `theme: training guideline, urgency` — Rationale: An explicit training instruction with the urgent image of entanglement and disaster.
- Mirrored to `src/content/pli/sn/sn17.4.md`.

### src/content/en/sn/sn17.5.mdx
- Removed `fetter: sensual desire, conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: conceit, harm, giving up` — Rationale: The dung-beetle simile dramatizes how gain breeds conceit — the bhikkhu boasts and looks down on well-behaved bhikkhus — leading to harm and suffering for that misguided person for a long time, prompting the training to abandon them.
- Added `theme: training guideline, urgency` — Rationale: An explicit training instruction with the urgent warning of prolonged harm and suffering.
- Mirrored to `src/content/pli/sn/sn17.5.md`.

### src/content/en/sn/sn17.6.mdx
- Removed `fetter: sensual desire, conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: perceiving drawback, giving up` — Rationale: The thunderbolt simile casts acquisitions, respect, and popularity as a bolt that strikes the trainee whose mind has not yet reached the goal, prompting the training to abandon them.
- Added `theme: training guideline` — Rationale: An explicit “you should train yourselves” instruction on not letting acquisitions occupy the mind.
- Mirrored to `src/content/pli/sn/sn17.6.md`.

### src/content/en/sn/sn17.7.mdx
- Removed `fetter: sensual desire, conceit, personal existence, ignorance` and `tags:`.
- Added `qualities: perceiving drawback, giving up` — Rationale: The poison-dipped dart simile pictures gain, respect, and popularity as a barbless dart smeared with venom that strikes the trainee, prompting the training to abandon them.
- Added `theme: training guideline` — Rationale: An explicit “you should train yourselves” instruction on not letting acquisitions occupy the mind.
- Mirrored to `src/content/pli/sn/sn17.7.md`.

### src/content/en/sn/sn20.1.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: ignorance, diligence` — Rationale: The peaked-roof simile presents a cause-result structure: all unwholesome qualities have ignorance as their root, converge upon it, and are eradicated with its eradication, leading to the training to dwell diligently.
- Added `theme: principle, training guideline` — Rationale: States the principle that ignorance is the root of all unwholesome states, then gives a concrete training guideline: dwell diligently.
- Mirrored to `src/content/pli/sn/sn20.1.md`.

### src/content/en/sn/sn20.10.mdx
- Removed `fetter: sensual desire, ignorance` and `tags:`.
- Added `qualities: mindfulness, sense restraint, passion` — Rationale: The cat-and-mouse simile shows the unguarded bhikkhu invaded by lust on seeing a scantily clad woman, resulting in death or deadly suffering, prompting the training to enter villages guarded, with mindfulness set up and faculties restrained.
- Added `theme: training guideline, urgency` — Rationale: An explicit training guideline underlined by the urgent outcome of death or deadly suffering in the Noble One's Vinaya.
- Mirrored to `src/content/pli/sn/sn20.10.md`.

### src/content/en/sn/sn20.11.mdx
- Removed `fetter: personal existence, ill will, conceit, ignorance` and `tags:`.
- Added `qualities: diligence` — Rationale: The mange-ridden jackal simile says even such a rebirth would be fortunate for one falsely claiming to be the Buddha's follower, pressing the training to dwell diligently.
- Added `theme: urgency, training guideline` — Rationale: An urgent warning against false followership, sealed with the explicit training guideline to dwell diligently.
- Mirrored to `src/content/pli/sn/sn20.11.md`.

### src/content/en/sn/sn20.2.mdx
- Removed `fetter: ignorance, doubt` and `tags:`.
- Added `qualities: diligence` — Rationale: The fingernail-dust simile establishes the extreme rarity of human rebirth against the great earth of other rebirths, prompting the training to dwell diligently.
- Added `theme: urgency` — Rationale: Urgency: the improbability of the human state leaves no room for complacency.
- Mirrored to `src/content/pli/sn/sn20.2.md`.

### src/content/en/sn/sn20.3.mdx
- Removed `fetter: ill will, ignorance` and `tags:`.
- Added `qualities: loving-kindness, cultivation` — Rationale: The household simile draws a direct cause-effect parallel: an undeveloped release of mind through loving-kindness is easily overwhelmed by non-humans, while a well-developed one is hard to overcome, prompting the training to develop it as a vehicle and basis.
- Added `theme: training guideline` — Rationale: An explicit training guideline for developing the release of mind through loving-kindness.
- Mirrored to `src/content/pli/sn/sn20.3.md`.

### src/content/en/sn/sn20.4.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: loving-kindness, cultivation, giving` — Rationale: The discourse compares cultivating loving-kindness for the brief moment of milking a cow with a hundred pots given three times a day, concluding the cultivation yields far greater fruit, prompting the training to develop the release of mind through loving-kindness.
- Added `theme: training guideline` — Rationale: An explicit training guideline grounded in the comparative fruit of loving-kindness versus giving.
- Mirrored to `src/content/pli/sn/sn20.4.md`.

### src/content/en/sn/sn20.6.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: diligence` — Rationale: The archer simile escalates through ever-faster speeds to the point that the wearing away of the vital formations outpaces them all, prompting the training to dwell diligently.
- Added `theme: urgency, training guideline` — Rationale: Urgency — the life force is being exhausted faster than can be imagined — sealed with a training guideline.
- Mirrored to `src/content/pli/sn/sn20.6.md`.

### src/content/en/sn/sn20.7.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: learning` — Rationale: The cracked-drum simile warns that the profound discourses connected with emptiness will disappear as future bhikkhus favor poetical compositions of outsiders, prompting the training to listen, learn, and master them.
- Added `theme: urgency, training guideline` — Rationale: Urgency about the disappearance of the profound Dhamma, with an explicit guideline to lend an ear and master it.
- Mirrored to `src/content/pli/sn/sn20.7.md`.

### src/content/en/sn/sn20.8.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: diligence, continuous effort` — Rationale: The Licchavī simile draws the cause-effect parallel that dwelling diligent and with continuous effort leaves Māra no foothold, while future softness and comfort will give him opportunity, prompting the training to dwell with wooden pillows, diligent and striving.
- Added `theme: training guideline, urgency` — Rationale: An explicit training guideline, urgent in view of Māra's future opportunity.
- Mirrored to `src/content/pli/sn/sn20.8.md`.

### src/content/en/sn/sn20.9.mdx
- Removed `fetter: sensual desire, ignorance` and `tags:`.
- Added `qualities: free from attachment, perceiving drawback, discerning escape` — Rationale: The bull-elephant simile contrasts elders who use acquisitions untied, not fixated, seeing the danger in them and understanding the escape, with immature elephants who eat the lotus stalks unwashed and meet deadly suffering, prompting the same training.
- Added `theme: training guideline` — Rationale: An explicit training guideline on using acquisitions without being tied to them or fixated on them.
- Mirrored to `src/content/pli/sn/sn20.9.md`.

### src/content/en/sn/sn22.58.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: dispassion, liberation, wisdom` — Rationale: Both the Sammāsambuddha and the wisdom-liberated bhikkhu are defined by liberation through dispassion, the fading of, and complete ending of desire for each of the five aggregates; only the Tathāgata's role as originator of the path distinguishes them.
- Added `theme: cultivating discernment` — Rationale: A comparative teaching that systematically distinguishes the perfectly Awakened One from the wisdom-liberated disciple.
- Mirrored to `src/content/pli/sn/sn22.58.md`.

### src/content/en/sn/sn22.63.mdx
- Removed `fetter: personal existence, sensual desire, ill will, conceit, ignorance` and `tags:`.
- Added `qualities: attachment, free from attachment` — Rationale: The Buddha's brief statement sets a direct cause-result: in clinging to each of the five aggregates one is bound by Māra, by not clinging one is freed from the Evil One — which the bhikkhu confirms and lives out to arahantship.
- Added `theme: principle` — Rationale: A general principle of bondage and freedom, stated as cause and result.
- Mirrored to `src/content/pli/sn/sn22.63.md`.

### src/content/en/sn/sn22.78.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `theme: urgency` — Rationale: The lion's-roar simile conveys the urgency that even long-lived, happy deities are unstable, not enduring, not everlasting — they tremble at the teaching of the arising and passing away of the aggregates.
- Mirrored to `src/content/pli/sn/sn22.78.md`.

### src/content/en/sn/sn22.89.mdx
- Removed `fetter: conceit` and `tags:`.
- Added `theme: story, cultivating discernment` — Rationale: A narrative account of Khemaka's illness and the exchanges with the elders, which systematically examines the residual “I am” conceit apart from the five aggregates, likened to the scent of a flower and a residual odor on a washed cloth.
- Mirrored to `src/content/pli/sn/sn22.89.md`.

### src/content/en/sn/sn22.94.mdx
- Removed `fetter: doubt, adherence to rules and observances, personal existence, conceit, ignorance` and `tags:`.
- Added `qualities: recognition of impermanence, recognition of unsatisfactoriness, immaturity` — Rationale: The discourse defines the aggregates' actual characteristics — impermanent, unsatisfactory, subject to change — as what the wise accept as existing, while one who fails to know or see this is called immature, blind, without vision.
- Added `theme: principle, cultivating discernment` — Rationale: States the principle of what the wise accept as existing and not existing, in a dichotomy between the wise and the immature.
- Mirrored to `src/content/pli/sn/sn22.94.md`.

### src/content/en/sn/sn3.13.mdx
- Removed `fetter: adherence to rules and observances` and `tags:`.
- Added `qualities: mindfulness, sense restraint` — Rationale: The verse prescribes being always mindful and knowing moderation in eating as the cause whose result is fading discomfort and slow aging, and the narrative shows King Pasenadi slimming down by applying it daily.
- Added `theme: training guideline, story` — Rationale: A training guideline on mindful, moderate eating delivered within a story about King Pasenadi.
- Mirrored to `src/content/pli/sn/sn3.13.md`.

### src/content/en/sn/sn3.17.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: diligence, merit` — Rationale: Diligence is presented as the single Dhamma whose accomplishment results in both present-life and future welfare, as all footprints fit into the elephant's footprint; the verse adds that the wise and diligent gain deeds of merit and both benefits.
- Added `theme: principle, householder life` — Rationale: A general cause-effect principle on two-fold welfare, addressed to King Pasenadi as a lay ruler.
- Mirrored to `src/content/pli/sn/sn3.17.md`.

### src/content/en/sn/sn3.25.mdx
- Removed `fetter: doubt, adherence to rules and observances, personal existence, ignorance` and `tags:`.
- Added `theme: urgency` — Rationale: Mountains advancing from all four directions as the simile of inevitable aging and death makes the case that the Dhamma must be lived now — no battle of elephants, wits, or wealth can hold them back.
- Mirrored to `src/content/pli/sn/sn3.25.md`.

### src/content/en/sn/sn3.3.mdx
- Removed `fetter: doubt, personal existence, conceit, ignorance` and `tags:`.
- Added `qualities: recollection of death, suffering` — Rationale: The discourse establishes that for anyone born — affluent aristocrats, brahmins, householders, even arahants — the result is aging and death, the breaking up and laying down of this body.
- Added `theme: urgency, principle` — Rationale: States the principle that aging and death follow birth for all, with urgency since no wealth or status escapes it.
- Mirrored to `src/content/pli/sn/sn3.3.md`.

### src/content/en/sn/sn3.6.mdx
- Removed `fetter: ignorance, sensual desire` and `tags:`.
- Added `qualities: conceit, negligence, sensual desire` — Rationale: King Pasenadi's reflection, confirmed by the Buddha, is that few wealthy people avoid becoming arrogant, negligent, obsessed with sensual pleasures, or wronging others — the deer-in-the-trap verse shows the painful result of indulgence.
- Added `theme: principle` — Rationale: A general principle about the rarity of restraint amid great wealth.
- Mirrored to `src/content/pli/sn/sn3.6.md`.

### src/content/en/sn/sn33.2.mdx
- Removed `fetter: ignorance,personal existence` and `tags:`.
- Added `qualities: ignorance` — Rationale: The Buddha gives the direct cause: it is from not knowing feeling, its arising, its cessation, and the practice leading to its cessation that the various speculative views arise in the world.
- Added `theme: principle` — Rationale: A cause-and-condition principle explaining the origin of speculative views.
- Mirrored to `src/content/pli/sn/sn33.2.md`.

### src/content/en/sn/sn33.3.mdx
- Removed `fetter: ignorance,personal existence` and `tags:`.
- Added `theme: principle` — Rationale: A cause-and-condition principle: not knowing perception, its arising, cessation, and the path to its cessation is the origin of the various speculative views.
- Mirrored to `src/content/pli/sn/sn33.3.md`.

### src/content/en/sn/sn33.4.mdx
- Removed `fetter: ignorance,personal existence` and `tags:`.
- Added `theme: principle` — Rationale: A cause-and-condition principle: not knowing intentional constructs, their arising, cessation, and the path to their cessation is the origin of the various speculative views.
- Mirrored to `src/content/pli/sn/sn33.4.md`.

### src/content/en/sn/sn33.5.mdx
- Removed `fetter: ignorance,personal existence` and `tags:`.
- Added `theme: principle` — Rationale: A cause-and-condition principle: not knowing consciousness, its arising, cessation, and the path to its cessation is the origin of the various speculative views.
- Mirrored to `src/content/pli/sn/sn33.5.md`.

### src/content/en/sn/sn33.6-10.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: ignorance` — Rationale: The Buddha gives the direct cause: it is from not seeing each of the five aggregates, their arising, cessation, and the practice leading to their cessation, that the various speculative views arise in the world.
- Added `theme: principle` — Rationale: A cause-and-condition principle explaining the origin of speculative views.
- Mirrored to `src/content/pli/sn/sn33.6-10.md`.

### src/content/en/sn/sn34.1.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: collectedness` — Rationale: The fourfold typology ranks meditators by skill in collectedness and in attainment based on collectedness, with the milk-to-ghee simile crowning the one skilled in both as foremost.
- Added `theme: cultivating discernment` — Rationale: A systematic comparative classification of the four types of meditators.
- Mirrored to `src/content/pli/sn/sn34.1.md`.

SN batch 3 (sn35 sense bases, sn43–sn45, sn46, sn51)

# SN Frontmatter Cleanup — Part 2 (batch 02)

### src/content/en/sn/sn34.2.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: collectedness, cultivation` — Rationale: The discourse develops skill in collectedness and its continuity through a four-way typology of meditators, with the milk→curd→butter→ghee simile presenting progressive refinement of collectedness as the result of cultivation.
- Added `theme: principle` — Rationale: A general evaluative truth ranking meditators by skill in collectedness, not a step-by-step instruction.
- Mirrored to `src/content/pli/sn/sn34.2.md`.

### src/content/en/sn/sn34.3.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: collectedness, cultivation` — Rationale: The discourse develops skill in collectedness and in emergence from collectedness via the four-meditator typology, with the ghee simile presenting the fully skilled meditator as the progressive result of development.
- Added `theme: principle` — Rationale: A general evaluative truth about mastery of entering and emerging from collectedness.
- Mirrored to `src/content/pli/sn/sn34.3.md`.

### src/content/en/sn/sn34.4.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: collectedness, flexible, cultivation` — Rationale: Flexibility (pliancy) of collectedness is the specific skill the four-way typology substantively develops, with the ghee simile presenting refinement of the malleable, cultivated mind.
- Added `theme: principle` — Rationale: A general evaluative truth about the pliancy of collectedness.
- Mirrored to `src/content/pli/sn/sn34.4.md`.

### src/content/en/sn/sn34.5.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: collectedness, cultivation` — Rationale: The discourse develops skill in collectedness and in the support (object) for collectedness through the four-meditator typology, with the ghee simile ranking the fully cultivated meditator foremost.
- Added `theme: principle` — Rationale: A general evaluative truth about the support for collectedness.
- Mirrored to `src/content/pli/sn/sn34.5.md`.

### src/content/en/sn/sn35.147.mdx
- Removed `fetter: ignorance, personal existence, sensual desire, ill will` and `tags:`.
- Added `qualities: recognition of impermanence, vision, felt-experience` — Rationale: The discourse substantively develops seeing each sense base, object, consciousness, contact, and whatever feeling arises with contact as impermanent — the recognition of impermanence applied through clear seeing across all six senses.
- Added `theme: training guideline` — Rationale: A repeated step-by-step practice instruction ("the way of practice suitable for realizing Nibbāna") applied sense by sense.
- Mirrored to `src/content/pli/sn/sn35.147.md`.

### src/content/en/sn/sn35.148.mdx
- Removed `fetter: ignorance, personal existence, sensual desire, ill will` and `tags:`.
- Added `qualities: recognition of unsatisfactoriness, perceiving drawback, felt-experience` — Rationale: The discourse develops seeing each sense base, object, consciousness, contact, and conditioned feeling as a source of discontentment — perceiving the drawback of the six sense fields as the practice leading to Nibbāna.
- Added `theme: training guideline` — Rationale: A repeated step-by-step practice instruction applied sense by sense.
- Mirrored to `src/content/pli/sn/sn35.148.md`.

### src/content/en/sn/sn35.149.mdx
- Removed `fetter: ignorance, personal existence, sensual desire, ill will` and `tags:`.
- Added `qualities: recognition of not-self, vision, felt-experience` — Rationale: The discourse develops seeing each sense base, object, consciousness, contact, and conditioned feeling as not-self — the recognition of not-self applied through repeated seeing across all six senses.
- Added `theme: training guideline` — Rationale: A repeated step-by-step practice instruction applied sense by sense.
- Mirrored to `src/content/pli/sn/sn35.149.md`.

### src/content/en/sn/sn35.234.mdx
- Removed `fetter: ignorance` and `tags:`.
- Mirrored to `src/content/pli/sn/sn35.234.md`.

### src/content/en/sn/sn35.245.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `theme: story, directly knowing` — Rationale: A narrative account (a bhikkhu canvassing bhikkhus' differing answers, then the kiṁsuka-tree and city-gatekeeper similes) that teaches vision is purified by directly knowing the arising and passing away of phenomena.
- Mirrored to `src/content/pli/sn/sn35.245.md`.

### src/content/en/sn/sn35.26.mdx
- Removed `fetter: ignorance,sensual desire,ill will` and `tags:`.
- Mirrored to `src/content/pli/sn/sn35.26.md`.

### src/content/en/sn/sn35.28.mdx
- Removed `fetter: ignorance,sensual desire,ill will` and `tags:`.
- Added `qualities: passion, aversion, delusion, disenchantment, dispassion, liberation` — Rationale: The discourse develops that everything is burning with the fires of passion, aversion, and delusion, and presents the dependent result: seeing thus → disenchantment → dispassion → liberation of the thousand bhikkhus' minds from the taints.
- Added `theme: urgency, principle` — Rationale: "All is burning … with birth, aging, death, sorrow, lamentation, pain, displeasure, and despair" conveys the danger of samsara, while the disenchantment→dispassion→release sequence is a general cause-effect truth.
- Mirrored to `src/content/pli/sn/sn35.28.md`.

### src/content/en/sn/sn43.13.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `theme: training guideline, wisdom` — Rationale: The sutta teaches the uninclined (the ending of passion, aversion, and delusion) and systematically enumerates the 37 factors leading there as the way of practice, paralleling SN 43.12's theme assignment.
- Mirrored to `src/content/pli/sn/sn43.13.md`.

### src/content/en/sn/sn43.14-43.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: ending, dispassion, non-proliferation, liberation, free from attachment, safety` — Rationale: The sutta presents Nibbāna under synonyms it develops one by one — the taintless, the wearing away of craving, dispassion, non-proliferation, freedom, the non-clinging, the safe — each paired with the way of practice leading to it.
- Added `theme: inspiration, principle` — Rationale: The evocative catalogue of Nibbāna's names (the deathless, the unaging, the island…) inspires confidence in the goal, while each repeated goal-and-path pair states a general principle.
- Mirrored to `src/content/pli/sn/sn43.14-43.md`.

### src/content/en/sn/sn43.44.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: ending, mindfulness-of-body` — Rationale: The sutta develops the ultimate goal as the ending of passion, aversion, and delusion, and presents mindfulness of the body as the way of practice leading to it.
- Added `theme: training guideline` — Rationale: A "goal + way of practice" teaching pointing to mindfulness of the body as the training, with the exhortation to meditate and not be negligent.
- Mirrored to `src/content/pli/sn/sn43.44.md`.

### src/content/en/sn/sn45.139.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: diligence, wholesome, cultivation` — Rationale: The discourse presents diligence as the root in which all wholesome qualities meet (presented as a cause), and develops how the diligent bhikkhu cultivates the Noble Eightfold Path culminating in relinquishment, the deathless, and Nibbāna.
- Added `theme: inspiration` — Rationale: The Tathāgata-foremost-among-beings simile exalts diligence to inspire the practice.
- Mirrored to `src/content/pli/sn/sn45.139.md`.

### src/content/en/sn/sn45.140.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: diligence, wholesome, cultivation` — Rationale: The elephant-footprint simile develops that all wholesome qualities are rooted in and meet together in diligence, which then drives cultivation of the Noble Eightfold Path.
- Added `theme: inspiration` — Rationale: The foremost-footprint simile exalts diligence to encourage practice.
- Mirrored to `src/content/pli/sn/sn45.140.md`.

### src/content/en/sn/sn45.141-145.mdx
- Removed `fetter: ignorance` and `tags:`.
- Mirrored to `src/content/pli/sn/sn45.141-145.md`.

### src/content/en/sn/sn45.171.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: sensual desire, craving, wrong view, ignorance, direct knowledge, complete comprehension, giving up, ending` — Rationale: The four floods (sensual pleasures, continued existence, views, ignorance) are presented as the causes to be known, and the Noble Eightfold Path is developed as the way to their direct knowledge, full comprehension, exhaustion, and giving up.
- Added `theme: principle` — Rationale: A general cause-effect truth: for the ending of the floods, the path should be cultivated.
- Mirrored to `src/content/pli/sn/sn45.171.md`.

### src/content/en/sn/sn45.172.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: attachment, sensual desire, craving, wrong view, ignorance, direct knowledge, complete comprehension, giving up` — Rationale: The four bonds (sensual pleasures, continued existence, views, ignorance) are presented as what binds one to cyclical existence, and the path is developed as the way to their direct knowledge, comprehension, exhaustion, and giving up.
- Added `theme: principle` — Rationale: A general cause-effect truth: for the release from the bonds, the path should be cultivated.
- Mirrored to `src/content/pli/sn/sn45.172.md`.

### src/content/en/sn/sn45.174.mdx
- Removed `fetter: doubt, adherence to rules and observances, personal existence, sensual desire, ill will, ignorance` and `tags:`.
- Mirrored to `src/content/pli/sn/sn45.174.md`.

### src/content/en/sn/sn45.27.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: collectedness, cultivation` — Rationale: The water-pot simile develops that a mind with support is hard to overturn while an unsupported mind is easily knocked over, and presents the Noble Eightfold Path — developed and cultivated — as that support for stability of mind.
- Added `theme: principle` — Rationale: A general cause-effect truth about the supported versus unsupported mind.
- Mirrored to `src/content/pli/sn/sn45.27.md`.

### src/content/en/sn/sn45.35.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: spiritual life, stream-entry, liberation` — Rationale: The discourse develops the spiritual life as the Noble Eightfold Path and presents its fruits in sequence — stream-entry, once-returning, non-returning — culminating in the arahant's liberation.
- Added `theme: principle` — Rationale: A definitional cause-effect truth: the path is the spiritual life, and its cultivation yields the graded fruits.
- Mirrored to `src/content/pli/sn/sn45.35.md`.

### src/content/en/sn/sn45.50-54.mdx
- Removed `fetter: adherence to rules and observances,doubt,ignorance` and `tags:`.
- Added `qualities: ethical conduct, desire, right view, diligence, cultivation` — Rationale: Accomplishment in virtue, aspiration, self-development, view, and diligence are each presented as the forerunner and precursor (the dawn before sunrise) for the arising of the Noble Eightfold Path that is then cultivated.
- Added `theme: principle` — Rationale: A general cause-effect truth about the prerequisites of the path's arising.
- Mirrored to `src/content/pli/sn/sn45.50-54.md`.

### src/content/en/sn/sn45.63.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: good friendship, cultivation, right view` — Rationale: Good friendship is presented as the one thing greatly beneficial for the arising of the path (the cause), whose result is the bhikkhu's development of right view through right collectedness culminating in relinquishment.
- Added `theme: principle` — Rationale: A general cause-effect truth: good friendship leads to cultivation of the path.
- Mirrored to `src/content/pli/sn/sn45.63.md`.

### src/content/en/sn/sn45.91.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: cultivation, right view, giving up` — Rationale: The Ganges-slanting-eastward simile develops that the bhikkhu who develops right view through right collectedness — dependent on seclusion, supported by dispassion and cessation, culminating in complete relinquishment — inclines towards Nibbāna.
- Added `theme: principle` — Rationale: A general cause-effect simile: cultivation of the path necessarily inclines the practitioner toward Nibbāna.
- Mirrored to `src/content/pli/sn/sn45.91.md`.

### src/content/en/sn/sn46.23.mdx
- Removed `fetter: ignorance` (no `tags:` present).
- Mirrored to `src/content/pli/sn/sn46.23.md`.

### src/content/en/sn/sn46.3.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: ethical conduct, mindfulness, examination, vigour, uplifting joy, tranquility, collectedness, equanimity` — Rationale: The discourse develops the benefit of association with virtuous bhikkhus and then presents the seven awakening factors arising sequentially by cause and condition — from mindfulness through investigation, energy, joy, tranquility, collectedness, and equanimity — reaching fulfillment through cultivation.
- Added `theme: inspiration, principle` — Rationale: Seeing, hearing, and attending upon bhikkhus accomplished in virtue is extolled as of great benefit, while the stepwise arising of the awakening factors and their seven fruits is a cause-effect presentation.
- Mirrored to `src/content/pli/sn/sn46.3.md`.

### src/content/en/sn/sn51.1.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, examination, cultivation` — Rationale: The four bases of psychic power — collectedness arising from aspiration, energy, purification of mind, and investigation — are developed and frequently practiced, presented as the cause leading from the near shore to the far shore.
- Added `theme: principle` — Rationale: A general cause-effect truth: developing the bases leads to the far shore.
- Mirrored to `src/content/pli/sn/sn51.1.md`.

### src/content/en/sn/sn51.11.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: inquisitiveness, desire, vigour, examination, collectedness, psychic power, clear awareness` — Rationale: The discourse recounts the Bodhisatta's pre-awakening inquiry — "What is the cause, what is the condition for the development of the bases of psychic powers?" — and develops the balanced (not too slack, not too tense) application of aspiration, energy, mind, and investigation with continuous clear awareness, resulting in the psychic powers.
- Added `theme: story` — Rationale: A narrative account of the Buddha's inquiry before his full awakening.
- Mirrored to `src/content/pli/sn/sn51.11.md`.

### src/content/en/sn/sn51.12.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, examination, clear awareness, liberation, direct knowledge` — Rationale: The discourse develops the balanced practice formula (aspiration/energy/mind/investigation neither slack nor tense, with open, unenveloped, radiant mind) and presents its results: the various psychic powers and, through wearing away of the taints, the taintless liberation realized with direct knowledge.
- Added `theme: training guideline` — Rationale: A step-by-step practice instruction on how the bases are cultivated for great fruit and benefit.
- Mirrored to `src/content/pli/sn/sn51.12.md`.

### src/content/en/sn/sn51.13.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `theme: training guideline` — Rationale: A step-by-step analysis pairing each basis (aspiration, determination, mind, investigation) with the four right efforts as intentional constructs of striving.
- Mirrored to `src/content/pli/sn/sn51.13.md`.

### src/content/en/sn/sn51.15.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `theme: story, principle` — Rationale: A narrative dialogue with the brahmin Uṇṇābha whose park-visit questions resolve the paradox that desire is abandoned by means of desire, presenting the principle that the bases of psychic power are the way desire is abandoned.
- Mirrored to `src/content/pli/sn/sn51.15.md`.

### src/content/en/sn/sn51.16.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, examination, cultivation` — Rationale: Mighty and powerful ascetics and brahmins of the past, future, and present are all presented as having attained their might through cultivation and frequent practice of the four bases — collectedness arising from aspiration, energy, mind, and investigation.
- Added `theme: principle` — Rationale: A general truth asserted across past, future, and present.
- Mirrored to `src/content/pli/sn/sn51.16.md`.

### src/content/en/sn/sn51.17.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, examination` — Rationale: Ascetics and brahmins of all times who experienced the various psychic powers are presented as having done so through the four bases — collectedness arising from aspiration, energy, mind, and investigation.
- Added `theme: principle` — Rationale: A general truth asserted across past, future, and present.
- Mirrored to `src/content/pli/sn/sn51.17.md`.

### src/content/en/sn/sn51.18.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, examination, liberation, direct knowledge` — Rationale: The four bases — collectedness arising from aspiration, energy, mind, and investigation — are developed as the cause through which a bhikkhu, with the wearing away of the taints, realizes the taintless liberation of mind and liberation by wisdom with direct knowledge.
- Added `theme: principle` — Rationale: A general cause-effect truth: development of the bases leads to liberation.
- Mirrored to `src/content/pli/sn/sn51.18.md`.

### src/content/en/sn/sn51.19.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, examination, cultivation` — Rationale: The discourse systematically develops psychic power, its basis, the development of the bases (collectedness arising from aspiration, energy, mind, investigation with intentional effort), and the Noble Eightfold Path as the way leading to that development.
- Added `theme: training guideline` — Rationale: A structured "I will teach you X, the basis of X, the development of X, and the way leading to X" practice teaching.
- Mirrored to `src/content/pli/sn/sn51.19.md`.

### src/content/en/sn/sn51.2.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, examination, negligence, cultivation` — Rationale: The discourse presents a mirrored cause-effect pair: for whomever the four bases are neglected (negligence), the way to complete cessation of suffering is also neglected, and for whomever they are undertaken and cultivated, that way is also undertaken.
- Added `theme: principle` — Rationale: A general cause-effect truth about neglect versus undertaking of the bases.
- Mirrored to `src/content/pli/sn/sn51.2.md`.

### src/content/en/sn/sn51.20.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: desire, vigour, clear awareness, mindfulness, recognition of unattractiveness, collectedness, psychic power` — Rationale: The discourse develops each basis (aspiration, determination, mind, investigation) against its distortions — too slack (laziness), too intense (restlessness), inwardly inhibited (dullness and drowsiness), outwardly scattered (sensual cords) — with well-grasped mindfulness, contemplation of the body's parts as full of impurities, and the perception of brightness developing a radiant mind.
- Added `theme: training guideline` — Rationale: A detailed step-by-step analysis of how the bases are cultivated for great fruit and benefit.
- Mirrored to `src/content/pli/sn/sn51.20.md`.

### src/content/en/sn/sn51.3.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, examination, liberation` — Rationale: The four bases — collectedness arising from aspiration, energy, mind, and investigation — are developed and presented as noble and leading to liberation, guiding the right practitioner to the complete cessation of suffering.
- Added `theme: principle` — Rationale: A general cause-effect truth: the bases lead one who practices rightly to the ending of suffering.
- Mirrored to `src/content/pli/sn/sn51.3.md`.

SN batch 4 (sn51, sn55, sn56, sn7)

### src/content/en/sn/sn51.31.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, clear awareness, direct knowledge, liberation` — Rationale: The bases' development is presented as the cause of Moggallana's might: each base is 'endowed with collectedness' and he dwells 'continuously aware' (clear awareness), and the stated results are the psychic powers culminating in taint-free liberation.
- Added `theme: training guideline` — Rationale: A step-by-step description of how each of the four bases is developed with balanced effort and continuous awareness.
- Mirrored to `src/content/pli/sn/sn51.31.md`.

### src/content/en/sn/sn51.4.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, ending, tranquility, direct knowledge` — Rationale: Explicit cause-result chain: the four bases, when developed and frequently practiced, lead to complete disenchantment, fading of desire (dispassion), cessation (ending), tranquility, directly knowing, and Nibbana.
- Added `theme: principle` — Rationale: States a general cause-effect truth about what the developed bases lead to.
- Mirrored to `src/content/pli/sn/sn51.4.md`.

### src/content/en/sn/sn51.5.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, investigation` — Rationale: Psychic power is presented as the result, with the four bases — collectedness arising from aspiration (desire), energy (vigour), mind, and investigation — as its stated cause in past, future, and present.
- Added `theme: principle` — Rationale: A universal cause-effect claim about the origin of psychic powers across past, future, and present.
- Mirrored to `src/content/pli/sn/sn51.5.md`.

### src/content/en/sn/sn51.6.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, desire, vigour, investigation` — Rationale: The highest psychic powers are presented as the result of developing the four bases, each endowed with collectedness arising from desire, vigour, mind, and investigation.
- Added `theme: principle` — Rationale: A universal cause-effect claim about the origin of the highest psychic powers.
- Mirrored to `src/content/pli/sn/sn51.6.md`.

### src/content/en/sn/sn51.7.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, direct knowledge, liberation` — Rationale: Taint-free liberation is presented as the result of developing the four bases, each of which is endowed with collectedness.
- Added `theme: principle` — Rationale: A general cause-effect truth: taint-free release comes only through developing the four bases.
- Mirrored to `src/content/pli/sn/sn51.7.md`.

### src/content/en/sn/sn51.77-86.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: direct knowledge, complete comprehension, ending, collectedness` — Rationale: The four bases are given as the cause to be developed for the directly knowing, full understanding, complete exhaustion, and abandonment of the five higher fetters; each base is endowed with collectedness.
- Added `theme: training guideline` — Rationale: Framed as a practice instruction: 'the four bases of psychic powers should be developed' for abandoning the higher fetters.
- Mirrored to `src/content/pli/sn/sn51.77-86.md`.

### src/content/en/sn/sn51.8.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: psychic power, collectedness, liberation` — Rationale: The Tathagata's title 'Arahant' is presented as the result of having developed and frequently practiced the bases, which are endowed with collectedness.
- Added `theme: principle` — Rationale: States the general principle that the Tathagata is called Arahant because of the developed bases.
- Mirrored to `src/content/pli/sn/sn51.8.md`.

### src/content/en/sn/sn51.9.mdx
- Removed `fetter: desire for fine-material existence, desire for immaterial existence, conceit, restlessness, ignorance` and `tags:`.
- Added `qualities: insight, wisdom, true knowledge, psychic power` — Rationale: The sutta details the three-phase direct realization ('this is', 'should be developed', 'has been developed') through which vision, insight, wisdom, and true knowledge arose in the Buddha regarding each base.
- Added `theme: directly knowing` — Rationale: Records the Buddha's direct experiential knowledge arising in three phases regarding each base.
- Mirrored to `src/content/pli/sn/sn51.9.md`.

### src/content/en/sn/sn55.1.mdx
- Removed `fetter: doubt` and `tags:`.
- Mirrored to `src/content/pli/sn/sn55.1.md`.

### src/content/en/sn/sn55.2.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Mirrored to `src/content/pli/sn/sn55.2.md`.

### src/content/en/sn/sn55.31.mdx
- Removed `fetter: doubt` and `tags:`.
- Mirrored to `src/content/pli/sn/sn55.31.md`.

### src/content/en/sn/sn55.32.mdx
- Removed `fetter: doubt` and `tags:`.
- Mirrored to `src/content/pli/sn/sn55.32.md`.

### src/content/en/sn/sn55.33.mdx
- Removed `fetter: doubt` and `tags:`.
- Mirrored to `src/content/pli/sn/sn55.33.md`.

### src/content/en/sn/sn55.4.mdx
- Removed `fetter: doubt` and `tags:`.
- Mirrored to `src/content/pli/sn/sn55.4.md`.

### src/content/en/sn/sn55.44.mdx
- Removed `fetter: doubt` and `tags:`.
- Mirrored to `src/content/pli/sn/sn55.44.md`.

### src/content/en/sn/sn55.45.mdx
- Removed `fetter: doubt` and `tags:`.
- Mirrored to `src/content/pli/sn/sn55.45.md`.

### src/content/en/sn/sn56.11.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: suffering, right view, true knowledge, vision, tranquility, direct knowledge` — Rationale: The middle way is presented as the cause leading to vision, tranquility, and direct knowledge; the truths are laid out with the three-phase true knowledge, and Kondanna's Dhamma eye (vision) arises as the result.
- Added `theme: principle, inspiration` — Rationale: Foundational statement of the Four Noble Truths as framework, delivered as the inspiring first discourse culminating in Kondanna's realization.
- Mirrored to `src/content/pli/sn/sn56.11.md`.

### src/content/en/sn/sn56.13.mdx
- Removed `fetter: doubt, sensual desire, ignorance` and `tags:`.
- Added `qualities: suffering, craving, ending, complete comprehension` — Rationale: Suffering is systematically clarified as the five aggregates subject to clinging, with craving presented as its arising cause, the eightfold path as the way, and full understanding as the task.
- Added `theme: principle, cultivating discernment` — Rationale: Systematic comparative examination of the four truths and the five aggregates, stating each truth's general task.
- Mirrored to `src/content/pli/sn/sn56.13.md`.

### src/content/en/sn/sn56.20.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: suffering, truth, complete comprehension` — Rationale: The four truths are declared true, unerring, and not otherwise, and the closing exhortation makes fully understanding them (complete comprehension) the practice point.
- Added `theme: principle` — Rationale: A general cause-effect truth: these four are true, unerring, and not otherwise.
- Mirrored to `src/content/pli/sn/sn56.20.md`.

### src/content/en/sn/sn56.21.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: suffering, ignorance, complete comprehension, ending` — Rationale: Not fully understanding the truths is presented as the cause of the long wandering in samsara (ignorance, suffering), while full understanding severs the craving for existence so there is no more rebirth (ending).
- Added `theme: urgency, principle` — Rationale: Emphasizes the long course of samsara from not understanding the truths to inspire urgency, while stating the general truth of each task.
- Mirrored to `src/content/pli/sn/sn56.21.md`.

### src/content/en/sn/sn56.24.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: suffering, complete comprehension, true knowledge` — Rationale: All arahants past, future, and present are shown to have truly understood the four truths, with full understanding (complete comprehension) as the closing practice point.
- Added `theme: principle` — Rationale: A general truth about all arahants of past, present, and future having understood the four truths.
- Mirrored to `src/content/pli/sn/sn56.24.md`.

### src/content/en/sn/sn56.25.mdx
- Removed `fetter: doubt, personal existence, adherence to rules and observances, ignorance` and `tags:`.
- Added `qualities: suffering, direct knowledge, ending, complete comprehension` — Rationale: Knowing and seeing each of the four truths is presented as the direct cause for the wearing away of the taints (ending).
- Added `theme: principle` — Rationale: States the general cause-effect truth that knowing and seeing the four truths wears away the taints.
- Mirrored to `src/content/pli/sn/sn56.25.md`.

### src/content/en/sn/sn56.27.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: suffering, truth, complete comprehension` — Rationale: The truths are clarified as actual, unchanging, and not otherwise — hence 'Noble Truths' — with the exhortation to fully understand them.
- Added `theme: principle` — Rationale: A general proposition about the truths being actual and unchanging.
- Mirrored to `src/content/pli/sn/sn56.27.md`.

### src/content/en/sn/sn56.28.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: suffering, truth, complete comprehension` — Rationale: The nobility of the Tathagata in the world is given as the reason these truths are called 'Noble Truths', with the exhortation to fully understand them.
- Added `theme: principle` — Rationale: A general proposition explaining why the truths are called noble.
- Mirrored to `src/content/pli/sn/sn56.28.md`.

### src/content/en/sn/sn56.29.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: suffering, craving, ending, complete comprehension, cultivation` — Rationale: Each truth is dependently clarified with its distinct task: suffering to be fully understood, its arising (craving) to be abandoned, its cessation (ending) to be personally experienced, and the path to be developed (cultivation).
- Added `theme: principle` — Rationale: States the general framework of the four distinct tasks assigned to the four truths.
- Mirrored to `src/content/pli/sn/sn56.29.md`.

### src/content/en/sn/sn56.31.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: disenchantment, dispassion, ending, tranquility, direct knowledge` — Rationale: The rosewood-leaf simile clarifies that the Buddha taught only what leads to disenchantment, dispassion, cessation, tranquility, direct knowledge, and Nibbana.
- Added `theme: principle` — Rationale: States the general principle that only what leads to disenchantment and Nibbana was taught.
- Mirrored to `src/content/pli/sn/sn56.31.md`.

### src/content/en/sn/sn56.32.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: suffering, complete comprehension, ending` — Rationale: The acacia-leaf simile illustrates the cause-result: completely ending suffering is possible only through fully comprehending the four truths, never without them.
- Added `theme: principle` — Rationale: States the general cause-effect principle that ending suffering depends on fully understanding the truths.
- Mirrored to `src/content/pli/sn/sn56.32.md`.

### src/content/en/sn/sn56.33.mdx
- Removed `fetter: sensual desire, desire for fine-material existence, desire for immaterial existence, conceit, ignorance` and `tags:`.
- Added `qualities: ignorance, craving, suffering, complete comprehension` — Rationale: The stick simile illustrates beings obstructed by ignorance and fettered by craving (suffering) wandering in cyclic existence because they have not seen the truths; full understanding is the escape.
- Added `theme: urgency` — Rationale: The image of beings aimlessly wandering through rebirths like a tossed stick underscores the urgency of understanding the truths.
- Mirrored to `src/content/pli/sn/sn56.33.md`.

### src/content/en/sn/sn56.34.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `theme: urgency` — Rationale: The burning-clothes/head simile frames the breakthrough to the Four Noble Truths as an immediate emergency demanding utmost effort.
- Mirrored to `src/content/pli/sn/sn56.34.md`.

### src/content/en/sn/sn56.37.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: right view, vision, complete comprehension` — Rationale: Right view is presented as the precursor that precedes and predicts the breakthrough to the four truths, just as dawn precedes the rising of the sun.
- Added `theme: principle` — Rationale: States the general principle that right view precedes the breakthrough to the truths.
- Mirrored to `src/content/pli/sn/sn56.37.md`.

### src/content/en/sn/sn56.38.mdx
- Removed `fetter: ignorance,doubt` and `tags:`.
- Added `qualities: suffering, true knowledge, vision` — Rationale: The sun-and-moon simile presents the Buddha's arising as the cause of great light — the declaration of the four truths dispelling complete darkness.
- Added `theme: inspiration` — Rationale: Presents the Buddha's arising as the light that dispels darkness, encouraging faith in the teaching of the truths.
- Mirrored to `src/content/pli/sn/sn56.38.md`.

### src/content/en/sn/sn56.42.mdx
- Removed `fetter: ignorance` and `tags:`.
- Added `qualities: suffering, intentional-constructs, complete comprehension` — Rationale: The precipice simile shows the cause-result: delighting in intentional constructs leads to falling into the precipice of rebirth, aging, death, and despair, while fully understanding the truths brings escape from suffering.
- Added `theme: urgency` — Rationale: The greater precipice of rebirth, aging, death, and sorrow impresses the danger of not understanding the truths.
- Mirrored to `src/content/pli/sn/sn56.42.md`.

### src/content/en/sn/sn56.49.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: suffering, right view, stream-entry` — Rationale: The Mount Sineru simile presents the result of right view: the suffering eradicated and exhausted by the noble disciple dwarfs the little that remains.
- Added `theme: principle` — Rationale: States the general principle, through the simile, of how much suffering right view eradicates.
- Mirrored to `src/content/pli/sn/sn56.49.md`.

### src/content/en/sn/sn56.6.mdx
- Removed `fetter: doubt, ignorance` and `tags:`.
- Added `qualities: suffering, true knowledge, complete comprehension` — Rationale: Fully awakening to the four truths is presented as the cause of full awakening for all ascetics and brahmins of the past, future, and present.
- Added `theme: principle` — Rationale: A general truth that all who fully awaken do so by awakening to the four truths.
- Mirrored to `src/content/pli/sn/sn56.6.md`.

### src/content/en/sn/sn7.1.mdx
- Removed `fetter: ill will, ignorance` and `tags:`.
- Mirrored to `src/content/pli/sn/sn7.1.md`.

### src/content/en/sn/sn7.2.mdx
- Removed `fetter: ill will, ignorance` and `tags:`.
- Added `qualities: anger, patience, mindfulness` — Rationale: The refused-deliacies simile and verses clarify the cause-result of quarreling: not retaliating against anger but calming oneself with mindfulness wins the battle hard to win.
- Added `theme: wisdom` — Rationale: The Buddha's wise, reflective handling of the insulting brahmin teaches how anger belongs to the one who carries it.
- Mirrored to `src/content/pli/sn/sn7.2.md`.

### src/content/en/sn/sn7.3.mdx
- Removed `fetter: ill will, ignorance` and `tags:`.
- Added `qualities: anger, patience, mindfulness` — Rationale: The verses set the dichotomy that the immature thinks he wins by bellowing harshly, but true victory belongs to those who patiently endure and calm themselves with mindfulness.
- Added `theme: cultivating discernment` — Rationale: A comparative teaching contrasting the immature brawler with the one who wins the hard battle by patient endurance.
- Mirrored to `src/content/pli/sn/sn7.3.md`.

### src/content/en/sn/sn7.4.mdx
- Removed `fetter: ill will, ignorance` and `tags:`.
- Added `qualities: harm, anger, person-of-integrity` — Rationale: The dust-against-the-wind simile states a cause-effect principle: harming a blameless person returns as harm to the immature harmer.
- Added `theme: principle` — Rationale: States the general cause-effect principle that harm returns to the one who harms a blameless person.
- Mirrored to `src/content/pli/sn/sn7.4.md`.

### src/content/en/sn/sn7.5.mdx
- Removed `fetter: doubt, ill will, ignorance` and `tags:`.
- Added `qualities: non-harm, harm, ethical conduct` — Rationale: The Buddha clarifies that harmlessness is established not by name but by doing no harm by body, speech, or mind — true ethical conduct.
- Added `theme: cultivating discernment` — Rationale: A discriminative clarification of what truly makes one harmless versus merely bearing the name.
- Mirrored to `src/content/pli/sn/sn7.5.md`.

---

## Missing theme pass

Follow-up sweep over `src/content/en` for discourses whose frontmatter still
lacked a `theme:` key (most of these were already clean of `fetter:`/`tags:`,
so they pre-date the main pass). Every addition is mirrored to the Pāli
counterpart. `src/content/en/index.mdx` intentionally has no theme — it is the
site landing page, not a discourse.

### src/content/en/an/an6.18.mdx (+ pli mirror)
- Added `theme: urgency, principle` — the fisherman's cruelty is traced
  cause-by-cause through rebirth in the great hell, a pointed warning about
  the consequences of cruelty.

### src/content/en/an/an6.63.mdx (+ pli mirror)
- Added `theme: directly knowing, principle` — the "penetrative" exposition:
  each thing (sense pleasures, feeling, perception, taints, action, suffering)
  is to be known directly through its definition, origin, cessation, and way.

### src/content/en/an/an6.64.mdx (+ pli mirror)
- Added `theme: directly knowing, inspiration` — the six Tathāgata powers
  presented as knowledges realized through collectedness.

### src/content/en/an/an6.75.mdx (+ pli mirror)
- Added `theme: training guideline` — six thoughts/perceptions to develop
  enumerated as a practice for dwelling in ease.

### src/content/en/mn/mn101.mdx (+ pli mirror)
- Added `theme: principle, training guideline` — refutes the principle that
  suffering is eroded by past-action austerities, then walks the gradual
  training to dispassion.

### src/content/en/mn/mn102.mdx (+ pli mirror)
- Added `theme: principle` — speculative views deconstructed as clinging;
  liberation through non-clinging to the six sense bases.
- Fixed invalid pre-existing quality `feeling` → `felt experience` (the
  vocabulary term; also mirrored to pli).

### src/content/en/mn/mn43.mdx (+ pli mirror)
- Added `theme: directly knowing, wisdom` — Sāriputta/Mahākoṭṭhika Q&A that
  defines and discriminates wisdom, consciousness, feeling, and the rest.

### src/content/en/mn/mn54.mdx (+ pli mirror)
- Added `theme: principle, training guideline` — true "cutting off of all
  dealings" redefined as abandoning unwholesome actions, with a graduated
  sequence of similes.

### src/content/en/mn/mn64.mdx (+ pli mirror)
- Added `theme: training guideline` — the five lower fetters and the stepwise
  way of practice (collectedness, fading of interest, perception of not-self)
  for their abandonment.

### src/content/en/sn/sn1.2.mdx (+ pli mirror)
- Fixed typo'd frontmatter key `themes:` → `theme:` (kept values
  `inspiration, wisdom` — the plural key is not in the schema and was being
  silently dropped).

### src/content/en/sn/sn56.1.mdx (+ pli mirror)
- Fixed typo'd frontmatter key `themes:` → `theme:` (kept value `wisdom`);
  also removed the `fetter:`/`tags:` still present in the pli counterpart.

### src/content/en/sn/sn11.5.mdx (+ pli mirror)
- Added `theme: story, principle` — Sakka's verse-contest victory over
  Vepacitti demonstrates that patience and mindfulness conquer anger.

### src/content/en/sn/sn12.68.mdx (+ pli mirror)
- Added `theme: directly knowing` — the Kosambi dialogues on knowing
  dependent co-arising by personal knowledge independent of faith,
  preference, hearsay, and reasoning.
- Note: the English file is a content stub (title/slug only, empty body);
  the full discourse text exists in `src/content/pli/sn/sn12.68.md`. Content
  import would be a separate follow-up.

### src/content/en/sn/sn17.30.mdx (+ pli mirror)
- Added `theme: urgency` — acquisitions, respect, and popularity as an
  obstacle even to an arahant's pleasant abiding here and now.

### src/content/en/sn/sn2.2.mdx (+ pli mirror)
- Added `theme: inspiration, training guideline` — the young deity Kassapa's
  verse instruction for a bhikkhu.

### src/content/en/sn/sn20.12.mdx (+ pli mirror)
- Added `theme: training guideline` — the old jackal simile urging training
  in gratefulness; also removed the `fetter:`/`tags:` still present in the
  pli counterpart.

### src/content/en/sn/sn22.1.mdx (+ pli mirror)
- Added `theme: story, directly knowing` — householder Nakulapitā's aging
  body vs the unafflicted mind, then Sāriputta's not-self clarification.
- Fixed invalid pre-existing quality `feeling` → `felt experience` (mirrored
  to pli).

### src/content/en/sn/sn22.90.mdx (+ pli mirror)
- Added `theme: principle, story` — Channa's struggle resolved through the
  middle-way principle avoiding existence and non-existence.

### src/content/en/sn/sn47.4.mdx (+ pli mirror)
- Added `theme: training guideline` — who should cultivate the four
  establishments of mindfulness and to what purpose.

### src/content/en/sn/sn47.40.mdx (+ pli mirror)
- Added `theme: training guideline, directly knowing` — the analysis of the
  establishments and the cultivation stage of observing arising and vanishing.

### src/content/en/sn/sn47.8.mdx (+ pli mirror)
- Added `theme: training guideline` — the cook simile: the meditator must
  know their mind's theme, as the cook knows the king's preference.

### src/content/en/sn/sn4.4.mdx (+ pli mirror)
- Added `theme: inspiration` — the Buddha's attainment of the unsurpassed
  liberation through radical attention and right striving, unshaken by Māra.

### src/content/en/snp/snp1.2.mdx (+ pli mirror)
- Added `theme: story, inspiration` — the poetic duel between Dhaniya and
  the Buddha ending in the cowherd's going for refuge.

### src/content/en/snp/snp3.12.mdx (+ pli mirror)
- Added `theme: directly knowing, principle` — liberating knowledge from
  observing pairs of principles and the dependent arising of suffering.

### src/content/en/snp/snp5.14.mdx (+ pli mirror)
- Added `theme: training guideline` — Posāla's question on guiding a
  meditator established in the sphere of nothingness toward further release.

### src/content/en/ud/ud6.7.mdx (+ pli mirror)
- Added `theme: inspiration` — the Blessed One's inspired utterance on seeing
  venerable Subhūti absorbed in collectedness.

### src/content/en/anthologies/noble-truths-noble-path.mdx
- Added `theme: wisdom` — Bhikkhu Bodhi's anthology structured entirely
  around the Four Noble Truths and the Noble Eightfold Path.

### src/content/en/anthologies/in-the-buddhas-words.mdx
- Added `theme: inspiration` — the curated anthology's breadth, from
  impermanence and not-self to the path to awakening.
