import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";

// Define the colors available for highlighting.
const COLOR_MAP = {
	yellow: "#FEF08A",
	pink: "#FBCFE8",
	green: "#BBF7D0",
	blue: "#BFDBFE",
};

export default function HighlightLayout({ children }) {
	const router = useRouter();
	const { theme, systemTheme } = useTheme();

	// 1) If on home page "/", skip all highlight logic
	if (router.pathname === "/" || router.pathname === "/index.en") {
		return <>{children}</>;
	}

	// Page-specific key for storing highlights (localStorage)
	const storageKey = `my-highlights-${router.asPath}`;

	// Rangy references
	const rangyRef = useRef(null);
	const highlighterRef = useRef(null);

	// State
	const [rangyLoaded, setRangyLoaded] = useState(false);
	const [menuVisible, setMenuVisible] = useState(false);
	const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
	const [pendingRange, setPendingRange] = useState(null);

	// Track whether the selected text is already highlighted (for showing eraser)
	const [hasHighlightInSelection, setHasHighlightInSelection] = useState(false);

	// We'll use this for outside-click detection
	const menuRef = useRef(null);

	// Determine light/dark theme
	const currentTheme = theme === "system" ? systemTheme : theme;
	const menuBg = currentTheme === "dark" ? "#333" : "#fff";
	const menuBorder = currentTheme === "dark" ? "#555" : "#ccc";

	/**
	 * Dynamically import Rangy, set up highlighter, restore
	 * highlights for this route from localStorage.
	 */
	useEffect(() => {
		if (typeof window === "undefined") return;

		(async () => {
			const rangyCore = await import("rangy");
			await import("rangy/lib/rangy-classapplier");
			await import("rangy/lib/rangy-highlighter");
			await import("rangy/lib/rangy-selectionsaverestore");

			const rangy = rangyCore.default || rangyCore;
			rangy.init();

			const highlighter = rangy.createHighlighter();

			// Create inline-style class appliers for each color
			Object.entries(COLOR_MAP).forEach(([colorName, bgColor]) => {
				const classApplier = rangy.createClassApplier(
					`highlight-${colorName}`,
					{
						elementTagName: "mark",
						elementProperties: {
							style: {
								backgroundColor: bgColor,
							},
						},
					}
				);
				highlighter.addClassApplier(classApplier);
			});

			// Restore existing highlights for this page
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				highlighter.deserialize(saved);
			}

			rangyRef.current = rangy;
			highlighterRef.current = highlighter;
			setRangyLoaded(true);
		})();
	}, [storageKey]);

	/**
	 * On mouse up, check if the user has selected text.
	 * If so, store the range and show the popover.
	 * Also determine if the selection already contains highlights.
	 */
	const handleMouseUp = (e) => {
		if (!rangyLoaded || !rangyRef.current || !highlighterRef.current) return;

		const selection = rangyRef.current.getSelection();
		if (!selection || selection.isCollapsed) {
			return;
		}

		const range = selection.getRangeAt(0);
		if (!range) return;

		// Get highlights in the newly selected range
		const existingHighlights =
			highlighterRef.current.getHighlightsInSelection();
		setHasHighlightInSelection(existingHighlights.length > 0);

		// Position the menu below the cursor
		const x = e.clientX + window.scrollX;
		const y = e.clientY + window.scrollY + 20;
		setMenuPosition({ x, y });

		setPendingRange(range);
		setMenuVisible(true);
	};

	/**
	 * Toggling highlight:
	 * - If the selection is already entirely the same color, remove it.
	 * - Otherwise, remove all highlights in selection, then apply the new color.
	 */
	const applyHighlight = (colorName) => {
		if (!pendingRange || !highlighterRef.current) return;

		const existingHighlights =
			highlighterRef.current.getHighlightsInSelection();
		if (existingHighlights.length) {
			// Check if *every* highlight in selection is the same color:
			const isAllSameColor = existingHighlights.every(
				(h) =>
					h.classApplier &&
					h.classApplier.className === `highlight-${colorName}`
			);
			if (isAllSameColor) {
				// 1) If user re-selects the same color => remove all in selection
				highlighterRef.current.removeHighlights(existingHighlights);
				persistHighlights();
				closeMenu();
				return;
			} else {
				// 2) Remove any existing highlight(s) in selection before applying new color
				highlighterRef.current.removeHighlights(existingHighlights);
			}
		}

		// Now apply the new color highlight
		highlighterRef.current.highlightRanges(`highlight-${colorName}`, [
			pendingRange,
		]);

		// Persist and close
		persistHighlights();
		closeMenu();
	};

	/**
	 * Explicitly "clear highlight" (eraser icon) means remove all
	 * highlights in the current selection, if any.
	 */
	const handleClear = () => {
		if (!pendingRange || !highlighterRef.current) return;

		const existingHighlights =
			highlighterRef.current.getHighlightsInSelection();
		if (existingHighlights.length) {
			highlighterRef.current.removeHighlights(existingHighlights);
			persistHighlights();
		}
		closeMenu();
	};

	/**
	 * Serialize the current highlights into localStorage under `storageKey`.
	 */
	const persistHighlights = () => {
		if (!highlighterRef.current) return;
		const serialized = highlighterRef.current.serialize();
		localStorage.setItem(storageKey, serialized);
	};

	/**
	 * Hide the popover & clear pending selection state.
	 */
	const closeMenu = () => {
		setMenuVisible(false);
		setPendingRange(null);
		setHasHighlightInSelection(false);
	};

	/**
	 * Outside-click detection: if user clicks anywhere not in the menu, close it.
	 */
	useEffect(() => {
		if (!menuVisible) return;

		const handleClickOutside = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target)) {
				closeMenu();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [menuVisible]);

	return (
		<div
			onMouseUp={handleMouseUp}
			style={{ position: "relative", minHeight: "100vh" }}
		>
			{children}

			{menuVisible && (
				<div
					ref={menuRef}
					style={{
						position: "absolute",
						top: menuPosition.y,
						left: menuPosition.x,
						transform: "translate(-50%, 0)",
						backgroundColor: menuBg,
						border: `1px solid ${menuBorder}`,
						borderRadius: "6px",
						boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
						padding: "8px",
						display: "flex",
						gap: 8,
						zIndex: 9999,
					}}
				>
					{/* Color Swatches */}
					{Object.entries(COLOR_MAP).map(([colorName, bgColor]) => (
						<button
							key={colorName}
							onClick={() => applyHighlight(colorName)}
							style={{
								cursor: "pointer",
								backgroundColor: bgColor,
								width: 24,
								height: 24,
								border: "none",
								borderRadius: "50%",
							}}
						/>
					))}

					{/* Show eraser icon if the selection already has a highlight */}
					{hasHighlightInSelection && (
						<button
							onClick={handleClear}
							style={{
								cursor: "pointer",
								backgroundColor: "#999", // neutral gray
								width: 24,
								height: 24,
								border: "none",
								borderRadius: "50%",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
							title="Clear highlight"
						>
							{/* 
                Simple "eraser" icon (inline SVG).
                You can replace with any other eraser/trash icon as desired.
              */}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 32 32"
								width="16" // Adjust size as needed within the 24x24 button
								height="16"
								fill="#fff"
								stroke="#333"
								strokeWidth="0"
							>
								<path
									d="M28.7,8.9l-5.7-5.7c-1.1-1.1-3.1-1.1-4.2,0l-7.1,7.1c0,0,0,0,0,0s0,0,0,0l-7.5,7.5c-1.2,1.2-1.2,3.1,0,4.2l3.8,3.8
        c0.2,0.2,0.4,0.3,0.7,0.3h6.6c0.3,0,0.5-0.1,0.7-0.3l12.7-12.7c0,0,0,0,0,0C29.9,12,29.9,10.1,28.7,8.9z M14.9,24.1H9.2l-3.5-3.5
        c-0.4-0.4-0.4-1,0-1.4l6.8-6.8l7.1,7.1L14.9,24.1z"
								/>
								<path d="M27,28H5c-0.6,0-1,0.4-1,1s0.4,1,1,1h22c0.6,0,1-0.4,1-1S27.6,28,27,28z" />
							</svg>
						</button>
					)}
				</div>
			)}
		</div>
	);
}
