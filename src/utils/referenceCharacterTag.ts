/**
 * Tag featured interlocutors on reference-only Pali files.
 *
 * Character means the person the discourse is *with*, not every name that
 * appears. Collection defaults cover person-saṃyuttas; Pali openings and
 * body cues cover the rest. Sujato titles are never enough on their own
 * (Kolita is Mahāmoggallāna; Upatissa is Sāriputta). Homonyms that lack a
 * role cue are left untagged for review.
 *
 *   npx tsx src/utils/referenceCharacterTag.ts
 *   npx tsx src/utils/referenceCharacterTag.ts --apply
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import {
	buildPersonAliasCatalog,
	compactPersonCore,
	findEnglishLabelVariants,
	findLayRolePrefixGaps,
	isAnonymousPersonLabel,
	loadEnglishPersonLabels,
	resolvePersonLabel,
	stemPaliPersonToken,
	type EnglishLabelVariantGroup,
	type PersonAliasCatalog,
} from "./personIdentity";
import { referenceOnlyRouteSet } from "./referenceOnlyRoutes";
import { toChicagoTitleCase } from "./toChicagoTitleCase";

export type CharacterHit = {
	label: string;
	via: string;
	homonymGroup?: string;
	/** Constructed label not already used in English MDX. */
	isNewLabel?: boolean;
	aliasFrom?: string;
};

export type CharacterDetection = {
	slug: string;
	labels: string[];
	hits: CharacterHit[];
	reviews: { reason: string; detail: string }[];
};

export type PersonSense = {
	label: string;
	homonymGroup?: string;
	/** Lowercased Pali stems; any one is a mention. */
	pali?: string[];
	/** If set, at least one must also appear when matching via pali[]. */
	paliRequire?: string[];
	paliReject?: string[];
	/** Lowercased Sujato phrases. */
	sujato?: string[];
	/** saṃyutta keys such as sn33, sn3. */
	collections?: string[];
	/** Exact discourse slugs such as dn24. */
	slugs?: string[];
	/** Names that map from a Sujato "With X" / "To X" title. */
	titleNames?: string[];
};

const TITLE_NON_PERSON = new Set(
	[
		"suffering",
		"suffering as outcome",
		"verses",
		"mindfulness",
		"the dhamma",
		"dhamma",
		"the path",
		"path",
		"nibbana",
		"nibbāna",
		"the eye",
		"the eye, etc.",
		"eye",
		"content",
		"judgment",
		"accumulation",
		"outcome",
		"qualities",
		"precepts",
		"faculties",
		"feeling",
		"form",
		"consciousness",
		"perception",
		"choices",
		"aggregates",
		"fetters",
		"jhana",
		"jhāna",
		"the mendicants",
		"mendicants",
		"bhikkhus",
		"the sakyans",
		"sakyans",
		"the gods",
		"gods",
		"brahmins",
		"a mendicant",
		"several mendicants",
		"awakening",
		"candana, etc.",
		"benefit oneself",
		"a drawn sword",
		"residue",
		"spiky",
	].map((s) => s.toLowerCase()),
);

export const PERSON_SENSES: PersonSense[] = [
	{
		label: "Wanderer Vacchagotta",
		homonymGroup: "vacchagotta",
		pali: ["vacchagott"],
		paliRequire: ["paribbājak"],
		paliReject: ["venāgapur"],
		sujato: ["wanderer vacchagotta"],
		collections: ["sn33"],
		titleNames: ["vacchagotta"],
	},
	{
		label: "Brahmin Vacchagotta of Venāgapura",
		homonymGroup: "vacchagotta",
		pali: ["vacchagott", "venāgapur"],
		paliRequire: ["venāgapur"],
		sujato: ["vacchagotta of venāgapura", "brahmin vacchagotta"],
		titleNames: ["vacchagotta of venāgapura"],
	},
	{
		label: "Venerable Udāyī",
		homonymGroup: "udayi",
		pali: ["udāyī", "udayi"],
		paliRequire: ["āyasmā udāy", "āyasmatā udāy"],
		paliReject: ["sakuludāy", "sakuluday"],
		sujato: ["venerable udāyī"],
		titleNames: ["udāyī", "udayi"],
	},
	{
		label: "Wanderer Sakuludāyī",
		homonymGroup: "udayi",
		pali: ["sakuludāy"],
		sujato: ["wanderer sakuludāyī", "sakuludāyī"],
		titleNames: ["sakuludāyī", "sakuludayi"],
	},
	{
		label: "Brahmin Udaya",
		homonymGroup: "udayi",
		pali: ["udaya"],
		paliRequire: ["brāhmaṇ"],
		paliReject: ["udāyī", "sakuludāy", "āyasmā udaya"],
		sujato: ["brahmin udaya"],
		titleNames: ["udaya"],
	},
	{
		label: "Venerable Udaya",
		homonymGroup: "udayi",
		pali: ["udaya"],
		paliRequire: ["āyasmā udaya"],
		paliReject: ["sakuludāy"],
		sujato: ["venerable udaya"],
	},
	{
		label: "Venerable Mahākassapa",
		homonymGroup: "kassapa",
		pali: ["mahākassap"],
		sujato: ["venerable mahākassapa", "mahākassapa"],
		collections: ["sn16"],
		titleNames: ["mahākassapa", "kassapa"],
	},
	{
		label: "Buddha Kassapa",
		homonymGroup: "kassapa",
		sujato: ["buddha kassapa", "kassapa buddha"],
		titleNames: ["kassapa buddha", "buddha kassapa"],
	},
	{
		label: "Venerable Kassapagotta",
		homonymGroup: "kassapa",
		pali: ["kassapagott"],
		sujato: ["kassapagotta"],
		titleNames: ["kassapagotta"],
	},
	{
		label: "Venerable Kumārakassapa",
		homonymGroup: "kassapa",
		pali: ["kumārakassap"],
		sujato: ["kassapa the prince", "kumārakassapa", "kassapa the boy"],
		titleNames: ["kassapa the prince", "kumārakassapa"],
	},
	{
		label: "Naked Ascetic Kassapa",
		homonymGroup: "kassapa",
		pali: ["acelo kassap", "acela kassap"],
		paliRequire: ["acelo", "acela"],
		sujato: ["naked ascetic kassapa"],
		titleNames: ["kassapa, the naked ascetic", "the naked ascetic kassapa"],
	},
	{
		label: "Prince Abhaya",
		pali: ["abhayo rājakumār", "abhaya rājakumār"],
		sujato: ["prince abhaya"],
		titleNames: ["prince abhaya"],
	},
	{
		label: "Prince Bodhi",
		pali: ["bodhi rājakumār", "bodhissa rājakumār", "bodhiṁ rājakumār"],
		paliReject: ["sañjikāputt"],
		sujato: ["prince bodhi"],
		titleNames: ["prince bodhi", "bodhi"],
		slugs: ["mn85"],
	},
	{
		label: "Headman Asibandhakaputta",
		pali: ["asibandhakaputt"],
		sujato: ["headman asibandhakaputta", "asibandhakaputta"],
		titleNames: ["asibandhakaputta"],
	},
	{
		label: "Spirit Sūciloma",
		pali: ["sūcilom"],
		sujato: ["sūciloma"],
		titleNames: ["sūciloma"],
	},
	{
		label: "Spirit Āḷavaka",
		pali: ["āḷavako yakkh", "āḷavakassa yakkh"],
		sujato: ["native spirit āḷavaka", "spirit āḷavaka"],
		titleNames: ["āḷavaka"],
	},
	{
		label: "Deity Moon",
		pali: ["candimā devaputt", "candimaṁ devaputt", "candimaso devaputt"],
		sujato: ["moon god", "the moon"],
		titleNames: ["the moon", "moon"],
	},
	{
		label: "Deity Sun",
		pali: ["sūriyo devaputt", "sūriyaṁ devaputt", "sūriyo devaputt"],
		paliRequire: ["devaputt"],
		sujato: ["sun god", "the sun"],
		titleNames: ["the sun", "sun"],
	},
	{
		label: "Princess Cundī",
		pali: ["cundī rājakumār", "cundiyo rājakumār"],
		sujato: ["princess cundī", "cundī"],
		titleNames: ["cundī", "cundi"],
		slugs: ["an5.32"],
	},
	{
		label: "Brahmin Soṇadaṇḍa",
		pali: ["soṇadaṇḍo", "soṇadaṇḍassa"],
		paliRequire: ["brāhmaṇ"],
		sujato: ["brahmin soṇadaṇḍa", "soṇadaṇḍa"],
		titleNames: ["soṇadaṇḍa", "sonadanda"],
		slugs: ["dn4"],
	},
	{
		label: "Naked Ascetic Pāṭikaputta",
		pali: ["acelo pāthikaputt", "pāthikaputt"],
		paliRequire: ["acelo"],
		sujato: ["naked ascetic pāṭikaputta", "pāṭikaputta", "pāthikaputta", "about pāṭikaputta"],
		titleNames: ["pāṭikaputta", "pathikaputta", "pāthika"],
		slugs: ["dn24"],
	},
	{
		label: "Laywoman Bojjhā",
		pali: ["bojjhā upāsik", "bojjho upāsik"],
		sujato: ["laywoman bojjhā", "bojjhā"],
		titleNames: ["bojjhā"],
	},
	{
		label: "Laywoman Nakulamātā",
		pali: ["nakulamātā gahapatān", "nakulamātā"],
		sujato: ["nakula's mother", "nakulamātā", "housewife nakula"],
		titleNames: ["nakulamātā"],
	},
	{
		label: "Laywoman Suppavāsā",
		pali: ["suppavāsā koliyadhīt", "suppavāsā"],
		sujato: ["suppavāsā the koliyan", "suppavāsā"],
		titleNames: ["suppavāsā"],
	},
	{
		label: "Venerable Nanda",
		homonymGroup: "nanda",
		pali: ["āyasmā nando", "āyasmantaṁ nandaṁ"],
		paliReject: ["nandamāt", "nandaka", "nandivisāla"],
		sujato: ["venerable nanda"],
		titleNames: ["nanda"],
	},
	{
		label: "Laywoman Nandamātā",
		homonymGroup: "nanda",
		pali: ["nandamāt"],
		sujato: ["nandamātā", "nanda’s mother", "nanda's mother"],
		titleNames: ["nandamātā", "velukaṇṭakī", "nanda’s mother"],
	},
	{
		label: "Venerable Nandaka",
		homonymGroup: "nandaka",
		pali: ["āyasmā nandak", "nandako"],
		sujato: ["venerable nandaka"],
		titleNames: ["nandaka"],
	},
	{
		label: "Nandaka, the chief minister of the Licchavis",
		homonymGroup: "nandaka",
		pali: ["nandaka"],
		paliRequire: ["licchavi", "mahāmatt"],
		sujato: ["nandaka, the chief minister", "nandaka the chief minister"],
		titleNames: ["nandaka, the chief minister"],
	},
	{
		label: "Venerable Bhaddiya",
		homonymGroup: "bhaddiya",
		pali: ["bhaddiya"],
		paliReject: [
			"lakuṇḍaka",
			"lakundaka",
			"licchavi",
			"sakkaṁ",
			"sakkan",
			"kāḷīgodhāya",
		],
		sujato: ["venerable bhaddiya"],
		titleNames: ["bhaddiya"],
	},
	{
		label: "Venerable Bhaddiya, son of Kāḷīgodhā",
		homonymGroup: "bhaddiya",
		pali: ["bhaddiyo kāḷīgodhāya putto", "āyasmā bhaddiyo kāḷīgodhāya"],
		sujato: ["bhaddiya son of kāḷīgodhā", "venerable bhaddiya son of kāḷīgodhā"],
		titleNames: ["bhaddiya son of kāḷīgodhā"],
	},
	{
		label: "Bhaddiya the Licchavi",
		homonymGroup: "bhaddiya",
		pali: ["bhaddiyo licchavi", "bhaddiyaṁ licchavi", "bhaddiyo licchaviṁ"],
		sujato: ["bhaddiya the licchavi"],
		titleNames: ["bhaddiya the licchavi"],
	},
	{
		label: "Bhaddiya the Sakyan",
		homonymGroup: "bhaddiya",
		pali: ["bhaddiyaṁ sakkaṁ", "bhaddiya sakka", "bhaddiyo sakka"],
		sujato: ["bhaddiya the sakyan"],
		titleNames: ["bhaddiya the sakyan"],
	},
	{
		label: "Venerable Lakuṇḍaka Bhaddiya",
		homonymGroup: "bhaddiya",
		pali: ["lakuṇḍaka"],
		sujato: ["lakuṇḍaka bhaddiya", "dwarf bhaddiya"],
		titleNames: ["lakuṇḍaka bhaddiya"],
	},
	{
		label: "Citta the householder",
		homonymGroup: "citta",
		pali: ["citto gahapati", "cittaṁ gahapati"],
		sujato: ["citta the householder", "citta, the householder"],
		collections: ["sn41"],
		titleNames: ["citta"],
	},
	{
		label: "Citta Hatthisāriputta",
		homonymGroup: "citta",
		pali: ["hatthisāriputt"],
		sujato: ["citta hatthisāriputta", "hatthisāriputta"],
		titleNames: ["citta hatthisāriputta", "hatthisāriputta"],
	},
	{
		label: "Venerable Isidatta",
		homonymGroup: "isidatta",
		pali: ["āyasmā isidatt", "isidattassa"],
		paliReject: ["gahapati", "thapati"],
		sujato: ["venerable isidatta", "reverend isidatta"],
		titleNames: ["isidatta"],
		slugs: ["sn41.2", "sn41.3"],
	},
	{
		label: "Layman Isidatta",
		homonymGroup: "isidatta",
		pali: [
			"isidatto gahapati",
			"isidattaṁ gahapati",
			"pitāmaho isidatt",
			"isidattapurāṇā thapat",
			"isidattapurāṇe thapat",
		],
		paliReject: ["āyasmā"],
		sujato: [
			"layman isidatta",
			"isidatta the layman",
			"uncle isidatta",
			"chamberlains isidatta",
			"chamberlain isidatta",
		],
		slugs: ["an6.44", "an10.75", "an6.120-139", "sn55.6"],
	},
	{
		label: "Layman Purāṇa",
		homonymGroup: "purana",
		pali: [
			"purāṇo gahapati",
			"purāṇa gahapati",
			"purāṇo brahmacār",
			"isidattapurāṇā thapat",
			"isidattapurāṇe thapat",
		],
		sujato: [
			"father purāṇa",
			"layman purāṇa",
			"my father purāṇa",
			"chamberlain purāṇa",
			"purāṇa and isidatta",
		],
		slugs: ["an6.44", "an10.75", "sn55.6"],
	},
	{
		label: "Laywoman Migasālā",
		pali: ["migasālā upāsik", "migasālāya upāsik"],
		sujato: ["laywoman migasālā", "migasālā"],
		titleNames: ["migasālā", "migasala"],
		slugs: ["an6.44", "an10.75"],
	},
	{
		label: "Brahmin woman Verahaccāni",
		pali: [
			"verahaccānigottā brāhmaṇī",
			"verahaccānigottāya brāhmaṇiyā",
			"verahaccānigottaṁ brāhmaṇiṁ",
		],
		sujato: [
			"brahmin lady of the verahaccāni",
			"brahmin woman verahaccāni",
			"verahaccāni clan",
		],
		titleNames: ["verahaccāni", "verahaccani"],
		slugs: ["sn35.133"],
	},
	{
		label: "Young Brahmin Vāseṭṭha",
		pali: ["vāseṭṭhabhāradvāj"],
		sujato: ["student vāseṭṭha", "young brahmin vāseṭṭha"],
		slugs: ["dn13", "dn27", "mn98", "snp3.9"],
	},
	{
		label: "Young Brahmin Bhāradvāja",
		pali: ["vāseṭṭhabhāradvāj"],
		paliReject: ["aggikabhāradvāj", "bhāradvājagott"],
		sujato: ["student bhāradvāja", "young brahmin bhāradvāja"],
		slugs: ["dn13", "dn27", "mn98", "snp3.9"],
	},
	{
		label: "Householder Ugga of Vesāli",
		homonymGroup: "ugga",
		pali: [
			"uggo gahapati vesāliko",
			"uggaṁ gahapatiṁ vesālikaṁ",
			"uggassa gahapatino vesālikassa",
		],
		sujato: ["ugga of vesāli", "householder ugga of vesāli"],
		slugs: ["an8.21", "sn35.124", "an5.44"],
	},
	{
		label: "Householder Ugga of Hatthigāma",
		homonymGroup: "ugga",
		pali: [
			"uggo gahapati hatthigāmako",
			"uggaṁ gahapatiṁ hatthigāmakaṁ",
			"uggassa gahapatino hatthigāmakassa",
		],
		sujato: ["ugga of hatthigāma", "householder ugga of hatthigāma"],
		slugs: ["an8.22", "sn35.125"],
	},
	{
		label: "Uggaha, Meṇḍaka's grandson",
		pali: ["uggaho meṇḍakanattā", "uggahassa meṇḍakanattuno"],
		sujato: ["uggaha, meṇḍaka's grandson", "meṇḍaka’s grandson"],
		titleNames: ["uggaha"],
		slugs: ["an5.33"],
	},
	{
		label: "Cunda the smith",
		homonymGroup: "cunda",
		pali: ["cundo kammāraputt", "cundassa kammāraputt", "cundaṁ kammāraputtaṁ"],
		sujato: ["cunda the smith", "cunda kammāraputta"],
		titleNames: ["cunda the smith", "cunda"],
	},
	{
		label: "Venerable Mahācunda",
		homonymGroup: "cunda",
		pali: ["mahācund"],
		sujato: ["venerable mahācunda", "mahācunda"],
		titleNames: ["mahācunda"],
	},
	{
		label: "Venerable Ānanda",
		pali: ["āyasmā ānand", "āyasmatā ānand"],
		sujato: ["venerable ānanda"],
		titleNames: ["ānanda", "ananda"],
	},
	{
		label: "Venerable Sāriputta",
		pali: ["sāriputt"],
		sujato: ["venerable sāriputta", "sāriputta"],
		collections: ["sn28", "sn38", "sn39"],
		titleNames: ["sāriputta"],
	},
	{
		label: "Venerable Mahāmoggallāna",
		pali: ["mahāmoggallān", "moggallān"],
		sujato: ["venerable mahāmoggallāna", "moggallāna"],
		collections: ["sn40"],
		titleNames: ["moggallāna", "mahāmoggallāna"],
	},
	{
		label: "Venerable Anuruddha",
		pali: ["anuruddh"],
		sujato: ["venerable anuruddha", "anuruddha"],
		collections: ["sn52"],
		titleNames: ["anuruddha"],
	},
	{
		label: "Venerable Rādha",
		pali: ["rādha"],
		sujato: ["venerable rādha", "rādha"],
		collections: ["sn23"],
		titleNames: ["rādha", "radha"],
	},
	{
		label: "Venerable Rāhula",
		pali: ["rāhul"],
		sujato: ["rāhula", "venerable rāhula"],
		collections: ["sn18"],
		titleNames: ["rāhula", "rahula"],
	},
	{
		label: "Venerable Vaṅgīsa",
		pali: ["vaṅgīs"],
		sujato: ["vaṅgīsa", "venerable vaṅgīsa"],
		collections: ["sn8"],
		titleNames: ["vaṅgīsa", "vangisa"],
	},
	{
		label: "King Pasenadi of Kosala",
		pali: ["pasenadi"],
		sujato: ["king pasenadi", "pasenadi of kosala"],
		collections: ["sn3"],
		titleNames: ["pasenadi", "king pasenadi"],
	},
	{
		label: "King Ajātasattu",
		pali: [
			"rājā māgadho ajātasattu",
			"rañño māgadhassa ajātasattussa",
			"rājā ajātasattu",
		],
		sujato: ["king ajātasattu"],
		titleNames: ["ajātasattu", "ajatasattu"],
		slugs: ["an4.188"],
	},
	{
		label: "Māra the Evil One",
		pali: ["māro pāpimā"],
		sujato: ["māra the evil one", "then māra", "māra approached"],
		collections: ["sn4"],
		titleNames: ["māra", "mara"],
	},
	{
		label: "Sakka, lord of the gods",
		pali: ["sakko devānamindo", "sakko"],
		sujato: ["sakka"],
		collections: ["sn11"],
		titleNames: ["sakka"],
	},
	{
		label: "Brahmā Sahampati",
		pali: ["sahampati"],
		sujato: ["sahampati"],
		titleNames: ["sahampati"],
	},
	{
		label: "Baka the Brahmā",
		pali: ["bako brahmā", "baka"],
		sujato: ["baka"],
		titleNames: ["baka", "baka the divinity"],
	},
	{
		label: "Wanderer Jambukhādaka",
		pali: ["jambukhādak"],
		sujato: ["jambukhādaka"],
		collections: ["sn38"],
		titleNames: ["jambukhādaka", "jambukhadaka"],
	},
	{
		label: "Wanderer Sāmaṇḍaka",
		pali: ["sāmaṇḍak"],
		sujato: ["sāmaṇḍaka", "sāmaṇḍaka"],
		collections: ["sn39"],
		titleNames: ["sāmaṇḍaka", "samandaka"],
	},
	{
		label: "Venerable Aññāsikoṇḍañña",
		pali: ["aññāsikoṇḍaññ", "aññāsi koṇḍaññ"],
		sujato: ["aññāsi koṇḍañña", "aññāsikoṇḍañña"],
		titleNames: ["aññāsikoṇḍañña", "aññāsi koṇḍañña"],
		slugs: ["ud7.6", "sn8.9"],
	},
	{
		label: "Householder Anāthapiṇḍika",
		homonymGroup: "anathapindika",
		pali: ["anāthapiṇḍiko", "anāthapiṇḍikaṁ"],
		paliReject: ["devaputt", "pañcamattehi"],
		sujato: ["householder anāthapiṇḍika", "anāthapiṇḍika the householder"],
		titleNames: ["anāthapiṇḍika", "anathapindika"],
	},
	{
		label: "Deity Anāthapiṇḍika",
		homonymGroup: "anathapindika",
		pali: ["anāthapiṇḍiko devaputt"],
		paliRequire: ["devaputt"],
		sujato: ["young deity anāthapiṇḍika", "deity anāthapiṇḍika"],
		titleNames: ["anāthapiṇḍika"],
	},
	{
		label: "Mahānāma the Sakyan",
		pali: ["mahānāmo sakko", "mahānāmo sakkaṁ", "mahānāma sakka"],
		paliRequire: ["sakka"],
		sujato: ["mahānāma"],
		titleNames: ["mahānāma", "mahanama"],
	},
	{
		label: "Devadatta",
		pali: ["devadatt"],
		sujato: ["devadatta"],
		titleNames: ["devadatta"],
	},
	{
		label: "Venerable Upāli",
		pali: ["upāli"],
		sujato: ["upāli", "venerable upāli"],
		titleNames: ["upāli", "upali"],
	},
	{
		label: "Queen Mallikā",
		pali: ["mallikā"],
		paliReject: ["mallikādevīsutta"],
		sujato: ["mallikā", "mallika", "queen mallikā"],
		titleNames: ["mallikā", "mallika", "queen mallikā"],
	},
	{
		label: "Sakyan laywoman Kāḷigodhā",
		pali: ["kāḷigodhā sākiyān", "kāligodhā sākiyān", "kāḷigodhāya sākiyān"],
		sujato: ["kāḷigodhā the sakyan lady", "kāḷigodhā"],
		titleNames: ["kāḷigodhā", "kaligodha"],
		slugs: ["sn55.39"],
	},
	{
		label: "Wanderer Kuṇḍaliya",
		pali: ["kuṇḍaliyo paribbājak", "kuṇḍaliya paribbājak"],
		sujato: ["wanderer kuṇḍaliya", "kuṇḍaliya"],
		titleNames: ["kuṇḍaliya", "kundaliya"],
		slugs: ["sn46.6"],
	},
	{
		label: "Deity Rohitassa",
		pali: ["rohitasso devaputt", "rohitassaṁ devaputt"],
		sujato: [
			"godling rohitassa",
			"young deity rohitassa",
			"deity rohitassa",
			"the glorious godling rohitassa",
		],
		titleNames: ["rohitassa"],
		slugs: ["sn2.26", "an4.45", "an4.46"],
	},
	{
		label: "Brahmin Jāṇussoṇi",
		pali: ["jāṇussoṇi", "jānussoṇi"],
		sujato: ["jānussoṇi", "jāṇussoṇi"],
		titleNames: ["jānussoṇi", "jāṇussoṇi"],
	},
	{
		label: "Brahmin Doṇa",
		pali: ["doṇo brāhmaṇ", "doṇa brāhmaṇ", "doṇassa brāhmaṇ"],
		sujato: ["brahmin doṇa", "doṇa", "the brahmin doṇa"],
		titleNames: ["doṇa", "dona", "doṇo"],
		slugs: ["dn16", "an4.36", "an5.192"],
	},
	{
		label: "Householder Dasama",
		pali: ["dasamo gahapati", "dasamassa gahapati"],
		sujato: ["householder dasama", "dasama", "man from the town of aṭṭhaka"],
		titleNames: ["dasama", "aṭṭhakanāgara"],
		slugs: ["mn52", "an11.16"],
	},
	{
		label: "Lay follower Dhammadinna",
		pali: ["dhammadinno upāsak", "dhammadinna upāsak"],
		sujato: ["lay follower dhammadinna", "dhammadinna"],
		titleNames: ["dhammadinna"],
		slugs: ["sn55.53"],
	},
	{
		label: "Lay follower Dhammika",
		homonymGroup: "dhammika",
		pali: ["dhammiko upāsak", "dhammika upāsak"],
		paliReject: ["āyasmā dhammik", "āyasmantaṁ dhammik", "āyasmatā dhammik"],
		sujato: ["lay follower dhammika"],
		titleNames: ["dhammika"],
		slugs: ["snp2.14"],
	},
	{
		label: "Venerable Dhammika",
		homonymGroup: "dhammika",
		pali: ["āyasmā dhammik", "āyasmantaṁ dhammik", "āyasmatā dhammik"],
		paliReject: ["dhammiko upāsak"],
		sujato: ["venerable dhammika"],
		slugs: ["an6.54"],
	},
	{
		label: "Hatthaka of Āḷavi",
		homonymGroup: "hatthaka",
		pali: ["hatthak", "hatthako āḷavak"],
		paliReject: ["devaputt"],
		sujato: [
			"hatthaka of Āḷavī",
			"hatthaka of alavi",
			"householder hatthaka",
		],
		titleNames: ["hatthaka", "hatthaka of alavi"],
		slugs: ["an8.23", "an8.24", "an3.35"],
	},
	{
		label: "Deity Hatthaka",
		homonymGroup: "hatthaka",
		pali: ["hatthak"],
		paliRequire: ["devaputt"],
		sujato: ["godling hatthaka", "deity hatthaka"],
		titleNames: ["hatthaka"],
		slugs: ["an3.127"],
	},
	{
		label: "Young Brahmin Saṅgārava",
		homonymGroup: "sangarava",
		pali: ["saṅgārav"],
		paliRequire: ["māṇav"],
		sujato: ["student saṅgārava", "young brahmin saṅgārava"],
		titleNames: ["saṅgārava", "sangarava"],
	},
	{
		label: "Brahmin Saṅgārava",
		homonymGroup: "sangarava",
		pali: ["saṅgārav"],
		paliReject: ["māṇav"],
		sujato: ["brahmin saṅgārava", "saṅgārava the brahmin"],
		titleNames: ["saṅgārava", "sangarava"],
	},
	{
		label: "Lay follower Visākha",
		homonymGroup: "visakha",
		pali: ["visākho upāsak"],
		paliReject: ["pañcālaputt", "migāramāt"],
		sujato: ["lay follower visākha", "the householder visākha"],
		titleNames: ["visākha"],
	},
	{
		label: "Venerable Visākha, Pañcālī's Son",
		homonymGroup: "visakha",
		pali: ["visākho pañcālaputt", "visākhaṁ pañcālaputta"],
		sujato: ["pañcālī’s son", "pañcāli’s son", "visākha, pañcālī"],
		titleNames: ["visākha, pañcālī’s son", "visākha"],
	},
	{
		label: "Laywoman Visākhā Migāramātā",
		homonymGroup: "visakha",
		pali: ["visākhā migāramāt", "visākhā migāramātā", "migāramātā visākhā"],
		sujato: ["visākhā, migāra’s mother", "migāramātā", "migāra's mother"],
		titleNames: ["visākhā"],
	},
	{
		label: "Laywoman Sāmāvatī",
		pali: ["sāmāvatī"],
		sujato: ["sāmāvatī", "queen sāmāvatī", "lay woman sāmāvatī"],
		titleNames: ["sāmāvatī"],
	},
	{
		label: "Laywoman Dhanañjānī",
		pali: ["dhanañjānī brāhmaṇ", "dhanañjānī"],
		paliReject: ["dhanañjāni gahapati", "dhanañjāni brāhmaṇo"],
		sujato: ["dhanañjānī", "brahmin lady dhanañjānī", "brahmin woman dhanañjānī"],
		titleNames: ["dhanañjānī"],
	},
	{
		label: "Brahmin Dhanañjāni",
		pali: ["dhanañjāni gahapati", "dhanañjāni brāhmaṇ"],
		sujato: ["dhanañjāni", "brahmin dhanañjāni"],
		titleNames: ["dhanañjāni"],
		paliReject: ["dhanañjānī", "brāhmaṇī"],
	},
	{
		label: "Householder Soṇa",
		pali: ["soṇo gahapatiputt", "soṇa gahapatiputt"],
		sujato: ["soṇa the householder's son", "householder soṇa", "soṇa"],
		titleNames: ["soṇa", "soṇo"],
	},
	{
		label: "General Sīha",
		pali: ["sīho senāpati", "sīhā senāpati"],
		sujato: ["general sīha", "sīha the general", "sīho senāpati"],
		titleNames: ["sīha", "sīhasenāpati", "sīho senāpati"],
	},
	{
		label: "Saccaka—Nigaṇṭha’s son",
		pali: ["saccako nigaṇṭhaputt", "saccaka nigaṇṭha"],
		sujato: ["saccaka, the son of jain parents", "saccaka the son of jain parents"],
		titleNames: ["saccaka"],
		slugs: ["mn35", "mn36"],
	},
	{
		label: "Brahmin Bhāradvāja the Fire-Worshiper",
		pali: ["aggikabhāradvāj"],
		paliRequire: ["brāhmaṇ"],
		sujato: ["bhāradvāja the fire-worshiper", "fire-worshipper"],
		titleNames: ["bhāradvāja the fire-worshiper"],
	},
	{
		label: "Vepacitti, lord of the asuras",
		pali: ["vepacitti"],
		sujato: ["vepacitti"],
		titleNames: ["vepacitti"],
	},
	{
		label: "Kaḷāra the Aristocrat",
		pali: ["kaḷārakhattiy", "kalarakhattiy"],
		sujato: ["kaḷāra the aristocrat", "kalara the aristocrat"],
		titleNames: ["kaḷāra the aristocrat", "kalara the aristocrat"],
		slugs: ["sn12.32"],
	},
];

const OPENING_CHARS = 1800;

function pruneHomonymHits(hits: CharacterHit[], pali: string): CharacterHit[] {
	const grouped = new Map<string, CharacterHit[]>();
	for (const hit of hits) {
		if (!hit.homonymGroup) continue;
		const list = grouped.get(hit.homonymGroup) || [];
		list.push(hit);
		grouped.set(hit.homonymGroup, list);
	}

	const drop = new Set<CharacterHit>();
	for (const [group, groupHits] of grouped) {
		if (group === "bhaddiya" && groupHits.length >= 2) {
			const specific = groupHits.filter((hit) =>
				/(licchavi|sakyan|kāḷīgodhā)/i.test(hit.label),
			);
			if (specific.length) {
				for (const hit of groupHits) {
					if (hit.label === "Venerable Bhaddiya" && specific.some((s) => s !== hit)) {
						drop.add(hit);
					}
				}
			}
		}
		if (group === "cunda" && groupHits.length >= 2) {
			const smith = groupHits.find((hit) => hit.label === "Cunda the smith");
			if (smith) {
				for (const hit of groupHits) {
					if (hit !== smith && /kammāraputt/i.test(hit.label)) {
						drop.add(hit);
					}
				}
			}
		}
	}

	return hits.filter((hit) => !drop.has(hit));
}

function fold(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function includesFolded(haystack: string, needle: string): boolean {
	return includesPhrase(haystack, needle);
}

/** Phrase must fall on letter boundaries so `venerable nanda` does not match Nandaka. */
export function includesPhrase(haystack: string, needle: string): boolean {
	const foldedHay = fold(haystack);
	const foldedNeedle = fold(needle).trim();
	if (!foldedNeedle) return false;
	if (foldedNeedle.includes(" ")) {
		const escaped = foldedNeedle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "i").test(foldedHay);
	}
	const escaped = foldedNeedle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "i").test(foldedHay);
}

/** Stem must start at a letter boundary so `māro` does not match `kumāro`. */
export function includesPaliStem(text: string, stem: string): boolean {
	if (stem.includes(" ")) return includesFolded(text, stem);
	const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?<![\\p{L}\\p{M}])${escaped}`, "iu").test(text);
}

export function collectionKeyForSlug(slug: string): string | null {
	const match = slug.toLowerCase().match(/^(sn|an|snp|ud|iti|kp|dhp|mn|dn)(\d+)/);
	if (!match) return null;
	const book = match[1];
	if (book === "sn" || book === "an" || book === "snp") {
		return `${book}${match[2]}`;
	}
	return book;
}

function stripSujatoComments(body: string): string {
	return body.replace(/<!--[\s\S]*?-->/g, " ").replace(/\s+/g, " ").trim();
}

export function extractWithTitleName(title: string): string | null {
	const trimmed = title.trim();
	if (!trimmed) return null;
	const withMatch = trimmed.match(
		/^(?:The\s+(?:Greater|Shorter|Longer|Great|Lesser)\s+Discourse\s+)?With\s+(.+?)(?:\s+\((?:1st|2nd|3rd|4th|5th)\))?$/i,
	);
	const toMatch = trimmed.match(
		/^To\s+(\S+?)(?:\s+on\s+the\s+.+)?(?:\s+\((?:1st|2nd|3rd|4th|5th)\))?$/i,
	);
	let name = (withMatch?.[1] || toMatch?.[1] || "").trim();
	if (toMatch && !withMatch) {
		const token = toMatch[1] || "";
		const gazetteerHit = PERSON_SENSES.some((sense) =>
			senseMatchesTitle(sense, token),
		);
		if (!gazetteerHit) return null;
		name = token;
	}
	name = name.replace(/\s+on\s+(?:the\s+)?(?:impermanence|suffering|not-self|not self).*$/i, "").trim();
	name = name.replace(/\s+on\s+the\s+.+$/i, "").trim();
	name = name.replace(/\s+\((?:1st|2nd|3rd|4th|5th)\)$/i, "").trim();
	if (!name || TITLE_NON_PERSON.has(fold(name))) return null;
	if (fold(name).startsWith("suffering") || fold(name).startsWith("untitled")) {
		return null;
	}
	if (/^(a|an|the|several)\s/i.test(name)) return null;
	return name;
}

function senseMatchesTitle(sense: PersonSense, titleName: string): boolean {
	const folded = fold(titleName);
	return (sense.titleNames || []).some((name) => {
		const n = fold(name);
		return folded === n || folded.startsWith(`${n} `) || folded.endsWith(` ${n}`);
	});
}

function textHasAny(
	text: string,
	needles: string[] | undefined,
	paliStems = false,
): boolean {
	if (!needles?.length) return false;
	return needles.some((needle) =>
		paliStems ? includesPaliStem(text, needle) : includesFolded(text, needle),
	);
}

function senseMatchesPali(
	sense: PersonSense,
	pali: string,
	collection: string | null,
): boolean {
	if (sense.paliReject && textHasAny(pali, sense.paliReject, true)) return false;
	if (collection && sense.collections?.includes(collection)) return true;
	if (!sense.pali?.length) return false;
	if (!textHasAny(pali, sense.pali, true)) return false;
	if (sense.paliRequire?.length && !textHasAny(pali, sense.paliRequire, true)) {
		return false;
	}
	return true;
}

function uniqueLabels(hits: CharacterHit[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const hit of hits) {
		const key = compactPersonCore(hit.label) || fold(hit.label);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(hit.label);
	}
	return out;
}

const GENERIC_AYASMA = new Set(
	[
		"bhikkhu",
		"thero",
		"navo",
		"so",
		"te",
		"kho",
		"pi",
		"ca",
		"hi",
		"evamāha",
		"allīno",
		"ajjhupagato",
		"āyasmato",
		"āyasmassa",
		"āyasmata",
		"imasmiṁ",
		"imasmiṃ",
		"imasmim",
		"dhammavinaye",
	].map(fold),
);

const PALI_NAME = "[\\p{L}\\p{M}]+";

/** Pali compounds whose English card should follow the usual Sujato epithet. */
const PALI_COMPOUND_DISPLAY: Record<string, string> = {
	aggikabharadvaja: "Bhāradvāja the Fire-Worshiper",
	dona: "Doṇa",
	doṇa: "Doṇa",
	doṇo: "Doṇa",
	sono: "Soṇa",
	soṇo: "Soṇa",
	siho: "Sīha",
	sīho: "Sīha",
	verahaccani: "Verahaccāni",
	verahaccāni: "Verahaccāni",
	uggo: "Ugga",
	ugga: "Ugga",
	uggaho: "Uggaha",
	uggaha: "Uggaha",
	mahakotthika: "Mahākoṭṭhita",
	mahakotthita: "Mahākoṭṭhita",
	mahakoṭṭhika: "Mahākoṭṭhita",
	mahakoṭṭhita: "Mahākoṭṭhita",
};

/** Celestial devas use the English heavenly body, not the Pali name. */
const CELESTIAL_DEVA_ENGLISH: Record<string, string> = {
	candima: "Moon",
	candimā: "Moon",
	candimasa: "Moon",
	candimasā: "Moon",
	suriya: "Sun",
	sūriya: "Sun",
	sūriyo: "Sun",
};

const IGNORE_PALI_NAME_TOKENS = new Set(
	[
		"bhagavā",
		"bhagavanta",
		"bhagavato",
		"buddha",
		"yena",
		"tena",
		"tato",
		"tatra",
		"te",
		"taṁ",
		"tam",
		"so",
		"sā",
		"idaṁ",
		"etaṁ",
		"pubbaṇhasamayaṁ",
		"sāyanhasamayaṁ",
		"paṭisallānā",
		"vuṭṭhito",
		"nivāsetvā",
		"pattacīvaramādāya",
		"dve",
		"pañcahi",
		"pañcamattehi",
		"saddhiṁ",
		"saddhim",
		"acirapakkante",
		"āyasmato",
		"āyasmassa",
		"tadahuposathe",
		"uṭṭhāyāsanā",
		"uṭṭhāyāsana",
		"imasmiṁ",
		"imasmiṃ",
		"dhammavinaye",
	].map(fold),
);

const ANONYMOUS_PALI_NAME_STEMS = new Set(
	[
		"bhāradvājagott",
		"bhaggavagott",
		"bhikkhak",
		"brāhmaṇagahapatik",
		"khomadussak",
		"campeyyak",
		"moranivāp",
		"venāgapurik",
		"appasadd",
		"lokāyatik",
		"evaṁnām",
		"aṭṭhakanāgar",
		"icchānaṅgalak",
		"sahassabhikkhunisaṅgh",
		"bhikkhunisaṅgh",
		"aññatitthiyāna",
		"acirapakkante",
		"jātibhūmak",
		"jātibhūmi",
		"kāpilavatthav",
		"kapilavatthav",
	].map(fold),
);

const CROWD_LEADER_TOKENS = new Set(
	["sambahulā", "sambahula", "seyyathidaṁ", "seyyathidam", "te"].map(fold),
);

function isGeographicEpithetStem(stem: string): boolean {
	const folded = fold(stem);
	if (ANONYMOUS_PALI_NAME_STEMS.has(folded)) return true;
	return /(eyyak|purik|gahapatik|nivāp|gott)$/.test(folded);
}

function truncatePaliForCharacterScan(text: string): string {
	const uddanaIdx = text.search(/\btassuddān[\p{L}\p{M}]*/iu);
	let cut = uddanaIdx >= 0 ? uddanaIdx : text.length;
	const vaggoIdx = text.search(/\n\s*\S+vaggo\s+\S+\.\s*(?:\n|$)/iu);
	if (vaggoIdx >= 0 && vaggoIdx < cut) cut = vaggoIdx;
	return text.slice(0, cut).trim();
}

/** Chapter index listing many laywomen — not a single interlocutor discourse. */
export function isVaggoIndexList(paliBody: string): boolean {
	const truncated = truncatePaliForCharacterScan(paliBody);
	const lines = truncated
		.split(/\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length === 0 || lines.length > 2) return false;
	const main = lines[0] || "";
	const commaCount = (main.match(/,/g) || []).length;
	if (commaCount < 5) return false;
	const foldedMain = fold(main);
	if (!foldedMain.includes("upasika") && !foldedMain.includes("gahapatani")) {
		return false;
	}
	return /vaggo/i.test(paliBody);
}

function isIgnoredPaliNameToken(token: string): boolean {
	const folded = fold(token.replace(/[.,;:]+$/u, ""));
	return IGNORE_PALI_NAME_TOKENS.has(folded);
}

function isAnonymousPaliNameStem(token: string): boolean {
	const stem = fold(stemPaliPersonToken(token.replace(/[.,;:]+$/u, "")));
	for (const anonymous of ANONYMOUS_PALI_NAME_STEMS) {
		if (stem.startsWith(anonymous) || anonymous.startsWith(stem)) return true;
	}
	return false;
}

function isUnidentifiedBharadvajaGotta(pali: string): boolean {
	return /aññatar(?:assa|ā)\s+bhāradvājagott/i.test(pali);
}

export function isFalseCharacterLabel(label: string): boolean {
	const folded = fold(label);
	if (/\bbhagavā\b/.test(folded)) return true;
	if (/\byena\b/.test(folded) && /\bwanderer\b/.test(folded)) return true;
	if (/\bbhikkhak/.test(folded)) return true;
	if (/\bbhāradvājagott/.test(folded)) return true;
	if (/\bkhomaduss/.test(folded)) return true;
	if (/\bsaṅgārav/.test(folded) && /\bkhomaduss/.test(folded)) return true;
	if (/\brāhu\b/.test(folded) && /\bdeity\b/.test(folded)) return true;
	if (/\brāhu\b/.test(folded) && /\bcandim/.test(folded)) return true;
	if (/\bcandimā\b/.test(folded) && !/\bmoon\b/.test(folded)) return true;
	if (/\bcandimas/.test(folded) && !/\bmoon\b/.test(folded)) return true;
	if (/\bsūriy/.test(folded) && !/\bsun\b/.test(folded)) return true;
	if (/\bupāsikā\b/.test(folded)) return true;
	if (/\bcampeyyak/.test(folded)) return true;
	if (/\bmoranivāp/.test(folded)) return true;
	if (/\bappasadd/.test(folded)) return true;
	if (/\bbhaggavagott/.test(folded)) return true;
	if (/\bkammaraputt/.test(folded) && !/\bsmith\b/.test(folded)) return true;
	if (/\bdve\b/.test(folded) && /\bbrahmin\b/.test(folded)) return true;
	if (/\blokāyatik/.test(folded)) return true;
	if (/\bevaṁnām/.test(folded)) return true;
	if (/\bpañcahi\b/.test(folded)) return true;
	if (/\bpañcamattehi\b/.test(folded)) return true;
	if (/\bicchānaṅgalak/.test(folded)) return true;
	if (/\bāḷavaka\b/.test(folded) && /\bpañcamattehi\b/.test(folded)) return true;
	if (/\baṭṭhakanāgar/.test(folded)) return true;
	if (/\bbrahmin dono\b/.test(folded)) return true;
	if (/\bisidattapurāṇā\b/.test(folded)) return true;
	if (/v[aā]se[tṭ]+habh[aā]radv[aā]j/.test(folded)) return true;
	if (/\btadahuposathe\b/.test(folded)) return true;
	if (/\bsahassabhikkhunisaṅgh/.test(folded)) return true;
	if (/\bbhikkhunisaṅgh/.test(folded)) return true;
	if (/\bannatitthiyana/.test(folded)) return true;
	if (/\bannatitthiyesu/.test(folded)) return true;
	if (/\bacirapakkante/.test(folded)) return true;
	if (/\bayasmat/.test(folded)) return true;
	if (/\bimasmim\b/.test(folded)) return true;
	if (/\butthayasan/.test(folded)) return true;
	if (/\bjatibhumak/.test(folded) || /\bjatibhumi/.test(folded)) return true;
	if (/\bkapilavatthav/.test(folded)) return true;
	if (/\bmallika\b/.test(folded) && /\bdevi\b/.test(folded)) return true;
	if (/\bbodhi\b/.test(folded) && /\bsanjikaputt/.test(folded)) return true;
	return false;
}

function paliTokenToEnglish(token: string): string {
	const stemmed = stemPaliPersonToken(token.replace(/[.,;:]+$/u, ""));
	const folded = fold(stemmed);
	const celestial = CELESTIAL_DEVA_ENGLISH[folded] || CELESTIAL_DEVA_ENGLISH[stemmed];
	if (celestial) return celestial;
	const display = PALI_COMPOUND_DISPLAY[folded];
	if (display) return display;
	return toChicagoTitleCase(stemmed);
}

const PALI_ROLE_ENGLISH: Array<[RegExp, string]> = [
	[/^gāma[nṇ][iī]/i, "Headman"],
	[/^rājakumārī/i, "Princess"],
	[/^rājakumār/i, "Prince"],
	[/^yakkho?$/i, "Spirit"],
	[/^acelo?$/i, "Naked Ascetic"],
	[/^paribbājak/i, "Wanderer"],
	[/^upāsak/i, "Lay follower"],
	[/^upāsik/i, "Laywoman"],
	[/^sākiyān/i, "Sakyan laywoman"],
	[/^devī$/i, "Queen"],
	[/^gahapati/i, "Householder"],
	[/^senāpati$/i, "General"],
	[/^thapati/i, "Builder"],
	[/^māṇav/i, "Young Brahmin"],
	[/^brāhma[nṇ][iī]/i, "Brahmin woman"],
	[/^brāhma[nṇ]/i, "Brahmin"],
	[/^devaputt/i, "Deity"],
	[/^bhikkhun[īi]/i, "Bhikkhunī"],
];

function isIgnoredPaliRoleExtra(token: string): boolean {
	return /^niganthasavak/i.test(fold(token));
}

function paliRoleEnglish(token: string): string | null {
	for (const [re, label] of PALI_ROLE_ENGLISH) {
		if (re.test(token)) return label;
	}
	return null;
}

/** Pali `asibandhakaputto gāmaṇi` → English `Headman Asibandhakaputta`. */
export function englishLabelFromPaliPhrase(phrase: string): string | null {
	const words = phrase.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
	if (words.some((word) => isIgnoredPaliNameToken(word))) {
		const filtered = words.filter((word) => !isIgnoredPaliNameToken(word));
		if (filtered.length !== words.length && filtered.length === 0) return null;
	}
	const phraseHasBrahminWoman = words.some((word) =>
		/^brāhma[nṇ][iī]/i.test(word.replace(/[.,;:]+$/u, "")),
	);
	let role: string | null = null;
	const nameParts: string[] = [];
	let clanSuffix: string | null = null;
	for (const word of words) {
		if (isIgnoredPaliNameToken(word)) continue;
		if (isIgnoredPaliRoleExtra(word)) continue;
		const rawFold = fold(word.replace(/[.,;:]+$/u, ""));
		if (rawFold === "alavako" || rawFold === "āḷavako") {
			const hasYakkhaRole = words.some((w) => /^yakkho?$/i.test(fold(w)));
			const followsHatthaka = nameParts.some((part) => /hatthaka/i.test(part));
			if (!hasYakkhaRole && followsHatthaka) {
				clanSuffix = "of Āḷavi";
				continue;
			}
		}
		const mapped = paliRoleEnglish(word);
		if (mapped) {
			role = mapped;
			continue;
		}
		if (GENERIC_AYASMA.has(fold(word))) continue;
		if (isAnonymousPaliNameStem(word)) return null;
		if (phraseHasBrahminWoman) {
			const clanBase = word
				.replace(/[.,;:]+$/u, "")
				.replace(/gott[aā]ya$/iu, "")
				.replace(/gott[aā]$/iu, "");
			if (clanBase && clanBase !== word.replace(/[.,;:]+$/u, "")) {
				nameParts.push(paliTokenToEnglish(clanBase));
				continue;
			}
		}
		const stem = fold(stemPaliPersonToken(word.replace(/[.,;:]+$/u, "")));
		if (isGeographicEpithetStem(stem)) return null;
		if (/^licchavi/.test(stem)) {
			clanSuffix = "the Licchavi";
			continue;
		}
		if (/^aṭṭhakanāgar/.test(stem)) continue;
		if (/^sakka/.test(stem)) {
			clanSuffix = "the Sakyan";
			continue;
		}
		const stripped = word.replace(/[.,;:]+$/u, "");
		if (/khattiy/i.test(stripped) && !/^khattiy/i.test(fold(stripped))) {
			const khattiyaBase = stripped.replace(/khattiy[\p{L}\p{M}]*$/iu, "");
			if (khattiyaBase) {
				nameParts.push(paliTokenToEnglish(khattiyaBase));
				clanSuffix = "the Aristocrat";
				continue;
			}
		}
		if (/^kāḷīgodhāya$/.test(stem) || /^kālīgodhāya$/.test(stem)) {
			clanSuffix = "son of Kāḷīgodhā";
			continue;
		}
		if (/^putto$/.test(stem) && clanSuffix === "son of Kāḷīgodhā") continue;
		if (/^hatthigamak/.test(stem)) {
			clanSuffix = "of Hatthigāma";
			continue;
		}
		if (/^vesalik/.test(stem)) {
			clanSuffix = "of Vesāli";
			continue;
		}
		if (/^mendakanatt/.test(stem)) {
			clanSuffix = "Meṇḍaka's grandson";
			continue;
		}
		nameParts.push(paliTokenToEnglish(word));
	}
	const name = nameParts.filter(Boolean).join(" ").trim();
	if (!name || isAnonymousPersonLabel(name)) return null;
	if (clanSuffix?.startsWith("the ")) {
		return `${name} ${clanSuffix}`;
	}
	if (clanSuffix === "of Āḷavi" || clanSuffix?.startsWith("of ")) {
		return role ? `${role} ${name} ${clanSuffix}` : `${name} ${clanSuffix}`;
	}
	if (
		clanSuffix === "son of Kāḷīgodhā" ||
		clanSuffix === "Meṇḍaka's grandson"
	) {
		return role ? `${role} ${name}, ${clanSuffix}` : `${name}, ${clanSuffix}`;
	}
	return role ? `${role} ${name}` : name;
}

function samePersonLabel(a: string, b: string): boolean {
	const ac = compactPersonCore(a);
	const bc = compactPersonCore(b);
	if (ac && bc && ac === bc) return true;
	const fa = fold(a);
	const fb = fold(b);
	return fa.includes(fb) || fb.includes(fa);
}

/** `vāseṭṭhabhāradvājānaṁ māṇavānaṁ` is two students, not one name. */
function expandDualPersonLabel(label: string): string[] {
	const folded = fold(label);
	if (/v[aā]se[tṭ]+habh[aā]radv[aā]j/.test(folded)) {
		return ["Young Brahmin Vāseṭṭha", "Young Brahmin Bhāradvāja"];
	}
	return [label];
}

/**
 * Featured interlocutors as Sujato names them in the opening.
 * Titles alone are not used (Kolita / Upatissa).
 */
export function labelsFromSujatoOpening(sujatoOpening: string): string[] {
	const text = stripSujatoComments(sujatoOpening);
	const labels: string[] = [];
	const seen = new Set<string>();
	const push = (label: string) => {
		const key = fold(label);
		if (!key || seen.has(key) || isAnonymousPersonLabel(label)) return;
		seen.add(key);
		labels.push(label);
	};

	const patterns: Array<[RegExp, (name: string) => string]> = [
		[/\bprince\s+([A-ZĀĪŪ][\wāīū-]*)/g, (name) => `Prince ${name}`],
		[/\bnaked ascetic\s+([A-ZĀĪŪ][\wāīū-]*)/gi, (name) => `Naked Ascetic ${toChicagoTitleCase(name)}`],
		[/\bheadman\s+([A-ZĀĪŪ][\wāīū-]*)/gi, (name) => `Headman ${toChicagoTitleCase(name)}`],
		[
			/\b(?:native spirit|spirit)\s+([A-ZĀĪŪ][\wāīū-]*)/gi,
			(name) => `Spirit ${toChicagoTitleCase(name)}`,
		],
	];
	for (const [re, toLabel] of patterns) {
		for (const match of text.matchAll(re)) {
			const name = match[1] || "";
			if (!name) continue;
			push(toLabel(name));
		}
	}
	return labels;
}

/** Featured speakers/approachers from the opening, never from the sutta title. */
export function labelsFromPaliOpening(paliOpening: string): string[] {
	const opening = truncatePaliForCharacterScan(paliOpening);
	if (isUnidentifiedBharadvajaGotta(opening)) return [];

	const labels: string[] = [];
	const seen = new Set<string>();
	const push = (label: string) => {
		for (const piece of expandDualPersonLabel(label)) {
			if (isFalseCharacterLabel(piece)) continue;
			const key = fold(piece);
			if (!key || seen.has(key)) continue;
			if (isAnonymousPersonLabel(piece)) continue;
			if (labels.some((existing) => samePersonLabel(existing, piece))) {
				continue;
			}
			seen.add(key);
			labels.push(piece);
		}
	};

	for (const match of opening.matchAll(/isidattapurāṇā\s+thapatay[oa]/giu)) {
		if (!match[0]) continue;
		push("Layman Isidatta");
		push("Layman Purāṇa");
	}

	for (const match of opening.matchAll(
		new RegExp(`(?<![\\p{L}\\p{M}])āyasmā(?:\\s+ca)?\\s+(${PALI_NAME})`, "giu"),
	)) {
		const token = match[1] || "";
		if (!token || GENERIC_AYASMA.has(fold(token))) continue;
		if (isAnonymousPersonLabel(token) || isAnonymousPaliNameStem(token)) continue;
		if (/^appasadd/i.test(fold(token))) continue;
		if (/^evaṁnām/i.test(fold(token))) continue;
		const context = opening.slice(Math.max(0, (match.index || 0) - 40), (match.index || 0) + 80);
		if (/kāḷīgodhāya\s+putto/i.test(context)) {
			push(`Venerable ${paliTokenToEnglish(token)}, son of Kāḷīgodhā`);
			continue;
		}
		push(`Venerable ${paliTokenToEnglish(token)}`);
	}

	for (const match of opening.matchAll(
		new RegExp(
			`ekamanta[\\p{L}\\p{M}]*\\s+nisinna[\\p{L}\\p{M}]*\\s+kho\\s+(${PALI_NAME})\\s+(licchavi|sakka[\\p{L}\\p{M}]*)\\s+bhagavā`,
			"giu",
		),
	)) {
		const labelled = englishLabelFromPaliPhrase(
			`${match[1] || ""} ${match[2] || ""}`,
		);
		if (labelled) push(labelled);
	}

	for (const match of opening.matchAll(
		new RegExp(`(${PALI_NAME})\\s+kāḷīgodhāya\\s+putto`, "giu"),
	)) {
		const token = match[1] || "";
		if (!token) continue;
		push(`Venerable ${paliTokenToEnglish(token)}, son of Kāḷīgodhā`);
	}

	const roleTail =
		"bhikkhun[īi]|paribbājak|thapati|upāsak(?!asat)|upāsik|gahapati|māṇav|brāhma[nṇ](?!agahapatik)[\\p{L}\\p{M}]*|devaputt|rājakumār|sākiyān[iī]|devī";
	const nameNotRole = `(?:(?!${roleTail})${PALI_NAME})`;
	for (const match of opening.matchAll(
		new RegExp(
			`atha kho\\s+((?:${nameNotRole}\\s+){0,3}${nameNotRole})\\s+(?:${roleTail})`,
			"giu",
		),
	)) {
		const span = match[0].replace(/^atha kho\s+/i, "");
		if (/^bhagavā\b/i.test(span)) continue;
		if (/^āyasmā\s/i.test(span)) continue;
		if (/^(sambahulā|seyyathidaṁ|te)\b/i.test(span)) continue;
		if (/^icchānaṅgalak/i.test(span)) continue;
		if (/\brāhu\b/i.test(span) || /\basurind/i.test(span)) continue;
		if (/\byena\s+aññatitthiyāna/i.test(span)) continue;
		if (/\bacirapakkante/i.test(span) && /\baññatitthiy/i.test(span)) {
			continue;
		}
		const afterRole = opening.slice((match.index || 0) + match[0].length);
		const trailingClan = afterRole.match(
			/^\s+(hatthigāmak[\p{L}\p{M}]*|vesālik[\p{L}\p{M}]*|meṇḍakanatt[\p{L}\p{M}]*)/iu,
		);
		const labelled = englishLabelFromPaliPhrase(
			trailingClan ? `${span} ${trailingClan[1]}` : span,
		);
		if (labelled) push(labelled);
	}

	for (const match of opening.matchAll(
		new RegExp(`atha kho\\s+(acelo?\\s+${PALI_NAME})`, "giu"),
	)) {
		const labelled = englishLabelFromPaliPhrase(match[1] || "");
		if (labelled) push(labelled);
	}

	for (const match of opening.matchAll(
		new RegExp(
			`atha kho (${PALI_NAME}) rājakumārī[\\s\\S]{0,240}?yena bhagavā tenupasaṅkami`,
			"giu",
		),
	)) {
		const token = match[1] || "";
		if (!token) continue;
		push(`Princess ${paliTokenToEnglish(token)}`);
	}

	for (const match of opening.matchAll(
		new RegExp(
			`atha kho\\s+((?:${PALI_NAME}\\s+){0,3}${PALI_NAME})\\s+yena bhagavā tenupasaṅkami`,
			"giu",
		),
	)) {
		const phrase = (match[1] || "").replace(/\s+/g, " ").trim();
		if (!phrase || /^āyasmā\s/i.test(phrase)) continue;
		if (/^(sambahulā|aññataro|aññatarā|te|so|bhagavā|seyyathidaṁ)\b/i.test(phrase)) {
			continue;
		}
		if (phrase.split(/\s+/).some((word) => CROWD_LEADER_TOKENS.has(fold(word)))) {
			continue;
		}
		if (
			phrase
				.split(/\s+/)
				.every((word) => isIgnoredPaliNameToken(word))
		) {
			continue;
		}
		if (/isidattapurāṇā/i.test(phrase)) continue;
		if (isAnonymousPaliNameStem(phrase.split(/\s+/)[0] || "")) continue;
		const labelled = englishLabelFromPaliPhrase(phrase);
		if (labelled) push(labelled);
	}

	for (const match of opening.matchAll(
		new RegExp(`(${PALI_NAME})\\s+devaputto\\b`, "giu"),
	)) {
		const labelled = englishLabelFromPaliPhrase(`${match[1] || ""} devaputta`);
		if (labelled) push(labelled);
	}

	return labels;
}

export function detectReferenceCharacters(input: {
	slug: string;
	paliTitle?: string;
	paliBody?: string;
	sujatoTitle?: string;
	sujatoBody?: string;
	knownLabels?: Set<string>;
	catalog?: PersonAliasCatalog;
}): CharacterDetection {
	const slug = input.slug.toLowerCase();
	if (isVaggoIndexList(input.paliBody || "")) {
		return {
			slug,
			labels: [],
			hits: [],
			reviews: [{ reason: "vaggo-index", detail: "chapter index list — not tagged" }],
		};
	}
	const collection = collectionKeyForSlug(slug);
	const paliRaw = `${input.paliTitle || ""}\n${(input.paliBody || "").slice(0, OPENING_CHARS)}`;
	const pali = truncatePaliForCharacterScan(paliRaw);
	const sujatoOpening = stripSujatoComments(
		(input.sujatoBody || "").slice(0, OPENING_CHARS),
	);
	const sujatoTitle = input.sujatoTitle || "";
	const reviews: CharacterDetection["reviews"] = [];
	const hits: CharacterHit[] = [];
	const catalog =
		input.catalog ||
		(input.knownLabels
			? buildPersonAliasCatalog([...input.knownLabels])
			: undefined);
	const knownFolds = new Set(
		(catalog?.labels || [...(input.knownLabels || [])]).map(fold),
	);

	const titleName = extractWithTitleName(sujatoTitle);

	for (const sense of PERSON_SENSES) {
		let via: string | null = null;
		if (sense.slugs?.includes(slug)) {
			via = via ? `${via}+slug` : "slug";
		}
		if (collection && sense.collections?.includes(collection)) {
			via = `collection:${collection}`;
		}
		if (titleName && senseMatchesTitle(sense, titleName)) {
			via = via ? `${via}+title` : "title";
		}
		if (sense.sujato && textHasAny(sujatoOpening, sense.sujato)) {
			via = via ? `${via}+sujato-opening` : "sujato-opening";
		}
		if (senseMatchesPali(sense, pali, collection)) {
			via = via ? `${via}+pali` : "pali";
		}

		if (!via) continue;
		if (via === "title") continue;
		if (isFalseCharacterLabel(sense.label)) continue;

		if (sense.homonymGroup && via === "pali" && sense.paliRequire?.length) {
			if (!textHasAny(pali, sense.paliRequire) && !textHasAny(sujatoOpening, sense.sujato || [])) {
				reviews.push({
					reason: "homonym-unresolved",
					detail: `${sense.homonymGroup}: matched stem for ${sense.label} without role cue`,
				});
				continue;
			}
		}

		hits.push({
			label: sense.label,
			via,
			homonymGroup: sense.homonymGroup,
		});
	}

	const groups = new Map<string, CharacterHit[]>();
	for (const hit of hits) {
		if (!hit.homonymGroup) continue;
		const list = groups.get(hit.homonymGroup) || [];
		list.push(hit);
		groups.set(hit.homonymGroup, list);
	}
	for (const [group, groupHits] of groups) {
		const distinct = uniqueLabels(groupHits);
		if (distinct.length > 1) {
			reviews.push({
				reason: "homonym-conflict",
				detail: `${group}: ${distinct.join(" | ")}`,
			});
		} else if (groupHits[0]) {
			reviews.push({
				reason: "homonym-disambiguated",
				detail: `${group} → ${groupHits[0].label} (${groupHits[0].via})`,
			});
		}
	}

	for (const label of labelsFromPaliOpening(pali)) {
		if (isFalseCharacterLabel(label)) continue;
		if (
			hits.some(
				(hit) =>
					samePersonLabel(hit.label, label) ||
					fold(hit.label).includes(fold(label)),
			)
		) {
			continue;
		}
		hits.push({
			label,
			via: "pali-opening",
		});
	}

	const prunedHits = pruneHomonymHits(hits, pali);
	hits.length = 0;
	hits.push(...prunedHits.filter((hit) => !isFalseCharacterLabel(hit.label)));

	for (const named of labelsFromSujatoOpening(sujatoOpening)) {
		for (const hit of hits) {
			if (
				samePersonLabel(hit.label, named) &&
				compactPersonCore(hit.label) === compactPersonCore(named)
			) {
				hit.label = named;
			}
		}
	}

	if (catalog) {
		for (const hit of hits) {
			const resolved = resolvePersonLabel(hit.label, catalog);
			if (resolved.ambiguous?.length) {
				reviews.push({
					reason: "alias-ambiguous",
					detail: `${hit.label} → ${resolved.ambiguous.join(" | ")}`,
				});
				continue;
			}
			if (resolved.label !== hit.label && resolved.via !== "exact") {
				reviews.push({
					reason: "alias-resolved",
					detail: `${hit.label} → ${resolved.label} (${resolved.via})`,
				});
				hit.aliasFrom = hit.label;
				hit.label = resolved.label;
				hit.via = `${hit.via}+alias`;
			} else if (resolved.via === "exact" || resolved.via === "core") {
				hit.label = resolved.label;
			}
		}
	}

	for (const hit of hits) {
		const folded = fold(hit.label);
		hit.isNewLabel = !knownFolds.has(folded);
		if (hit.via.includes("pali-opening")) {
			reviews.push({
				reason: hit.isNewLabel ? "new-label" : "pali-opening",
				detail: `${slug}: ${hit.label}`,
			});
		}
	}

	const labels = uniqueLabels(hits)
		.filter((label) => !isAnonymousPersonLabel(label))
		.filter((label) => !isFalseCharacterLabel(label));
	if (labels.length > 3) {
		reviews.push({
			reason: "many-characters",
			detail: labels.join("; "),
		});
	}

	return { slug, labels, hits, reviews };
}

function yamlCharacterItem(label: string): string {
	if (/[:#,]|^\s|\s$/.test(label) || label.includes('"') || label.includes(",")) {
		return JSON.stringify(label);
	}
	return label;
}

export function formatCharacterYaml(labels: string[]): string {
	if (labels.length === 1) {
		const value = labels[0] || "";
		if (value.includes(",")) {
			return `character:\n  - ${yamlCharacterItem(value)}`;
		}
		if (/[:#]|^\s|\s$/.test(value) || value.includes('"')) {
			return `character: ${JSON.stringify(value)}`;
		}
		return `character: ${value}`;
	}
	return ["character:", ...labels.map((label) => `  - ${yamlCharacterItem(label)}`)].join(
		"\n",
	);
}

export function upsertPaliCharacterFrontmatter(
	raw: string,
	labels: string[],
): string {
	const match = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
	if (!match) {
		throw new Error("Pali file has no YAML frontmatter");
	}
	const newline = match[1].includes("\r") ? "\r\n" : "\n";
	let fm = match[2];
	fm = fm
		.replace(/^character:(?:[^\n]*)(?:\n[ \t]+-[^\n]*)*/m, "")
		.replace(/\n{2,}/g, "\n")
		.trim();
	if (labels.length > 0) {
		const block = formatCharacterYaml(labels).replace(/\n/g, newline);
		if (/^slug:/m.test(fm)) {
			fm = fm.replace(/^(slug:[^\n]*)/m, `$1${newline}${block}`);
		} else {
			fm = `${block}${newline}${fm}`;
		}
	}
	return `${match[1]}${fm}${match[3]}${raw.slice(match[0].length)}`;
}

export function scanReferenceOnlyDiscourses(root = process.cwd()): CharacterDetection[] {
	const catalog = buildPersonAliasCatalog(loadEnglishPersonLabels(root));
	const knownLabels = new Set(catalog.labels);
	const results: CharacterDetection[] = [];

	for (const slug of referenceOnlyRouteSet) {
		const book = slug.match(/^[a-z]+/)?.[0];
		if (!book) continue;
		const paliPath = join(root, "src/content/pli", book, `${slug}.md`);
		if (!existsSync(paliPath)) continue;
		const paliRaw = readFileSync(paliPath, "utf8");
		const pali = matter(paliRaw);

		const sujatoPath = join(
			root,
			"src/content/references/sujato",
			book,
			`${slug}.md`,
		);
		const sujato = existsSync(sujatoPath)
			? matter(readFileSync(sujatoPath, "utf8"))
			: null;

		results.push(
			detectReferenceCharacters({
				slug,
				paliTitle: String(pali.data.title || ""),
				paliBody: pali.content,
				sujatoTitle: String(sujato?.data.title || ""),
				sujatoBody: sujato?.content || "",
				knownLabels,
				catalog,
			}),
		);
	}

	return results;
}

export function renderCharacterTagReview(
	results: CharacterDetection[],
	extras?: {
		englishVariants?: EnglishLabelVariantGroup[];
		layRoleGaps?: EnglishLabelVariantGroup[];
	},
): string {
	const tagged = results.filter((r) => r.labels.length > 0);
	const untagged = results.filter((r) => r.labels.length === 0);
	const byReason = new Map<string, CharacterDetection[]>();
	for (const result of results) {
		for (const review of result.reviews) {
			const list = byReason.get(review.reason) || [];
			if (!list.includes(result)) list.push(result);
			byReason.set(review.reason, list);
		}
	}

	const lines: string[] = [
		"# Reference character tagging review",
		"",
		"Featured interlocutors on reference-only Pali files (no English MDX). Short names are mapped onto an existing English character when the match is unique. Homonyms, remaining new labels, and English near-duplicates need a pass before biographies.",
		"",
		`- Reference-only files scanned: ${results.length}`,
		`- Tagged: ${tagged.length}`,
		`- Left untagged (no featured interlocutor detected): ${untagged.length}`,
		"",
		"## Homonyms that need confirmation",
		"",
	];

	const seenSlug = new Set<string>();
	const homonymMustReview = [
		...(byReason.get("homonym-conflict") || []),
		...(byReason.get("homonym-unresolved") || []),
	];
	if (homonymMustReview.length === 0) {
		lines.push("None.");
	} else {
		for (const result of homonymMustReview) {
			if (seenSlug.has(result.slug)) continue;
			seenSlug.add(result.slug);
			const notes = result.reviews
				.filter((r) => r.reason === "homonym-conflict" || r.reason === "homonym-unresolved")
				.map((r) => r.detail)
				.join("; ");
			lines.push(
				`- \`${result.slug}\` → ${result.labels.join("; ") || "(untagged)"} — ${notes}`,
			);
		}
	}

	lines.push("", "### Disambiguated with a role cue (spot-check)", "");
	const disambiguated = byReason.get("homonym-disambiguated") || [];
	const grouped = new Map<string, number>();
	for (const result of disambiguated) {
		const note = result.reviews.find((r) => r.reason === "homonym-disambiguated");
		const key = note?.detail.replace(/ \(.*\)$/, "") || result.labels.join(";");
		grouped.set(key, (grouped.get(key) || 0) + 1);
	}
	if (grouped.size === 0) {
		lines.push("None.");
	} else {
		for (const [key, count] of [...grouped.entries()].sort()) {
			lines.push(`- ${key} (${count} discourse${count === 1 ? "" : "s"})`);
		}
	}

	lines.push("", "## Short names mapped onto existing characters", "");
	const aliased = byReason.get("alias-resolved") || [];
	if (aliased.length === 0) {
		lines.push("None.");
	} else {
		const aliasNotes = new Map<string, number>();
		for (const result of aliased) {
			for (const review of result.reviews.filter((r) => r.reason === "alias-resolved")) {
				aliasNotes.set(review.detail, (aliasNotes.get(review.detail) || 0) + 1);
			}
		}
		for (const [detail, count] of [...aliasNotes.entries()].sort()) {
			lines.push(`- ${detail} (${count} discourse${count === 1 ? "" : "s"})`);
		}
	}

	lines.push("", "## Short names that match more than one character", "");
	const ambiguousAlias = byReason.get("alias-ambiguous") || [];
	if (ambiguousAlias.length === 0) {
		lines.push("None.");
	} else {
		for (const result of ambiguousAlias) {
			const notes = result.reviews
				.filter((r) => r.reason === "alias-ambiguous")
				.map((r) => r.detail)
				.join("; ");
			lines.push(`- \`${result.slug}\` → ${result.labels.join("; ")} — ${notes}`);
		}
	}

	lines.push("", "## New labels (not yet used in English MDX)", "");
	const newLabels = results.filter((r) => r.hits.some((h) => h.isNewLabel));
	if (newLabels.length === 0) {
		lines.push("None.");
	} else {
		for (const result of newLabels) {
			const created = result.hits.filter((h) => h.isNewLabel).map((h) => h.label);
			lines.push(`- \`${result.slug}\` → ${created.join("; ")}`);
		}
	}

	lines.push("", "## Many characters on one discourse", "");
	const many = byReason.get("many-characters") || [];
	if (many.length === 0) {
		lines.push("None.");
	} else {
		for (const result of many) {
			lines.push(`- \`${result.slug}\` → ${result.labels.join("; ")}`);
		}
	}

	const englishVariants = extras?.englishVariants || [];
	lines.push("", "## English labels that may be the same person", "");
	lines.push(
		"Manual English `character` strings that share a name core, or share a distinctive word while using different slugs. Some of these are genuine homonyms and should stay separate; others are the same person under two labels.",
		"",
	);
	const sameCore = englishVariants.filter((group) => group.kind === "same-core");
	const sharedName = englishVariants.filter((group) => group.kind === "shared-name");
	lines.push("### Same person, slightly different labels", "");
	if (sameCore.length === 0) {
		lines.push("None.");
	} else {
		for (const group of sameCore) {
			lines.push(`- \`${group.key}\`: ${group.labels.join(" | ")}`);
		}
	}
	lines.push("", "### Shared name, different identity slugs", "");
	if (sharedName.length === 0) {
		lines.push("None.");
	} else {
		for (const group of sharedName) {
			lines.push(`- \`${group.key}\`: ${group.labels.join(" | ")}`);
		}
	}

	const layRoleGaps = extras?.layRoleGaps || [];
	lines.push("", "## Lay role prefix gaps (merge or relabel candidates)", "");
	lines.push(
		"Names that share a person core but mix bare and role-prefixed labels, or bare *mātā/*dhītā names with no lay role prefix yet.",
		"",
	);
	if (layRoleGaps.length === 0) {
		lines.push("None.");
	} else {
		for (const group of layRoleGaps) {
			lines.push(`- \`${group.key}\`: ${group.labels.join(" | ")}`);
		}
	}

	const vaggoIndex = results.filter((r) =>
		r.reviews.some((review) => review.reason === "vaggo-index"),
	);
	lines.push("", "## Vagga index lists (left untagged)", "");
	if (vaggoIndex.length === 0) {
		lines.push("None.");
	} else {
		for (const result of vaggoIndex) {
			lines.push(`- \`${result.slug}\``);
		}
	}

	return `${lines.join("\n")}\n`;
}

function applyTags(root: string, results: CharacterDetection[]): number {
	let written = 0;
	for (const result of results) {
		if (result.reviews.some((r) => r.reason === "homonym-conflict")) continue;
		const book = result.slug.match(/^[a-z]+/)?.[0];
		if (!book) continue;
		const paliPath = join(root, "src/content/pli", book, `${result.slug}.md`);
		if (!existsSync(paliPath)) continue;
		const raw = readFileSync(paliPath, "utf8");
		const next = upsertPaliCharacterFrontmatter(raw, result.labels);
		if (next !== raw) {
			writeFileSync(paliPath, next);
			written += 1;
		}
	}
	return written;
}

function isMain(): boolean {
	const invoked = process.argv[1]?.replace(/\\/g, "/");
	return Boolean(invoked?.endsWith("referenceCharacterTag.ts"));
}

if (isMain()) {
	const apply = process.argv.includes("--apply");
	const root = process.cwd();
	const results = scanReferenceOnlyDiscourses(root);
	const tagged = results.filter((r) => r.labels.length > 0).length;
	const englishVariants = findEnglishLabelVariants(loadEnglishPersonLabels(root));
	const layRoleGaps = findLayRolePrefixGaps(loadEnglishPersonLabels(root));
	const review = renderCharacterTagReview(results, { englishVariants, layRoleGaps });
	const reviewPath = join(root, "src/data/characterTagReview.md");
	mkdirSync(dirname(reviewPath), { recursive: true });
	writeFileSync(reviewPath, review);
	console.log(
		`reference-characters: scanned ${results.length}, would tag ${tagged}`,
	);
	console.log(`review: ${reviewPath}`);
	if (apply) {
		const written = applyTags(root, results);
		console.log(`wrote character to ${written} Pali files`);
	} else {
		console.log("dry-run only; pass --apply to write Pali frontmatter");
	}
}
