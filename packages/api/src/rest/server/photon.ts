// Innlogging med TIHLDE og kall mot Photon (tihlde.org sitt API). Kun serverkode.

import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

import { HttpError } from "./http-error";
import { shared } from "./shared";

/** Photon sin OIDC-utsteder. Samme standardverdi som i appen (src/lib/auth/photon.ts). */
export const PHOTON_ISSUER =
	process.env.PHOTON_ISSUER ?? "https://photon.tihlde.org/api/auth";

export interface PhotonUser {
	/** Den faste id-en til TIHLDE-kontoen. */
	sub: string;
	name: string;
	email: string;
	/** Profilbildet (OIDC-claimet `picture`), om Photon sender det. */
	picture: string | null;
}

/**
 * Mobilappens klient på tihlde.org (Sporty Native). Bearer-tokens laget for andre klienter godtas
 * ikke. Nettsiden bruker cookie og sin egen klient (PHOTON_CLIENT_ID), ikke Bearer-tokens.
 */
const CLIENT_ID = process.env.PHOTON_APP_CLIENT_ID ?? "";

/** Photon sine offentlige nøkler. jose henter dem én gang og husker dem (og henter nye ved behov). */
const jwks = shared("photon-jwks", () =>
	createRemoteJWKSet(new URL(`${PHOTON_ISSUER}/jwks`)),
);

/**
 * Hvem tokenet tilhører, sjekket lokalt: signaturen mot Photon sine nøkler, utsteder og utløp.
 * Krever ingen kall til tihlde.org (bortsett fra nøklene). Gir null hvis tokenet ikke kan sjekkes
 * her (opakt, utløpt eller ukjent nøkkel), så kalleren spør userinfo, som har siste ord.
 *
 * Et gyldig token laget for en annen app på tihlde.org avvises med en gang: userinfo ville godtatt
 * det, siden den ikke ser hvilken klient tokenet er laget for.
 */
export async function verifyPhotonToken(
	accessToken: string,
): Promise<string | null> {
	if (accessToken.split(".").length !== 3) return null;
	let payload;
	try {
		({ payload } = await jwtVerify(accessToken, jwks, {
			issuer: PHOTON_ISSUER,
		}));
	} catch {
		return null;
	}
	const client = payload.azp ?? payload.client_id;
	if (CLIENT_ID && typeof client === "string" && client !== CLIENT_ID) {
		throw new HttpError(401, "Innloggingen er ikke laget for Sporty");
	}
	return payload.sub ?? null;
}

/**
 * Svar fra userinfo, per token, delt mellom alle rutene. Huskes til tokenet utløper (maks en
 * time), så hvert token koster høyst ett kall.
 */
const MAX_CACHE_MS = 60 * 60_000;
const MAX_CACHED = 1000;
const cache = shared(
	"photon-userinfo",
	() => new Map<string, { user: PhotonUser; expiresAt: number }>(),
);

/** Når tokenet utløper, lest fra JWT-en uten å sjekke den (bare for hvor lenge vi husker svaret). */
function tokenExpiresAt(accessToken: string) {
	try {
		const exp = decodeJwt(accessToken).exp;
		if (exp) return Math.min(exp * 1000, Date.now() + MAX_CACHE_MS);
	} catch {
		// Opakt token: bruk standardtiden.
	}
	return Date.now() + 5 * 60_000;
}

/**
 * Hvem tokenet tilhører, med navn og e-post, ifølge Photon sin userinfo. Brukes første gang
 * noen logger inn, og når tokenet ikke kan sjekkes lokalt.
 */
export async function getPhotonUser(accessToken: string): Promise<PhotonUser> {
	const cached = cache.get(accessToken);
	if (cached && cached.expiresAt > Date.now()) return cached.user;

	let response: Response;
	try {
		response = await fetch(`${PHOTON_ISSUER}/oauth2/userinfo`, {
			headers: { authorization: `Bearer ${accessToken}` },
		});
	} catch {
		throw new HttpError(503, "Får ikke kontakt med TIHLDE-innloggingen");
	}
	// Photon svarer 400 eller 401 på et utløpt eller ugyldig token.
	if (response.status === 400 || response.status === 401) {
		throw new HttpError(401, "Innloggingen har utløpt");
	}
	if (response.status === 429) {
		throw new HttpError(
			503,
			"TIHLDE-innloggingen er overbelastet. Prøv igjen om litt",
		);
	}
	if (!response.ok) {
		throw new HttpError(
			503,
			`TIHLDE-innloggingen svarer ikke (${response.status})`,
		);
	}

	const data = (await response.json()) as Partial<PhotonUser> & {
		preferred_username?: string;
	};
	if (!data.sub || !data.email)
		throw new HttpError(401, "Mangler brukerinfo fra TIHLDE");
	const user: PhotonUser = {
		sub: data.sub,
		email: data.email.toLowerCase(),
		name: data.name || data.preferred_username || data.email,
		picture: data.picture || null,
	};

	if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
	cache.set(accessToken, { user, expiresAt: tokenExpiresAt(accessToken) });
	return user;
}

/** Photon sitt API (der `groups/mine` ligger), utledet fra utstederen: …/api/auth → …/api. */
const PHOTON_API_URL = PHOTON_ISSUER.replace(/\/auth\/?$/, "");

/** En gruppe på tihlde.org som brukeren er med i, slik `GET /api/groups/mine` gir den. */
export interface PhotonGroup {
	slug: string;
	name: string;
	description: string | null;
	type: string;
	subtype: string | null;
	archivedAt: string | null;
	/** Logoen (offentlig lenke), eller null. */
	logoUrl: string | null;
	finesActivated: boolean;
	/** Botsjefen (Photon-id), eller null. */
	finesAdminId: string | null;
	membership: { role: "member" | "leader" };
}

/**
 * Gruppene brukeren er med i på tihlde.org. Krever et JWT-token, som appen får fordi den ber om
 * `resource` ved innlogging. Et opakt token gir 401 her selv om userinfo godtok det.
 */
export async function getMyPhotonGroups(
	accessToken: string,
): Promise<PhotonGroup[]> {
	const response = await fetch(`${PHOTON_API_URL}/groups/mine`, {
		headers: { authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok)
		throw new Error(`Photon svarte ${response.status} på groups/mine`);
	return (await response.json()) as PhotonGroup[];
}

/**
 * Idrettsgruppene, i de to kategoriene tihlde.org selv viser: «Idrettslag (IdKom)» (type
 * SPORTSTEAM) og «Interessegrupper – Idrettsgrupper» (INTERESTGROUP med subtype IDRETTSGRUPPE).
 * Photon ber om at typene sammenlignes uten hensyn til store og små bokstaver.
 */
export function isSportsGroup(
	group: Pick<PhotonGroup, "type" | "subtype" | "archivedAt">,
) {
	if (group.archivedAt) return false;
	const type = group.type.toUpperCase();
	return (
		type === "SPORTSTEAM" ||
		(type === "INTERESTGROUP" &&
			group.subtype?.toUpperCase() === "IDRETTSGRUPPE")
	);
}

/** Et medlem i en gruppe på tihlde.org, slik `GET /api/groups/:slug/members` gir det. */
export interface PhotonMember {
	/** Samme id som `sub` ved innlogging. */
	userId: string;
	role: string;
	/**
	 * `image` er profilbildet: det som er lastet opp på tihlde.org, ellers det fra Feide. Opplastede
	 * bilder er private og krever innlogging for å hentes.
	 */
	user: { id: string; name: string; image: string | null };
}

/** Hele medlemslisten til en gruppe. Synlig for medlemmer av gruppen. Har ikke e-post. */
export async function getPhotonGroupMembers(
	accessToken: string,
	slug: string,
): Promise<PhotonMember[]> {
	const response = await fetch(
		`${PHOTON_API_URL}/groups/${encodeURIComponent(slug)}/members`,
		{
			headers: { authorization: `Bearer ${accessToken}` },
		},
	);
	if (!response.ok)
		throw new Error(`Photon svarte ${response.status} på members for ${slug}`);
	return (await response.json()) as PhotonMember[];
}

/**
 * Kall mot Photon sitt API som den innloggede brukeren, så Photon sine egne tilgangsregler
 * gjelder. Feil fra Photon sendes videre til appen med Photon sin melding.
 */
async function photonRequest<T>(
	accessToken: string,
	path: string,
	init: {
		method?: "GET" | "POST" | "PATCH";
		body?: unknown;
		query?: Record<string, string>;
	} = {},
): Promise<T> {
	const url = new URL(`${PHOTON_API_URL}/${path}`);
	for (const [key, value] of Object.entries(init.query ?? {}))
		url.searchParams.set(key, value);
	let response: Response;
	try {
		response = await fetch(url, {
			method: init.method ?? "GET",
			headers: {
				authorization: `Bearer ${accessToken}`,
				...(init.body !== undefined
					? { "content-type": "application/json" }
					: {}),
			},
			body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
		});
	} catch {
		throw new HttpError(503, "Får ikke kontakt med tihlde.org");
	}
	if (!response.ok) {
		const data = (await response.json().catch(() => null)) as {
			message?: string;
		} | null;
		if (response.status === 429) {
			throw new HttpError(
				503,
				"tihlde.org får for mange forespørsler. Prøv igjen om litt",
			);
		}
		const status =
			response.status === 401
				? 401
				: response.status >= 500
					? 502
					: response.status;
		throw new HttpError(
			status,
			data?.message ?? `tihlde.org svarte ${response.status}`,
		);
	}
	return (await response.json()) as T;
}

export type PhotonFineStatus = "pending" | "approved" | "paid" | "rejected";

/** En bot på tihlde.org, slik Photon gir den. `amount` er antall bøter. */
export interface PhotonFine {
	id: string;
	userId: string;
	reason: string;
	amount: number;
	status: PhotonFineStatus;
	/** Settes av den som fikk boten. */
	defense: string | null;
	/** Bare et tegn på at boten har bilde. Selve bildet hentes med photonFineImageUrl. */
	image: string | null;
	createdAt: string;
	user: { id: string; name: string };
	createdByUser: { id: string; name: string } | null;
	law: { id: string; paragraph: string; title: string } | null;
}

/** En paragraf i lagets lovverk på tihlde.org. `amount` er foreslått antall bøter. */
export interface PhotonLaw {
	id: string;
	paragraph: string;
	title: string;
	description: string;
	amount: number;
}

/** Én side med bøter, nyeste først. Med `userId` bare den brukerens. Photon teller sider fra 0. */
export async function listPhotonFinesPage(
	accessToken: string,
	slug: string,
	options: { page: number; pageSize: number; userId?: string },
) {
	const result = await photonRequest<{
		fines: PhotonFine[];
		nextPage: number | null;
	}>(accessToken, `groups/${encodeURIComponent(slug)}/fines`, {
		query: {
			page: String(options.page),
			pageSize: String(options.pageSize),
			...(options.userId ? { userId: options.userId } : {}),
		},
	});
	return { fines: result.fines, nextPage: result.nextPage };
}

/** Høyst så mange bøter hentes når alle trengs (én brukers bøter på profilen). */
const MAX_FINES = 500;

/** Alle bøtene (opptil MAX_FINES), nyeste først. Med `userId` bare den brukerens. */
export async function listPhotonFines(
	accessToken: string,
	slug: string,
	options: { userId?: string } = {},
) {
	const fines: PhotonFine[] = [];
	let page: number | null = 0;
	while (page !== null && fines.length < MAX_FINES) {
		const result = await listPhotonFinesPage(accessToken, slug, {
			...options,
			page,
			pageSize: 100,
		});
		fines.push(...result.fines);
		page = result.nextPage;
	}
	return fines;
}

/**
 * Bilder på tihlde.org sitt eget lager (`…/api/assets/…`). Profilbilder der er private: de hentes
 * med tokenet, og bare dit skal tokenet sendes. Andre lenker er eksterne bilder.
 */
export function isPhotonAsset(url: string) {
	return url.startsWith(`${PHOTON_API_URL}/assets/`);
}

/** Én bot, med forsvar og om den har bilde. */
export function getPhotonFine(
	accessToken: string,
	slug: string,
	fineId: string,
) {
	return photonRequest<PhotonFine>(
		accessToken,
		`groups/${encodeURIComponent(slug)}/fines/${encodeURIComponent(fineId)}`,
	);
}

/**
 * Bildet til en bot. Det er privat: appen henter det med det samme tokenet som ellers, og Photon
 * sjekker at brukeren får se boten.
 */
export function photonFineImageUrl(slug: string, fineId: string) {
	return `${PHOTON_API_URL}/groups/${encodeURIComponent(slug)}/fines/${encodeURIComponent(fineId)}/image`;
}

/** Summen av bøter per status i gruppen. Avviste er ikke med. */
export function getPhotonFineStatistics(accessToken: string, slug: string) {
	return photonRequest<{
		notApproved: number;
		approvedNotPaid: number;
		paid: number;
	}>(accessToken, `groups/${encodeURIComponent(slug)}/fines/statistics`);
}

export function listPhotonLaws(accessToken: string, slug: string) {
	return photonRequest<PhotonLaw[]>(
		accessToken,
		`groups/${encodeURIComponent(slug)}/laws`,
	);
}

/** Gir én person en bot. Den venter på godkjenning fra botsjefen eller lederen. */
export function createPhotonFine(
	accessToken: string,
	slug: string,
	fine: { userId: string; reason: string; amount: number; lawId?: string },
) {
	return photonRequest<{ id: string }>(
		accessToken,
		`groups/${encodeURIComponent(slug)}/fines`,
		{
			method: "POST",
			body: { ...fine, groupSlug: slug },
		},
	);
}

/** Godkjenn, marker som betalt eller avvis. Bare botsjefen og lederen har lov. */
export function updatePhotonFineStatus(
	accessToken: string,
	slug: string,
	fineId: string,
	status: PhotonFineStatus,
) {
	return photonRequest(
		accessToken,
		`groups/${encodeURIComponent(slug)}/fines/${encodeURIComponent(fineId)}`,
		{ method: "PATCH", body: { status } },
	);
}
