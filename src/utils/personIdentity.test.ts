import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildPersonAliasCatalog,
	canonicalSlugForPerson,
	compactPersonCore,
	findEnglishLabelVariants,
	isAnonymousPersonLabel,
	normalizePersonParts,
	personFilterClass,
	personFilterClasses,
	resolvePersonLabel,
	stemPaliPersonToken,
} from "./personIdentity";

const EN_LABELS = [
	"Mahāpajāpati Gotamī",
	"Builder Pañcakaṅga",
	"Bhikkhunī Dhammadinnā",
	"Venerable Mahākoṭṭhita",
	"Venerable Ānanda",
	"venerable Ānanda",
	"Venerable Nanda",
	"Wanderer Vacchagotta",
	"Brahmin Vacchagotta of Venāgapura",
	"Layman Isidatta",
	"Venerable Isidatta",
	"Wanderer Channa",
	"Venerable Channa",
	"Venerable Nandiya",
	"Nandaka, the chief minister of the Licchavis",
	"Venerable Nandaka",
	"Brahmin Suddhika Bhāradvāja",
	"Venerable Bhāradvāja",
	"Jīvaka Komārabhacca",
	"Buddha Kassapa",
	"Venerable Mahākassapa",
	"Venerable Kassapagotta",
	"Cunda the smith",
	"Venerable Mahācunda",
	"Venerable Mahā Cunda",
	"Hatthaka of Āḷavi",
	"Householder Hatthaka",
	"Saccaka—Nigaṇṭha’s son",
	"Sakka, lord of the gods",
	"Sakka",
	"Brahmā Sahampati",
	"Brahma Sahampati",
	"Householder Anāthapiṇḍika",
	"Anāthapiṇḍika",
	"Deity Anāthapiṇḍika",
	"Brahmin Saṅgārava",
	"Young Brahmin Saṅgārava",
	"Lay follower Visākha",
	"Venerable Visākha, Pañcālī's Son",
	"Visākhā Migāramātā",
	"Prince Abhaya",
	"Headman Asibandhakaputta",
	"Spirit Sūciloma",
	"Spirit Āḷavaka",
	"Naked Ascetic Kassapa",
];

describe("resolvePersonLabel", () => {
	const catalog = buildPersonAliasCatalog(EN_LABELS);

	it("maps Gotamī onto Mahāpajāpati Gotamī by unique last word", () => {
		const result = resolvePersonLabel("Gotamī", catalog);
		assert.equal(result.label, "Mahāpajāpati Gotamī");
		assert.equal(result.via, "last-word");
	});

	it("maps Pañcakaṅga onto Builder Pañcakaṅga by role prefix", () => {
		const result = resolvePersonLabel("Pañcakaṅga", catalog);
		assert.equal(result.label, "Builder Pañcakaṅga");
		assert.equal(result.via, "core");
	});

	it("maps Dhammadinna onto Bhikkhunī Dhammadinnā", () => {
		const result = resolvePersonLabel("Dhammadinna", catalog);
		assert.equal(result.label, "Bhikkhunī Dhammadinnā");
		assert.equal(result.via, "core");
	});

	it("maps Koṭṭhita onto Mahākoṭṭhita when the compound is unique", () => {
		const result = resolvePersonLabel("Koṭṭhita", catalog);
		assert.equal(result.label, "Venerable Mahākoṭṭhita");
		assert.equal(result.via, "maha-compound");
	});

	it("merges Mahākoṭṭhika onto Venerable Mahākoṭṭhita", () => {
		assert.equal(
			compactPersonCore("Venerable Mahākoṭṭhika"),
			compactPersonCore("Venerable Mahākoṭṭhita"),
		);
		assert.equal(
			canonicalSlugForPerson("Venerable Mahākoṭṭhika", catalog),
			canonicalSlugForPerson("Venerable Mahākoṭṭhita", catalog),
		);
		assert.equal(
			resolvePersonLabel("Venerable Mahākoṭṭhika", catalog).label,
			"Venerable Mahākoṭṭhita",
		);
	});

	it("does not let nanda swallow Ānanda", () => {
		assert.equal(resolvePersonLabel("Nanda", catalog).label, "Nanda");
		assert.notEqual(resolvePersonLabel("Nanda", catalog).label, "Venerable Ānanda");
		assert.equal(canonicalSlugForPerson("Ānanda", catalog), "ananda");
		assert.equal(canonicalSlugForPerson("Venerable Ānanda", catalog), "ananda");
		assert.notEqual(
			canonicalSlugForPerson("Nanda", catalog),
			canonicalSlugForPerson("Ānanda", catalog),
		);
	});

	it("leaves Kassapa alone when several people share the name", () => {
		const result = resolvePersonLabel("Kassapa", catalog);
		assert.equal(result.label, "Kassapa");
		assert.ok(result.ambiguous && result.ambiguous.length > 1);
	});

	it("maps Saccaka onto the unique longer English label", () => {
		const result = resolvePersonLabel("Saccaka", catalog);
		assert.equal(result.label, "Saccaka—Nigaṇṭha’s son");
		assert.equal(result.via, "first-word");
	});

	it("does not merge lay and ordained people who share a name", () => {
		assert.equal(resolvePersonLabel("Layman Isidatta", catalog).label, "Layman Isidatta");
		assert.equal(resolvePersonLabel("Venerable Isidatta", catalog).label, "Venerable Isidatta");
		assert.equal(resolvePersonLabel("Wanderer Channa", catalog).label, "Wanderer Channa");
		assert.equal(resolvePersonLabel("Venerable Channa", catalog).label, "Venerable Channa");
		assert.equal(resolvePersonLabel("Nandiya", catalog).label, "Nandiya");
	});

	it("does not map a monk onto a similarly named official", () => {
		assert.equal(resolvePersonLabel("Venerable Nandaka", catalog).label, "Venerable Nandaka");
		assert.equal(
			resolvePersonLabel("Venerable Bhāradvāja", catalog).label,
			"Venerable Bhāradvāja",
		);
	});

	it("maps Jīvaka onto Jīvaka Komārabhacca", () => {
		assert.equal(resolvePersonLabel("Jīvaka", catalog).label, "Jīvaka Komārabhacca");
	});

	it("maps Deity Anāthapiṇḍika onto the householder's person card", () => {
		const result = resolvePersonLabel("Deity Anāthapiṇḍika", catalog);
		assert.equal(result.label, "Householder Anāthapiṇḍika");
		assert.equal(
			canonicalSlugForPerson("Deity Anāthapiṇḍika", catalog),
			"anathapindika",
		);
		assert.equal(
			canonicalSlugForPerson("Deity Anāthapiṇḍika", catalog),
			canonicalSlugForPerson("Householder Anāthapiṇḍika", catalog),
		);
	});

	it("maps Deity Ghaṭīkāra onto Ghaṭikāra the Potter's person card", () => {
		const labels = [
			...catalog.labels,
			"Ghaṭikāra the Potter",
			"Deity Ghaṭīkāra",
		];
		const extended = buildPersonAliasCatalog(labels);
		const result = resolvePersonLabel("Deity Ghaṭīkāra", extended);
		assert.equal(result.label, "Ghaṭikāra the Potter");
		assert.equal(
			canonicalSlugForPerson("Deity Ghaṭīkāra", extended),
			"ghatikara",
		);
		assert.equal(
			canonicalSlugForPerson("Deity Ghaṭīkāra", extended),
			canonicalSlugForPerson("Ghaṭikāra the Potter", extended),
		);
	});

	it("maps Deity Hatthaka onto Hatthaka of Āḷavi's person card", () => {
		const labels = [
			...catalog.labels,
			"Hatthaka of Āḷavi",
			"Deity Hatthaka",
		];
		const extended = buildPersonAliasCatalog(labels);
		const result = resolvePersonLabel("Deity Hatthaka", extended);
		assert.equal(result.label, "Hatthaka of Āḷavi");
		assert.equal(
			canonicalSlugForPerson("Deity Hatthaka", extended),
			"hatthaka-of-alavi",
		);
		assert.equal(
			canonicalSlugForPerson("Deity Hatthaka", extended),
			canonicalSlugForPerson("Hatthaka of Āḷavi", extended),
		);
	});

	it("maps Aññāsi Koṇḍañña onto Venerable Aññāsikoṇḍañña", () => {
		const labels = [
			...catalog.labels,
			"Aññāsi Koṇḍañña",
			"Venerable Aññāsikoṇḍañña",
		];
		const extended = buildPersonAliasCatalog(labels);
		assert.equal(
			resolvePersonLabel("Aññāsi Koṇḍañña", extended).label,
			"Venerable Aññāsikoṇḍañña",
		);
		assert.equal(
			canonicalSlugForPerson("Aññāsi Koṇḍañña", extended),
			canonicalSlugForPerson("Venerable Aññāsikoṇḍañña", extended),
		);
	});

	it("keeps Young Brahmin Saṅgārava distinct from Brahmin Saṅgārava", () => {
		assert.equal(
			resolvePersonLabel("Young Brahmin Saṅgārava", catalog).label,
			"Young Brahmin Saṅgārava",
		);
		assert.equal(
			resolvePersonLabel("Brahmin Saṅgārava", catalog).label,
			"Brahmin Saṅgārava",
		);
		assert.notEqual(
			canonicalSlugForPerson("Young Brahmin Saṅgārava", catalog),
			canonicalSlugForPerson("Brahmin Saṅgārava", catalog),
		);
		assert.equal(
			canonicalSlugForPerson("Young Brahmin Saṅgārava", catalog),
			"young-brahmin-sangarava",
		);
		assert.equal(
			canonicalSlugForPerson("Brahmin Saṅgārava", catalog),
			"brahmin-sangarava",
		);
	});

	it("keeps the MN 44 lay follower distinct from Visākha, Pañcālī's Son", () => {
		assert.equal(
			resolvePersonLabel("Lay follower Visākha", catalog).label,
			"Lay follower Visākha",
		);
		assert.equal(
			resolvePersonLabel("Venerable Visākha, Pañcālī's Son", catalog).label,
			"Venerable Visākha, Pañcālī's Son",
		);
		assert.notEqual(
			canonicalSlugForPerson("Lay follower Visākha", catalog),
			canonicalSlugForPerson("Venerable Visākha, Pañcālī's Son", catalog),
		);
		assert.notEqual(
			canonicalSlugForPerson("Lay follower Visākha", catalog),
			canonicalSlugForPerson("Visākhā Migāramātā", catalog),
		);
		assert.equal(
			canonicalSlugForPerson("Lay follower Visākha", catalog),
			"visakha",
		);
		assert.equal(
			canonicalSlugForPerson("Venerable Visākha, Pañcālī's Son", catalog),
			"visakha-pancalis-son",
		);
		assert.equal(
			canonicalSlugForPerson("Visākhā Migāramātā", catalog),
			"visakha-migaramata",
		);
	});

	it("maps Pali-order roles onto the English character already used on site", () => {
		assert.equal(
			resolvePersonLabel("Abhayo Rājakumāro", catalog).label,
			"Prince Abhaya",
		);
		assert.equal(
			resolvePersonLabel("Asibandhakaputto Gāmaṇi", catalog).label,
			"Headman Asibandhakaputta",
		);
		assert.equal(
			resolvePersonLabel("Asibandhakaputto Gāmaṇi Nigaṇṭhasāvako", catalog)
				.label,
			"Headman Asibandhakaputta",
		);
		assert.equal(
			resolvePersonLabel("Sūcilomo Yakkho", catalog).label,
			"Spirit Sūciloma",
		);
		assert.equal(
			resolvePersonLabel("Āḷavako Yakkho", catalog).label,
			"Spirit Āḷavaka",
		);
		assert.equal(
			resolvePersonLabel("Acelo Kassapo", catalog).label,
			"Naked Ascetic Kassapa",
		);
		assert.equal(
			compactPersonCore("Abhayo Rājakumāro"),
			compactPersonCore("Prince Abhaya"),
		);
		assert.equal(
			compactPersonCore("Asibandhakaputto Gāmaṇi"),
			compactPersonCore("Headman Asibandhakaputta"),
		);
		assert.equal(
			compactPersonCore("Citta the householder"),
			compactPersonCore("Householder Citta"),
		);
		assert.notEqual(
			canonicalSlugForPerson("Naked Ascetic Kassapa", catalog),
			canonicalSlugForPerson("Buddha Kassapa", catalog),
		);
	});
});

describe("canonicalSlugForPerson", () => {
	const catalog = buildPersonAliasCatalog(EN_LABELS);

	it("merges Builder Pañcakaṅga with Pañcakaṅga", () => {
		assert.equal(
			canonicalSlugForPerson("Pañcakaṅga", catalog),
			canonicalSlugForPerson("Builder Pañcakaṅga", catalog),
		);
	});

	it("merges Mahā Cunda spellings onto one slug", () => {
		assert.equal(
			canonicalSlugForPerson("Venerable Mahācunda", catalog),
			canonicalSlugForPerson("Venerable Mahā Cunda", catalog),
		);
	});

	it("keeps wanderer and Venāgapura Vacchagotta distinct", () => {
		assert.notEqual(
			canonicalSlugForPerson("Wanderer Vacchagotta", catalog),
			canonicalSlugForPerson("Brahmin Vacchagotta of Venāgapura", catalog),
		);
	});

	it("keeps lay Isidatta distinct from Venerable Isidatta", () => {
		assert.notEqual(
			canonicalSlugForPerson("Layman Isidatta", catalog),
			canonicalSlugForPerson("Venerable Isidatta", catalog),
		);
	});

	it("keeps Lay follower Dhammika distinct from Venerable Dhammika", () => {
		const dhammika = buildPersonAliasCatalog([
			"Lay follower Dhammika",
			"Venerable Dhammika",
		]);
		assert.notEqual(
			canonicalSlugForPerson("Lay follower Dhammika", dhammika),
			canonicalSlugForPerson("Venerable Dhammika", dhammika),
		);
		assert.equal(
			canonicalSlugForPerson("Venerable Dhammika", dhammika),
			"dhammika",
		);
		assert.equal(
			canonicalSlugForPerson("Lay follower Dhammika", dhammika),
			"lay-follower-dhammika",
		);
	});

	it("merges Chamberlain Isidatta onto Layman Isidatta", () => {
		const labels = [
			...catalog.labels,
			"Chamberlain Isidatta",
			"Layman Isidatta",
		];
		const extended = buildPersonAliasCatalog(labels);
		assert.equal(
			canonicalSlugForPerson("Layman Isidatta", extended),
			canonicalSlugForPerson("Chamberlain Isidatta", extended),
		);
		assert.equal(
			resolvePersonLabel("Chamberlain Isidatta", extended).label,
			"Layman Isidatta",
		);
	});

	it("merges Chamberlain Purāṇa onto Layman Purāṇa", () => {
		const labels = [
			...catalog.labels,
			"Chamberlain Purāṇa",
			"Layman Purāṇa",
		];
		const extended = buildPersonAliasCatalog(labels);
		assert.equal(
			canonicalSlugForPerson("Layman Purāṇa", extended),
			canonicalSlugForPerson("Chamberlain Purāṇa", extended),
		);
	});
});

describe("findEnglishLabelVariants", () => {
	it("groups spelling and prefix variants that share a core", () => {
		const groups = findEnglishLabelVariants(EN_LABELS);
		const sahampati = groups.find(
			(group) => group.kind === "same-core" && group.key.includes("sahampati"),
		);
		assert.ok(sahampati);
		assert.ok(sahampati.labels.some((label) => /Brahmā/.test(label)));
		assert.ok(sahampati.labels.some((label) => /Brahma /.test(label)));

		const cunda = groups.find(
			(group) => group.kind === "same-core" && group.key === "mahacunda",
		);
		assert.ok(cunda);
		assert.equal(cunda.labels.length, 2);
	});

	it("flags Isidatta lay/ordained as shared-name, not the same core", () => {
		const groups = findEnglishLabelVariants(EN_LABELS);
		assert.ok(
			!groups.some(
				(group) => group.kind === "same-core" && group.labels.includes("Layman Isidatta"),
			),
		);
		const isidatta = groups.find(
			(group) =>
				group.kind === "shared-name" &&
				group.labels.includes("Layman Isidatta") &&
				group.labels.includes("Venerable Isidatta"),
		);
		assert.ok(isidatta);
	});

	it("flags the two Saṅgārava figures as distinct people who share a name", () => {
		const groups = findEnglishLabelVariants(EN_LABELS);
		assert.ok(
			!groups.some(
				(group) =>
					group.kind === "same-core" &&
					group.labels.includes("Brahmin Saṅgārava") &&
					group.labels.includes("Young Brahmin Saṅgārava"),
			),
		);
		const sangarava = groups.find(
			(group) =>
				group.kind === "shared-name" &&
				group.labels.includes("Brahmin Saṅgārava") &&
				group.labels.includes("Young Brahmin Saṅgārava"),
		);
		assert.ok(sangarava);
	});

	it("flags Sakka labels that likely point to one person", () => {
		const groups = findEnglishLabelVariants(EN_LABELS);
		const sakka = groups.find(
			(group) => group.kind === "shared-name" && group.key === "sakka",
		);
		assert.ok(sakka);
		assert.ok(sakka.labels.includes("Sakka"));
		assert.ok(sakka.labels.includes("Sakka, lord of the gods"));
	});
});

describe("normalizePersonParts", () => {
	it("keeps Name, epithet as one person after YAML quotes are stripped", () => {
		assert.deepEqual(normalizePersonParts("Sakka, lord of the gods"), [
			"Sakka, lord of the gods",
		]);
		assert.deepEqual(
			normalizePersonParts("Venerable Visākha, Pañcālī's Son"),
			["Venerable Visākha, Pañcālī's Son"],
		);
		assert.deepEqual(
			normalizePersonParts("Nandaka, the chief minister of the Licchavis"),
			["Nandaka, the chief minister of the Licchavis"],
		);
	});

	it("still splits two people listed with a comma", () => {
		assert.deepEqual(normalizePersonParts("Sāriputta, Ānanda"), [
			"Sāriputta",
			"Ānanda",
		]);
	});
});

describe("stemPaliPersonToken", () => {
	it("stems a-stem case endings to the citation form", () => {
		assert.equal(stemPaliPersonToken("Mānatthaddhassa"), "Mānatthaddha");
		assert.equal(stemPaliPersonToken("Mānatthaddhaṁ"), "Mānatthaddha");
		assert.equal(stemPaliPersonToken("Mānatthaddho"), "Mānatthaddha");
		assert.equal(stemPaliPersonToken("Aggikabhāradvājo"), "Aggikabhāradvāja");
	});
});

describe("isAnonymousPersonLabel", () => {
	it("rejects a certain nun, knowledge-declaration, and stock dependents", () => {
		assert.equal(isAnonymousPersonLabel("Bhikkhunī Aññatarā"), true);
		assert.equal(isAnonymousPersonLabel("Venerable Aññaṁ"), true);
		assert.equal(isAnonymousPersonLabel("Venerable Adhimānasacca"), true);
		assert.equal(isAnonymousPersonLabel("Venerable Nissāya"), true);
		assert.equal(isAnonymousPersonLabel("Sambahulā Bhikkhū"), true);
		assert.equal(isAnonymousPersonLabel("Venerable Ānanda"), false);
	});
});

describe("personFilterClass", () => {
	it("maps common prefixes onto browse classes", () => {
		assert.equal(personFilterClass("Venerable Sāriputta"), "Bhikkhu");
		assert.equal(personFilterClass("Bhikkhunī Dhammadinnā"), "Bhikkhunī");
		assert.equal(personFilterClass("Wanderer Vacchagotta"), "Wanderer");
		assert.equal(personFilterClass("Householder Anāthapiṇḍika"), "Lay follower");
		assert.equal(personFilterClass("Visākhā Migāramātā"), "Laywoman");
		assert.equal(personFilterClass("Nandamātā"), "Laywoman");
		assert.equal(personFilterClass("Lay follower Visākha"), "Lay follower");
		assert.equal(personFilterClass("Brahmin Mānatthaddha"), "Lay follower");
		assert.equal(personFilterClass("Brahmin Ghoṭamukha"), "Lay follower");
		assert.equal(
			personFilterClass("Brahmin woman Verahaccāni"),
			"Laywoman",
		);
		assert.equal(personFilterClass("Saraṇāni the Sakyan"), "Lay follower");
		assert.equal(personFilterClass("Mahānāma the Sakyan"), "Lay follower");
		assert.equal(personFilterClass("Mahāpajāpati Gotamī"), "Bhikkhunī");
		assert.equal(personFilterClass("Kokālika"), "Bhikkhu");
		assert.equal(personFilterClass("Wanderer Kuṇḍaliya"), "Wanderer");
		assert.equal(
			personFilterClass("Sakyan laywoman Kāḷigodhā"),
			"Laywoman",
		);
		assert.equal(personFilterClass("Queen Mallikā"), "Royal");
		assert.equal(personFilterClass("Deity Rohitassa"), "Deities & Gods");
		assert.equal(
			personFilterClass("Uggaha, Meṇḍaka's grandson"),
			"Lay follower",
		);
		assert.equal(
			personFilterClass("Householder Ugga of Hatthigāma"),
			"Lay follower",
		);
		assert.equal(personFilterClass("Keṇiya Jaṭila"), "Wanderer");
		assert.equal(personFilterClass("King Pasenadi of Kosala"), "Royal");
		assert.equal(personFilterClass("Prince Abhaya"), "Royal");
		assert.equal(personFilterClass("Deity Anāthapiṇḍika"), "Deities & Gods");
		assert.equal(personFilterClass("Sakka, lord of the gods"), "Deities & Gods");
		assert.equal(personFilterClass("Spirit Sūciloma"), "Deities & Gods");
		assert.equal(personFilterClass("Brahmā Sahampati"), "Deities & Gods");
		assert.equal(personFilterClass("King Yama"), "Deities & Gods");
		assert.equal(personFilterClass("Naked Ascetic Kassapa"), "Wanderer");
		assert.equal(personFilterClass("Headman Asibandhakaputta"), "Lay follower");
		assert.equal(personFilterClass("Laywoman Sāmāvatī"), "Laywoman");
		assert.equal(personFilterClass("Chamberlain Isidatta"), "Lay follower");
		assert.equal(personFilterClass("Young Householder Siṅgālaka"), "Lay follower");
		assert.equal(personFilterClass("Ambapālī the Courtesan"), "Laywoman");
		assert.equal(personFilterClass("Bāhiya of the Bark Cloth"), "Wanderer");
		assert.equal(personFilterClass("Baka the Brahmā"), "Deities & Gods");
		assert.equal(personFilterClass("Bhaddiya the Licchavi"), "Lay follower");
		assert.equal(personFilterClass("Bhaddiya the Sakyan"), "Lay follower");
		assert.equal(personFilterClass("Buddha Kakusandha"), "Awakened One");
		assert.equal(personFilterClass("Kassapa Buddha"), "Awakened One");
		assert.equal(personFilterClass("Citta Hatthisāriputta"), "Lay follower");
		assert.equal(personFilterClass("Jīvaka Komārabhacca"), "Lay follower");
		assert.equal(personFilterClass("Kaḷāra the Aristocrat"), "Royal");
		assert.equal(personFilterClass("Upaka Maṇḍikāputta"), null);
	});

	it("lists Brahmā Sahampati under deities and awakened ones", () => {
		assert.deepEqual(personFilterClasses("Brahmā Sahampati"), [
			"Deities & Gods",
			"Awakened One",
		]);
	});
});

describe("Dhanañjānī homonyms", () => {
	it("keeps the laywoman and brahmin on separate person cards", () => {
		const catalog = buildPersonAliasCatalog([
			"Laywoman Dhanañjānī",
			"Brahmin Dhanañjāni",
		]);
		assert.equal(
			canonicalSlugForPerson("Laywoman Dhanañjānī", catalog),
			"dhananjani",
		);
		assert.equal(
			canonicalSlugForPerson("Brahmin Dhanañjāni", catalog),
			"brahmin-dhananjani",
		);
	});
});

describe("lay person merges", () => {
	it("merges Nakulamātā label variants onto one core", () => {
		assert.equal(
			compactPersonCore("Housewife Nakulamātā"),
			compactPersonCore("Nakulamātā Gahapatānī"),
		);
		assert.equal(
			canonicalSlugForPerson("Housewife Nakulamātā"),
			canonicalSlugForPerson("Nakulamātā Gahapatānī"),
		);
		assert.equal(
			compactPersonCore("Laywoman Visākhā Migāramātā"),
			compactPersonCore("Visākhā Migāramātā Tadahuposathe"),
		);
	});
});

describe("Mānatthaddha identity", () => {
	it("merges genitive and accusative onto one slug", () => {
		assert.equal(
			canonicalSlugForPerson("Brahmin Mānatthaddhassa"),
			canonicalSlugForPerson("Brahmin Mānatthaddhaṁ"),
		);
		assert.equal(
			canonicalSlugForPerson("Brahmin Mānatthaddha"),
			"manatthaddha",
		);
		assert.equal(
			compactPersonCore("Brahmin Mānatthaddhassa"),
			compactPersonCore("Brahmin Mānatthaddha"),
		);
	});
});
