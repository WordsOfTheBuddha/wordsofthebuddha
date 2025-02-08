export function calculateMenuPosition(
    menu: HTMLElement,
    finalRect: DOMRect,
    rootElement: HTMLElement
) {
    const containerRect = rootElement.getBoundingClientRect();
    const menuLeft = finalRect.right - containerRect.left + rootElement.scrollLeft + 5;
    const maxLeft = containerRect.width - menu.offsetWidth;
    menu.style.left = `${Math.min(menuLeft, maxLeft)}px`;
    menu.style.top = `${finalRect.bottom - containerRect.top + rootElement.scrollTop}px`;
}

export function getDomPath(element: Element): string {
    const path: number[] = [];
    while (element && element.parentElement) {
        const parent = element.parentElement;
        const index = Array.from(parent.children).indexOf(element);
        path.unshift(index);
        element = parent;
    }
    return path.join("-");
}

export function getContainerIndex(element: Element): string {
    const type = element.tagName.toLowerCase();
    const sameTypeElements = Array.from(document.getElementsByTagName(type));
    return `${type}-${sameTypeElements.indexOf(element)}`;
}

export function scanPageForHighlights(validContainers: string[]): {
    containerIndex: string;
    container: Element;
    order: number;
}[] {
    const root = document.getElementById("highlight-root");
    if (!root) return [];

    const highlightedElements = Array.from(
        root.querySelectorAll('mark[class*="highlight-"]')
    );

    const containers = new Set<Element>();
    highlightedElements.forEach((mark) => {
        for (let el = mark.parentElement; el && el !== root; el = el.parentElement) {
            if (validContainers.includes(el.tagName.toLowerCase())) {
                containers.add(el);
                break;
            }
        }
    });

    const orderedContainers = Array.from(containers);
    orderedContainers.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    return orderedContainers.map((container, index) => ({
        containerIndex: getContainerIndex(container),
        container,
        order: index,
    }));
}
