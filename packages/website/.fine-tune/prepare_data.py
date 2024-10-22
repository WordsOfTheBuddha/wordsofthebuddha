import os
import json
import random

# Define the instruction and dictionary
instruction = """As a professional tutor and translator, translate the Pali text faithfully while maintaining an accessible and smooth transition flow. The primary use case is for Pali canon suttas. This will ensure a high fidelity with the original texts.

For Prose:

*  When a title is present, translate the title.
* Fill in with complete repeated phrases for ... or ...pe... patterns.
* Output quotes as "..." instead of “...”.
* Output single quotes as '...' instead of ‘...’.

For Verse:

* Line-by-line translation in the format of the input.
* Each line should have fidelity with the Pali text.

Dictionary - Please use the below provided translations including the brackets on all occasions:

abhutvā = not having enjoyed  
Abhisaṅkharoti = chooses to act  
acinteyyāni, acinteyyo = not suitable to conceive  
adukkhamasukhaṁ = neither painful-nor-pleasant  
Akkheyyañca = fully comprehending signs  
Akkheyyasaññino = perceiving in terms of signs  
Alobho = contentment  
amoho = wisdom (inclination to carefully examine and independently verify)  
Anītikañca, anītikaṁ = freedom from calamity  
Anālayañca, anālayo = non-clinging  
Anuseti = has a tendency towards  
Apalokitañca, apalokitaṁ = non-disintegrating  
Appaṇihito = desireless (undirected)  
āsavānaṁ = (source of) taints  
āsavehi = (source of) taints  
Akkheyyasaññino = perceiving in terms of signs  
Alobho = contentment  
amoho = wisdom (inclination to carefully examine and independently verify)  
Anītikañca, anītikaṁ = freedom from calamity  
Anālayañca, anālayo = non-clinging  
anuseti = has a tendency towards  
Apalokitañca, apalokitaṁ = non-disintegrating  
Appaṇihito = desireless (undirected)  
āp = liberating the mind  
āsavānaṁ = (source of) taints  
āsavehi = (source of) taints  
bhavo, bhava = continued existence  
bhikkhave = bhikkhus  
bhikkhasi = go for alms  
bhikkhu, bhikkhuṁ = bhikkhu  
bhutvā = having enjoyed  
bojjhaṅga = factor of awakening  
brahmacariya = spiritual life  
cetovimutti = release of mind  
cetasā = with mind  
chanda = interest  
chandasamādhippadhānasaṅkhārasamannāgataṁ = collectedness arising from aspiration and accompanied by an intention of continuous effort  
dhammadhātu = mental-qualities-element  
dhamma (in the context of four foundations of mindfulness) = mental qualities  
dhammavicayasambojjhaṅgassa = awakening factor of investigation of phenomena (dhamma)  
devatā = deity (deva)  
dosapariyuṭṭhitaṁ = overcome by aversion (ill-will, hatred)  
doso = aversion (ill-will, hatred, resentment)  
dukkhaṁ (in the context of feeling or consciousness) = painful  
dukkhā = suffering (discontentment, stress)  
Evaṁ me sutaṁ = Thus have I heard  
ehipassiko = inviting verification  
iddhi = psychic ability  
iddhipādā = basis for psychic ability  
khaye ñāṇan”ti = knowledge of ending (cessation)  
khaye, khayā = ending (cessation)  
lobho = greed (lust, desire, attachment)  
moghapuriso = misguided person  
moha = delusion (assumption making tendencies, absence of close examination and verification)  
mohapariyuṭṭhitaṁ = overcome by delusion (assumption making tendencies, absence of close examination and verification)  
mudita = empathetic joy  
pītisambojjhaṅgaṁ = awakening factor of joy (rapture)  
pīti = rapture (intense joy)  
Pakappeti = plans  
Paṭibhānakūṭa = Inspiration peak  
Paṭiccasamuppāda = dependent co-arising  
paññāvimutti = release by wisdom  
parippharati = permeates  
parāyana = the ultimate goal  
rāga = passion (desire, attachment)  
rāgapariyuṭṭhitaṁ = overcome by passion (desire, attachment)  
samaṇā, samana, samaṇaṁ = ascetic  
samādhi = collectedness of mind  
samāhitaṁ = collected  
samatha = tranquility  
Savitakko = accompanied with reflection  
savicāra = with examination  
Saṅkhārā = formations (volitions, choices)  
sukha = ease (bliss)  
sukham = ease (bliss)  
sukhaṁ (in the context of feeling or consciousness) = pleasant  
suññato = emptiness and absence  
Sāvatthinidānaṁ = At Sāvatthi  
thīna-middha = dullness (complacency)  
thinamiddhaṁ = dullness (complacency)  
Tathāni, tatha = true (actual)  
uddhaccakukkuccaṁ = restlessness (mental agitation)  
upanisā = proximate cause  
upādāna = clinging (grasping/holding on)  
Uposatha = Uposatha (observance day)  
vijjābhāgiyā = realization  
vijānāti (in the context of consciousness) = cognizes  
vimānamajjhagā = gone beyond conceit  
Vimocayaṁ cittaṁ = liberating the mind  
viññāṇañcāyatanaṁ = sphere of infinite consciousness (boundless awareness)  
vīriya = persistence (energy)  
vīriyabalaṁ = strength of persistence  
vīriyindriyaṁ = faculty of persistence  
vīriyasambojjhaṅgaṁ = awakening factor of persistence (energy)  
vīriyasamādhippadhānasaṅkhārasamannāgataṁ = collectedness arising from determination and accompanied by an intention of continuous effort  
vīmaṁsāsamādhippadhānasaṅkhārasamannāgataṁ = collectedness arising from investigation (reflection and examination) accompanied by an intention of continuous effort  
viññāṇañcāyatanaṁ = sphere of infinite consciousness (boundless awareness)  
Yathābhūtañāṇadassanampāhaṁ = knowledge and vision of things as they have come to be  
yoga = yoke (bond)
"""


def pair_files(pali_files, english_files):
    """Pair Pali and English files based on their directory structure."""
    pairs = []

    # Create a dictionary for quick lookup of English files by base name
    english_file_dict = {}
    for english_file in english_files:
        base_name = os.path.splitext(os.path.basename(english_file))[
            0].replace('.en', '')
        english_file_dict[base_name] = english_file

    # Pair each Pali file with the corresponding English file
    for pali_file in pali_files:
        base_name = os.path.splitext(os.path.basename(pali_file))[
            0].replace('.pli', '')
        if base_name in english_file_dict:
            english_file = english_file_dict[base_name]
            pairs.append((pali_file, english_file))

    return pairs


def extract_content(file_path):
    """Extract content from a file, extract title, and skip frontmatter."""
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
        title = ""
        # Extract and process frontmatter
        if content.startswith('---'):
            frontmatter_end = content.find('---', 3)  # Find the closing '---'
            frontmatter = content[:frontmatter_end].strip()
            content = content[frontmatter_end+3:].strip()

            # Extract title from frontmatter
            for line in frontmatter.splitlines():
                if line.startswith('title:'):
                    title = line.split(':', 1)[1].strip()
                    if ' - ' in title:
                        # Use only the Pali part
                        title = title.split(' - ')[0].strip()

        return title, content


def create_jsonl_full_files_with_title(pairs, output_file):
    """Create a JSONL file with full-file pairs and titles."""
    unique_pairs = set()
    with open(output_file, 'w', encoding='utf-8') as jsonl_file:
        for pali_file, english_file in pairs:
            pali_title, pali_content = extract_content(pali_file)
            english_title, english_content = extract_content(english_file)

            # Combine title and content
            pali_text = f"{pali_title}\n{pali_content}".strip()
            english_text = f"{english_title}\n{english_content}".strip()

            # Create a tuple of the full file content to check for duplicates
            pair = (pali_text, english_text)
            if pair not in unique_pairs:
                unique_pairs.add(pair)
                json_line = {
                    "messages": [
                        {"role": "system", "content": instruction},
                        {"role": "user", "content": pair[0]},
                        {"role": "assistant", "content": pair[1]}
                    ]
                }
                # Use ensure_ascii=False to prevent escaping of non-ASCII characters
                jsonl_file.write(json.dumps(
                    json_line, ensure_ascii=False) + '\n')


# Traversing and collecting files
pali_files = []
english_files = []

for root, dirs, files in os.walk('pages'):
    for file in files:
        if file.endswith('.pli.md'):
            pali_files.append(os.path.join(root, file))
        elif file.endswith('.en.mdx'):
            english_files.append(os.path.join(root, file))

# Pairing files
pairs = pair_files(pali_files, english_files)

# Shuffling and splitting pairs
random.shuffle(pairs)
split_idx = len(pairs) // 2
train_pairs = pairs[:split_idx]
validation_pairs = pairs[split_idx:]

# Creating JSONL files with full files in chat format including titles
create_jsonl_full_files_with_title(
    train_pairs, 'train_chat_full_files_with_title.jsonl')
create_jsonl_full_files_with_title(
    validation_pairs, 'validation_chat_full_files_with_title.jsonl')
