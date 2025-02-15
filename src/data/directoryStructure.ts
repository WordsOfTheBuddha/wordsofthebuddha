import type { DirectoryStructure } from "../types/directory";

export const directoryStructure: Record<string, DirectoryStructure> = {
	sn: {
		title: "Saṃyutta Nikāya - Linked Discourses",
		description:
			"A collection of discourses grouped by theme, offering rich explorations of core Buddhist concepts such as dependent origination, the five aggregates, and the path to liberation.",
		children: {
			"sn1-11": {
				title: "The Group of Linked Discourses With Verses",
				description:
					'The "Book With Verses" is the first of the five books in the Saṁyutta Nikāya, containing 271 suttas divided into eleven saṁyuttas or sections...',
				range: { start: 1, end: 11 },
				children: {
					sn1: {
						title: "Devatāsaṁyutta",
						description:
							'The "Linked Discourses With Deities" features dialogues between the Buddha and various deities...',
					},
					sn3: {
						title: "Kosalasaṁyutta - Linked Discourses With King Pasenadi of Kosala",
						description:
							"The \"Linked Discourses With King Pasenadi of Kosala\" centers on King Pasenadi of Kosala, a figure who emerges in the early texts as both complex and relatable. Pasenadi is portrayed with his flaws and follies, yet also with deep devotion and a capacity for growth. These discourses often involve substantial prose narratives, depicting the king's struggles to reconcile his royal duties—amidst spies, sacrifices, punishments, and wars—with his commitment to the Dhamma. Queen Mallikā, a key figure in Pasenadi's spiritual journey, also appears, notably in [SN 3.8](/sn3.8), where she boldly challenges the king. This collection provides a rich exploration of the challenges faced by a ruler striving to uphold the Dhamma in the complex world of royal life.",
					},
					sn4: {
						title: "Mārasaṁyutta - Linked Discourses With Māra",
						description:
							"The \"Linked Discourses With Māra\" features dialogues between the Buddha and Māra, the personification of evil and the tempter of beings. Māra is depicted as a powerful figure who seeks to obstruct the Buddha's path to awakening and enlightenment. These discourses often involve Māra's attempts to dissuade the Buddha from teaching or to distract him from his meditation. The Buddha responds with wisdom and compassion, skillfully countering Māra's deceptions and revealing the path to liberation.",
					},
					sn7: {
						title: "Brāhmaṇasaṁyutta - Linked Discourses with Brahmins",
						description:
							"The \"Linked Discourses with Brahmins\" focuses on the Buddha's interactions with brahmins, the religious scholars and ritual practitioners of his time. In these dialogues, the Buddha challenges the brahmins' reliance on caste and rituals, emphasizing the importance of ethical actions and inner virtue over birth or societal status. These suttas often depict brahmins boasting about their superiority, only to be gently corrected by the Buddha, where he teaches that one's deeds —not birth— make one a true brahmin. This collection illustrates the Buddha's critique of rigid social hierarchies and his emphasis on a universal path of ethical conduct and wisdom for spiritual liberation.",
					},
				},
			},
			"sn12-21": {
				title: "The Group of Linked Discourses Beginning With Causation",
				description:
					'The "Book of Causation" is the second book in the Saṁyutta Nikāya. It is named after the first and longest saṁyutta, which explores causation through the Buddha\'s foundational teaching of dependent co-arising. The remaining nine saṁyuttas address various secondary themes, with some organized by subject matter and others by the individuals involved in the teachings. This book delves into the intricate web of cause and effect, offering insights into the nature of existence and the process of becoming.',
				range: { start: 12, end: 21 },
				children: {
					sn12: {
						title: "Nidānasaṁyutta - Linked Discourses on Causation",
						description:
							'The "Linked Discourses on Causation" contains discourses on dependent co-arising (paṭiccasamuppāda). Dependent co-arising presents a series of conditional links laying out the process of becoming and the arising of suffering. These teachings explore the interdependent nature of existence, illustrating how one condition leads to another in a chain of causation. By examining the causes and conditions that give rise to suffering, these discourses offer insights into the nature of reality and the conditions for liberation.',
					},
					sn13: {
						title: "Abhisamayasaṁyutta - Linked Discourses on Complete Comprehension",
						description:
							'The "Linked Discourses on Complete Comprehension" contains discourses that use vivid similes to illustrate the value of realizing the Dhamma.',
					},
					sn14: {
						title: "Dhātusaṁyutta - Linked Discourses on the Elements",
						description:
							'The "Linked Discourses on the Elements" contains discourses exploring elements shaping experience, with a focus on the six sensory elements — eye, ear, nose, tongue, body, and mind. These elements are examined for their role in generating contact, perception, and feeling, showing how sensory experience drives attachment and aversion. Other discourses address mental elements (e.g., forgetful, reckless, mindful) and the four great elements—earth, water, fire, and air — representing the basic physical structure of existence.',
					},
					sn15: {
						title: "Anamataggasaṁyutta - Linked Discourses on the Inconceivable Beginning",
						description:
							'The "Linked Discourses on the Inconceivable Beginning" contains discourses exploring the beginningless nature of saṁsāra, the cycle of birth and death. These teachings challenge the idea of a first point in time, suggesting that saṁsāra has no discernible origin. By examining the endless cycle of rebirth and the causes of suffering, these discourses offer insights into the nature of existence and the conditions for liberation.',
					},
					sn17: {
						title: "Lābhasakkārasaṁyutta - Linked Discourses on Acquisitions and Respect",
						description:
							'The "Linked Discourses on Acquisitions and Respect"  contain teachings on the danger of acqusitions, respect, and popularity for spiritual practitioners. The Buddha emphasizes how these worldly rewards are harsh, bitter, severe, and obstructive, leading to complacency, attachment, and spiritual downfall. Through vivid similes — such as comparing acquisitions and respect to a fisherman\'s baited hook — the discourses highlight how even accomplished practitioners can become ensnared if they relish praise and recognition.',
					},
					sn20: {
						title: "Opammavagga - Linked Discourses with Similes",
						description:
							'The "Linked Discourses with Similes" contains discourses that use vivid similes to illustrate the Buddha\'s teachings. These similes draw on everyday experiences and natural phenomena to convey profound truths about the nature of reality, the path to liberation, and the qualities of an awakened being. By comparing spiritual principles to familiar objects and situations, these discourses offer accessible and memorable insights into the Dhamma.',
					},
				},
			},
			"sn22-34": {
				title: "The Group of Linked Discourses Beginning With the Aggregates",
				description:
					'The "Book of the Aggregates" is the third book in the Saṁyutta Nikāya. It is named after the first and longest saṁyutta, which explores the Buddha\'s core teaching on the five aggregates. Of the remaining twelve saṁyuttas, three continue to delve into the theme of the aggregates, while the others address various secondary themes, with some organized by subject matter and others by the individuals involved in the teachings. This book provides profound insights into the components of existence and the nature of self.',
				range: { start: 22, end: 34 },
				children: {
					sn22: {
						title: "Khandhasaṁyutta - Linked Discourses on the Aggregates",
						description:
							'The "Linked Discourses on the Aggregates" contains discourses focusing on the five aggregates that constitute personal experience: form, feeling, perception, volitional formations, and consciousness. These teachings explore the nature of the aggregates, their arising and ceasing, and their relationship to suffering and liberation. By examining the components of experience, these discourses offer insights into the nature of self and the conditions for suffering and liberation.',
					},
					sn33: {
						title: "Vacchagottasaṁyutta - Linked Discourses with Vacchagotta",
						description:
							"The \"Linked Discourses with Vacchagotta\" features dialogues between the Buddha and Vacchagotta, a wandering ascetic who engages the Buddha in philosophical debates. Vacchagotta is known for his skepticism and challenging questions, which the Buddha skillfully addresses with wisdom and compassion. These discourses explore a wide range of topics, including the nature of the self, the nature of the world, and the path to liberation. The Buddha's responses to Vacchagotta's inquiries offer profound insights into the core teachings of the Dhamma and the path to awakening.",
					},
				},
			},
			"sn35-44": {
				title: "The Group of Linked Discourses on the Six Sense Bases",
				description:
					'The "Book of the Six Sense Bases" is the fourth book in the Saṁyutta Nikāya. It is named after the first and longest saṁyutta, which focuses on the Buddha\'s core teaching concerning the six sense bases. The second saṁyutta on Feelings also addresses a significant doctrinal topic. The remaining eight saṁyuttas cover various secondary themes, with some organized by subject matter and others by the individuals involved in the teachings. This book offers deep insights into the interaction of senses, perception, and the experience of reality.',
				range: { start: 35, end: 44 },
				children: {
					sn35: {
						title: "Saḷāyatanasaṁyutta - Linked Discourses on the Six Sense Bases",
						description:
							'The "Linked Discourses on the Six Sense Bases" contains discourses focusing on the six sense bases and their corresponding objects. These teachings explore the nature of sensory experience, the arising of contact, and the role of consciousness in the process of perception. By examining the interplay between the senses and their objects, these discourses offer insights into the nature of reality and the conditions for suffering and liberation.',
					},
					sn43: {
						title: "Asaṅkhatasaṁyutta - Linked Discourses on the Unconditioned",
						description:
							'The "Linked Discourses on the Unconditioned" contains discourses focusing on the unconditioned, the ultimate reality beyond conditioned phenomena. These teachings explore the nature of the unconditioned, its relationship to the conditioned, and the path to realizing the unconditioned. By examining the nature of ultimate reality, these discourses offer insights into the nature of liberation and the conditions for spiritual awakening.',
					},
				},
			},
			"sn45-56": {
				title: "The Group of Linked Discourses on the Way Of Practice",
				description:
					'The "Great Book" is the fifth and largest book in the Saṁyutta Nikāya, comprising twelve saṁyuttas centered on the Buddha\'s teachings on the way of practice leading to awakening. The first saṁyutta, the "Section on the Way of Practice" (Maggasaṁyutta), along with the following seven saṁyuttas, expounds on the bodhipakkhiyā dhammā, or "qualities leading to awakening", as taught by the Buddha. The remaining saṁyuttas offer various perspectives from the Buddha on the way of practice, concluding with teachings on stream-entry and the four noble truths. This book offers comprehensive insights into the Buddha\'s guidance on the way of practice to awakening.',
				range: { start: 45, end: 56 },
				children: {
					sn45: {
						title: "Maggasaṁyutta - Linked Discourses on the Eightfold Path",
						description:
							'The "Linked Discourses on the Eightfold Path" contains discourses focusing on the Noble Eightfold Path, the Buddha\'s core teaching on the way of practice leading to awakening. These teachings explore each factor of the path — right view, right intention, right speech, right action, right livelihood, right effort, right mindfulness, and right collectedness — offering guidance on how to cultivate these factors in daily life. By examining the path to awakening, these discourses provide insights into the conditions for spiritual growth and liberation.',
					},
					sn46: {
						title: "Bojjhaṅgasaṁyutta - Linked Discourses on the Factors of Awakening",
						description:
							'The "Linked Discourses on the Factors of Awakening" contains discourses focusing on the seven factors that lead to awakening when cultivated. These factors include mindfulness, investigation of mental qualities (principles, states), energy, joy, tranquility, collectedness, and equanimity (mental poise). These teachings explore the qualities that support spiritual growth and the development of insight. By examining the factors of awakening, these discourses offer insights into the conditions for spiritual progress and liberation.',
					},
					sn51: {
						title: "Iddhipādasaṁyutta - Linked Discourses on the Bases of Psychic Ability",
						description:
							'The "Linked Discourses on the Bases of Psychic Ability" contains discourses focusing on the qualities of aspiration, energy, purification of mind, and investigation that lead to the development of psychic ability when frequently cultivated. This collection offers insights into the power of the mind and the potential for spiritual growth through the cultivation of these qualities.',
					},
					sn55: {
						title: "Sotāpattisaṁyutta - Linked Discourses on Stream-Entry",
						description:
							'The "Linked Discourses on Stream-Entry" focuses on the qualities and practices leading to the attainment of stream-entry, the first stage of awakening. It explores two key sets of four qualities: one that defines a stream-enterer, centered on experiential confidence and ethical conduct, and another that leads to stream-entry, emphasizing hearing the teachings and practicing accordingly. These teachings highlight the crucial role of experiential confidence and ethical behavior in achieving this significant milestone on the path to liberation, while also acknowledging that other qualities are essential to fully understanding and realizing stream-entry.',
					},
					sn56: {
						title: "Saccasaṁyutta - Linked Discourses on the Truths",
						description:
							'The "Linked Discourses on the Truths" contains discourses centered on the four noble truths: suffering, its arising, its ending, and the way of practice for its ending. These fundamental teachings formed the core of the Buddha\'s first discourse, which is included here as [SN 56.11](/sn56.11). The Buddha taught that all his teachings are encompassed within these four truths. This chapter offers a comprehensive perspective on the other teachings, linking them to the understanding and realization of the four noble truths, which culminates in enlightenment.',
					},
				},
			},
		},
	},
	snp: {
		title: "Sutta Nipāta",
		description:
			"An early collection of discourses in verse, emphasizing simplicity, renunciation, and deep philosophical inquiry, including some of the oldest and most poetic teachings of the Buddha.",
		children: {
			snp1: {
				title: "Uragavagga - The Serpent Chapter",
				description:
					"This chapter of the Sutta Nipāta consists of twelve diverse poems, beginning with a series of similes that compare a liberated one to a serpent shedding its skin. The poems vary in style and content, likely collected from different sources. This chapter includes many timeless teachings, such as the Mettā Sutta on loving-kindness and the Parābhava Sutta, which warns against the causes of downfall. This collection offers profound insights into the Buddha's teachings through poetic expression.",
			},
			snp2: {
				title: "Cūḷavagga - The Lesser Chapter",
				description:
					"This chapter of the Sutta Nipāta consists of fourteen diverse poems, each offering unique insights into the Buddha's teachings. The poems address a range of spiritual themes, including the treasures of the Triple Gem, the nature of true defilement, the blessings of skillful behavior, and the conduct of a true brahmin.",
			},
			snp3: {
				title: "Mahāvagga - The Great Chapter",
				description:
					"This chapter of the Sutta Nipāta contains twelve longer poems, which often expand into legendary narratives. The first two discourses and the Nalaka Sutta provide early glimpses into crucial episodes of the Buddha's life. While some of these poems appear elsewhere in the canon, the Dvayatānupassanā Sutta offers a unique perspective on dependent co-arising and other topics typically explored in prose texts. This chapter offers a rich blend of storytelling and profound teachings, providing deeper insights into the Buddha's life and core principles of the Dhamma.",
			},
			snp4: {
				title: "Aṭṭhakavagga - The Chapter of Eights",
				description:
					"This chapter is considered one of the earliest texts in the canon. It is known for its direct and powerful style, stripped of literary embellishments. A distinctive feature of this chapter is its critique of meaningless debates and attachment to views. Notably, the Attadaṇḍa Sutta provides an alternative account of the reasons for the Buddha's renunciation. This collection offers profound insights into the Buddha's teachings, emphasizing clarity and purpose in spiritual practice.",
			},
			snp5: {
				title: "Pārāyanavagga - The Chapter on the Way to the Beyond",
				description:
					"This chapter is considered one of the most profound and poetic compositions in early Buddhism. It begins with a brahmin teacher, troubled by an unwanted curse, who sends his students on a journey to seek the Buddha. Upon meeting the Buddha, the students ask a series of deep and philosophical questions that reflect their advanced understanding and meditation practice. The discourses cover a wide range of topics, including the nature of mindfulness, the cessation of suffering, and the qualities of a true sage. The chapter concludes with a powerful declaration of faith and dedication to the Buddha's teachings, capturing the transformative impact of the encounter. This collection provides a rich and moving exploration of spiritual inquiry and the way of practice to liberation.",
			},
		},
	},
	iti: {
		title: "Itivuttaka - As it was Said",
		description:
			"A collection of 112 short discourses where the Buddha’s words are framed with “Thus it was said,” covering core aspects of Dhamma in concise and impactful teachings.",
		children: {
			"iti1-27": {
				title: "Ekakanipāta - The Book of the Ones",
				description:
					'The "The Book of the Ones" contains 27 discourses, each dealing with a single important concept or teaching. These are concise and focus on the essence of a single point, often discussing the fundamentals of the Dhamma.',
				range: {
					start: 1,
					end: 27,
				},
			},
			"iti28-49": {
				title: "Dukanipāta - The Book of the Twos",
				description:
					'The "The Book of the Twos" contains 22 discourses, each dealing with pairs of concepts or teachings. These discourses explore the relationship between two elements, such as good and evil, wisdom and compassion, or effort and mindfulness.',
				range: {
					start: 28,
					end: 49,
				},
			},
			"iti50-99": {
				title: "Tikanipāta - The Book of the Threes",
				description:
					'The "The Book of the Threes" contains 50 discourses, each dealing with sets of three concepts or teachings. These discourses explore the interconnectedness of these elements and their collective significance in the practice of the Dhamma.',
				range: {
					start: 50,
					end: 99,
				},
			},
			"iti100-112": {
				title: "Catukkanipāta - The Book of the Fours",
				description:
					'The "The Book of the Fours" contains 13 discourses. Here, teachings are presented in groups of fours, covering various sets of four principles or qualities, such as the Four Noble Truths or the four Brahmavihāras (divine abidings: loving-kindness, compassion, sympathetic joy, and equanimity).',
				range: {
					start: 100,
					end: 112,
				},
			},
		},
	},
	mn: {
		title: "Majjhima Nikāya - Middle Length Discourses",
		description:
			"A collection of 152 suttas that provide in-depth teachings on meditation, wisdom, and the path to liberation, balancing practical guidance with deep philosophical inquiry.",
		children: {
			"mn1-50": {
				title: "Mūlapaṇṇāsa - The Root Fifty",
				range: { start: 1, end: 50 },
			},
			"mn51-100": {
				title: "Majjhimapaṇṇāsa - The Middle Fifty",
				range: { start: 51, end: 100 },
			},
			"mn101-152": {
				title: "Uparipaṇṇāsa - The Last Fifty",
				range: { start: 101, end: 152 },
			},
		},
	},
	an: {
		title: "Aṅguttara Nikāya - Numerical Discourses",
		children: {
			an1: {
				title: "The Book of the Ones",
				description:
					"This chapter consists of short discourses that explore singular concepts or principles central to the Buddha's teachings. Each sutta in this collection highlights a single factor or quality, such as mindfulness, collectedness, or ethical conduct. These concise teachings offer foundational insights into the Dhamma, emphasizing the importance of individual qualities that contribute to the path of spiritual development. The \"Book of Ones\" serves as an essential resource for understanding the core elements of the Buddha's teachings in a straightforward and accessible format.",
			},
			an2: {
				title: "The Book of the Twos",
				description:
					'This chapter presents discourses that explore pairs of qualities, concepts, or principles fundamental to the Buddha\'s teachings. Each sutta examines the relationship between two elements, such as good and evil, wisdom and compassion, or effort and mindfulness. These teachings emphasize the balance and interdependence of these dualities in the practice of the Dhamma. The "Book of Twos" provides valuable insights into how complementary qualities work together to support spiritual growth and understanding on the way of practice to liberation.',
			},
			an3: {
				title: "The Book of the Threes",
				description:
					'This chapter contains discourses that explore sets of three qualities, concepts, or principles integral to the Buddha\'s teachings. Each sutta delves into triads such as the three kinds of right conduct, the three types of happiness, or the three aspects of wisdom. These teachings highlight the interrelated nature of these elements and their combined importance in the practice of the Dhamma. The "Book of Threes" offers a deeper understanding of how these grouped qualities work together to foster spiritual development and insight on the way of practice to enlightenment.',
			},
			an4: {
				title: "The Book of the Fours",
				description:
					'This chapter contains discourses that explore sets of four qualities, concepts, or principles essential to the Buddha\'s teachings. Each sutta examines groups such as the four foundations of mindfulness, the four types of noble disciples, or the four aspects of right effort. These teachings emphasize the interconnectedness of these elements and their collective significance in the practice of the Dhamma. The "Book of Fours" provides a deeper understanding of how these grouped qualities contribute to spiritual development and insight on the way of practice to enlightenment.',
			},
			an5: {
				title: "The Book of the Fives",
				description:
					'This chapter contains discourses that explore sets of five qualities, concepts, or principles central to the Buddha\'s teachings. Each sutta investigates groups such as the five aggregates, the five spiritual faculties, or the five hindrances. These teachings demonstrate how these elements interact and support each other in the practice of the Dhamma. The "Book of Fives" offers a comprehensive understanding of how these grouped qualities work together to advance spiritual development and insight on the way of practice to enlightenment.',
			},
			an6: {
				title: "The Book of the Sixes",
				description:
					'This chapter contains discourses that explore sets of six qualities, concepts, or principles that are key to the Buddha\'s teachings. Each sutta delves into groups such as the six sense bases, the six recollections, or the six types of mindfulness. These teachings illustrate the interconnectedness of these elements and their importance in the practice of the Dhamma. The "Book of Sixes" provides valuable insights into how these grouped qualities contribute to spiritual growth and understanding on the way of practice to enlightenment.',
			},
			an7: {
				title: "The Book of the Sevens",
				description:
					'This chapter contains discourses that explore sets of seven qualities, concepts, or principles foundational to the Buddha\'s teachings. Each sutta examines groups such as the seven factors of enlightenment, the seven kinds of wealth, or the seven types of noble persons. These teachings highlight the significance of these elements in the practice of the Dhamma and their role in supporting spiritual development. The "Book of Sevens" offers deep insights into how these grouped qualities work together to guide practitioners on the way of practice to enlightenment.',
			},
			an8: {
				title: "The Book of the Eights",
				description:
					'This chapter contains discourses that explore sets of eight qualities, concepts, or principles integral to the Buddha\'s teachings. Each sutta delves into groups such as the Noble Eightfold Path, the eight causes of suffering, or the eight types of individuals worthy of offerings. These teachings emphasize the importance of these elements in the practice of the Dhamma and their collective role in advancing spiritual progress. The "Book of Eights" provides valuable insights into how these grouped qualities contribute to the way of practice leading to enlightenment.',
			},
			an9: {
				title: "The Book of the Nines",
				description:
					'This chapter contains discourses that explore sets of nine qualities, concepts, or principles that are essential to the Buddha\'s teachings. Each sutta examines groups such as the nine progressive abodes, the nine causes of resentment, or the nine kinds of people. These teachings highlight the interconnection and significance of these elements in the practice of the Dhamma. The "Book of Nines" offers profound insights into how these grouped qualities work together to foster spiritual growth and insight on the way of practice to enlightenment.',
			},
			an10: {
				title: "The Book of the Tens",
				description:
					'This chapter contains discourses that explore sets of ten qualities, concepts, or principles crucial to the Buddha\'s teachings. Each sutta delves into groups such as the ten courses of wholesome action, the ten perfections (pāramīs), or the ten fetters. These teachings illustrate the interconnectedness and collective importance of these elements in the practice of the Dhamma. The "Book of Tens" provides comprehensive insights into how these grouped qualities contribute to spiritual development and the way of practice leading to enlightenment.',
			},
			an11: {
				title: "The Book of the Elevens",
				description:
					'This chapter contains discourses that explore sets of eleven qualities, concepts, or principles vital to the Buddha\'s teachings. Each sutta examines groups such as the eleven benefits of loving-kindness, the eleven kinds of wholesome deeds, or the eleven factors leading to non-returning. These teachings emphasize the significance and interrelation of these elements in the practice of the Dhamma. The "Book of Elevens" offers valuable insights into how these grouped qualities support spiritual progress and guide practitioners on the way of practice to enlightenment.',
			},
		},
	},
	ud: {
		title: "Udāna - Inspired Utterances",
		description:
			"A collection of 80 inspired utterances of the Buddha, often arising spontaneously in response to profound moments, expressing deep insight and realization.",
		children: {
			ud1: {
				title: "Bodhivagga - The Chapter on Awakening",
				description:
					"This chapter begins with a series of discourses delivered by the Buddha immediately after his awakening, establishing a core teaching: that awakening is possible through one's own efforts. Each discourse examines the idea of the true \"brahmin\", defined not by hereditary caste but by freedom from defilements. This collection offers profound insights into the Buddha's early teachings on spiritual liberation and the qualities of true nobility.",
			},
			ud2: {
				title: "Mucalindavagga - The Chapter with Mucalinda",
				description:
					"This chapter delves into the emotional dimension of enlightenment, as experienced by the Buddha after his awakening. Having discovered a spiritual happiness surpassing any worldly joy, the Buddha's discourses in this section emphasize the profound and enduring happiness that arises from true liberation. This collection offers insights into the depth of contentment and peace found in the enlightened mind.",
			},
			ud3: {
				title: "Nandavagga - The Chapter with Nanda",
				description:
					"This chapter centers on the theme of equanimity in the face of pleasure and pain. The discourses provide several examples of monastic conduct marked by poise and balance, illustrating the Buddha's teachings on maintaining inner stability amidst the dualities of life. This collection offers valuable insights into the cultivation of equanimity and the serene, composed nature of the enlightened mind.",
			},
			ud4: {
				title: "Meghiyavagga - The Chapter with Meghiya",
				description:
					"This chapter explores the consequences of a lack of balance in a practitioner's life. When a mind is undisciplined and unbalanced, it can lead to harm for oneself and others. The discourses in this section emphasize the importance of mental discipline and the dangers of allowing the mind to become unruly. This collection highlights the critical role of mindfulness and self-control in the way of practice to liberation.",
			},
			ud5: {
				title: "Soṇavagga - The Chapter with Soṇa",
				description:
					"This chapter broadens its focus beyond the individual practitioner to encompass the \"all\", demonstrating how the Dhamma is inclusive of all beings, from kings to the smallest creatures like little fish. The discourses in this section reveal the universal nature of the Buddha's teachings, emphasizing that the Dhamma applies to all beings regardless of their status or form. This collection offers a profound understanding of the all-encompassing compassion and wisdom inherent in the Buddha's message.",
			},
			ud6: {
				title: "Jaccandhavagga - The Chapter on Blind From Birth",
				description:
					"This chapter returns to stories from the Buddha's life, focusing on events near the end of his journey. It serves as a reminder of those who have lost their way, contrasting their struggles with the Buddha's unwavering way of practice to enlightenment. These discourses offer a reflective view on the later stages of the Buddha's life and the enduring lessons of his teachings.",
			},
			ud7: {
				title: "Cūḷavagga - The Lesser Chapter",
				description:
					"This chapter revisits the Buddha's awakening, using water-based imagery to highlight the transformative power of the Dhamma. The discourses emphasize how the Dhamma serves as a vessel, carrying practitioners across the flood of worldly challenges and towards liberation. This collection reinforces the strength and guidance offered by the Buddha's teachings in navigating the journey to awakening.",
			},
			ud8: {
				title: "Pāṭaligāmiyavagga - The Chapter with the Pāṭali Villagers",
				description:
					"The final chapter of the Udāna addresses the Buddha's passing away and the profound crisis of faith that followed. It opens with a series of solemn declarations on Nibbāna, reflecting the depth of the Buddha's teachings on ultimate liberation. The chapter concludes with the remarkable passing of the bhikkhu Dabba, illustrating the enduring strength of the Dhamma even in the face of loss. This collection offers deep reflections on the end of the Buddha's life and the spiritual legacy he left behind.",
			},
		},
	},
	dhp: {
		title: "Dhammapada - The Path of Truth",
		description:
			"A widely read collection of 423 verses of the Buddha's teachings, offering practical wisdom on ethics, mental cultivation, and liberation, organized into memorable chapters.",
	},
};
