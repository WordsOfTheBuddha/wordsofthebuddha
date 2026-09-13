/** Auth gate for Deep Research. Unsigned requests must not reach GLM. */

export interface ResearchAuthUser {
	uid?: string | null;
	emailVerified?: boolean;
}

export interface ResearchAuthFailure {
	status: 401;
	code: "research_auth";
	error: string;
}

export function researchAuthFailure(
	user: ResearchAuthUser | null | undefined,
): ResearchAuthFailure | null {
	if (!user?.uid) {
		return {
			status: 401,
			code: "research_auth",
			error: "Sign in to use Research.",
		};
	}
	if (user.emailVerified !== true) {
		return {
			status: 401,
			code: "research_auth",
			error: "Verify your email to use Research.",
		};
	}
	return null;
}
