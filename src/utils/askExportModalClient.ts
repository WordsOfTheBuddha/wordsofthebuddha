import {
	ASK_EXPORT_OPEN_EVENT,
	type AskExportOpenDetail,
	type AskExportTurnView,
	type ResearchExportContents,
	researchExportContentsCounts,
	researchExportContentsDescription,
	slugsForResearchExportContents,
} from "./askExportTurns";
import { transformId } from "./transformId";

let toastTimer: ReturnType<typeof setTimeout>;
let keydownWired = false;
let currentTurns: AskExportTurnView[] = [];
let currentSharePath: string | undefined;
let currentResearch = false;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function getDialog(): HTMLDialogElement | null {
	return document.querySelector<HTMLDialogElement>("#ask-pdf-export-dialog");
}

function closeDialog(): void {
	const dlg = getDialog();
	if (dlg?.open) {
		try {
			dlg.close();
		} catch {
			/* ignore */
		}
	}
}

function showToast(msg: string): void {
	const toast = document.querySelector<HTMLElement>(".ask-pdf-toast");
	const toastMsg = toast?.querySelector<HTMLElement>(".toast-msg");
	if (!toast || !toastMsg) return;
	clearTimeout(toastTimer);
	toastMsg.textContent = msg;
	toast.classList.add("visible");
	toastTimer = setTimeout(() => toast.classList.remove("visible"), 8000);
}

function getSelectedFormat(dlg: HTMLDialogElement): "pdf" | "epub" {
	const input = dlg.querySelector<HTMLInputElement>(
		'input[name="ask-export-format"]:checked',
	);
	return input?.value === "epub" ? "epub" : "pdf";
}

function generateButtonLabel(
	dlg: HTMLDialogElement,
	format: "pdf" | "epub",
): string {
	const gen = dlg.querySelector<HTMLButtonElement>("#ask-pdf-generate");
	if (format === "epub") return gen?.dataset.labelEpub || "Download EPUB";
	return gen?.dataset.labelPdf || "Print PDF";
}

function getDiscourseCheckboxes(dlg: HTMLDialogElement): HTMLInputElement[] {
	return Array.from(
		dlg.querySelectorAll<HTMLInputElement>(".pdf-discourse-cb"),
	);
}

function getSelectedResearchContents(
	dlg: HTMLDialogElement,
): ResearchExportContents {
	const input = dlg.querySelector<HTMLInputElement>(
		'input[name="ask-export-contents"]:checked',
	);
	if (input?.value === "report" || input?.value === "all") return input.value;
	return "cited";
}

function updateGenerateButton(dlg: HTMLDialogElement): void {
	const gen = dlg.querySelector<HTMLButtonElement>("#ask-pdf-generate");
	if (!gen) return;
	if (currentResearch) {
		gen.disabled = currentTurns.length === 0;
		return;
	}
	gen.disabled = getDiscourseCheckboxes(dlg).every((cb) => !cb.checked);
}

function applyResearchContentsUi(dlg: HTMLDialogElement): void {
	const researchEl = dlg.querySelector<HTMLElement>(
		"#ask-pdf-research-contents",
	);
	const treeEl = dlg.querySelector<HTMLElement>("#ask-pdf-contents");
	const optionsEl = dlg.querySelector<HTMLElement>("#ask-pdf-options");
	const largeNote = dlg.querySelector<HTMLElement>(
		"#ask-pdf-large-export-note",
	);
	const citedOpt = dlg.querySelector<HTMLElement>(
		'[data-contents-option="cited"]',
	);
	const allOpt = dlg.querySelector<HTMLElement>(
		'[data-contents-option="all"]',
	);
	const citedDesc = dlg.querySelector("[data-contents-cited-desc]");
	const allDesc = dlg.querySelector("[data-contents-all-desc]");
	if (researchEl) researchEl.hidden = !currentResearch;
	if (treeEl) treeEl.hidden = currentResearch;
	if (!currentResearch) {
		if (optionsEl) optionsEl.hidden = false;
		if (largeNote) largeNote.hidden = true;
		updateGenerateButton(dlg);
		return;
	}

	const counts = researchExportContentsCounts(currentTurns);
	const turnCount = currentTurns.length;
	if (citedOpt) citedOpt.hidden = !counts.showCited;
	if (allOpt) allOpt.hidden = !counts.showAll;
	if (citedDesc) {
		citedDesc.textContent = researchExportContentsDescription(
			"cited",
			counts.cited,
			turnCount,
		);
	}
	if (allDesc) {
		allDesc.textContent = researchExportContentsDescription(
			"all",
			counts.all,
			turnCount,
		);
	}

	const selected = getSelectedResearchContents(dlg);
	const next: ResearchExportContents =
		selected === "cited" && !counts.showCited
			? counts.defaultContents
			: selected === "all" && !counts.showAll
				? counts.showCited
					? "cited"
					: "report"
				: selected;
	if (next !== selected) {
		const radio = dlg.querySelector<HTMLInputElement>(
			`input[name="ask-export-contents"][value="${next}"]`,
		);
		if (radio) radio.checked = true;
	}

	const contents = getSelectedResearchContents(dlg);
	if (optionsEl) optionsEl.hidden = contents === "report";
	const discourseCount =
		contents === "report"
			? 0
			: contents === "cited"
				? counts.cited
				: counts.all;
	if (largeNote) largeNote.hidden = discourseCount <= 100;
	updateGenerateButton(dlg);
}

function updateSelectionUi(dlg: HTMLDialogElement): void {
	const boxes = getDiscourseCheckboxes(dlg);
	const total = boxes.length;
	const sel = boxes.filter((cb) => cb.checked).length;
	const countEl = dlg.querySelector("#ask-pdf-selection-count");
	if (countEl) countEl.textContent = `${sel} of ${total} selected`;
	updateGenerateButton(dlg);
}

function syncChapterFromChildren(chapterEl: Element): void {
	const chapterCb = chapterEl.querySelector(
		".pdf-chapter-cb",
	) as HTMLInputElement | null;
	const discs = Array.from(
		chapterEl.querySelectorAll<HTMLInputElement>(".pdf-discourse-cb"),
	);
	if (!chapterCb) return;
	const n = discs.length;
	const c = discs.filter((d) => d.checked).length;
	chapterCb.checked = c === n && n > 0;
	chapterCb.indeterminate = c > 0 && c < n;
}

function applyChapterToDiscourses(chapterCb: HTMLInputElement): void {
	const chapterEl = chapterCb.closest(".pdf-tree-chapter");
	if (!chapterEl) return;
	chapterEl
		.querySelectorAll<HTMLInputElement>(".pdf-discourse-cb")
		.forEach((d) => {
			d.checked = chapterCb.checked;
		});
	chapterCb.indeterminate = false;
}

function resetAll(dlg: HTMLDialogElement): void {
	getDiscourseCheckboxes(dlg).forEach((d) => {
		d.checked = true;
	});
	dlg.querySelectorAll(".pdf-tree-chapter").forEach((ch) => {
		const cb = ch.querySelector(".pdf-chapter-cb") as HTMLInputElement | null;
		if (cb) {
			cb.checked = true;
			cb.indeterminate = false;
		}
	});
	updateSelectionUi(dlg);
}

function clearAll(dlg: HTMLDialogElement): void {
	getDiscourseCheckboxes(dlg).forEach((d) => {
		d.checked = false;
	});
	dlg.querySelectorAll(".pdf-tree-chapter").forEach((ch) => {
		const cb = ch.querySelector(".pdf-chapter-cb") as HTMLInputElement | null;
		if (cb) {
			cb.checked = false;
			cb.indeterminate = false;
		}
	});
	updateSelectionUi(dlg);
}

function applyFormatDependentUi(dlg: HTMLDialogElement): void {
	const format = getSelectedFormat(dlg);
	const isEpub = format === "epub";
	const layoutFs = dlg.querySelector<HTMLFieldSetElement>(
		"#ask-pdf-fieldset-layout",
	);
	const vizColors = dlg.querySelector<HTMLFieldSetElement>(
		"#ask-pdf-fieldset-viz-colors",
	);
	const epubNote = dlg.querySelector<HTMLElement>("#ask-export-epub-note");
	const gen = dlg.querySelector<HTMLButtonElement>("#ask-pdf-generate");
	const pliInput = dlg.querySelector<HTMLInputElement>("#ask-pdf-opt-pli");
	const vizShow = dlg.querySelector<HTMLInputElement>("#ask-pdf-opt-viz-show");

	if (layoutFs) {
		layoutFs.hidden = isEpub;
		if (!isEpub) layoutFs.disabled = !pliInput?.checked;
	}
	if (vizColors) {
		vizColors.hidden = false;
		vizColors.disabled = !vizShow?.checked;
		const lightOpt = vizColors.querySelector<HTMLElement>(
			"[data-viz-mode-option='light']",
		);
		const einkOpt = vizColors.querySelector<HTMLElement>(
			"[data-viz-mode-option='eink']",
		);
		const thermalOpt = vizColors.querySelector<HTMLElement>(
			"[data-viz-mode-option='thermal']",
		);
		if (lightOpt) lightOpt.hidden = isEpub;
		if (einkOpt) einkOpt.hidden = !isEpub;
		if (thermalOpt) thermalOpt.hidden = isEpub;
		const lightR = vizColors.querySelector<HTMLInputElement>(
			'input[name="ask-viz-mode"][value="light"]',
		);
		const einkR = vizColors.querySelector<HTMLInputElement>(
			'input[name="ask-viz-mode"][value="eink"]',
		);
		const darkR = vizColors.querySelector<HTMLInputElement>(
			'input[name="ask-viz-mode"][value="dark"]',
		);
		if (isEpub) {
			if (!darkR?.checked && einkR) einkR.checked = true;
		} else if (einkR?.checked && lightR) {
			lightR.checked = true;
		}
	}
	if (epubNote) epubNote.hidden = !isEpub;
	if (
		gen &&
		gen.textContent !== "Printing…" &&
		gen.textContent !== "Building EPUB…"
	) {
		gen.textContent = generateButtonLabel(dlg, format);
	}
	applyResearchContentsUi(dlg);
}

function applyDefaultsFromPage(dlg: HTMLDialogElement): void {
	const pliInput = dlg.querySelector<HTMLInputElement>("#ask-pdf-opt-pli");
	const layoutFieldset = dlg.querySelector<HTMLFieldSetElement>(
		"#ask-pdf-fieldset-layout",
	);
	const vizShowInput = dlg.querySelector<HTMLInputElement>(
		"#ask-pdf-opt-viz-show",
	);
	const vizColorsFieldset = dlg.querySelector<HTMLFieldSetElement>(
		"#ask-pdf-fieldset-viz-colors",
	);
	const keyTermsInput = dlg.querySelector<HTMLInputElement>(
		"#ask-pdf-opt-keyterms",
	);
	if (!pliInput || !layoutFieldset || !keyTermsInput) {
		resetAll(dlg);
		applyFormatDependentUi(dlg);
		return;
	}

	try {
		const params = new URLSearchParams(window.location.search);
		const showPali =
			document.documentElement.classList.contains("pali-on") ||
			localStorage.getItem("paliMode") === "true" ||
			params.get("pli") === "true";
		pliInput.checked = showPali;
		const split =
			document.documentElement.classList.contains("split") ||
			localStorage.getItem("layout") === "split";
		const interleaved = dlg.querySelector<HTMLInputElement>(
			'input[name="ask-layout"][value="interleaved"]',
		);
		const splitR = dlg.querySelector<HTMLInputElement>(
			'input[name="ask-layout"][value="split"]',
		);
		if (splitR && interleaved) {
			if (split) splitR.checked = true;
			else interleaved.checked = true;
		}
		layoutFieldset.disabled = !showPali;

		if (vizShowInput && vizColorsFieldset) {
			const imgStored = localStorage.getItem("showDiscourseImages");
			const showImg = imgStored === null || imgStored === "true";
			vizShowInput.checked = showImg;
			vizColorsFieldset.disabled = !showImg;

			let v = localStorage.getItem("vizImageMode");
			if (v === "print") v = "thermal";
			const lightR = dlg.querySelector<HTMLInputElement>(
				'input[name="ask-viz-mode"][value="light"]',
			);
			const darkR = dlg.querySelector<HTMLInputElement>(
				'input[name="ask-viz-mode"][value="dark"]',
			);
			const thermalR = dlg.querySelector<HTMLInputElement>(
				'input[name="ask-viz-mode"][value="thermal"]',
			);
			if (v === "light" && lightR) lightR.checked = true;
			else if (v === "dark" && darkR) darkR.checked = true;
			else if (v === "thermal" && thermalR) thermalR.checked = true;
			else if (lightR) lightR.checked = true;
		}

		keyTermsInput.checked = true;

		const savedFormat = localStorage.getItem("exportFormat");
		const epubR = dlg.querySelector<HTMLInputElement>(
			'input[name="ask-export-format"][value="epub"]',
		);
		const pdfR = dlg.querySelector<HTMLInputElement>(
			'input[name="ask-export-format"][value="pdf"]',
		);
		if (savedFormat === "epub" && epubR) epubR.checked = true;
		else if (pdfR) pdfR.checked = true;
	} catch {
		pliInput.checked = false;
		layoutFieldset.disabled = true;
	}

	resetAll(dlg);
	applyFormatDependentUi(dlg);
}

function renderTree(turns: AskExportTurnView[]): string {
	const multi = turns.length > 1;
	return turns
		.map((turn, i) => {
			const question = escapeHtml(turn.question);
			const discourses = turn.discourses
				.map((d) => {
					const title =
						d.title && d.title.trim() !== d.slug
							? ` <span>${escapeHtml(d.title)}</span>`
							: "";
					const badge = d.isReference
						? '<span class="pdf-tree-ref-badge">Ref.</span>'
						: "";
					return `<li${d.isReference ? ' class="pdf-tree-discourse--reference"' : ""}>
						<label class="pdf-tree-discourse-label${d.isReference ? " pdf-tree-discourse-label--reference" : ""}">
							<input type="checkbox" class="pdf-discourse-cb" data-slug="${escapeHtml(d.slug)}" data-turn-index="${i}" checked />
							<span class="pdf-tree-discourse-title">
								<span class="pdf-tree-id">${escapeHtml(transformId(d.slug))}</span>${title}${badge}
							</span>
						</label>
					</li>`;
				})
				.join("");
			const idSpan = multi
				? `<span class="pdf-tree-id">${i + 1}</span> `
				: "";
			return `<div class="pdf-tree-chapter" data-turn-index="${i}">
				<div class="pdf-tree-chapter-row">
					<label class="pdf-tree-chapter-label">
						<input type="checkbox" class="pdf-chapter-cb" checked />
						<span class="pdf-tree-chapter-title">${idSpan}<span>${question}</span></span>
					</label>
				</div>
				<ul class="pdf-tree-discourses">${discourses}</ul>
			</div>`;
		})
		.join("");
}

function openWith(detail: AskExportOpenDetail): void {
	const dlg = getDialog();
	if (!dlg) return;
	currentTurns = detail.turns || [];
	currentSharePath = detail.sharePath;
	currentResearch =
		detail.research === true ||
		currentTurns.some((turn) => turn.research === true);
	if (currentTurns.length === 0) return;

	const tree = dlg.querySelector("#ask-pdf-tree-scroll");
	if (tree && !currentResearch) tree.innerHTML = renderTree(currentTurns);

	const subject = dlg.querySelector<HTMLElement>("[data-ask-export-subject]");
	if (subject) {
		subject.textContent = currentResearch
			? currentTurns.length > 1
				? "Research reports"
				: "Research report"
			: currentTurns.length === 1
				? currentTurns[0]?.question || "Ask"
				: "Ask conversation";
	}

	if (currentResearch) {
		const counts = researchExportContentsCounts(currentTurns);
		const radio = dlg.querySelector<HTMLInputElement>(
			`input[name="ask-export-contents"][value="${counts.defaultContents}"]`,
		);
		if (radio) radio.checked = true;
	}

	applyDefaultsFromPage(dlg);
	if (!dlg.open) dlg.showModal();
}

function selectedTurnsPayload(dlg: HTMLDialogElement): {
	question: string;
	summary: string;
	selectedDiscourseSlugs: string[];
}[] {
	if (currentResearch) {
		const contents = getSelectedResearchContents(dlg);
		return currentTurns
			.map((turn) => ({
				question: turn.question,
				summary: turn.summary,
				selectedDiscourseSlugs: slugsForResearchExportContents(
					turn.discourses,
					contents,
				),
			}))
			.filter(
				(turn) =>
					turn.summary.trim().length > 0 ||
					turn.selectedDiscourseSlugs.length > 0,
			);
	}
	const byTurn = new Map<number, string[]>();
	getDiscourseCheckboxes(dlg)
		.filter((cb) => cb.checked)
		.forEach((cb) => {
			const index = Number(cb.dataset.turnIndex);
			const slug = cb.dataset.slug;
			if (!Number.isFinite(index) || !slug) return;
			const list = byTurn.get(index) ?? [];
			list.push(slug);
			byTurn.set(index, list);
		});
	const out: {
		question: string;
		summary: string;
		selectedDiscourseSlugs: string[];
	}[] = [];
	currentTurns.forEach((turn, index) => {
		const slugs = byTurn.get(index);
		if (!slugs || slugs.length === 0) return;
		out.push({
			question: turn.question,
			summary: turn.summary,
			selectedDiscourseSlugs: slugs,
		});
	});
	return out;
}

async function handleGenerate(): Promise<void> {
	const dlg = getDialog();
	if (!dlg?.open) return;
	const generateBtn = dlg.querySelector<HTMLButtonElement>("#ask-pdf-generate");
	if (!generateBtn || generateBtn.disabled) return;

	const pliInput = dlg.querySelector<HTMLInputElement>("#ask-pdf-opt-pli");
	const keyTermsInput = dlg.querySelector<HTMLInputElement>(
		"#ask-pdf-opt-keyterms",
	);
	const vizShowInput = dlg.querySelector<HTMLInputElement>(
		"#ask-pdf-opt-viz-show",
	);
	if (!pliInput || !keyTermsInput) return;

	const format = getSelectedFormat(dlg);
	generateBtn.disabled = true;
	generateBtn.textContent =
		format === "epub" ? "Building EPUB…" : "Printing…";

	try {
		const d = new Date();
		const day = d.getDate();
		const suffix = [11, 12, 13].includes(day)
			? "th"
			: day % 10 === 1
				? "st"
				: day % 10 === 2
					? "nd"
					: day % 10 === 3
						? "rd"
						: "th";
		const month = d.toLocaleDateString("en-GB", { month: "long" });
		const year = d.getFullYear();
		const date = `${day}<sup>${suffix}</sup> ${month} ${year}`;

		const includeDiscourses =
			!currentResearch || getSelectedResearchContents(dlg) !== "report";
		const includeImages = includeDiscourses && !!vizShowInput?.checked;
		const layoutEl = dlg.querySelector<HTMLInputElement>(
			'input[name="ask-layout"]:checked',
		);
		const lay =
			!includeDiscourses || format === "epub"
				? "interleaved"
				: layoutEl?.value === "split"
					? "split"
					: "interleaved";

		const turns = selectedTurnsPayload(dlg);
		if (turns.length === 0) {
			showToast(
				currentResearch
					? "Nothing to download."
					: "Select at least one discourse.",
			);
			return;
		}

		const postBody: Record<string, unknown> = {
			turns,
			date,
			format,
			images: includeImages ? "svgPrimaryOnly" : "none",
			pli: includeDiscourses && pliInput.checked,
			layout: lay,
			keyTerms: includeDiscourses && keyTermsInput.checked,
		};
		if (currentSharePath) postBody.sharePath = currentSharePath;
		const coverTitle =
			currentResearch && currentTurns[0]?.reportTitle
				? currentTurns[0].reportTitle
				: currentTurns[0]?.question;
		if (coverTitle) postBody.title = coverTitle;
		if (currentResearch) postBody.kind = "research";
		if (includeImages) {
			const mode = dlg.querySelector<HTMLInputElement>(
				'input[name="ask-viz-mode"]:checked',
			);
			const vz = mode?.value;
			if (format === "epub") {
				postBody.viz = vz === "dark" ? "dark" : "eink";
			} else if (vz === "light" || vz === "dark" || vz === "thermal") {
				postBody.viz = vz;
			}
		}

		const response = await fetch("/api/export/ask", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(postBody),
		});

		if (!response.ok) {
			let detail = response.statusText;
			try {
				const errBody = await response.json();
				detail = (errBody as { error?: string }).error ?? detail;
			} catch {
				/* ignore */
			}
			if (response.status === 504) {
				detail =
					"The export took too long on the server. Try selecting fewer discourses, or try again in a moment.";
			}
			throw new Error(detail);
		}

		const blob = await response.blob();
		const objectUrl = URL.createObjectURL(blob);
		const disposition = response.headers.get("Content-Disposition") ?? "";
		const nameMatch = /filename="([^"]+)"/.exec(disposition);
		const filename =
			nameMatch?.[1] ?? `ask.${format === "epub" ? "epub" : "pdf"}`;

		const anchor = document.createElement("a");
		anchor.href = objectUrl;
		anchor.download = filename;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
		closeDialog();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		const kind = format === "epub" ? "EPUB" : "PDF";
		showToast(`${kind} generation failed: ${msg}`);
	} finally {
		generateBtn.textContent = generateButtonLabel(dlg, format);
		if (currentResearch) applyResearchContentsUi(dlg);
		else updateSelectionUi(dlg);
	}
}

function wireUi(): void {
	const dlg = getDialog();
	if (!dlg) return;

	dlg.querySelectorAll("[data-ask-pdf-close]").forEach((btn) => {
		(btn as HTMLElement).onclick = (e) => {
			e.preventDefault();
			closeDialog();
		};
	});
	dlg.onclick = (e) => {
		if (e.target === dlg) closeDialog();
	};

	const gen = dlg.querySelector("#ask-pdf-generate");
	if (gen) {
		(gen as HTMLElement).onclick = (e) => {
			e.preventDefault();
			void handleGenerate();
		};
	}
	const selAll = dlg.querySelector("#ask-pdf-select-all");
	if (selAll) {
		(selAll as HTMLElement).onclick = (e) => {
			e.preventDefault();
			resetAll(dlg);
		};
	}
	const clr = dlg.querySelector("#ask-pdf-clear-all");
	if (clr) {
		(clr as HTMLElement).onclick = (e) => {
			e.preventDefault();
			clearAll(dlg);
		};
	}

	dlg.onchange = (e) => {
		const el = e.target as HTMLElement | null;
		if (!el) return;
		if (el.classList.contains("pdf-chapter-cb")) {
			applyChapterToDiscourses(el as HTMLInputElement);
			updateSelectionUi(dlg);
			return;
		}
		if (el.classList.contains("pdf-discourse-cb")) {
			const ch = el.closest(".pdf-tree-chapter");
			if (ch) syncChapterFromChildren(ch);
			updateSelectionUi(dlg);
			return;
		}
		if ((el as HTMLInputElement).name === "ask-export-contents") {
			applyResearchContentsUi(dlg);
			return;
		}
		if (el.id === "ask-pdf-opt-pli" || el.id === "ask-pdf-opt-viz-show") {
			applyFormatDependentUi(dlg);
		}
		if ((el as HTMLInputElement).name === "ask-export-format") {
			applyFormatDependentUi(dlg);
			try {
				localStorage.setItem("exportFormat", getSelectedFormat(dlg));
			} catch {
				/* ignore */
			}
		}
	};

	if (!keydownWired) {
		keydownWired = true;
		window.addEventListener(
			"keydown",
			(e) => {
				if (e.key !== "Escape") return;
				if (!getDialog()?.open) return;
				closeDialog();
				e.preventDefault();
			},
			true,
		);
	}
}

function bindToastDismiss(): void {
	if (document.documentElement.dataset.askPdfToastDismiss === "1") return;
	document.documentElement.dataset.askPdfToastDismiss = "1";
	document.addEventListener(
		"click",
		(e) => {
			const t = e.target as HTMLElement | null;
			if (!t?.closest(".ask-pdf-toast .toast-close")) return;
			e.preventDefault();
			clearTimeout(toastTimer);
			document.querySelector(".ask-pdf-toast")?.classList.remove("visible");
		},
		true,
	);
}

function init(): void {
	bindToastDismiss();
	queueMicrotask(() => wireUi());
	if (document.documentElement.dataset.askExportOpenWired === "1") return;
	document.documentElement.dataset.askExportOpenWired = "1";
	window.addEventListener(ASK_EXPORT_OPEN_EVENT, ((
		event: CustomEvent<AskExportOpenDetail>,
	) => {
		openWith(event.detail || { turns: [] });
	}) as EventListener);
}

/** Wires the Ask export dialog; loaded with the Ask client (AiModeApp). */
export function initAskExportModal(): void {
	document.addEventListener("astro:page-load", init);
	init();
}
