import { describe, expect, it } from "vitest";
import { cleanPaliWordForLookup } from "./cleanPaliWord";

describe("cleanPaliWordForLookup", () => {
	it("lowercases and strips common punctuation", () => {
		expect(cleanPaliWordForLookup("Bhikkhu,")).toBe("bhikkhu");
		expect(cleanPaliWordForLookup("(evaṃ)")).toBe("evaṃ");
		expect(cleanPaliWordForLookup("sakkāya—")).toBe("sakkāya");
		expect(cleanPaliWordForLookup("dhammo.")).toBe("dhammo");
	});

	it("strips curly quotes", () => {
		expect(cleanPaliWordForLookup("‘hoti’")).toBe("hoti");
		expect(cleanPaliWordForLookup("“dhamma”")).toBe("dhamma");
	});
});
