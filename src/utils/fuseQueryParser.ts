export const SEARCH_FIELDS = ['slug', 'title', 'description', 'content'] as const;
type SearchField = typeof SEARCH_FIELDS[number];

interface FieldQuery {
    field: SearchField;
    value: string;
}

interface FuseQueryTerm {
    $or?: Array<Record<SearchField, string>>;
    $and?: Array<Record<SearchField, string> | FuseQueryTerm>;
}

interface ParsedTerm {
    field?: SearchField;
    value: string;
    isOr?: boolean;
    isFieldSpecific?: boolean;
}

interface SimplifiedTerm {
    value: string;
    operator?: '|';  // Add more operators if needed
}

function createFieldQuery(term: string): Record<SearchField, string> {
    // Remove any leftover parentheses
    term = term.replace(/^\(|\)$/g, '').trim();
    return {
        slug: term,
        title: term,
        description: term,
        content: term
    };
}

function createGenericQuery(term: string): Record<SearchField, string> {
    return SEARCH_FIELDS.reduce((acc, field) => {
        acc[field] = term;
        return acc;
    }, {} as Record<SearchField, string>);
}

interface ParseResult {
    terms: ParsedTerm[];
    usedTerms: Set<string>;  // Track terms used in OR operations
}

function parseFieldPattern(term: string): { field?: SearchField; value: string } {
    const fieldMatch = term.match(/^(\w+):(.+)$/);
    if (fieldMatch && SEARCH_FIELDS.includes(fieldMatch[1] as SearchField)) {
        return {
            field: fieldMatch[1] as SearchField,
            value: fieldMatch[2].trim()
        };
    }
    return { value: term };
}

function splitParenthesizedTerms(term: string): string[] {
    // If it's not a parenthesized group, return as is
    if (!term.startsWith('(') || !term.endsWith(')')) {
        return [term];
    }

    // Remove outer parentheses and split by spaces
    const inner = term.slice(1, -1).trim();
    const terms = inner.split(/\s+/);

    // If there's an OR operator, keep as is
    if (terms.some(t => t === '|')) {
        return [term];
    }

    // Otherwise split into individual terms
    return terms;
}

function parseQuery(query: string): ParseResult {
    const terms: string[] = [];
    const usedTerms = new Set<string>();
    let current = '';
    let depth = 0;

    // First split while preserving parentheses groups
    for (let i = 0; i < query.length; i++) {
        const char = query[i];
        if (char === '(' && depth === 0) {
            if (current.trim()) terms.push(current.trim());
            current = '(';
            depth++;
        } else if (char === ')' && depth === 1) {
            current += ')';
            terms.push(current.trim());
            current = '';
            depth--;
        } else if (char === ' ' && depth === 0) {
            if (current.trim()) terms.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) terms.push(current.trim());

    console.log("Initial terms:", terms);

    // Group terms connected by |
    let i = 0;
    const groupedTerms: string[] = [];
    while (i < terms.length) {
        let term = terms[i];

        // Look ahead for OR operators
        if (i + 2 < terms.length && terms[i + 1] === '|') {
            const orTerms = [term];
            console.log("Starting OR group with term:", term);

            // Collect all terms connected by |
            while (i + 2 < terms.length && terms[i + 1] === '|') {
                const nextTerm = terms[i + 2];
                console.log("Adding to OR group:", nextTerm);
                orTerms.push(nextTerm);
                usedTerms.add(term);
                usedTerms.add(nextTerm);
                i += 2;
                term = nextTerm;
            }

            const orGroup = `(${orTerms.join(' | ')})`;
            console.log("Created OR group:", orGroup);
            groupedTerms.push(orGroup);
            continue;
        } else {
            // For non-OR terms, check if it's a parenthesized group
            const splitTerms = splitParenthesizedTerms(term);
            splitTerms.forEach(t => {
                if (!usedTerms.has(t)) {
                    console.log("Adding term:", t);
                    groupedTerms.push(t);
                }
            });
        }
        i++;
    }

    console.log("Final grouped terms:", groupedTerms);

    // Convert to ParsedTerms
    const parsedTerms = groupedTerms.map(term => {
        if (term.startsWith('(')) {
            return { value: term, isOr: true };
        }
        // Parse field specifications for non-OR terms
        const { field, value } = parseFieldPattern(term);
        return {
            field,
            value,
            isFieldSpecific: !!field
        };
    });

    return { terms: parsedTerms, usedTerms };
}

function expandGenericTerm(term: string): Array<Record<string, string>> {
    // Check if term is a negation
    const isNegation = term.startsWith('!');
    const value = isNegation ? term : term;  // Keep ! for Fuse.js to handle
    const fieldQueries = SEARCH_FIELDS.map(field => ({ [field]: value }));

    // For negations, wrap in $and to ensure all fields match the negation
    return isNegation ? [{ $and: fieldQueries }] : fieldQueries;
}

function simplifyGroupedTerms(terms: string[]): string[] {
    return terms.map(term => {
        // Handle double negation in field-specific terms
        const fieldMatch = term.match(/^(\w+):!!(.+)$/);
        if (fieldMatch && SEARCH_FIELDS.includes(fieldMatch[1] as SearchField)) {
            return `${fieldMatch[1]}:${fieldMatch[2]}`;
        }

        // Handle regular double negation
        if (term.startsWith('!!')) {
            return term.slice(2);
        }
        return term;
    });
}

function simplifyQuery(query: string): string {
    // First handle terms in parentheses
    let simplified = query.replace(/\(([^)]+)\)/g, (match, group) => {
        const innerTerms = group.split(/\s+/);
        const simplifiedInner = simplifyGroupedTerms(innerTerms).join(' ');
        return `(${simplifiedInner})`;
    });

    // Then handle remaining terms
    const terms = simplified.split(/\s+/);
    simplified = simplifyGroupedTerms(terms).join(' ');

    console.log("Simplified query:", simplified);
    return simplified;
}

export function buildFuseQuery(rawQuery: string): FuseQueryTerm {
    // Phase 1: Query Simplification
    const query = simplifyQuery(rawQuery);
    console.log("After simplification:", query);

    // Phase 2: Query Transformation
    const { terms: parsedTerms } = parseQuery(query);
    const andTerms: Array<Record<string, string> | FuseQueryTerm> = [];

    parsedTerms.forEach(term => {
        if (term.isOr) {
            // Handle OR groups
            const orTerms = term.value
                .replace(/^\(|\)$/g, '')
                .split('|')
                .map(t => t.trim())
                .filter(Boolean);

            const orGroup: FuseQueryTerm = {
                $or: orTerms.flatMap(orTerm => {
                    const { field, value } = parseFieldPattern(orTerm);
                    return field
                        ? [{ [field]: value }]
                        : expandGenericTerm(value);
                })
            };
            andTerms.push(orGroup);
        } else if (term.isFieldSpecific && term.field) {
            // Handle field-specific terms (no need to wrap negations in AND as they're single field)
            andTerms.push({ [term.field]: term.value });
        } else {
            // Handle generic terms, using expandGenericTerm to handle negations
            const expanded = expandGenericTerm(term.value);
            andTerms.push(expanded.length === 1 ? expanded[0] : { $or: expanded });
        }
    });

    return { $and: andTerms };
}

// Update test function to show both phases
export function testQueries() {
    const tests = [
        "!!evil",  // Double negation -> evil
        "!defilement",  // Keep single negation
        "(!defilement | !jhana)",  // Preserve negations in OR groups
        "(title:!!mind | description:noble)",  // Field-specific double negation
        "title:'consciousness description:danger slug:^AN | slug:^MN",
        "title:mind | title:consciousness description:noble",
        "title:'consciousness | title:mind slug:^AN description:noble",
        "title:mind | title:consciousness | title:wisdom description:noble",  // Test with multiple OR terms
        "title:'consciousness description:danger",  // Test field-specific terms
        "title:'consciousness description:danger content:'nibbana",  // Test multiple field-specific terms
        "title:'harm | noble (slug:^AN | slug:^MN)",
        "title:'danger | noble harm",
        "(slug:^AN slug:^MN)", // Test parenthesized group without OR
        "(title:noble description:path)", // Test multiple field-specific terms in parentheses
    ];

    tests.forEach(query => {
        console.log('\nOriginal:', query);
        console.log('Simplified:', simplifyQuery(query));
        console.log('Final Query:', JSON.stringify(buildFuseQuery(query), null, 2));
        console.log('---');
    });
}
