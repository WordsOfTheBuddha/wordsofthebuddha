import type { DirectoryStructure } from "../types/directory";

export const directoryStructure: Record<string, DirectoryStructure> = {
	sn: {
		title: "Saṃyutta Nikāya - Linked Discourses",
		description:
			"A collection of discourses grouped by theme, offering rich explorations of core Buddhist concepts such as dependent origination, the five aggregates, and the path to liberation.",
		children: {
			"sn1-11": {
				title: "The Group of Linked Discourses with Verses",
				description:
					'The "Group of Linked Discourses with Verses" forms the opening section of the Saṁyutta Nikāya. Distinguished by its frequent use of verse, often paired with prose, this collection presents the Buddha’s teachings through a poetic lens. The suttas feature a diverse cast of figures—deities, Brahmās (Gods), kings, and disciples—engaging in dialogues that address core elements of the Dhamma, such as suffering, liberation, and the law of kamma. Rich with vivid imagery and lyrical expression, this division weaves together profound insights and narrative depth, offering an evocative introduction to early Buddhist thought.',
				range: { start: 1, end: 11 },
				children: {
					sn1: {
						title: "Devatāsaṁyutta - Linked Discourses with Deities",
						description:
							'The "Linked Discourses With Deities" features dialogues between the Buddha and various deities, beings who visit, often at night, to engage in dialogues about the Dhamma. These suttas, frequently featuring verses, explore a wide range of topics, from the nature of suffering to the path of liberation. The devas, depicted as luminous and reverent, approach the Awakened One with questions or reflections, revealing their eagerness to deepen their understanding. This collection highlights the universal reach of the Buddha’s teachings, extending even to beings of higher realms seeking wisdom.',
					},
					sn2: {
						title: "Devaputtasaṁyutta - Linked Discourses with Young Deities",
						description:
							'The "Linked Discourses with Young Deities" features young celestial beings, often newly reborn from human lives, who come to the Buddha or his disciples to express their insights or seek further guidance. These suttas, rich with verse, delve into themes of kamma, rebirth, and the pursuit of wisdom, as the young devas reflect on their past actions and their current exalted state. Portrayed with a mix of awe and curiosity, these beings engage in poignant exchanges that underscore the continuity of the spiritual journey across realms. This collection offers a vivid exploration of how past deeds shape present existence, even among the divine.',
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
					sn5: {
						title: "Bhikkhunīsaṁyutta - Linked Discourses with Bhikkhunīs",
						description:
							'The "Linked Discourses with Bhikkhunīs" contains verses from ten awakened bhikkhunis who express their liberation through poetic reflections. Each sutta features a bhikkhunī confronting Māra or celebrating her mastery of the Dhamma, showcasing their insight into impermanence, suffering, and not-self. These discourses highlight the spiritual accomplishments of these women in the early Buddhist community.',
					},
					sn6: {
						title: "Brahmasaṁyutta - Linked Discourses with Brahmas",
						description:
							'The "Linked Discourses with Brahmas" recount interactions between the Buddha or his disciples and Brahmas, mighty celestial beings residing in exalted realms. In these suttas, Brahmas often approach the Buddha to seek clarification, offer praise, or discuss profound topics such as the nature of existence and the path to liberation. The dialogues explore themes like impermanence, the limitations of even the highest states of being, and the unparalleled depth of the Buddha’s wisdom. This saṁyutta illustrates the expansive reach of the Dhamma, demonstrating its relevance and authority even among the most elevated beings in the cosmos.',
					},
					sn7: {
						title: "Brāhmaṇasaṁyutta - Linked Discourses with Brahmins",
						description:
							"The \"Linked Discourses with Brahmins\" focuses on the Buddha's interactions with brahmins, the religious scholars and ritual practitioners of his time. In these dialogues, the Buddha challenges the brahmins' reliance on caste and rituals, emphasizing the importance of ethical actions and inner virtue over birth or societal status. These suttas often depict brahmins boasting about their superiority, only to be gently corrected by the Buddha, where he teaches that one's deeds —not birth— make one a true brahmin. This collection illustrates the Buddha's critique of rigid social hierarchies and his emphasis on a universal path of ethical conduct and wisdom for spiritual liberation.",
					},
					sn8: {
						title: "Vangīsasaṁyutta - Linked Discourses with Vangīsa",
						description:
							'The "Linked Discourses with Vangīsa" focus on Venerable Vangīsa, a distinguished disciple of the Buddha celebrated for his exceptional poetic abilities. This collection features suttas where Vangīsa composes spontaneous verses to express his deep devotion to the Buddha, his admiration for the Dhamma, or his contemplations on the spiritual journey. Through his lyrical compositions, Vangīsa captures profound spiritual truths and emotions, blending artistry with insight. The discourses showcase the transformative power of poetry as a medium for conveying the essence of the Buddha’s teachings, making this saṁyutta a unique fusion of wisdom and beauty.',
					},
					sn9: {
						title: "Vanasaṁyutta - Linked Discourses in the Forest",
						description:
							'The "Linked Discourses in the Forest" centers on the bhikkhus who dwell in the wilderness. Typically, the bhikkhu is slack or negligent in some way, and a deity appears to call them out and encourages them to strive with greater diligence. These suttas emphasize the need for effort and mindfulness in solitary practice.',
					},
					sn10: {
						title: "Yakkhasaṁyutta - Linked Discourses with Yakkhas",
						description:
							'The "Linked Discourses with Yakkhas" depicts encounters between the Buddha or his disciples and yakkhas, territorial spirits who often challenge or question them. In each sutta, the Buddha or a disciple responds with teachings on morality, impermanence, or the dangers of anger, subduing or instructing the yakkhas. These discourses illustrate the Dhamma’s power to transform even hostile beings.',
					},
					sn11: {
						title: "Sakkasaṁyutta - Linked Discourses with Sakka",
						description:
							'The "Linked Discourses with Sakka" features Sakka, the lord of the deities, in conversations with the Buddha. In these suttas, Sakka seeks clarification on ethical conduct, the benefits of giving, or the path to liberation, often prompted by challenges in his celestial rule. The discourses reveal his devotion to the Dhamma and its application to leadership.',
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
							'The "Linked Discourses on Acquisitions and Respect"  contain teachings on the danger of acqusitions, respect, and popularity for spiritual practitioners. The Buddha emphasizes how these worldly rewards are vicious, bitter, severe, and obstructive, leading to complacency, attachment, and spiritual downfall. Through vivid similes — such as comparing acquisitions and respect to a fisherman\'s baited hook — the discourses highlight how even accomplished practitioners can become ensnared if they relish praise and recognition.',
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
							'The "Linked Discourses on the Aggregates" contains discourses focusing on the five aggregates that constitute personal experience: form, feeling, perception, intentional constructs, and consciousness. These teachings explore the nature of the aggregates, their arising and ceasing, and their relationship to suffering and liberation. By examining the components of experience, these discourses offer insights into the nature of self and the conditions for suffering and liberation.',
					},
					sn23: {
						title: "Rādhasaṁyutta - Linked Discourses with Rādha",
						description:
							"The \"Linked Discourses with Rādha\" centers on Venerable Rādha, a disciple of the Buddha known for his sharp intellect and his role in asking profound questions that lead to deep teachings. These discourses often involve Venerable Rādha approaching the Buddha with inquiries about the nature of reality, the self, and the path to liberation. The Buddha's responses are typically concise yet deeply insightful, using metaphors and analogies to illuminate complex concepts. This collection provides a glimpse into the dynamic between teacher and student, showcasing how the Buddha's wisdom unfolds through dialogue.",
					},
					sn25: {
						title: "Okkantasaṁyutta - Linked Discourses on Arrival",
						description:
							'The "Linked Discourses on Arrival" focuses on the theme of arrival or entry into the Dhamma, exploring the moment when one first comprehends the truth of the teachings. These suttas often feature the Buddha or his disciples explaining the significance of this pivotal moment, using vivid imagery and examples to convey the transformative power of understanding. The discourses in this collection emphasize the importance of direct experience and the sudden, profound shift that occurs when one truly sees the Dhamma. This saṁyutta offers a compelling look at the threshold of awakening.',
					},
					sn28: {
						title: "Sāriputtasaṁyutta - Linked Discourses with Sāriputta",
						description:
							"The \"Linked Discourses with Sāriputta\" features Venerable Sāriputta, one of the Buddha's foremost disciples, renowned for his wisdom and analytical skills. These discourses often involve Sāriputta engaging in discussions with the Buddha or other bhikkhus, delving into intricate aspects of the Dhamma. The suttas in this collection are characterized by their depth and precision, as Sāriputta's questions and reflections lead to detailed expositions on topics such as dependent origination, the nature of consciousness, and the path to liberation. This saṁyutta highlights the intellectual rigor and clarity that Sāriputta brings to the teachings.",
					},
					sn33: {
						title: "Vacchagottasaṁyutta - Linked Discourses with Vacchagotta",
						description:
							"The \"Linked Discourses with Vacchagotta\" features dialogues between the Buddha and Vacchagotta, a wanderer who engages the Buddha in philosophical debates. Vacchagotta is known for his skepticism and challenging questions, which the Buddha skillfully addresses with wisdom and compassion. These discourses explore a wide range of topics, including the nature of the self, the nature of the world, and the path to liberation. The Buddha's responses to Vacchagotta's inquiries offer profound insights into the core teachings of the Dhamma and the path to awakening.",
					},
					sn34: {
						title: "Jhānasaṁyutta - Linked Discourses on Collectedness (jhāna)",
						description:
							'The "Linked Discourses on Collectedness" contains discourses dealing with the meditative skills required to perfect jhānas. Each discourse describes a meditator who is skilled in some aspects, but not in others, and holds the one skilled in all aspects to be the best.',
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
					sn36: {
						title: "Vedanāsaṁyutta - Linked Discourses on Feelings",
						description:
							'The "Linked Discourses on Feeling" explores the nature of felt experiences—pleasant, painful, and neutral—as a fundamental aspect of experience. These teachings examine how feelings arise, their role in shaping perception, and the underlying tendencies that lead to attachment or aversion. By understanding the conditioned nature of feeling and its cessation, these discourses offer insight into the path to liberation and the end of suffering.',
					},
					sn37: {
						title: "Mātugāmasaṁyutta - Linked Discourses on Women",
						description:
							'The "Linked Discourses on Women" contains discourses dealing with the specific circumstances and qualities of women. These suttas often discuss the five powers of a woman—beauty, wealth, relatives, sons, and virtue—and how these qualities influence her life and future rebirths. The teachings also address the social roles of women and the importance of ethical conduct. While reflecting the cultural context of ancient India, these discourses underscore the universal principle that spiritual progress depends on one\'s actions and wisdom.',
					},
					sn38: {
						title: "Jambukhādakasaṁyutta - Linked Discourses with Jambukhādaka",
						description:
							'The "Linked Discourses with Jambukhādaka" features a series of conversations between Venerable Sāriputta and his nephew, the wanderer Jambukhādaka. These discourses follow a systematic pattern where Jambukhādaka asks direct questions about core Buddhist concepts, such as Nibbāna, arahantship, and the purpose of the spiritual life. Sāriputta responds with clear, concise explanations that illuminate the path to liberation.',
					},
					sn41: {
						title: "Cittasaṁyutta - Linked Discourses with Citta the Householder",
						description:
							'The "Linked Discourses with Citta the Householder" features Citta, the foremost lay disciple of the Buddha in giving Dhamma discourses. These discourses often involve Citta engaging in dialogues with elder bhikkhus. He skillfully discusses complex topics such as the nature of fetters, the diversity of elements, and the subtleties of meditative states. Citta\'s profound wisdom and clarity highlights that deep insight into the Dhamma is accessible to lay practitioners as well as monastics.',
					},
					sn42: {
						title: "Gāmaṇisaṁyutta - Linked Discourses with Headman",
						description:
							'The "Linked Discourses with Headman" contains dialogues between the Buddha and village leaders, focusing on ethical conduct, social harmony, and the application of Dhamma in daily life. These teachings offer guidance on virtuous living and wise leadership, illuminating the path to personal and communal well-being. Through these conversations, the Buddha addresses the headmen\'s concerns, emphasizing practical principles such as right action, generosity, and moral integrity, tailored to the responsibilities and spiritual development of lay practitioners.',
					},
					sn43: {
						title: "Asaṅkhatasaṁyutta - Linked Discourses on the Unconditioned",
						description:
							'The "Linked Discourses on the Unconditioned" contains discourses focusing on the unconditioned, the ultimate reality beyond conditioned phenomena. These teachings explore the nature of the unconditioned, its relationship to the conditioned, and the path to realizing the unconditioned. By examining the nature of ultimate reality, these discourses offer insights into the nature of liberation and the conditions for spiritual awakening.',
					},
					sn44: {
						title: "Abyākatasaṁyutta - Linked Discourses on the Undeclared",
						description:
							'The "Linked Discourses on the Undeclared" features dialogues concerning the "undeclared" (abyākata) points—questions the Buddha refused to answer, such as whether the world is eternal or infinite, and the status of an Awakened One after death. These discourses clarify why the Buddha set these questions aside: they are speculative, do not lead to liberation, and are often based on misconceptions about the self. This collection highlights the Buddha\'s pragmatic focus on suffering and its cessation.',
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
					sn47: {
						title: "Satipaṭṭhānasaṁyutta - Linked Discourses on the Establishments of Mindfulness",
						description:
							'The "Linked Discourses on the Establishments of Mindfulness" contains discourses focusing on the four foundations of mindfulness: clear comprehension and full awareness of the body, felt experience, mind, and mental qualities. These teachings explore how to establish mindfulness as a means to develop right collectedness, insight and wisdom.',
					},
					sn48: {
						title: "Indriyasaṁyutta - Linked Discourses on the Faculties",
						description:
							'The "Linked Discourses on the Faculties" explores the five spiritual faculties: faith, energy, mindfulness, collectedness, and wisdom. These teachings examine how these faculties function as both the means to attain liberation and as qualities that become increasingly refined through practice. By developing these faculties in a balanced way, practitioners can progress on the path to awakening.',
					},
					sn51: {
						title: "Iddhipādasaṁyutta - Linked Discourses on the Bases of Psychic Power",
						description:
							'The "Linked Discourses on the Bases of Psychic Power" contains discourses focusing on the qualities of aspiration, energy, purification of mind, and investigation that lead to the development of psychic power when frequently cultivated. This collection offers insights into the power of the mind and the potential for spiritual growth through the cultivation of these qualities.',
					},
					sn53: {
						title: "Jhānasaṁyutta - Linked Discourses on Collectedness",
						description:
							'The "Linked Discourses on Collectedness" contains teachings on the four jhānas—states of mental composure where awareness is gathered and steady. These discourses emphasize how cultivating jhānas leads a practitioner to slant, slope, and incline towards Nibbāna. Through the progressive deepening of collectedness—from reflection and examination to equanimity and purification of mindfulness—these teachings reveal the transformative power of cultivating this stable, undistracted awareness on the path to liberation.',
					},
					sn54: {
						title: "Ānāpānasaṁyutta - Linked Discourses on Mindfulness of Breathing",
						description:
							'The "Linked Discourses on Mindfulness of Breathing" contains discourses focusing on the practice of mindfulness of breathing (ānāpānasati). These teachings explore the sixteen steps of mindfulness of breathing, which fulfill the four foundations of mindfulness and lead to the seven factors of awakening. By cultivating this practice, one develops collectedness and insight, leading to liberation.',
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
					"This chapter contains twelve poetic suttas, opening with the Uraga Sutta, which likens liberation to a snake shedding its skin. Key texts include the Mettā Sutta, teaching loving-kindness, and the Parābhava Sutta, listing causes of downfall. Drawn from varied sources, these poems offer practical lessons on ethics, mindfulness, and wisdom in diverse styles.",
			},
			snp2: {
				title: "Cūḷavagga - The Lesser Chapter",
				description:
					"This chapter of the Sutta Nipāta consists of fourteen diverse poetic suttas, exploring themes like the worth of the Triple Gem, the inner nature of defilement, and the rewards of skillful conduct. It also defines a true brahmin by actions, not birth. These verses provide straightforward guidance on living morally and pursuing liberation.",
			},
			snp3: {
				title: "Mahāvagga - The Great Chapter",
				description:
					"This chapter features twelve longer suttas, blending narrative and doctrine. The Pabbajjā Sutta and Padhāna Sutta recount the Buddha’s renunciation and fight with Māra, while the Nalaka Sutta shares a prophecy about his life. The Dvayatānupassanā Sutta examines dependent co-arising. It merges storytelling with core Buddhist teachings.",
			},
			snp4: {
				title: "Aṭṭhakavagga - The Chapter of Eights",
				description:
					"An early collection of sixteen suttas, often in sets of eight verses, this chapter critiques clinging to views and fruitless arguments. The Attadaṇḍa Sutta ties the Buddha’s renunciation to life’s suffering. Direct and unadorned, it emphasizes clarity, detachment, and the path to peace.",
			},
			snp5: {
				title: "Pārāyanavagga - The Chapter on the Way to the Far Shore",
				description:
					"This chapter starts with a brahmin sending sixteen students to ask the Buddha profound questions about mindfulness, ending suffering, and a sage’s qualities. The Buddha’s replies lead to their declarations of faith. Poetic and deep, it traces a clear path to liberation through dialogue.",
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
					'The "The Book of the Fours" contains 13 discourses. Here, teachings are presented in groups of fours, covering various sets of four principles or qualities, such as the Four Noble Truths or the four Brahmavihāras (divine abidings: loving-kindness, compassion, appreciative joy, and equanimity).',
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
				title: "Mūlapaṇṇāsa - The First Fifty",
				description:
					"The first book of the Majjhima Nikāya, the Mūlapaṇṇāsa, contains discourses that establish the foundational principles of the Buddha’s teachings, beginning with the Mūlapariyāya Sutta, which examines how the notion of a personal existence emerges from the process of perception. Other discourses explore various aspects of the Dhamma through Buddha's own experiences leading to his full awakening, illustrative similes, training guidelines and paired discourses on key doctrines. This book provides a comprehensive introduction to the core teachings of the Buddha and the practices of early Buddhism.",
				range: { start: 1, end: 50 },
			},
			"mn51-100": {
				title: "Majjhimapaṇṇāsa - The Middle Fifty",
				description:
					"The second book of the Majjhima Nikāya, the Majjhimapaṇṇāsa, features discourses organized around the individuals involved in the teachings, such as householders, bhikkhus, wanderers, kings, and brahmins. Each of its five chapters (groupings of 10 discourses) presents teachings tailored to these groups, addressing their specific concerns and illustrating the practical application of the Dhamma across diverse contexts.",
				range: { start: 51, end: 100 },
			},
			"mn101-152": {
				title: "Uparipaṇṇāsa - The Final Fifty-Two",
				description:
					"The third book of the Majjhima Nikāya, the Uparipaṇṇāsa, delves into specific themes and advanced topics, with chapters exploring critiques of other philosophical views, meditation practices, the concept of emptiness, analytical methods, and the six sense bases. This book offers profound insights for those seeking a deeper understanding of the Buddha’s teachings.",
				range: { start: 101, end: 152 },
			},
		},
	},
	an: {
		title: "Aṅguttara Nikāya - Numerical Discourses",
		description:
			"A vast collection of discourses organized by numbered sets, offering practical teachings on daily application, cultivating virtue, collectedness, and wisdom for progress on the path to liberation.",
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
		title: "Dhammapada - The Path of Dhamma",
		description:
			"A widely read collection of 423 verses of the Buddha's teachings, offering practical wisdom on ethics, mental cultivation, and liberation, organized into memorable chapters.",
	},
	kp: {
		title: "Khuddakapāṭha - Short Passages",
		description:
			"A concise collection of nine short passages serving as a primer for novice monks and nuns, including essential recitations on taking refuge, precepts, body contemplation, protective blessings, treasures, merit-sharing, and loving-kindness, widely chanted for daily practice, protection, and introduction to core teachings.",
	},
};
