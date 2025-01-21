declare module 'rangy' {
    const rangy: RangyStatic;
    export default rangy;
}

declare module 'rangy/lib/rangy-classapplier' {
    const _exports: any;
    export = _exports;
}

declare module 'rangy/lib/rangy-highlighter' {
    const _exports: any;
    export = _exports;
}

declare module 'rangy/lib/rangy-selectionsaverestore' {
    const _exports: any;
    export = _exports;
}

interface RangyStatic {
    init(): void;
    createHighlighter(): Highlighter;
    getSelection(): Selection;
    createClassApplier(
        className: string,
        options: {
            elementTagName: string;
            elementProperties: {
                style: {
                    [key: string]: any;
                };
            };
            splitOnGet?: boolean;
            normalize?: boolean;
            splitExisting?: boolean;
        }
    ): ClassApplier;
    // Add other methods as needed
}

interface Highlighter {
    addClassApplier: (applier: ClassApplier) => void;
    highlightSelection: (className: string, options?: any) => void;
    removeHighlights: (highlights: any[]) => void;
    serialize: () => string;
    deserialize: (data: string) => void;
    highlights: any[]; // This is the correct property name
    getHighlightsInSelection: (selection: RangySelection) => any[];
}

interface Highlight {
    classApplier: ClassApplier;
}

interface ClassApplier {
    className: string;
}

interface RangySelection {
    nativeSelection: Selection;
    getRangeAt: (index: number) => RangyRange;
    isCollapsed: boolean;
    rangeCount: number;
}

interface RangyRange {
    nativeRange: Range;
}