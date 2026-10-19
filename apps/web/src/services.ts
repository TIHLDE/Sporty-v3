import { configureWebAuth } from "@sporty/api/rest/index";
import { createAuth } from "@sporty/auth";
import { getDb } from "@sporty/db";

import { ENV } from "./env.server";

export const db = getDb(ENV);
export const auth = createAuth(ENV, db);

// One refresh at a time per user: Photon rotates refresh tokens, so two
// parallel refreshes with the same token would make the second one fail.
const pendingPhotonTokens = new Map<string, Promise<string | null>>();

async function fetchPhotonAccessToken(userId: string): Promise<string | null> {
	const account = await db.account.findFirst({
		where: { userId, providerId: "photon" },
		select: { id: true },
	});
	if (!account) return null;
	try {
		// Refreshes (and stores) the token first if it has expired.
		const { accessToken } = await auth.api.getAccessToken({
			body: { accountId: account.id, userId },
		});
		return accessToken ?? null;
	} catch {
		return null;
	}
}

export function getPhotonAccessToken(userId: string) {
	let pending = pendingPhotonTokens.get(userId);
	if (!pending) {
		pending = fetchPhotonAccessToken(userId).finally(() =>
			pendingPhotonTokens.delete(userId),
		);
		pendingPhotonTokens.set(userId, pending);
	}
	return pending;
}

// The app's REST API (/api/*) accepts the website's Better Auth cookie too,
// not only the Photon bearer token the mobile app sends.
configureWebAuth({
	getSession: (request) => auth.api.getSession({ headers: request.headers }),
	getPhotonAccessToken,
	async getPhotonId(userId) {
		const account = await db.account.findFirst({
			where: { userId, providerId: "photon" },
			select: { accountId: true },
		});
		return account?.accountId ?? null;
	},
});
