#!/usr/bin/env node
/**
 * Import Nikāya subdivision structure from SuttaCentral sc-data.
 *
 * Fetches structure/tree/sutta/mn-tree.json, an-tree.json, and sn-tree.json,
 * merges English titles from scripts/data/*VaggaTitles.json overlays,
 * optionally enriches AN titles from EN grouped MDX frontmatter,
 * then writes generated structure files for MN, AN, and SN vagga navigation.
 *
 * Usage:
 *   node scripts/import-sc-structure.mjs
 *   node scripts/import-sc-structure.mjs --dry-run
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MN_OUTPUT_PATH = path.join(
	PROJECT_ROOT,
	"src/data/mnVaggaStructure.generated.ts",
);
const AN_OUTPUT_PATH = path.join(
	PROJECT_ROOT,
	"src/data/anVaggaStructure.generated.ts",
);
const SN_OUTPUT_PATH = path.join(
	PROJECT_ROOT,
	"src/data/snVaggaStructure.generated.ts",
);
const EN_AN_CONTENT = path.join(PROJECT_ROOT, "src/content/en/an");

const SC_DATA_BASE =
	"https://raw.githubusercontent.com/suttacentral/sc-data/master/structure";

/** SC vagga id → display title (Pāli, matching site conventions). */
const MN_VAGGA_PALI_TITLES = {
	"mn-mulapariyayavagga": "Mūlapariyāyavagga",
	"mn-sihanadavagga": "Sīhanādavagga",
	"mn-opammavagga": "Opammavagga",
	"mn-mahayamakavagga": "Mahāyamakavagga",
	"mn-culayamakavagga": "Cūḷayamakavagga",
	"mn-gahapativagga": "Gahapativagga",
	"mn-bhikkhuvagga": "Bhikkhuvagga",
	"mn-paribbajakavagga": "Paribbājakavagga",
	"mn-rajavagga": "Rājavagga",
	"mn-brahmanavagga": "Brāhmaṇavagga",
	"mn-devadahavagga": "Devadahavagga",
	"mn-anupadavagga": "Anupadavagga",
	"mn-sunnatavagga": "Suññatavagga",
	"mn-vibhangavagga": "Vibhaṅgavagga",
	"mn-salayatanavagga": "Saḷāyatanavagga",
};

const MN_PANNASA_KEYS = {
	"mn-mulapannasa": "mn1-50",
	"mn-majjhimapannasa": "mn51-100",
	"mn-uparipannasa": "mn101-152",
};

/** AN books with vagga section navigation. */
const AN_VAGGA_BOOKS = new Set([
	"an3",
	"an4",
	"an5",
	"an6",
	"an7",
	"an8",
	"an9",
	"an10",
	"an11",
]);

/** SC vagga id → Pāli title for AN books with vagga sections. */
const AN_VAGGA_PALI_TITLES = {
	"an3-balavagga": "Bālavagga",
	"an3-rathakaravagga": "Rathakāravagga",
	"an3-puggalavagga": "Puggalavagga",
	"an3-devadutavagga": "Devadūtavagga",
	"an3-culavagga": "Cūḷavagga",
	"an3-brahmanavagga": "Brāhmaṇavagga",
	"an3-mahavagga": "Mahāvagga",
	"an3-anandavagga": "Ānandavagga",
	"an3-samanavagga": "Samaṇavagga",
	"an3-lonakapallavagga": "Loṇakapallavagga",
	"an3-sambodhavagga": "Sambodhavagga",
	"an3-apayikavagga": "Āpāyikavagga",
	"an3-kusinaravagga": "Kusināravagga",
	"an3-yodhajivavagga": "Yodhājīvavagga",
	"an3-mangalavagga": "Maṅgalavagga",
	"an3-patipadavagga": "Paṭipadāvagga",
	"an3-kammapathapeyyavagga": "Kammapathapeyyāvagga",
	"an3-ragadipeyyalavagga": "Rāgādipeyyālavagga",
	"an6-ahuneyyavagga": "Āhuneyyavagga",
	"an6-saraniyavagga": "Sāraṇīyavagga",
	"an6-anuttariyavagga": "Anuttariyavagga",
	"an6-pathamapannasaka-devatavagga": "Devatāvagga",
	"an6-dhammikavagga": "Dhammikavagga",
	"an6-mahavagga": "Mahāvagga",
	"an6-dutiyapannasaka-devatavagga": "Devatāvagga",
	"an6-arahattavagga": "Arahattavagga",
	"an6-sitivagga": "Sītivagga",
	"an6-anisamsavagga": "Ānisaṁsavagga",
	"an6-tikavagga": "Tikavagga",
	"an6-samannavagga": "Sāmaññavagga",
	"an6-ragapeyyala": "Rāgapeyyāla",
	"an4-bhandagamavagga": "Bhaṇḍāgāmavagga",
	"an4-caravagga": "Caravagga",
	"an4-uruvelavagga": "Uruvelāvagga",
	"an4-cakkavagga": "Cakkavagga",
	"an4-rohitassavagga": "Rohitassavagga",
	"an4-punnabhisandavagga": "Puññābhisandavagga",
	"an4-pattakammavagga": "Pattakammavagga",
	"an4-apannakavagga": "Apannakavagga",
	"an4-macalavagga": "Macalavagga",
	"an4-asuravagga": "Asuravagga",
	"an4-valahakavagga": "Valāhakavagga",
	"an4-kesivagga": "Kesivagga",
	"an4-bhayavagga": "Bhayavagga",
	"an4-puggalavagga": "Puggalavagga",
	"an4-abhavagga": "Ābhavagga",
	"an4-indriyavagga": "Indriyavagga",
	"an4-patipadavagga": "Paṭipadāvagga",
	"an4-sancetaniyavagga": "Sañcetaniyavagga",
	"an4-brahmanavagga": "Brāhmaṇavagga",
	"an4-mahavagga": "Mahāvagga",
	"an4-sappurisavagga": "Sappurisavagga",
	"an4-parisavagga": "Parisavagga",
	"an4-duccaritavagga": "Duccaritavagga",
	"an4-kammavagga": "Kammavagga",
	"an4-apattibhayavagga": "Āpattibhayavagga",
	"an4-abhinnavagga": "Abhiññāvagga",
	"an4-kammapathavagga": "Kammapathavagga",
	"an4-ragapeyyala": "Rāgapeyyāla",
	"an5-sekhabalavagga": "Sekhabalavagga",
	"an5-balavagga": "Balavagga",
	"an5-pancangikavagga": "Pañcaṅgikavagga",
	"an5-sumanavagga": "Sumanavagga",
	"an5-mundarajavagga": "Muṇḍarājavagga",
	"an5-nivaranavagga": "Nīvaraṇavagga",
	"an5-sannavagga": "Saññāvagga",
	"an5-yodhajivavagga": "Yodhājīvavagga",
	"an5-theravagga": "Theravagga",
	"an5-kakudhavagga": "Kakudhavagga",
	"an5-phasuviharavagga": "Phāsuvihāravagga",
	"an5-andhakavindavagga": "Andhakavindavagga",
	"an5-gilanavagga": "Gilānavagga",
	"an5-rajavagga": "Rājavagga",
	"an5-tikandakivagga": "Tikaṇḍakīvagga",
	"an5-saddhammavagga": "Saddhammavagga",
	"an5-aghatavagga": "Aghātavagga",
	"an5-upasakavagga": "Upāsakavagga",
	"an5-arannavagga": "Āraññavagga",
	"an5-brahmanavagga": "Brāhmaṇavagga",
	"an5-kimilavagga": "Kimilavagga",
	"an5-akkosakavagga": "Akkosakavagga",
	"an5-dighacarikavagga": "Dīghacārikavagga",
	"an5-avasikavagga": "Āvāsikavagga",
	"an5-duccaritavagga": "Duccaritavagga",
	"an5-upasampadavagga": "Upasampadāvagga",
	"an5-sammutipeyyala": "Sammutipeyyāla",
	"an5-sikkhapadapeyyala": "Sikkhāpadapeyyāla",
	"an5-ragapeyyala": "Rāgapeyyāla",
	"an7-dhanavagga": "Dhanavagga",
	"an7-anusayavagga": "Anusayavagga",
	"an7-vajjisattakavagga": "Vajjisattakavagga",
	"an7-devatavagga": "Devatāvagga",
	"an7-mahayannavagga": "Mahāyaññavagga",
	"an7-abyakatavagga": "Abyākatavagga",
	"an7-mahavagga": "Mahāvagga",
	"an7-vinayavagga": "Vinayavagga",
	"an7-samanavagga": "Samaṇavagga",
	"an7-ahuneyyavagga": "Āhuneyyavagga",
	"an7-ragapeyyala": "Rāgapeyyāla",
	"an8-mettavagga": "Mettāvagga",
	"an8-mahavagga": "Mahāvagga",
	"an8-gahapativagga": "Gahapativagga",
	"an8-danavagga": "Dānavagga",
	"an8-uposathavagga": "Uposathavagga",
	"an8-gotamivagga": "Gotamīvagga",
	"an8-bhumicalavagga": "Bhūmicālavagga",
	"an8-yamakavagga": "Yamakavagga",
	"an8-sativagga": "Sativagga",
	"an8-samannavagga": "Sāmaññavagga",
	"an8-ragapeyyala": "Rāgapeyyāla",
	"an9-sambodhivagga": "Sambodhivagga",
	"an9-sihanadavagga": "Sīhanādavagga",
	"an9-sattavasavagga": "Sattāvāsavagga",
	"an9-mahavagga": "Mahāvagga",
	"an9-samannavagga": "Sāmaññavagga",
	"an9-khemavagga": "Khemavagga",
	"an9-satipatthanavagga": "Satipaṭṭhānavagga",
	"an9-sammappadhanavagga": "Sammappadhānavagga",
	"an9-iddhipadavagga": "Iddhipādavagga",
	"an9-ragapeyyala": "Rāgapeyyāla",
	"an10-anisamsavagga": "Anisamsavagga",
	"an10-nathavagga": "Nāthavagga",
	"an10-mahavagga": "Mahāvagga",
	"an10-pathamapannasaka-upalivagga": "Upālivagga",
	"an10-akkosavagga": "Akkosavagga",
	"an10-sacittavagga": "Sacittavagga",
	"an10-yamakavagga": "Yamakavagga",
	"an10-akankhavagga": "Ākaṅkhavagga",
	"an10-theravagga": "Theravagga",
	"an10-dutiyapannasaka-upalivagga": "Upālivagga",
	"an10-samanasannavagga": "Samaṇasaññāvagga",
	"an10-paccorohanivagga": "Paccorohaṇivagga",
	"an10-parisuddhavagga": "Parisuddhavagga",
	"an10-tatiyapannasaka-sadhuvagga": "Sādhuvagga",
	"an10-ariyavagga": "Ariyavagga",
	"an10-puggalavagga": "Puggalavagga",
	"an10-janussonivagga": "Jāṇussoṇivagga",
	"an10-catutthapannasaka-sadhuvagga": "Sādhuvagga",
	"an10-ariyamaggavagga": "Ariyamaggavagga",
	"an10-ariyapuggalavagga": "Ariyapuggalavagga",
	"an10-karajakayavagga": "Karajakāyavagga",
	"an10-samannavagga": "Sāmaññavagga",
	"an10-ragapeyyala": "Rāgapeyyāla",
	"an11-nissayavagga": "Nissayavagga",
	"an11-anussativagga": "Anussativagga",
	"an11-samannavagga": "Sāmaññavagga",
	"an11-ragapeyyala": "Rāgapeyyāla",
};

/** SN saṁyuttas with vagga section navigation (pilot). */
const SN_VAGGA_BOOKS = new Set([
	"sn1",
	"sn2",
	"sn3",
	"sn4",
	"sn5",
	"sn6",
	"sn7",
	"sn8",
	"sn9",
	"sn10",
	"sn11",
	"sn12",
	"sn13",
	"sn14",
	"sn15",
	"sn16",
	"sn17",
	"sn18",
	"sn19",
	"sn20",
	"sn21",
	"sn22",
	"sn23",
	"sn24",
	"sn25",
	"sn26",
	"sn27",
	"sn28",
	"sn29",
	"sn30",
	"sn31",
	"sn32",
	"sn33",
	"sn34",
	"sn35",
	"sn36",
	"sn37",
	"sn38",
	"sn39",
	"sn40",
	"sn41",
	"sn42",
	"sn43",
	"sn44",
	"sn45",
	"sn46",
	"sn47",
	"sn48",
	"sn49",
	"sn50",
	"sn51",
	"sn52",
	"sn53",
	"sn54",
	"sn55",
	"sn56",
]);

/** SC vagga id → Pāli title for SN books with vagga sections. */
const SN_VAGGA_PALI_TITLES = {
	"sn1-nalavagga": "Naḷavagga",
	"sn1-nandanavagga": "Nandanavagga",
	"sn1-sattivagga": "Sattivagga",
	"sn1-satullapakayikavagga": "Satullapakāyikavagga",
	"sn1-adittavagga": "Ādittavagga",
	"sn1-jaravagga": "Jarāvagga",
	"sn1-addhavagga": "Addhavagga",
	"sn1-chetvavagga": "Chetvāvagga",
	"sn2-pathamavagga": "Paṭhamavagga",
	"sn2-anathapindikavagga": "Anāthapiṇḍikavagga",
	"sn2-nanatitthiyavagga": "Nānātitthiyavagga",
	"sn3-pathamavagga": "Paṭhamavagga",
	"sn3-dutiyavagga": "Dutiyavagga",
	"sn3-tatiyavagga": "Tatiyavagga",
	"sn4-pathamavagga": "Paṭhamavagga",
	"sn4-dutiyavagga": "Dutiyavagga",
	"sn4-tatiyavagga": "Tatiyavagga",
	"sn5-bhikkhunivagga": "Bhikkhunīvagga",
	"sn6-pathamavagga": "Paṭhamavagga",
	"sn6-dutiyavagga": "Dutiyavagga",
	"sn7-arahantavagga": "Arahantavagga",
	"sn7-upasakavagga": "Upāsakavagga",
	"sn8-vangisavagga": "Vaṅgīsavagga",
	"sn9-vanavagga": "Vanavagga",
	"sn10-indakavagga": "Indakavagga",
	"sn11-pathamavagga": "Paṭhamavagga",
	"sn11-dutiyavagga": "Dutiyavagga",
	"sn11-tatiyavagga": "Tatiyavagga",
	"sn12-buddhavagga": "Buddhavagga",
	"sn12-aharavagga": "Āhāravagga",
	"sn12-dasabalavagga": "Dasabalavagga",
	"sn12-kalarakhattiyavagga": "Kaḷārakhattiyavagga",
	"sn12-gahapativagga": "Gahapativagga",
	"sn12-dukkhavagga": "Dukkhavagga",
	"sn12-mahavagga": "Mahāvagga",
	"sn12-samanabrahmanavagga": "Samaṇabrāhmaṇavagga",
	"sn13-abhisamayavagga": "Abhisamayavagga",
	"sn14-nanattavagga": "Nānattavagga",
	"sn14-dutiyavagga": "Dutiyavagga",
	"sn14-kammapathavagga": "Kammapathavagga",
	"sn14-catutthavagga": "Catutthavagga",
	"sn15-pathamavagga": "Paṭhamavagga",
	"sn15-dutiyavagga": "Dutiyavagga",
	"sn16-kassapavagga": "Kassapavagga",
	"sn17-pathamavagga": "Paṭhamavagga",
	"sn17-dutiyavagga": "Dutiyavagga",
	"sn17-tatiyavagga": "Tatiyavagga",
	"sn17-catutthavagga": "Catutthavagga",
	"sn18-pathamavagga": "Paṭhamavagga",
	"sn18-dutiyavagga": "Dutiyavagga",
	"sn19-pathamavagga": "Paṭhamavagga",
	"sn19-dutiyavagga": "Dutiyavagga",
	"sn20-opammavagga": "Opammavagga",
	"sn21-bhikkhuvagga": "Bhikkhuvagga",
	"sn22-nakulapituvagga": "Nakulapituvagga",
	"sn22-aniccavagga": "Aniccavagga",
	"sn22-bharavagga": "Bhāravagga",
	"sn22-natumhakavagga": "Natumhākavagga",
	"sn22-attadipavagga": "Attadīpavagga",
	"sn22-upayavagga": "Upayavagga",
	"sn22-arahantavagga": "Arahantavagga",
	"sn22-khajjaniyavagga": "Khajjanīyavagga",
	"sn22-theravagga": "Theravagga",
	"sn22-pupphavagga": "Pupphavagga",
	"sn22-antavagga": "Antavagga",
	"sn22-dhammakathikavagga": "Dhammakathikavagga",
	"sn22-avijjavagga": "Avijjāvagga",
	"sn22-kukkulavagga": "Kukkulavagga",
	"sn22-ditthivagga": "Diṭṭhivagga",
	"sn23-pathamamaravagga": "Paṭhamamāravagga",
	"sn23-dutiyamaravagga": "Dutiyamāravagga",
	"sn23-ayacanavagga": "Āyācanavagga",
	"sn23-upanisinnavagga": "Upanisinnavagga",
	"sn24-sotapattivagga": "Sotāpattivagga",
	"sn24-dutiyagamanavagga": "Dutiyagamanavagga",
	"sn24-tatiyagamanavagga": "Tatiyagamanavagga",
	"sn24-catutthagamanavagga": "Catutthagamanavagga",
	"sn25-cakkhuvagga": "Cakkhuvagga",
	"sn26-uppadavagga": "Uppādavagga",
	"sn27-kilesavagga": "Kilesavagga",
	"sn28-sariputtavagga": "Sāriputtavagga",
	"sn29-nagavagga": "Nāgavagga",
	"sn30-supannavagga": "Supaṇṇavagga",
	"sn31-gandhabbavagga": "Gandhabbavagga",
	"sn32-valahakavagga": "Valāhakavagga",
	"sn33-vacchagottavagga": "Vacchagottavagga",
	"sn34-jhanavagga": "Jhānavagga",
	"sn35-aniccavagga": "Aniccavagga",
	"sn35-yamakavagga": "Yamakavagga",
	"sn35-sabbavagga": "Sabbavagga",
	"sn35-jatidhammavagga": "Jātisahavatthuvagga",
	"sn35-sabbaaniccavagga": "Sabbaaniccavagga",
	"sn35-avijjavagga": "Avijjāvagga",
	"sn35-migajalavagga": "Migajālavagga",
	"sn35-gilanavagga": "Gilānavagga",
	"sn35-channavagga": "Channavagga",
	"sn35-salavagga": "Sālavagga",
	"sn35-yogakkhemivagga": "Yogakkhemivagga",
	"sn35-lokakamagunavagga": "Lokakāmaguṇavagga",
	"sn35-gahapativagga": "Gahapativagga",
	"sn35-devadahavagga": "Devadahavagga",
	"sn35-navapuranavagga": "Navapuranavagga",
	"sn35-nandikkhayavagga": "Nandikkhayavagga",
	"sn35-satthipeyyalavagga": "Satthipeyyālavagga",
	"sn35-samuddavagga": "Samuddavagga",
	"sn35-asivisavagga": "Asivisavagga",
	"sn36-sagathavagga": "Sagāthavagga",
	"sn36-rahogatavagga": "Rahogatavagga",
	"sn36-atthasatapariyayavagga": "Aṭṭhasatapariyāyavagga",
	"sn37-pathamapeyyalavagga": "Paṭhamapeyyālavagga",
	"sn37-dutiyapeyyalavagga": "Dutiyapeyyālavagga",
	"sn37-balavagga": "Bālavagga",
	"sn38-jambukhadakavagga": "Jambukhādakavagga",
	"sn39-samandakavagga": "Sāmaṇḍakavagga",
	"sn40-moggallanavagga": "Moggallānavagga",
	"sn41-cittavagga": "Cittavagga",
	"sn42-gamanivagga": "Gāmaṇivagga",
	"sn43-pathamavagga": "Paṭhamavagga",
	"sn43-dutiyavagga": "Dutiyavagga",
	"sn44-abyakatavagga": "Abyākatavagga",
	"sn45-avijjavagga": "Avijjāvagga",
	"sn45-viharavagga": "Vihāravagga",
	"sn45-micchattavagga": "Micchattavagga",
	"sn45-patipattivagga": "Paṭipattivagga",
	"sn45-annatitthiyapeyyalavagga": "Aññatitthiyapeyyālavagga",
	"sn45-suriyapeyyalavagga": "Sūriyapeyyālavagga",
	"sn45-ekadhammapeyyalavagga": "Ekadhammapeyyālavagga",
	"sn45-dutiyaekadhammapeyyalavagga": "Dutiyaekadhammapeyyālavagga",
	"sn45-gangapeyyalavagga": "Gaṅgāpeyyālavagga",
	"sn45-dutiyagangapeyyalavagga": "Dutiyagangāpeyyālavagga",
	"sn45-appamadapeyyalavagga": "Appamādapeyyālavagga",
	"sn45-balakaraniyavagga": "Balakaraṇīyavagga",
	"sn45-esanavagga": "Esanāvagga",
	"sn45-oghavagga": "Oghavagga",
	"sn46-pabbatavagga": "Pabbatovagga",
	"sn46-gilanavagga": "Gilānavagga",
	"sn46-udayivagga": "Udāyivagga",
	"sn46-nivaranavagga": "Nīvaraṇavagga",
	"sn46-cakkavattivagga": "Cakkavattivagga",
	"sn46-sakacchavagga": "Sākacchavagga",
	"sn46-anapanavagga": "Ānāpānavagga",
	"sn46-nirodhavagga": "Nirodhavagga",
	"sn46-gangapeyyalavagga": "Gaṅgāpeyyālavagga",
	"sn46-appamadavagga": "Appamādavagga",
	"sn46-balakaraniyavagga": "Balakaraṇīyavagga",
	"sn46-esanavagga": "Esanāvagga",
	"sn46-oghavagga": "Oghavagga",
	"sn46-punagangapeyyalavagga": "Punagangāpeyyālavagga",
	"sn46-punaappamadavagga": "Punaappamādavagga",
	"sn46-punabalakaraniyavagga": "Punabalakaraṇīyavagga",
	"sn46-punaesanavagga": "Punaesanāvagga",
	"sn46-punaoghavagga": "Punaoghavagga",
	"sn47-ambapalivagga": "Ambapālivagga",
	"sn47-nalandavagga": "Nālandāvagga",
	"sn47-silatthitivagga": "Sīlaṭṭhitivagga",
	"sn47-ananussutavagga": "Ananussutavagga",
	"sn47-amatavagga": "Amatavagga",
	"sn47-gangapeyyalavagga": "Gaṅgāpeyyālavagga",
	"sn47-appamadavagga": "Appamādavagga",
	"sn47-balakaraniyavagga": "Balakaraṇīyavagga",
	"sn47-esanavagga": "Esanāvagga",
	"sn47-oghavagga": "Oghavagga",
	"sn48-suddhikavagga": "Suddhikavagga",
	"sn48-mudutaravagga": "Mudutaravagga",
	"sn48-chalindriyavagga": "Chaḷindriyavagga",
	"sn48-sukhindriyavagga": "Sukhindriyavagga",
	"sn48-jaravagga": "Jarāvagga",
	"sn48-sukarakhatavagga": "Sūkarakhatavagga",
	"sn48-bodhipakkhiyavagga": "Bodhipakkhiyavagga",
	"sn48-gangapeyyalavagga": "Gaṅgāpeyyālavagga",
	"sn48-appamadavagga": "Appamādavagga",
	"sn48-balakaraniyavagga": "Balakaraṇīyavagga",
	"sn48-esanavagga": "Esanāvagga",
	"sn48-oghavagga": "Oghavagga",
	"sn48-punagangapeyyalavagga": "Punagangāpeyyālavagga",
	"sn48-punaappamadavagga": "Punaappamādavagga",
	"sn48-punabalakaraniyavagga": "Punabalakaraṇīyavagga",
	"sn48-punaesanavagga": "Punaesanāvagga",
	"sn48-punaoghavagga": "Punaoghavagga",
	"sn49-gangapeyyalavagga": "Gaṅgāpeyyālavagga",
	"sn49-appamadavagga": "Appamādavagga",
	"sn49-balakaraniyavagga": "Balakaraṇīyavagga",
	"sn49-esanavagga": "Esanāvagga",
	"sn49-oghavagga": "Oghavagga",
	"sn50-gangapeyyalavagga": "Gaṅgāpeyyālavagga",
	"sn50-appamadavagga": "Appamādavagga",
	"sn50-balakaraniyavagga": "Balakaraṇīyavagga",
	"sn50-esanavagga": "Esanāvagga",
	"sn50-oghavagga": "Oghavagga",
	"sn50-punagangapeyyalavagga": "Punagangāpeyyālavagga",
	"sn50-punaappamadavagga": "Punaappamādavagga",
	"sn50-punabalakaraniyavagga": "Punabalakaraṇīyavagga",
	"sn50-punaesanavagga": "Punaesanāvagga",
	"sn50-punaoghavagga": "Punaoghavagga",
	"sn51-capalavagga": "Cāpālavagga",
	"sn51-pasadakampanavagga": "Pāsādakampanavagga",
	"sn51-ayogulavagga": "Ayoguḷavagga",
	"sn51-gangapeyyalavagga": "Gaṅgāpeyyālavagga",
	"sn51-appamadavagga": "Appamādavagga",
	"sn51-balakaraniyavagga": "Balakaraṇīyavagga",
	"sn51-esanavagga": "Esanāvagga",
	"sn51-oghavagga": "Oghavagga",
	"sn52-rahogatavagga": "Rahogatavagga",
	"sn52-dutiyavagga": "Dutiyavagga",
	"sn53-gangapeyyalavagga": "Gaṅgāpeyyālavagga",
	"sn53-appamadavagga": "Appamādavagga",
	"sn53-balakaraniyavagga": "Balakaraṇīyavagga",
	"sn53-esanavagga": "Esanāvagga",
	"sn53-oghavagga": "Oghavagga",
	"sn54-ekadhammavagga": "Ekadhammavagga",
	"sn54-dutiyavagga": "Dutiyavagga",
	"sn55-veludvaravagga": "Veḷudvāravagga",
	"sn55-rajakaramavagga": "Rājakārāmavagga",
	"sn55-sarananivagga": "Saraṇānivagga",
	"sn55-punnabhisandavagga": "Puññābhisandavagga",
	"sn55-sagathakapunnabhisandavagga": "Sagāthakapuññābhisandavagga",
	"sn55-sappannavagga": "Sappaññavagga",
	"sn55-mahapannavagga": "Mahāpaññavagga",
	"sn56-samadhivagga": "Samādhivagga",
	"sn56-dhammacakkappavattanavagga": "Dhammacakkappavattanavagga",
	"sn56-kotigamavagga": "Koṭigāmavagga",
	"sn56-sisapavanavagga": "Sīsapāvanavagga",
	"sn56-papatavagga": "Papātavagga",
	"sn56-abhisamayavagga": "Abhisamayavagga",
	"sn56-pathamaamakadhannapeyyalavagga": "Paṭhamaāmakadhannapeyyālavagga",
	"sn56-dutiyaamakadhannapeyyalavagga": "Dutiyaāmakadhannapeyyālavagga",
	"sn56-tatiyaamakadhannapeyyalavagga": "Tatiyaāmakadhannapeyyālavagga",
	"sn56-catutthaamakadhannapeyyalavagga": "Catutthaāmakadhannapeyyālavagga",
	"sn56-pancagatipeyyalavagga": "Pañcagatipeyyālavagga",
};

const dryRun = process.argv.includes("--dry-run");

function loadJson(relativePath) {
	return JSON.parse(
		readFileSync(path.join(PROJECT_ROOT, relativePath), "utf-8"),
	);
}

const mnTitleOverlay = loadJson("scripts/data/mnVaggaTitles.json");
const anTitleOverlay = loadJson("scripts/data/anVaggaTitles.json");
const snTitleOverlay = loadJson("scripts/data/snVaggaTitles.json");

async function fetchJson(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		return response.json();
	} catch {
		console.warn(`fetch failed for ${url}, trying curl…`);
		const raw = execSync(`curl -fsSL "${url}"`, {
			encoding: "utf-8",
			timeout: 60_000,
		});
		return JSON.parse(raw);
	}
}

function parseSuttaRef(suttaId) {
	const range = suttaId.match(/^([a-z]+\d+)\.(\d+)-(\d+)$/);
	if (range) {
		return {
			start: Number(range[2]),
			end: Number(range[3]),
		};
	}
	const decimal = suttaId.match(/^([a-z]+\d+)\.(\d+)$/);
	if (decimal) {
		const num = Number(decimal[2]);
		return { start: num, end: num };
	}
	const simple = suttaId.match(/^([a-z]+)(\d+)$/);
	if (simple) {
		const num = Number(simple[2]);
		return { start: num, end: num };
	}
	throw new Error(`Unexpected sutta id: ${suttaId}`);
}

function suttaNumber(suttaId) {
	return parseSuttaRef(suttaId).start;
}

function suttaRangeFromIds(suttaIds) {
	let start = Number.POSITIVE_INFINITY;
	let end = 0;
	for (const id of suttaIds) {
		const range = parseSuttaRef(id);
		start = Math.min(start, range.start);
		end = Math.max(end, range.end);
	}
	return { start, end };
}

function expandSuttaIds(entries) {
	const ids = [];
	for (const entry of entries) {
		if (typeof entry === "string") {
			ids.push(entry);
			continue;
		}
		for (const nested of Object.values(entry)) {
			ids.push(...expandSuttaIds(nested));
		}
	}
	return ids;
}

function mnVaggaSlug(start, end) {
	return `mn${start}-${end}`;
}

function anVaggaSlug(book, start, end) {
	return `an${book}.${start}-${end}`;
}

function formatTitle(paliTitle, overlay, scKey) {
	const english = overlay?.englishSubtitle;
	if (english) {
		return `${paliTitle} - ${english}`;
	}
	return paliTitle;
}

function readEnMdxOverlay(slug) {
	const filePath = path.join(EN_AN_CONTENT, `${slug}.mdx`);
	if (!existsSync(filePath)) {
		return null;
	}
	const raw = readFileSync(filePath, "utf-8");
	const match = raw.match(
		/^---\n([\s\S]*?)\n---/,
	);
	if (!match) return null;
	const frontmatter = match[1];
	const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
	const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
	if (!titleMatch) return null;
	return {
		title: titleMatch[1].trim().replace(/^["']|["']$/g, ""),
		description: descriptionMatch?.[1]?.trim().replace(/^["']|["']$/g, ""),
	};
}

function buildVaggaEntry({
	scKey,
	paliTitle,
	suttaIds,
	overlay,
	slug,
}) {
	const mdxOverlay = readEnMdxOverlay(slug);
	const { start, end } = suttaRangeFromIds(suttaIds);

	return {
		title: mdxOverlay?.title ?? formatTitle(paliTitle, overlay, scKey),
		description: mdxOverlay?.description ?? overlay?.description,
		range: { start, end },
	};
}

function parseMnTree(tree) {
	const byPannasa = {};

	for (const pannasaEntry of tree.mn) {
		const [pannasaKey, vaggas] = Object.entries(pannasaEntry)[0];
		const pannasaSlug = MN_PANNASA_KEYS[pannasaKey];
		if (!pannasaSlug) {
			throw new Error(`Unknown paṇṇāsa key: ${pannasaKey}`);
		}

		byPannasa[pannasaSlug] = {};

		for (const vaggaEntry of vaggas) {
			const [vaggaKey, suttas] = Object.entries(vaggaEntry)[0];
			const numbers = suttas.map(suttaNumber);
			const start = Math.min(...numbers);
			const end = Math.max(...numbers);
			const slug = mnVaggaSlug(start, end);
			const paliTitle =
				MN_VAGGA_PALI_TITLES[vaggaKey] ??
				vaggaKey.replace(/^mn-/, "").replace(/vagga$/, "vagga");

			byPannasa[pannasaSlug][slug] = buildVaggaEntry({
				scKey: vaggaKey,
				paliTitle,
				suttaIds: suttas,
				overlay: mnTitleOverlay[vaggaKey],
				slug,
			});
		}
	}

	return byPannasa;
}

function collectAnBookVaggas(bookEntries, bookNum) {
	const vaggas = {};

	function walk(nodes) {
		for (const node of nodes) {
			if (typeof node !== "object" || node === null) continue;
			for (const [key, value] of Object.entries(node)) {
				if (key.includes("vagga") || key.includes("peyyala")) {
					const suttaIds = expandSuttaIds(value);
					const { start, end } = suttaRangeFromIds(suttaIds);
					const slug = anVaggaSlug(bookNum, start, end);
					const paliTitle =
						AN_VAGGA_PALI_TITLES[key] ??
						key.replace(/^an\d+-/, "").replace(/vagga$/, "vagga");
					vaggas[slug] = buildVaggaEntry({
						scKey: key,
						paliTitle,
						suttaIds,
						overlay: anTitleOverlay[key],
						slug,
					});
				} else {
					walk(Array.isArray(value) ? value : [value]);
				}
			}
		}
	}

	walk(bookEntries);
	return vaggas;
}

function parseAnTree(tree) {
	const result = {};

	for (const bookEntry of tree.an) {
		const [bookKey, sections] = Object.entries(bookEntry)[0];
		if (!AN_VAGGA_BOOKS.has(bookKey)) continue;
		const bookNum = Number(bookKey.replace("an", ""));
		result[bookKey] = collectAnBookVaggas(sections, bookNum);
	}

	return result;
}

function collectSnBookVaggas(bookEntries) {
	const vaggas = {};

	function walk(nodes) {
		for (const node of nodes) {
			if (typeof node !== "object" || node === null) continue;
			for (const [key, value] of Object.entries(node)) {
				if (key.includes("vagga") || key.includes("peyyala")) {
					const suttaIds = expandSuttaIds(value);
					const slug = key;
					const paliTitle =
						SN_VAGGA_PALI_TITLES[key] ??
						key.replace(/^sn\d+-/, "").replace(/vagga$/, "vagga");
					vaggas[slug] = buildVaggaEntry({
						scKey: key,
						paliTitle,
						suttaIds,
						overlay: snTitleOverlay[key],
						slug,
					});
				} else {
					walk(Array.isArray(value) ? value : [value]);
				}
			}
		}
	}

	walk(bookEntries);
	return vaggas;
}

function parseSnTree(tree) {
	const result = {};

	function walk(nodes) {
		for (const node of nodes) {
			if (typeof node !== "object" || node === null) continue;
			for (const [key, value] of Object.entries(node)) {
				if (SN_VAGGA_BOOKS.has(key)) {
					result[key] = collectSnBookVaggas(value);
				} else {
					walk(Array.isArray(value) ? value : [value]);
				}
			}
		}
	}

	walk(tree.sn);
	return result;
}

function renderMnTypeScript(structure) {
	return `// This file is auto-generated by scripts/import-sc-structure.mjs — do not edit directly
import type { DirectoryStructure } from "../types/directory";

/** MN vagga sections keyed by paṇṇāsa slug (mn1-50, mn51-100, mn101-152). UI grouping only — not collection routes. */
export const mnVaggaSections: Record<string, Record<string, DirectoryStructure>> = ${JSON.stringify(structure, null, "\t")};
`;
}

function renderAnTypeScript(structure) {
	return `// This file is auto-generated by scripts/import-sc-structure.mjs — do not edit directly
import type { DirectoryStructure } from "../types/directory";

/** AN vagga sections keyed by book slug. Not collection routes — UI grouping only. */
export const anVaggaSections: Record<string, Record<string, DirectoryStructure>> = ${JSON.stringify(structure, null, "\t")};
`;
}

function buildSnVaggaRangeBySlug(structure) {
	const ranges = {};
	for (const [bookKey, vaggas] of Object.entries(structure)) {
		const bookNum = Number(bookKey.replace("sn", ""));
		for (const [slug, entry] of Object.entries(vaggas)) {
			if (!entry.range) continue;
			ranges[slug] = {
				book: bookNum,
				start: entry.range.start,
				end: entry.range.end,
			};
		}
	}
	return ranges;
}

function renderSnTypeScript(structure) {
	const rangeBySlug = buildSnVaggaRangeBySlug(structure);
	return `// This file is auto-generated by scripts/import-sc-structure.mjs — do not edit directly
import type { DirectoryStructure } from "../types/directory";

/** SN vagga sections keyed by saṁyutta slug. Not collection routes — UI grouping only. */
export const snVaggaSections: Record<string, Record<string, DirectoryStructure>> = ${JSON.stringify(structure, null, "\t")};

/** Discourse-range lookup for SN vagga slugs (e.g. sn1-nalavagga → sn1.1–10). */
export const snVaggaRangeBySlug: Record<string, { book: number; start: number; end: number }> = ${JSON.stringify(rangeBySlug, null, "\t")};
`;
}

async function main() {
	console.log("Fetching MN structure from sc-data…");
	const mnTree = await fetchJson(`${SC_DATA_BASE}/tree/sutta/mn-tree.json`);
	const mnStructure = parseMnTree(mnTree);

	const mnVaggaCount = Object.values(mnStructure).reduce(
		(sum, vaggas) => sum + Object.keys(vaggas).length,
		0,
	);
	console.log(
		`Parsed ${mnVaggaCount} MN vaggas across ${Object.keys(mnStructure).length} paṇṇāsas.`,
	);

	console.log("Fetching AN structure from sc-data…");
	const anTree = await fetchJson(`${SC_DATA_BASE}/tree/sutta/an-tree.json`);
	const anStructure = parseAnTree(anTree);
	const anVaggaCount = Object.values(anStructure).reduce(
		(sum, vaggas) => sum + Object.keys(vaggas).length,
		0,
	);
	console.log(
		`Parsed ${anVaggaCount} AN vaggas across ${Object.keys(anStructure).length} books (pilot).`,
	);

	console.log("Fetching SN structure from sc-data…");
	const snTree = await fetchJson(`${SC_DATA_BASE}/tree/sutta/sn-tree.json`);
	const snStructure = parseSnTree(snTree);
	const snVaggaCount = Object.values(snStructure).reduce(
		(sum, vaggas) => sum + Object.keys(vaggas).length,
		0,
	);
	console.log(
		`Parsed ${snVaggaCount} SN vaggas across ${Object.keys(snStructure).length} saṁyuttas (pilot).`,
	);

	if (dryRun) {
		console.log(renderMnTypeScript(mnStructure));
		console.log(renderAnTypeScript(anStructure));
		console.log(renderSnTypeScript(snStructure));
		return;
	}

	writeFileSync(MN_OUTPUT_PATH, renderMnTypeScript(mnStructure), "utf-8");
	console.log(`Wrote ${MN_OUTPUT_PATH}`);

	writeFileSync(AN_OUTPUT_PATH, renderAnTypeScript(anStructure), "utf-8");
	console.log(`Wrote ${AN_OUTPUT_PATH}`);

	writeFileSync(SN_OUTPUT_PATH, renderSnTypeScript(snStructure), "utf-8");
	console.log(`Wrote ${SN_OUTPUT_PATH}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
