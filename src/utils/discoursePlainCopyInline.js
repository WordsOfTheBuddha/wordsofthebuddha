/**
 * Classic (non-module) copy interceptor. Inlined in Layout / ListenLayout so
 * Safari gets preventDefault + setData on the same turn. Walks live
 * `.english-paragraph` / `.pali-paragraph` blocks intersecting the selection
 * (cloneContents unwraps mid-<p> selections and glues them). Joins blocks
 * with \n\n. Calls window.__suttaPlainCopyPrepare when the module has loaded.
 *
 * Primary path: `copy` capture (Edit menu and Cmd+C). preventDefault +
 * setData("text/plain") + clipboard.writeText. Skip real form controls only;
 * do not skip contenteditable inside .md-content / #highlight-root.
 */
(function () {
	try {
		var __suttaCopyCapture = { capture: true, passive: false };
		var __suttaCopyBlockSelector =
			"p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, .english-paragraph, .pali-paragraph, .listen-paragraph";

		function __suttaNormalizeCopiedPlainText(text) {
			return text
				.replace(/[ \t]+\n/g, "\n")
				.replace(/\n[ \t]+/g, "\n")
				.replace(/\n{2,}/g, "\n\n")
				.trim();
		}

		function __suttaIsCopyBlock(el) {
			if (!el || el.nodeType !== 1) return false;
			var tag = el.tagName.toLowerCase();
			if (
				tag === "p" ||
				tag === "h1" ||
				tag === "h2" ||
				tag === "h3" ||
				tag === "h4" ||
				tag === "h5" ||
				tag === "h6" ||
				tag === "li" ||
				tag === "blockquote" ||
				tag === "pre"
			) {
				return true;
			}
			return (
				el.classList &&
				(el.classList.contains("listen-paragraph") ||
					el.classList.contains("english-paragraph") ||
					el.classList.contains("pali-paragraph"))
			);
		}

		function __suttaShouldIncludeBlock(el) {
			if (!__suttaIsCopyBlock(el)) return false;
			if (el.getAttribute("aria-hidden") === "true") return false;
			if (el.classList && el.classList.contains("english-pair-spacer")) {
				return false;
			}
			if (
				!document.documentElement.classList.contains("pali-on") &&
				el.classList &&
				(el.classList.contains("pali-paragraph") || el.id === "panel2")
			) {
				return false;
			}
			return true;
		}

		function __suttaRangeIntersectsNode(range, node) {
			if (!range || !node) return true;
			try {
				if (range.intersectsNode(node)) return true;
			} catch (err) {}
			var start = range.startContainer;
			var end = range.endContainer;
			if (node === start || node === end) return true;
			if (node.nodeType === 1) {
				if (node.contains(start) || node.contains(end)) return true;
			}
			if (start.nodeType === 1 && start.contains(node)) return true;
			if (end.nodeType === 1 && end.contains(node)) return true;
			try {
				var endOffset =
					node.nodeType === 3 ? node.data.length : node.childNodes.length;
				if (range.comparePoint(node, 0) === 0) return true;
				if (range.comparePoint(node, endOffset) === 0) return true;
				if (
					range.comparePoint(node, 0) < 0 &&
					range.comparePoint(node, endOffset) > 0
				) {
					return true;
				}
			} catch (err2) {}
			return false;
		}

		function __suttaSliceTextForRange(textNode, range) {
			if (!range) return textNode.data;
			var start = 0;
			var end = textNode.data.length;
			if (range.startContainer === textNode) start = range.startOffset;
			if (range.endContainer === textNode) end = range.endOffset;
			if (start >= end) return "";
			return textNode.data.slice(start, end);
		}

		function __suttaDiscourseRootFromElement(el) {
			if (!el || !el.closest) return null;
			var scoped = el.closest(
				".md-content, .listen-stage, #panel1, #panel2, .split-panel, #highlight-root",
			);
			return scoped || null;
		}

		function __suttaFindDiscourseRoot(range, sel) {
			var anchor = sel && sel.anchorNode;
			var anchorEl =
				anchor == null
					? null
					: anchor.nodeType === 1
						? anchor
						: anchor.parentElement;
			var fromAnchor = __suttaDiscourseRootFromElement(anchorEl);
			if (fromAnchor) return fromAnchor;
			var ancestor = range.commonAncestorContainer;
			var ancestorEl =
				ancestor.nodeType === 1 ? ancestor : ancestor.parentElement;
			var fromAncestor = __suttaDiscourseRootFromElement(ancestorEl);
			if (fromAncestor) return fromAncestor;
			try {
				var candidates = document.querySelectorAll(
					".md-content, .listen-stage, #panel1, #panel2",
				);
				for (var i = 0; i < candidates.length; i++) {
					if (__suttaRangeIntersectsNode(range, candidates[i])) {
						return candidates[i];
					}
				}
			} catch (err) {}
			return null;
		}

		function __suttaExtractBlockPlainText(block, range) {
			var walker = document.createTreeWalker(
				block,
				NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
				{
					acceptNode: function (node) {
						if (node.nodeType === 1) {
							var el = node;
							if (el.getAttribute("aria-hidden") === "true") {
								return NodeFilter.FILTER_REJECT;
							}
							try {
								if (
									el.matches(
										"button, script, style, .tm-lookup-btn, .listen-para-actions, .english-pair-spacer, .paragraph-num",
									)
								) {
									return NodeFilter.FILTER_REJECT;
								}
							} catch (err) {}
							if (el.tagName === "BR") {
								if (range && !__suttaRangeIntersectsNode(range, el)) {
									return NodeFilter.FILTER_REJECT;
								}
								return NodeFilter.FILTER_ACCEPT;
							}
							return NodeFilter.FILTER_SKIP;
						}
						if (range && !__suttaRangeIntersectsNode(range, node)) {
							return NodeFilter.FILTER_REJECT;
						}
						return NodeFilter.FILTER_ACCEPT;
					},
				},
			);
			var out = "";
			for (var n = walker.nextNode(); n; n = walker.nextNode()) {
				if (n.nodeType === 1) {
					out += "\n";
				} else {
					out += __suttaSliceTextForRange(n, range);
				}
			}
			return out
				.replace(/[ \t]+$/gm, "")
				.replace(/^[ \t]+/gm, "")
				.replace(/[ \t]{2,}/g, " ")
				.trim();
		}

		function __suttaPlainFromLiveSelection(sel) {
			if (!sel || !sel.rangeCount) return "";
			var range = sel.getRangeAt(0);
			var searchRoot = __suttaFindDiscourseRoot(range, sel);
			if (!searchRoot) {
				var ancestor = range.commonAncestorContainer;
				searchRoot =
					ancestor.nodeType === 1 ? ancestor : ancestor.parentElement;
			}
			if (!searchRoot) return "";

			var blocks = [];
			try {
				blocks = Array.prototype.slice.call(
					searchRoot.querySelectorAll(__suttaCopyBlockSelector),
				);
			} catch (err) {
				return "";
			}

			var parts = [];
			for (var i = 0; i < blocks.length; i++) {
				var block = blocks[i];
				if (!__suttaShouldIncludeBlock(block)) continue;
				if (!__suttaRangeIntersectsNode(range, block)) continue;
				var blockText = __suttaExtractBlockPlainText(block, range);
				if (blockText) parts.push(blockText);
			}

			if (!parts.length) {
				var fallback = __suttaExtractBlockPlainText(searchRoot, range);
				return fallback ? __suttaNormalizeCopiedPlainText(fallback) : "";
			}

			return __suttaNormalizeCopiedPlainText(parts.join("\n\n"));
		}

		function __suttaNodeIsDiscourse(node) {
			if (!node) return false;
			var el = node.nodeType === 1 ? node : node.parentElement;
			if (!el || !el.closest) return false;
			if (el.closest(".tm-popover-overlay, .bottom-popover")) return false;
			return !!el.closest(
				".md-content, .listen-stage, .split-panel, .split-wrapper, .interleaved-article, #panel1, #panel2, #highlight-root, .english-paragraph, .pali-paragraph, .listen-paragraph",
			);
		}

		function __suttaSelectionIsDiscourse(sel) {
			if (!sel) return false;
			if (__suttaNodeIsDiscourse(sel.anchorNode)) return true;
			if (__suttaNodeIsDiscourse(sel.focusNode)) return true;
			try {
				if (
					sel.rangeCount &&
					__suttaNodeIsDiscourse(sel.getRangeAt(0).commonAncestorContainer)
				) {
					return true;
				}
			} catch (err) {}
			return false;
		}

		function __suttaWritePlainClipboard(event, text) {
			event.preventDefault();
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			}
			try {
				if (event.clipboardData) {
					event.clipboardData.setData("text/plain", text);
				}
			} catch (err) {}
			try {
				var clip =
					(typeof window !== "undefined" &&
						window.navigator &&
						window.navigator.clipboard) ||
					(typeof navigator !== "undefined" && navigator.clipboard) ||
					null;
				if (clip && clip.writeText) {
					var written = clip.writeText(text);
					if (written && written.catch) written.catch(function () {});
				}
			} catch (err2) {}
		}

		function __suttaElementFromNode(node) {
			if (!node) return null;
			if (node.nodeType === 1) return node;
			return node.parentElement || null;
		}

		function __suttaIsFormControl(node) {
			var el = __suttaElementFromNode(node);
			if (!el || !el.closest) return false;
			try {
				var tag = el.tagName ? el.tagName.toLowerCase() : "";
				if (tag === "input" || tag === "textarea" || tag === "select") {
					return true;
				}
				return !!el.closest("input, textarea, select");
			} catch (err) {}
			return false;
		}

		function __suttaIsDiscourseCopy(sel, target) {
			if (__suttaSelectionIsDiscourse(sel)) return true;
			if (__suttaNodeIsDiscourse(target)) return true;
			return false;
		}

		function __suttaExtractSelectionPlain(sel, eventLike) {
			var text = "";
			try {
				if (typeof window.__suttaPlainCopyPrepare === "function") {
					text = window.__suttaPlainCopyPrepare(eventLike) || "";
				}
			} catch (err) {}
			if (!text) {
				try {
					text = __suttaPlainFromLiveSelection(sel) || "";
				} catch (err2) {}
			}
			return text;
		}

		function __suttaOnCopy(event) {
			if (event.__suttaPlainCopySeen) return;
			event.__suttaPlainCopySeen = true;

			var sel = window.getSelection && window.getSelection();
			var active = null;
			try {
				active = document.activeElement;
			} catch (activeErr) {}

			try {
				if (__suttaIsFormControl(event.target) || __suttaIsFormControl(active)) {
					return;
				}
				if (!sel || !sel.rangeCount || sel.isCollapsed) return;
				if (!__suttaIsDiscourseCopy(sel, event.target)) return;

				var text = __suttaExtractSelectionPlain(sel, event);
				if (!text) return;
				__suttaWritePlainClipboard(event, text);
			} catch (handlerErr) {}
		}

		try {
			document.addEventListener("copy", __suttaOnCopy, __suttaCopyCapture);
		} catch (bindDoc) {}
		try {
			window.addEventListener("copy", __suttaOnCopy, __suttaCopyCapture);
		} catch (bindWin) {}
	} catch (err) {}
})();
