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
    return SEARCH_FIELDS.map(field => ({ [field]: term }));
}

export function buildFuseQuery(query: string): FuseQueryTerm {
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
            andTerms.push({ [term.field]: term.value });
        } else {
            andTerms.push({ $or: expandGenericTerm(term.value) });
        }
    });

    return { $and: andTerms };
}

// Add test case
export function testQueries() {
    const tests = [
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
        console.log('\nInput:', query);
        console.log('Output:', JSON.stringify(buildFuseQuery(query), null, 2));
        console.log('---');
    });
}
