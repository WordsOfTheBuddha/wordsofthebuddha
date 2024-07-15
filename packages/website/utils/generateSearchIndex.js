const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const CONTENT_DIRECTORY = path.join(__dirname, "..", "pages");
const OUTPUT_FILE = path.join(__dirname, "..", "public", "searchIndex.json");

const getAllFiles = (dirPath, arrayOfFiles) => {
	const files = fs.readdirSync(dirPath);

	arrayOfFiles = arrayOfFiles || [];

	files.forEach((file) => {
		if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
			arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
		} else {
			arrayOfFiles.push(path.join(dirPath, file));
		}
	});

	return arrayOfFiles;
};

const parseContent = (content) => {
	const sections = [];
	const lines = content.split("\n");
	let currentHeader = "";
	let slugHeader = "";

	lines.forEach((line) => {
		const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
		if (headerMatch) {
			currentHeader = headerMatch[2].trim();
			// slugify header, preserve diacritics, ., are replaced by '', space is replaced by '-'
			slugHeader = currentHeader
				.replace(/[^\p{L}\p{M}0-9- ]/gu, "")
				.replace(/\s+/g, "-")
				.toLowerCase();
		}
		sections.push({
			id: slugHeader,
			header: currentHeader,
			content: line.trim(),
		});
	});

	return sections;
};

const generateSearchIndexJSON = async () => {
	const files = getAllFiles(CONTENT_DIRECTORY).filter(
		(file) => file.endsWith(".md") || file.endsWith(".mdx")
	);
	const searchIndexData = [];
	let frontMatterCount = 0;

	for (const file of files) {
		const fileContent = fs.readFileSync(file, "utf8");
		const { data: frontMatter, content } = matter(fileContent);
		if (Object.keys(frontMatter).length > 0) {
			const relativePath = path.relative(CONTENT_DIRECTORY, file);
			const route = "/" + relativePath.replace(/\.(md|mdx)$/, "");
			const cleanContent = content.replace(/<\/?[^>]+(>|$)/g, ""); // Remove HTML tags
			const sections = parseContent(cleanContent);
			// Extract fileId from the last part of the relativePath before the file extension
			const pathParts = relativePath.split(path.sep);
			const fileName = pathParts[pathParts.length - 1];
			const fileId = fileName.substring(0, fileName.lastIndexOf("."));
			if (route.endsWith(".pli")) {
				continue;
			}

			// iterate over the sections array and index one section at a time to the search index
			let sectionId = 0;
			const urlRoute = route.replace(/(.*)(\.\w{2,3})(#[\s\S]*)?$/, "$1$3");
			sections.forEach((section) => {
				sectionId++;
				searchIndexData.push({
					id: `${fileId}-${sectionId}`,
					url: section.id ? `${urlRoute}#${section.id}` : urlRoute,
					sectionId: sectionId,
					header: section.header,
					fileId,
					path: `/${relativePath.split(path.sep).slice(0, -1).join("/")}/`,
					description: section.id ? "" : frontMatter.description,
					tags: section.id ? [] : frontMatter.tags?.split(",").map((e) => e.trim()),
					title: frontMatter.title || "",
					content: section.content,
				});
			});
			frontMatterCount++;
		}
	}

	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(searchIndexData, null, 2));
	console.log(
		`Search index data written to ${OUTPUT_FILE} from ${frontMatterCount} files`
	);
};

generateSearchIndexJSON();
