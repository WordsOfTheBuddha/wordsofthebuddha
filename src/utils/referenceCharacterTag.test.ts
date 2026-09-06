import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectionKeyForSlug,
	detectReferenceCharacters,
	extractWithTitleName,
	formatCharacterYaml,
	includesPaliStem,
	isVaggoIndexList,
	labelsFromPaliOpening,
	englishLabelFromPaliPhrase,
	upsertPaliCharacterFrontmatter,
} from "./referenceCharacterTag";

describe("extractWithTitleName", () => {
	it("reads Sujato With/To person titles", () => {
		assert.equal(extractWithTitleName("With Vacchagotta"), "Vacchagotta");
		assert.equal(
			extractWithTitleName("To Vacchagotta on the Three Knowledges"),
			"Vacchagotta",
		);
		assert.equal(
			extractWithTitleName("The Shorter Discourse With Sakuludāyī"),
			"Sakuludāyī",
		);
		assert.equal(extractWithTitleName("With Ānanda (2nd)"), "Ānanda");
		assert.equal(
			extractWithTitleName("With Bhāradvāja of Sundarikā on the Sacrificial Cake"),
			"Bhāradvāja of Sundarikā",
		);
	});

	it("does not treat To Benefit Oneself as a person", () => {
		assert.equal(extractWithTitleName("To Benefit Oneself"), null);
	});
});

describe("includesPaliStem", () => {
	it("does not match māro inside kumāro", () => {
		assert.equal(includesPaliStem("kumāro agamāsi", "māro"), false);
		assert.equal(includesPaliStem("māro pāpimā āgacchi", "māro"), true);
	});
});

describe("detectReferenceCharacters", () => {
	it("tags wanderer Vacchagotta from SN 33 vocative, not the Venāgapura brahmin", () => {
		const result = detectReferenceCharacters({
			slug: "sn33.11-15",
			paliTitle: "Rūpaanabhisamayādisuttapañcaka",
			paliBody: "Sāvatthinidānaṁ.\n\n“Rūpe kho, vaccha, anabhisamayā …pe…",
			sujatoTitle: "Five Discourses on Not Comprehending Form, Etc.",
			sujatoBody: "The Buddha teaches Vaccha that it is because of not comprehending form",
		});
		assert.deepEqual(result.labels, ["Wanderer Vacchagotta"]);
	});

	it("tags wanderer Vacchagotta from approach formula", () => {
		const result = detectReferenceCharacters({
			slug: "an3.57",
			paliTitle: "Vacchagottasutta",
			paliBody:
				"Atha kho vacchagotto paribbājako yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavatā saddhiṁ sammodi.",
			sujatoTitle: "With Vacchagotta",
			sujatoBody:
				"Then the wanderer Vacchagotta went up to the Buddha, and exchanged greetings with him.",
		});
		assert.deepEqual(result.labels, ["Wanderer Vacchagotta"]);
	});

	it("keeps the Venāgapura brahmin distinct", () => {
		const result = detectReferenceCharacters({
			slug: "an3.63",
			paliTitle: "Venāgapurasutta",
			paliBody:
				"yena venāgapuraṁ nāma kosalānaṁ brāhmaṇagāmo tadavasari. Assosuṁ kho venāgapurikā brāhmaṇagahapatikā",
			sujatoTitle: "At Venāgapura",
			sujatoBody: "the brahmin Vacchagotta of Venāgapura then said to the Buddha",
		});
		assert.ok(
			result.labels.includes("Brahmin Vacchagotta of Venāgapura"),
			result.labels.join(", "),
		);
		assert.ok(!result.labels.includes("Wanderer Vacchagotta"));
	});

	it("does not treat Sakuludāyī as Venerable Udāyī", () => {
		const result = detectReferenceCharacters({
			slug: "mn79",
			paliTitle: "Cūḷasakuludāyisutta",
			paliBody:
				"Tena kho pana samayena sakuludāyī paribbājako moranivāpe paribbājakārāme paṭivasati",
			sujatoTitle: "The Shorter Discourse With Sakuludāyī",
			sujatoBody: "Visiting the wanderer Sakuludāyī, the Buddha answers sixteen points",
		});
		assert.deepEqual(result.labels, ["Wanderer Sakuludāyī"]);
	});

	it("defaults SN 3 to King Pasenadi", () => {
		const result = detectReferenceCharacters({
			slug: "sn3.7",
			paliTitle: "Aḍḍakaraṇasutta",
			paliBody:
				"Ekamantaṁ nisinno kho rājā pasenadi kosalo bhagavantaṁ etadavoca",
			sujatoTitle: "Judgment",
			sujatoBody: "King Pasenadi of Kosala visits the Buddha",
		});
		assert.deepEqual(result.labels, ["King Pasenadi of Kosala"]);
	});

	it("does not tag Anāthapiṇḍika from the Jeta’s Grove nidana", () => {
		const result = detectReferenceCharacters({
			slug: "an9.4",
			paliTitle: "Nandakasutta",
			paliBody:
				"Ekaṁ samayaṁ bhagavā sāvatthiyaṁ viharati jetavane anāthapiṇḍikassa ārāme. Atha kho āyasmā nandako",
			sujatoTitle: "With Nandaka",
			sujatoBody:
				"At one time the Buddha was staying near Sāvatthī in Jeta’s Grove, Anāthapiṇḍika’s monastery. Then Venerable Nandaka",
		});
		assert.ok(!result.labels.includes("Householder Anāthapiṇḍika"), result.labels.join(", "));
		assert.ok(!result.labels.includes("Venerable Nanda"), result.labels.join(", "));
		assert.deepEqual(result.labels, ["Venerable Nandaka"]);
	});

	it("maps Gotamī onto Mahāpajāpati Gotamī when that label already exists", () => {
		const result = detectReferenceCharacters({
			slug: "an8.51",
			paliTitle: "Gotamīsutta",
			paliBody: "Atha kho mahāpajāpatī gotamī yena bhagavā tenupasaṅkami",
			sujatoTitle: "With Gotamī",
			sujatoBody: "Then Mahāpajāpati Gotamī went up to the Buddha",
			knownLabels: new Set(["Mahāpajāpati Gotamī"]),
		});
		assert.deepEqual(result.labels, ["Mahāpajāpati Gotamī"]);
		assert.ok(
			result.reviews.some(
				(review) =>
					review.reason === "alias-resolved" ||
					review.detail.includes("Mahāpajāpati Gotamī"),
			),
			result.reviews.map((review) => review.detail).join("; "),
		);
	});

	it("maps Pañcakaṅga onto Builder Pañcakaṅga", () => {
		const result = detectReferenceCharacters({
			slug: "sn36.19",
			paliTitle: "Pañcakaṅgasutta",
			paliBody: "Atha kho pañcakaṅgo thapati yenāyasmā udāyī tenupasaṅkami",
			sujatoTitle: "With Pañcakaṅga",
			sujatoBody: "Then the chamberlain Pañcakaṅga went up to Venerable Udāyī",
			knownLabels: new Set(["Builder Pañcakaṅga", "Venerable Udāyī"]),
		});
		assert.ok(result.labels.includes("Builder Pañcakaṅga"), result.labels.join("; "));
		assert.ok(!result.labels.includes("Pañcakaṅga"));
	});

	it("tags SN 21.1 from the body, not the Kolita title", () => {
		const result = detectReferenceCharacters({
			slug: "sn21.1",
			paliTitle: "Kolitasutta",
			paliBody:
				"Tatra kho āyasmā mahāmoggallāno bhikkhū āmantesi: “āvuso bhikkhave”ti.",
			sujatoTitle: "With Kolita",
			sujatoBody:
				"There Mahāmoggallāna addressed the mendicants: “Reverends, mendicants!”",
			knownLabels: new Set(["Venerable Mahāmoggallāna"]),
		});
		assert.deepEqual(result.labels, ["Venerable Mahāmoggallāna"]);
		assert.ok(!result.labels.some((label) => /kolita/i.test(label)));
	});

	it("does not invent Upatissa from the SN 21.2 title", () => {
		const result = detectReferenceCharacters({
			slug: "sn21.2",
			paliTitle: "Upatissasutta",
			paliBody:
				"Tatra kho āyasmā sāriputto bhikkhū āmantesi: “āvuso bhikkhave”ti.\n\nEvaṁ vutte, āyasmā ānando āyasmantaṁ sāriputtaṁ etadavoca",
			sujatoTitle: "With Upatissa",
			sujatoBody: "There Sāriputta addressed the mendicants",
			knownLabels: new Set(["Venerable Sāriputta", "Venerable Ānanda"]),
		});
		assert.ok(result.labels.includes("Venerable Sāriputta"), result.labels.join("; "));
		assert.ok(result.labels.includes("Venerable Ānanda"), result.labels.join("; "));
		assert.ok(!result.labels.some((label) => /upatissa/i.test(label)));
	});

	it("tags Sujāta from āyasmā, not Māra from a stock verse", () => {
		const result = detectReferenceCharacters({
			slug: "sn21.5",
			paliTitle: "Sujātasutta",
			paliBody:
				"Atha kho āyasmā sujāto yena bhagavā tenupasaṅkami.\n\nDhāreti antimaṁ dehaṁ,\njetvā māraṁ savāhinin”ti.",
			sujatoTitle: "With Sujāta",
			sujatoBody: "Then Venerable Sujāta went to see the Buddha.",
		});
		assert.deepEqual(result.labels, ["Venerable Sujāta"]);
		assert.ok(!result.labels.some((label) => /māra/i.test(label)));
	});

	it("keeps Young Brahmin Saṅgārava distinct from Brahmin Saṅgārava", () => {
		const young = detectReferenceCharacters({
			slug: "mn100",
			paliTitle: "Saṅgāravasutta",
			paliBody:
				"Tena kho pana samayena saṅgāravo nāma māṇavo cañcalikappe paṭivasati",
			sujatoTitle: "With Saṅgārava",
			sujatoBody:
				"Now at that time the student Saṅgārava was residing in Caṇḍalakappa.",
			knownLabels: new Set(["Young Brahmin Saṅgārava", "Brahmin Saṅgārava"]),
		});
		assert.deepEqual(young.labels, ["Young Brahmin Saṅgārava"]);

		const brahmin = detectReferenceCharacters({
			slug: "an5.193",
			paliTitle: "Saṅgāravasutta",
			paliBody:
				"Atha kho saṅgāravo brāhmaṇo yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavatā saddhiṁ sammodi.",
			sujatoTitle: "With Saṅgārava",
			sujatoBody: "Then Saṅgārava the brahmin went up to the Buddha",
			knownLabels: new Set(["Young Brahmin Saṅgārava", "Brahmin Saṅgārava"]),
		});
		assert.deepEqual(brahmin.labels, ["Brahmin Saṅgārava"]);
	});

	it("tags the young deity Anāthapiṇḍika from SN 2.20, not from a grove nidana", () => {
		const deity = detectReferenceCharacters({
			slug: "sn2.20",
			paliTitle: "Anāthapiṇḍikasutta",
			paliBody:
				"Ekamantaṁ ṭhito kho anāthapiṇḍiko devaputto bhagavato santike imā gāthāyo abhāsi:",
			sujatoTitle: "With Anāthapiṇḍika",
			sujatoBody:
				"Standing to one side, the young deity Anāthapiṇḍika recited these verses",
			knownLabels: new Set(["Householder Anāthapiṇḍika", "Deity Anāthapiṇḍika"]),
		});
		assert.deepEqual(deity.labels, ["Householder Anāthapiṇḍika"]);

		const grove = detectReferenceCharacters({
			slug: "sn11.1",
			paliTitle: "Suvīrasutta",
			paliBody:
				"Ekaṁ samayaṁ bhagavā sāvatthiyaṁ viharati jetavane anāthapiṇḍikassa ārāme. Atha kho sakko devānamindo",
			sujatoTitle: "With Suvīra",
			sujatoBody: "At one time the Buddha was staying near Sāvatthī in Jeta’s Grove",
			knownLabels: new Set(["Householder Anāthapiṇḍika", "Sakka, lord of the gods"]),
		});
		assert.ok(!grove.labels.includes("Householder Anāthapiṇḍika"));
		assert.ok(!grove.reviews.some((review) => review.reason === "homonym-unresolved"));
	});

	it("keeps MN 44's lay follower Visākha distinct from Pañcālī's Son", () => {
		const lay = detectReferenceCharacters({
			slug: "mn44",
			paliTitle: "Cūḷavedallasutta",
			paliBody:
				"Atha kho visākho upāsako yena dhammadinnā bhikkhunī tenupasaṅkami; upasaṅkamitvā dhammadinnaṁ bhikkhuniṁ abhivādetvā ekamantaṁ nisīdi.",
			sujatoTitle: "The Shorter Series of Questions and Answers",
			sujatoBody: "Then the lay follower Visākha went to the nun Dhammadinnā",
			knownLabels: new Set([
				"Lay follower Visākha",
				"Venerable Visākha, Pañcālī's Son",
				"Laywoman Visākhā Migāramātā",
				"Bhikkhunī Dhammadinnā",
			]),
		});
		assert.ok(lay.labels.includes("Lay follower Visākha"), lay.labels.join("; "));
		assert.ok(!lay.labels.some((label) => /pañcāl/i.test(label)));

		const monk = detectReferenceCharacters({
			slug: "sn21.7",
			paliTitle: "Visākhasutta",
			paliBody:
				"Tena kho pana samayena āyasmā visākho pañcālaputto upaṭṭhānasālāyaṁ bhikkhū dhammiyā kathāya sandasseti",
			sujatoTitle: "With Visākha, Pañcālī’s Son",
			sujatoBody: "Now at that time Venerable Visākha, Pañcālī’s Son was educating the mendicants",
			knownLabels: new Set([
				"Lay follower Visākha",
				"Venerable Visākha, Pañcālī's Son",
				"Laywoman Visākhā Migāramātā",
			]),
		});
		assert.deepEqual(monk.labels, ["Venerable Visākha, Pañcālī's Son"]);

		const migaramata = detectReferenceCharacters({
			slug: "an8.47",
			paliTitle: "Dutiyavisākhāsutta",
			paliBody:
				"Atha kho visākhā migāramātā …pe… ekamantaṁ nisinnaṁ kho visākhaṁ migāramātaraṁ bhagavā etadavoca:",
			sujatoTitle: "With Visākhā (2nd)",
			sujatoBody: "Then Visākhā, Migāra’s mother, went up to the Buddha",
			knownLabels: new Set([
				"Lay follower Visākha",
				"Venerable Visākha, Pañcālī's Son",
				"Laywoman Visākhā Migāramātā",
			]),
		});
		assert.deepEqual(migaramata.labels, ["Laywoman Visākhā Migāramātā"]);
	});

	it("does not invent Aññaṁ, Adhimānasacca, or Nissāya from AN 10.86", () => {
		const result = detectReferenceCharacters({
			slug: "an10.86",
			paliTitle: "Adhimānasutta",
			paliBody:
				"Ekaṁ samayaṁ āyasmā mahākassapo rājagahe viharati. Tamenaṁ tathāgato evaṁ cetasā ceto paricca pajānāti: ‘Adhimāniko kho ayamāyasmā adhimānasacco. kiṁ nu kho ayamāyasmā nissāya adhimāniko. Adhimānena aññaṁ byākaroti",
			sujatoTitle: "Overestimation",
			sujatoBody:
				"At one time Venerable Mahākassapa was staying near Rājagaha",
		});
		assert.ok(!result.labels.some((label) => /aññaṁ|adhimānasacca|nissāya/i.test(label)));
		assert.ok(result.labels.includes("Venerable Mahākassapa"));
	});

	it("tags SN 7.8 as the fire-worshiping brahmin, not a monk", () => {
		const result = detectReferenceCharacters({
			slug: "sn7.8",
			paliTitle: "Aggikasutta",
			paliBody:
				"Tena kho pana samayena aggikabhāradvājassa brāhmaṇassa sappinā pāyaso sannihito hoti. Evaṁ vutte, aggikabhāradvājo brāhmaṇo bhagavantaṁ etadavoca: aññataro ca panāyasmā aggikabhāradvājo arahataṁ ahosīti.",
			sujatoTitle: "With Bhāradvāja the Fire-Worshiper",
			sujatoBody:
				"Now at that time ghee and milk-rice had been set out for the brahmin Bhāradvāja the Fire-Worshiper",
		});
		assert.deepEqual(result.labels, [
			"Brahmin Bhāradvāja the Fire-Worshiper",
		]);
	});

	it("keeps Ānanda on AN 4.159 and drops the unnamed nun", () => {
		const result = detectReferenceCharacters({
			slug: "an4.159",
			paliTitle: "Bhikkhunīsutta",
			paliBody:
				"Evaṁ me sutaṁ— ekaṁ samayaṁ āyasmā ānando kosambiyaṁ viharati ghositārāme. Atha kho aññatarā bhikkhunī aññataraṁ purisaṁ āmantesi",
			sujatoTitle: "The Nun",
			sujatoBody: "At one time Venerable Ānanda was staying near Kosambī",
		});
		assert.deepEqual(result.labels, ["Venerable Ānanda"]);
	});

	it("uses the English site label, not Pali word order or Sujato nicknames", () => {
		const known = new Set([
			"Prince Abhaya",
			"Headman Asibandhakaputta",
			"Naked Ascetic Kassapa",
			"Spirit Sūciloma",
			"Spirit Āḷavaka",
		]);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn46.56",
				paliBody:
					"Atha kho abhayo rājakumāro yena bhagavā tenupasaṅkami",
				sujatoTitle: "With Prince Abhaya",
				sujatoBody: "Then Prince Abhaya went up to the Buddha",
				knownLabels: known,
			}).labels,
			["Prince Abhaya"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn42.7",
				paliBody:
					"Atha kho asibandhakaputto gāmaṇi yena bhagavā tenupasaṅkami",
				sujatoTitle: "The Simile of the Field",
				sujatoBody:
					"Then Asibandhaka’s son the chief went up to the Buddha",
				knownLabels: known,
			}).labels,
			["Headman Asibandhakaputta"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn42.8",
				paliBody:
					"Atha kho asibandhakaputto gāmaṇi nigaṇṭhasāvako yena bhagavā tenupasaṅkami",
				sujatoTitle: "A Horn Blower",
				sujatoBody:
					"Then Asibandhaka’s son the chief, who was a disciple of the Jains, went up to the Buddha",
				knownLabels: known,
			}).labels,
			["Headman Asibandhakaputta"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "dn8",
				paliBody:
					"Atha kho acelo kassapo yena bhagavā tenupasaṅkami",
				sujatoTitle: "The Lion’s Roar to the Naked Ascetic Kassapa",
				sujatoBody:
					"Then the naked ascetic Kassapa went up to the Buddha",
				knownLabels: known,
			}).labels,
			["Naked Ascetic Kassapa"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn10.3",
				paliBody:
					"Atha kho kharo yakkho sūcilomaṁ yakkhaṁ etadavoca. Atha kho sūcilomo yakkho yena bhagavā tenupasaṅkami",
				sujatoTitle: "With Spiky",
				sujatoBody:
					"Then Spiky went up to the Buddha. At one time the native spirits Shaggy and Spiky were passing by",
				knownLabels: known,
			}).labels,
			["Spirit Sūciloma"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn10.12",
				paliBody:
					"Atha kho āḷavako yakkho yena bhagavā tenupasaṅkami",
				sujatoTitle: "With Āḷavaka",
				sujatoBody:
					"Then the native spirit Āḷavaka went up to the Buddha",
				knownLabels: known,
			}).labels,
			["Spirit Āḷavaka"],
		);
	});
});

describe("labelsFromPaliOpening", () => {
	it("reads a featured monk from āyasmā, not from a nickname title", () => {
		assert.deepEqual(
			labelsFromPaliOpening(
				"Tatra kho āyasmā mahāmoggallāno bhikkhū āmantesi",
			),
			["Venerable Mahāmoggallāna"],
		);
	});

	it("does not invent a person from ayamāyasmā or a certain nun", () => {
		assert.equal(
			labelsFromPaliOpening(
				"kiṁ nu kho ayamāyasmā aññaṁ byākaroti",
			).length,
			0,
		);
		assert.equal(
			labelsFromPaliOpening(
				"Atha kho aññatarā bhikkhunī aññataraṁ purisaṁ āmantesi",
			).length,
			0,
		);
	});

	it("stems brahmin case endings onto one citation form", () => {
		assert.deepEqual(
			labelsFromPaliOpening(
				"Atha kho mānatthaddhassa brāhmaṇassa etadahosi. Atha kho mānatthaddho brāhmaṇo yena bhagavā tenupasaṅkami. mānatthaddhaṁ brāhmaṇaṁ gāthāya ajjhabhāsi",
			),
			["Brahmin Mānatthaddha"],
		);
	});

	it("maps Pali roles onto English prefixes instead of Pali word order", () => {
		assert.deepEqual(
			labelsFromPaliOpening(
				"Atha kho abhayo rājakumāro yena bhagavā tenupasaṅkami",
			),
			["Prince Abhaya"],
		);
		assert.deepEqual(
			labelsFromPaliOpening(
				"Atha kho asibandhakaputto gāmaṇi yena bhagavā tenupasaṅkami",
			),
			["Headman Asibandhakaputta"],
		);
		assert.deepEqual(
			labelsFromPaliOpening(
				"Atha kho asibandhakaputto gāmaṇi nigaṇṭhasāvako yena bhagavā tenupasaṅkami",
			),
			["Headman Asibandhakaputta"],
		);
		assert.deepEqual(
			labelsFromPaliOpening(
				"Atha kho acelo kassapo yena bhagavā tenupasaṅkami",
			),
			["Naked Ascetic Kassapa"],
		);
		assert.deepEqual(
			labelsFromPaliOpening(
				"Atha kho sūcilomo yakkho yena bhagavā tenupasaṅkami",
			),
			["Spirit Sūciloma"],
		);
		assert.deepEqual(
			labelsFromPaliOpening(
				"Atha kho āḷavako yakkho yena bhagavā tenupasaṅkami",
			),
			["Spirit Āḷavaka"],
		);
	});

	it("does not tag a yakkha who is only speaking to another yakkha", () => {
		assert.deepEqual(
			labelsFromPaliOpening(
				"Atha kho kharo yakkho sūcilomaṁ yakkhaṁ etadavoca. Atha kho sūcilomo yakkho yena bhagavā tenupasaṅkami",
			),
			["Spirit Sūciloma"],
		);
	});
});

describe("detectReferenceCharacters false-positive guards", () => {
	it("drops Bhagavā from brahmin and wanderer labels", () => {
		const sn715 = detectReferenceCharacters({
			slug: "sn7.15",
			paliBody:
				"Atha kho mānatthaddhassa brāhmaṇassa etadahosi. Atha kho mānatthaddho brāhmaṇo yena bhagavā tenupasaṅkami. Atha kho bhagavā mānatthaddhaṁ brāhmaṇaṁ gāthāya ajjhabhāsi",
		});
		assert.deepEqual(sn715.labels, ["Brahmin Mānatthaddha"]);

		const an4185 = detectReferenceCharacters({
			slug: "an4.185",
			paliBody:
				"seyyathidaṁ annabhāro varadharo sakuludāyī ca paribbājako. Atha kho bhagavā yena te paribbājakā tenupasaṅkami",
		});
		assert.deepEqual(an4185.labels, ["Wanderer Sakuludāyī"]);
	});

	it("does not invent characters from chapter uddāna or anonymous brahmins", () => {
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn7.22",
				paliBody:
					"Atha kho bhagavā khomadussake brāhmaṇagahapatike gāthāya ajjhabhāsi.\n\nTassuddānaṁ\nSaṅgāravo ca khomadussena dvādasāti.",
			}).labels,
			[],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn7.10",
				paliBody:
					"Tena kho pana samayena aññatarassa bhāradvājagottassa brāhmaṇassa catuddasa balībaddā naṭṭhā honti. Atha kho bhāradvājagotto brāhmaṇo yena bhagavā tenupasaṅkami",
			}).labels,
			[],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn7.20",
				paliBody:
					"Atha kho bhikkhako brāhmaṇo yena bhagavā tenupasaṅkami",
			}).labels,
			[],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn55.50",
				paliBody:
					'"Cattārimāni, bhikkhave, sotāpattiyaṅgānī”ti.\n\nTassuddānaṁ\nBhaddiyo ānutappī ca,\nMahānāmaṅgena te dasāti.',
			}).labels,
			[],
		);
	});

	it("maps laywoman, celestial devas, and Bhaddiya homonyms", () => {
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an8.45",
				paliBody:
					"Atha kho bojjhā upāsikā yena bhagavā tenupasaṅkami",
			}).labels,
			["Laywoman Bojjhā"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn2.9",
				paliBody:
					"Tena kho pana samayena candimā devaputto rāhunā asurindena gahito hoti. Atha kho bhagavā candimaṁ devaputtaṁ ārabbha rāhuṁ asurindaṁ gāthāya ajjhabhāsi",
			}).labels.filter((label) => !label.includes("Vepacitti")),
			["Deity Moon"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an4.193",
				paliBody:
					"Atha kho bhaddiyo licchavi yena bhagavā tenupasaṅkami",
			}).labels,
			["Bhaddiya the Licchavi"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn55.48",
				paliBody:
					"Ekamantaṁ nisinnaṁ kho bhaddiyaṁ sakkaṁ bhagavā etadavoca",
			}).labels,
			["Bhaddiya the Sakyan"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "ud2.10",
				paliBody: "Āyasmā bhaddiyo kāḷīgodhāya putto",
			}).labels,
			["Venerable Bhaddiya, son of Kāḷīgodhā"],
		);
	});

	it("handles geographic crowds, clan wanderers, and slug-specific figures", () => {
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn2.11",
				paliBody:
					"Atha kho candimaso devaputto yena bhagavā tenupasaṅkami",
			}).labels,
			["Deity Moon"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "mn77",
				paliBody:
					"Tena kho pana samayena sakuludāyī paribbājako moranivāpe paribbājakārāme paṭivasati. Atha kho bhagavā yena moranivāpo paribbājakārāmo tenupasaṅkami. appasaddakāmo kho pana so āyasmā appasaddassa vaṇṇavādī. Atha kho bhagavā yena sakuludāyī paribbājako tenupasaṅkami",
			}).labels,
			["Wanderer Sakuludāyī"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "dn4",
				paliBody:
					"Assosuṁ kho campeyyakā brāhmaṇagahapatikā. Tena kho pana samayena soṇadaṇḍo brāhmaṇo campaṁ ajjhāvasati",
			}).labels,
			["Brahmin Soṇadaṇḍa"],
		);
		assert.deepEqual(
			detectReferenceCharacters({ slug: "dn24", paliBody: "bhaggavagotto paribbājako" })
				.labels,
			["Naked Ascetic Pāṭikaputta"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an5.32",
				paliBody:
					"Atha kho cundī rājakumārī pañcahi rathasatehi parivutā yena bhagavā tenupasaṅkami",
			}).labels,
			["Princess Cundī"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an7.52",
				paliBody:
					"Atha kho sambahulā campeyyakā upāsakā yena āyasmā sāriputto tenupasaṅkamiṁsu",
			}).labels,
			["Venerable Sāriputta"],
		);
	});

	it("normalizes Doṇa, Dasama, and rejects placeholder or crowd tokens", () => {
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an4.36",
				paliBody: "Doṇopi sudaṁ brāhmaṇo yena bhagavā tenupasaṅkami",
			}).labels,
			["Brahmin Doṇa"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "dn16",
				paliBody: "doṇo brāhmaṇo",
			}).labels,
			["Brahmin Doṇa"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "mn52",
				paliBody:
					"Atha kho dasamo gahapati aṭṭhakanāgaro yena aññataro bhikkhu tenupasaṅkami",
			}).labels,
			["Householder Dasama"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an9.38",
				paliBody:
					"Atha kho dve lokāyatikā brāhmaṇā yena bhagavā tenupasaṅkamiṁsu",
			}).labels,
			[],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn55.53",
				paliBody:
					"Atha kho dhammadinno upāsako pañcahi upāsakasatehi saddhiṁ yena bhagavā tenupasaṅkami",
			}).labels,
			["Lay follower Dhammadinna"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "snp2.14",
				paliBody:
					"Atha kho dhammiko upāsako pañcahi upāsakasatehi saddhiṁ yena bhagavā tenupasaṅkami",
			}).labels,
			["Lay follower Dhammika"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn22.106",
				paliBody: "Yvāyaṁ āyasmā evaṁnāmo evaṅgotto",
			}).labels,
			[],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn23.4",
				paliBody:
					"Āyasmā rādho yena bhagavā tenupasaṅkami. Yvāyaṁ āyasmā evaṁnāmo evaṅgotto",
			}).labels,
			["Venerable Rādha"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an8.24",
				paliBody:
					"Atha kho hatthako āḷavako pañcamattehi upāsakasatehi parivuto yena bhagavā tenupasaṅkami",
			}).labels,
			["Hatthaka of Āḷavi"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an8.86",
				paliBody:
					"Assosuṁ kho icchānaṅgalakā brāhmaṇagahapatikā. Atha kho icchānaṅgalakā brāhmaṇagahapatikā tassā rattiyā accayena yena icchānaṅgalavanasaṇḍo tenupasaṅkamiṁsu. Tena kho pana samayena āyasmā nāgito bhagavato upaṭṭhāko hoti",
			}).labels,
			["Venerable Nāgita"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an3.127",
				paliBody: "hatthakaṁ devaputtaṁ bhagavato santike",
			}).labels,
			["Deity Hatthaka"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn55.6",
				paliBody:
					"Tena kho pana samayena isidattapurāṇā thapatayo sādhuke paṭivasanti. Atha kho isidattapurāṇā thapatayo yena bhagavā tenupasaṅkamiṁsu",
			}).labels,
			["Layman Isidatta", "Layman Purāṇa"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn35.125",
				paliBody:
					"Ekaṁ samayaṁ bhagavā vajjīsu viharati hatthigāme. Atha kho uggo gahapati hatthigāmako yena bhagavā tenupasaṅkami",
			}).labels,
			["Householder Ugga of Hatthigāma"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an5.44",
				paliBody:
					"Ekaṁ samayaṁ bhagavā vesāliyaṁ viharati mahāvane kūṭāgārasālāyaṁ. Atha kho uggo gahapati vesāliko yena bhagavā tenupasaṅkami",
			}).labels,
			["Householder Ugga of Vesāli"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an5.33",
				paliBody:
					"Atha kho uggaho meṇḍakanattā yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ nisīdi",
			}).labels,
			["Uggaha, Meṇḍaka's grandson"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "an4.188",
				paliBody:
					"Atha kho upako maṇḍikāputto yena bhagavā tenupasaṅkami. Atha kho upako maṇḍikāputto yena rājā māgadho ajātasattu vedehiputto tenupasaṅkami",
			}).labels,
			["King Ajātasattu", "Upaka Maṇḍikāputta"],
		);
		assert.deepEqual(
			detectReferenceCharacters({
				slug: "sn35.133",
				paliBody:
					"Ekaṁ samayaṁ āyasmā udāyī kāmaṇḍāyaṁ viharati todeyyassa brāhmaṇassa ambavane. Atha kho verahaccānigottā brāhmaṇī āyasmantaṁ udāyiṁ paṇītena khādanīyena bhojanīyena sahatthā santappesi",
			}).labels.sort(),
			["Brahmin woman Verahaccāni", "Venerable Udāyī"].sort(),
		);
	});
});

describe("englishLabelFromPaliPhrase", () => {
	it("keeps place and kinship epithets on the English label", () => {
		assert.equal(
			englishLabelFromPaliPhrase("uggo gahapati hatthigāmako"),
			"Householder Ugga of Hatthigāma",
		);
		assert.equal(
			englishLabelFromPaliPhrase("uggo gahapati vesāliko"),
			"Householder Ugga of Vesāli",
		);
		assert.equal(
			englishLabelFromPaliPhrase("uggaho meṇḍakanattā"),
			"Uggaha, Meṇḍaka's grandson",
		);
		assert.equal(
			englishLabelFromPaliPhrase("verahaccānigottā brāhmaṇī"),
			"Brahmin woman Verahaccāni",
		);
		assert.equal(
			englishLabelFromPaliPhrase("kaḷārakhattiyo bhikkhu uṭṭhāyāsanā"),
			"Kaḷāra the Aristocrat",
		);
		assert.equal(
			englishLabelFromPaliPhrase("jātibhūmakānaṁ upāsakānaṁ"),
			null,
		);
		assert.equal(
			englishLabelFromPaliPhrase("kāḷigodhā sākiyānī"),
			"Sakyan laywoman Kāḷigodhā",
		);
		assert.equal(englishLabelFromPaliPhrase("mallikā devī"), "Queen Mallikā");
		assert.equal(
			englishLabelFromPaliPhrase("kāpilavatthavā sakyā"),
			null,
		);
		assert.equal(
			englishLabelFromPaliPhrase("kuṇḍaliyo paribbājako"),
			"Wanderer Kuṇḍaliya",
		);
	});
});

describe("formatCharacterYaml", () => {
	it("writes comma names as a YAML list so gray-matter keeps them whole", () => {
		assert.equal(
			formatCharacterYaml(["Sakka, lord of the gods"]),
			'character:\n  - "Sakka, lord of the gods"',
		);
		assert.equal(
			formatCharacterYaml(["Venerable Visākha, Pañcālī's Son"]),
			'character:\n  - "Venerable Visākha, Pañcālī\'s Son"',
		);
	});
});

describe("upsertPaliCharacterFrontmatter", () => {
	it("inserts character after slug", () => {
		const raw = `---
slug: sn11.1
source: suttacentral/bilara-data
title: Suvīrasutta
edition: ms
granularity: paragraph
---

Evaṁ me sutaṁ.
`;
		const next = upsertPaliCharacterFrontmatter(raw, [
			"Sakka, lord of the gods",
		]);
		assert.match(
			next,
			/slug: sn11\.1\ncharacter:\n  - "Sakka, lord of the gods"/,
		);
		assert.match(next, /Evaṁ me sutaṁ/);
	});

	it("does not leave a blank line after character", () => {
		const raw = `---
slug: sn46.56
character: Abhayo Rājakumāro

source: suttacentral/bilara-data
title: Abhayasutta
---
`;
		const next = upsertPaliCharacterFrontmatter(raw, ["Prince Abhaya"]);
		assert.match(
			next,
			/slug: sn46\.56\ncharacter: Prince Abhaya\nsource: suttacentral\/bilara-data/,
		);
		assert.doesNotMatch(next, /character: Prince Abhaya\n\n/);
	});

	it("removes character when no labels are detected", () => {
		const raw = `---
slug: sn7.22
character:
  - Brahmin Saṅgārava
source: suttacentral/bilara-data
title: Khomadussasutta
---
`;
		const next = upsertPaliCharacterFrontmatter(raw, []);
		assert.doesNotMatch(next, /^character:/m);
		assert.match(next, /slug: sn7\.22\nsource: suttacentral\/bilara-data/);
	});
});

describe("collectionKeyForSlug", () => {
	it("reads saṃyutta keys from range slugs", () => {
		assert.equal(collectionKeyForSlug("sn33.11-15"), "sn33");
		assert.equal(collectionKeyForSlug("mn79"), "mn");
	});
});

describe("isVaggoIndexList", () => {
	it("detects chapter index lists of laywomen", () => {
		const body = `Atha kho bojjhā upāsikā, sirīmā, padumā, sutanā, manujā, uttarā, muttā, khemā, rucī, cundī, bimbī, sumanā, mallikā, tissā, tissamātā, soṇā, soṇāya mātā, kāṇā, kāṇamātā, uttarā nandamātā, visākhā migāramātā, khujjuttarā upāsikā, sāmāvatī upāsikā, suppavāsā koliyadhītā, suppiyā upāsikā, nakulamātā gahapatānī.

Sāmaññavaggo pañcamo.`;
		assert.equal(isVaggoIndexList(body), true);
	});

	it("leaves normal discourses alone", () => {
		const body = `Atha kho anāthapiṇḍiko gahapati yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ nisīdi.`;
		assert.equal(isVaggoIndexList(body), false);
	});
});

describe("vagga index discourses", () => {
	it("does not tag an8.91-117 from the chapter list", () => {
		const result = detectReferenceCharacters({
			slug: "an8.91-117",
			paliBody: `Atha kho bojjhā upāsikā, sirīmā, padumā, sutanā, manujā, uttarā, muttā, khemā, rucī, cundī, bimbī, sumanā, mallikā, tissā, tissamātā, soṇā, soṇāya mātā, kāṇā, kāṇamātā, uttarā nandamātā, visākhā migāramātā, khujjuttarā upāsikā, sāmāvatī upāsikā, suppavāsā koliyadhītā, suppiyā upāsikā, nakulamātā gahapatānī.

Sāmaññavaggo pañcamo.`,
		});
		assert.deepEqual(result.labels, []);
		assert.match(
			result.reviews.map((r) => r.reason).join(","),
			/vaggo-index/,
		);
	});
});

describe("lay figure label fixes", () => {
	it("tags Householder Soṇa from the nominative Pali form", () => {
		const result = detectReferenceCharacters({
			slug: "sn22.49",
			paliBody: `Atha kho soṇo gahapatiputto yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ nisīdi.`,
			knownLabels: new Set(["Householder Soṇa"]),
		});
		assert.equal(result.labels[0], "Householder Soṇa");
	});

	it("tags General Sīha from senāpati", () => {
		const result = detectReferenceCharacters({
			slug: "an5.34",
			paliBody: `Atha kho sīho senāpati yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ nisīdi.`,
		});
		assert.equal(result.labels[0], "General Sīha");
	});

	it("tags only Householder Anāthapiṇḍika when visiting wanderers of other sects", () => {
		const result = detectReferenceCharacters({
			slug: "an10.93",
			paliBody: `Atha kho anāthapiṇḍiko gahapati divā divassa sāvatthiyā nikkhami bhagavantaṁ dassanāya. Atha kho anāthapiṇḍiko gahapati yena aññatitthiyānaṁ paribbājakānaṁ ārāmo tenupasaṅkami.`,
		});
		assert.deepEqual(result.labels, ["Householder Anāthapiṇḍika"]);
	});

	it("tags only Venerable Anurādha on SN 44.2", () => {
		const result = detectReferenceCharacters({
			slug: "sn44.2",
			paliBody: `Tena kho pana samayena āyasmā anurādho bhagavato avidūre araññakuṭikāyaṁ viharati. Atha kho sambahulā aññatitthiyā paribbājakā yenāyasmā anurādho tenupasaṅkamiṁsu. Atha kho āyasmato anurādhassa acirapakkantesu aññatitthiyehi paribbājakehi etadahosi.`,
		});
		assert.deepEqual(result.labels, ["Venerable Anurādha"]);
	});

	it("tags Prince Bodhi on MN 85, not a merged Sañjikāputta label", () => {
		const result = detectReferenceCharacters({
			slug: "mn85",
			paliBody: `Atha kho bodhi rājakumāro sañjikāputtaṁ māṇavaṁ āmantesi: “ehi tvaṁ, samma sañjikāputta, yena bhagavā tenupasaṅkama. Atha kho sañjikāputto māṇavo bodhissa rājakumārassa paṭissutvā yena bhagavā tenupasaṅkami.`,
			sujatoTitle: "With Prince Bodhi",
		});
		assert.ok(result.labels.includes("Prince Bodhi"), result.labels.join(", "));
		assert.ok(
			!result.labels.some((label) => /Bodhi Sañjikāputta/i.test(label)),
			result.labels.join(", "),
		);
	});

	it("does not tag the thousand-nun assembly as a person", () => {
		const result = detectReferenceCharacters({
			slug: "sn55.11",
			paliBody: `Atha kho sahassabhikkhunisaṅgho yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ aṭṭhāsi.`,
		});
		assert.deepEqual(result.labels, []);
	});

	it("tags Saccaka and Assaji on MN 35", () => {
		const result = detectReferenceCharacters({
			slug: "mn35",
			paliBody: `Atha kho saccako nigaṇṭhaputto vesāliyaṁ paṭivasati. Atha kho āyasmā assaji pubbaṇhasamayaṁ nivāsetvā pattacīvaramādāya vesāliṁ piṇḍāya pāvisi.`,
			sujatoTitle: "The Shorter Discourse With Saccaka",
		});
		assert.ok(result.labels.includes("Saccaka—Nigaṇṭha’s son"));
		assert.ok(result.labels.includes("Venerable Assaji"));
	});

	it("splits Vāseṭṭha and Bhāradvāja instead of tagging the dual compound", () => {
		const pair = [
			"Young Brahmin Bhāradvāja",
			"Young Brahmin Vāseṭṭha",
		];
		const mn98 = detectReferenceCharacters({
			slug: "mn98",
			paliBody:
				"Atha kho vāseṭṭhabhāradvājānaṁ māṇavānaṁ jaṅghāvihāraṁ anucaṅkamantānaṁ anuvicarantānaṁ ayamantarākathā udapādi. Bhāradvājo māṇavo evamāha. Vāseṭṭho māṇavo evamāha.",
		});
		assert.deepEqual(mn98.labels.sort(), pair);
		assert.equal(
			mn98.labels.some((label) => /vāseṭṭhabhāradvāj/i.test(label)),
			false,
		);

		const dn27 = detectReferenceCharacters({
			slug: "dn27",
			paliBody:
				"Tena kho pana samayena vāseṭṭhabhāradvājā bhikkhūsu parivasanti bhikkhubhāvaṁ ākaṅkhamānā. Addasā kho vāseṭṭho bhagavantaṁ. Disvāna bhāradvājaṁ āmantesi.",
		});
		assert.deepEqual(dn27.labels.sort(), pair);
	});

	it("keeps AN 3.70 on Laywoman Visākhā Migāramātā", () => {
		const result = detectReferenceCharacters({
			slug: "an3.70",
			paliBody:
				"Atha kho visākhā migāramātā tadahuposathe yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ nisīdi.",
			knownLabels: new Set(["Laywoman Visākhā Migāramātā"]),
		});
		assert.deepEqual(result.labels, ["Laywoman Visākhā Migāramātā"]);
		assert.equal(
			result.labels.some((label) => /tadahuposathe/i.test(label)),
			false,
		);
	});

	it("maps SN 12.32 onto Kaḷāra the Aristocrat, not Imasmiṁ or Uṭṭhāyāsanā", () => {
		const result = detectReferenceCharacters({
			slug: "sn12.32",
			paliTitle: "Kaḷārasutta",
			paliBody:
				"Sāvatthiyaṁ viharati.\n\nAtha kho kaḷārakhattiyo bhikkhu yenāyasmā sāriputto tenupasaṅkami; upasaṅkamitvā āyasmatā sāriputtena saddhiṁ sammodi. Ekamantaṁ nisinno kho kaḷārakhattiyo bhikkhu āyasmantaṁ sāriputtaṁ etadavoca: “moḷiyaphagguno, āvuso sāriputta, bhikkhu sikkhaṁ paccakkhāya hīnāyāvatto”ti.\n\n“Na hi nūna so āyasmā imasmiṁ dhammavinaye assāsamalatthā”ti.\n\nAtha kho kaḷārakhattiyo bhikkhu uṭṭhāyāsanā yena bhagavā tenupasaṅkami;",
			sujatoTitle: "With Kaḷāra the Aristocrat",
			sujatoBody:
				"Then the mendicant Kaḷāra the Aristocrat went up to Venerable Sāriputta and exchanged greetings with him.",
		});
		assert.deepEqual(result.labels.sort(), [
			"Kaḷāra the Aristocrat",
			"Venerable Sāriputta",
		].sort());
		assert.equal(
			result.labels.some((label) => /imasmi/i.test(label)),
			false,
		);
		assert.equal(
			result.labels.some((label) => /uṭṭhāyāsanā|utthayasana/i.test(label)),
			false,
		);
	});

	it("tags AN 6.54 as Venerable Dhammika, not native-land lay followers", () => {
		const result = detectReferenceCharacters({
			slug: "an6.54",
			paliTitle: "Dhammikasutta",
			paliBody:
				"Ekaṁ samayaṁ bhagavā rājagahe viharati gijjhakūṭe pabbate.\n\nTena kho pana samayena āyasmā dhammiko jātibhūmiyaṁ āvāsiko hoti sabbaso jātibhūmiyaṁ sattasu āvāsesu. Atha kho jātibhūmakānaṁ upāsakānaṁ etadahosi: “mayaṁ kho bhikkhusaṅghaṁ paccupaṭṭhitā”. Atha kho jātibhūmakā upāsakā yena āyasmā dhammiko tenupasaṅkamiṁsu.",
			sujatoTitle: "About Dhammika",
			sujatoBody:
				"Now at that time Venerable Dhammika was a resident in all seven monasteries of his native land. Then the local lay followers thought to themselves.",
		});
		assert.deepEqual(result.labels, ["Venerable Dhammika"]);
		assert.equal(
			result.labels.some((label) => /jātibhūmak|jatibhumak/i.test(label)),
			false,
		);
		assert.equal(
			result.labels.some((label) => /lay follower dhammika/i.test(label)),
			false,
		);
	});

	it("keeps SNP 2.14 on Lay follower Dhammika", () => {
		const result = detectReferenceCharacters({
			slug: "snp2.14",
			paliTitle: "Dhammikasutta",
			paliBody:
				"Evaṁ me sutaṁ— ekaṁ samayaṁ bhagavā sāvatthiyaṁ viharati jetavane anāthapiṇḍikassa ārāme. Atha kho dhammiko upāsako pañcahi upāsakasatehi saddhiṁ yena bhagavā tenupasaṅkami;",
			sujatoTitle: "With Dhammika",
			sujatoBody:
				"Then the lay follower Dhammika went up to the Buddha together with five hundred lay followers.",
		});
		assert.deepEqual(result.labels, ["Lay follower Dhammika"]);
	});

	it("tags SN 55.39 as Sakyan laywoman Kāḷigodhā", () => {
		const result = detectReferenceCharacters({
			slug: "sn55.39",
			paliTitle: "Kāḷigodhasutta",
			paliBody:
				"Ekaṁ samayaṁ bhagavā sakkesu viharati kapilavatthusmiṁ nigrodhārāme. Atha kho kāḷigodhā sākiyānī yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ nisīdi.",
			sujatoTitle: "With Kāḷigodhā",
			sujatoBody:
				"Then Kāḷigodhā went up to the Buddha, bowed, and sat down to one side.",
		});
		assert.deepEqual(result.labels, ["Sakyan laywoman Kāḷigodhā"]);
	});

	it("does not tag the Sakyans of Kapilavatthu as a person on SN 35.243", () => {
		const result = detectReferenceCharacters({
			slug: "sn35.243",
			paliTitle: "Avassutapariyāyasutta",
			paliBody:
				"Ekaṁ samayaṁ bhagavā sakkesu viharati kapilavatthusmiṁ nigrodhārāme. Atha kho kāpilavatthavā sakyā yena bhagavā tenupasaṅkamiṁsu; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ nisīdiṁsu.",
			sujatoTitle: "The Explanation of the Corrupt",
			sujatoBody:
				"Then the Sakyans of Kapilavatthu went up to the Buddha, bowed, and sat down to one side.",
		});
		assert.equal(
			result.labels.some((label) => /kāpilavatthav|kapilavatth/i.test(label)),
			false,
		);
	});

	it("tags SN 46.6 as Wanderer Kuṇḍaliya", () => {
		const result = detectReferenceCharacters({
			slug: "sn46.6",
			paliTitle: "Kuṇḍaliyasutta",
			paliBody:
				"Ekaṁ samayaṁ bhagavā sākete viharati añjanavane migadāye. Atha kho kuṇḍaliyo paribbājako yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavatā saddhiṁ sammodi.",
			sujatoTitle: "Kuṇḍaliya",
			sujatoBody:
				"Then the wanderer Kuṇḍaliya went up to the Buddha, and exchanged greetings with him.",
		});
		assert.deepEqual(result.labels, ["Wanderer Kuṇḍaliya"]);
	});

	it("keeps AN 4.197 on Queen Mallikā, not Mallikā Devī", () => {
		const result = detectReferenceCharacters({
			slug: "an4.197",
			paliTitle: "Mallikādevīsutta",
			paliBody:
				"Ekaṁ samayaṁ bhagavā sāvatthiyaṁ viharati jetavane anāthapiṇḍikassa ārāme. Atha kho mallikā devī yena bhagavā tenupasaṅkami; upasaṅkamitvā bhagavantaṁ abhivādetvā ekamantaṁ nisīdi.",
			sujatoTitle: "Queen Mallikā",
			sujatoBody: "Then Queen Mallikā went up to the Buddha, bowed, sat down to one side.",
			knownLabels: new Set(["Queen Mallikā"]),
		});
		assert.deepEqual(result.labels, ["Queen Mallikā"]);
		assert.equal(
			result.labels.some((label) => /devī/i.test(label)),
			false,
		);
	});

	it("tags Rohitassa as a deity", () => {
		const result = detectReferenceCharacters({
			slug: "an4.45",
			paliTitle: "Rohitassasutta",
			paliBody:
				"Ekaṁ samayaṁ bhagavā sāvatthiyaṁ viharati jetavane anāthapiṇḍikassa ārāme.\n\nAtha kho rohitasso devaputto abhikkantāya rattiyā abhikkantavaṇṇo kevalakappaṁ jetavanaṁ obhāsetvā yena bhagavā tenupasaṅkami;",
			sujatoTitle: "With Rohitassa",
			sujatoBody:
				"Then, late at night, the glorious godling Rohitassa, lighting up the entire Jeta’s Grove, went up to the Buddha.",
		});
		assert.deepEqual(result.labels, ["Deity Rohitassa"]);
	});
});
