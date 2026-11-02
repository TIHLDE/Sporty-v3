// Felles hjelpere for API-rutene. Kun serverkode.

import type { Role } from "../types";
import { HttpError } from "./http-error";
import { type PhotonUser, getPhotonUser, verifyPhotonToken } from "./photon";
import { prisma } from "./prisma";
import { shared } from "./shared";

export { HttpError };

/**
 * Innloggingen på nettsiden (Better Auth). Settes opp av apps/web ved oppstart med
 * configureWebAuth, så API-et også godtar nettsidens cookie, ikke bare Photon-tokenet fra appen.
 */
export interface WebAuth {
	/** Den som er logget inn på nettsiden (cookie), eller null. */
	getSession(
		request: Request,
	): Promise<{ user: { id: string; name: string; email: string } } | null>;
	/** Photon-tokenet til en som er logget inn på nettsiden. Better Auth fornyer det ved behov. */
	getPhotonAccessToken(userId: string): Promise<string | null>;
	/** TIHLDE-kontoen (Photon `sub`) til en som er logget inn på nettsiden. */
	getPhotonId(userId: string): Promise<string | null>;
}

const webAuth = shared<{ current: WebAuth | null }>("web-auth", () => ({
	current: null,
}));

export function configureWebAuth(auth: WebAuth) {
	webAuth.current = auth;
}

/** Nettsidens sesjon for forespørselen, hentet én gang per forespørsel. */
const sessions = new WeakMap<Request, ReturnType<WebAuth["getSession"]>>();
function webSession(request: Request) {
	if (!webAuth.current) return Promise.resolve(null);
	let session = sessions.get(request);
	if (!session) {
		session = webAuth.current.getSession(request);
		sessions.set(request, session);
	}
	return session;
}

function bearerToken(request: Request) {
	return (
		request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? null
	);
}

/**
 * Hvem som gjør forespørselen (id-en til Person). Appen sender access tokenet fra «Logg inn med
 * TIHLDE» som `Authorization: Bearer …`, nettsiden har Better Auth sin cookie. Alle API-ruter
 * (unntatt opplastede filer og helsesjekk) krever det ene eller det andre.
 *
 * Kun i utvikling: med ALLOW_DEV_USER_SWITCH=true kan en innlogget bruker opptre som en annen
 * bruker med `x-act-as` (Profil → Utvikling → Bytt bruker), for å teste ulike roller.
 */
export async function getUserId(request: Request) {
	const userId = await resolveRequestPerson(request);

	const actAs = request.headers.get("x-act-as");
	if (
		actAs &&
		actAs !== userId &&
		process.env.ALLOW_DEV_USER_SWITCH === "true"
	) {
		const exists = await prisma.person.count({ where: { id: actAs } });
		if (!exists) throw new HttpError(401, "Ukjent bruker");
		return actAs;
	}
	return userId;
}

async function resolveRequestPerson(request: Request) {
	const token = bearerToken(request);
	if (token) return resolveUserId(token);
	const session = await webSession(request);
	if (session) return resolveWebPerson(session.user);
	throw new HttpError(401, "Du må være logget inn");
}

/**
 * Photon-tokenet til den som gjør forespørselen, for kall mot tihlde.org (synk, bøter): fra
 * `Authorization`-headeren i appen, eller fra Better Auth for nettsiden.
 */
export async function getAccessToken(request: Request) {
	const token = bearerToken(request);
	if (token) return token;
	const session = await webSession(request);
	if (session && webAuth.current) {
		const photonToken = await webAuth.current.getPhotonAccessToken(
			session.user.id,
		);
		if (photonToken) return photonToken;
		throw new HttpError(401, "Logg inn med TIHLDE på nytt");
	}
	throw new HttpError(401, "Du må være logget inn");
}

/**
 * Personen til den som er logget inn på nettsiden. Første gang kobles innloggingen til personen
 * med samme TIHLDE-konto (fra appen eller en medlemsliste), ellers samme e-post, ellers lages en ny.
 */
async function resolveWebPerson(user: {
	id: string;
	name: string;
	email: string;
}) {
	const linked = await prisma.person.findUnique({
		where: { userId: user.id },
		select: { id: true },
	});
	if (linked) return linked.id;

	const email = user.email.toLowerCase();
	const photonId = (await webAuth.current?.getPhotonId(user.id)) ?? null;
	const existing =
		(photonId
			? await prisma.person.findUnique({ where: { photonId } })
			: null) ?? (await prisma.person.findUnique({ where: { email } }));
	if (existing) {
		const emailTaken =
			!existing.email &&
			(await prisma.person.count({
				where: { email, id: { not: existing.id } },
			})) > 0;
		await prisma.person.update({
			where: { id: existing.id },
			data: {
				userId: user.id,
				photonId: existing.photonId ?? photonId,
				...(existing.email || emailTaken ? {} : { email }),
			},
		});
		return existing.id;
	}
	const created = await prisma.person.create({
		data: { name: user.name, email, photonId, userId: user.id },
	});
	return created.id;
}

/**
 * Brukeren tokenet tilhører. Vanligvis sjekkes tokenet lokalt, uten kall til tihlde.org. Bare
 * første gang noen logger inn (eller når tokenet ikke kan sjekkes lokalt) spørres tihlde.org om
 * navn og e-post. Navn holdes ellers oppdatert av synken med tihlde.org.
 */
async function resolveUserId(token: string) {
	const sub = await verifyPhotonToken(token);
	if (sub) {
		const user = await prisma.person.findUnique({
			where: { photonId: sub },
			select: { id: true, email: true },
		});
		// Uten e-post er brukeren bare hentet fra en medlemsliste og har ikke logget inn før.
		if (user?.email) return user.id;
	}
	return findOrCreateUser(await getPhotonUser(token));
}

/**
 * Brukeren i Sporty for en TIHLDE-konto. Første gang kobles kontoen til en eksisterende bruker
 * med samme e-post, eller det lages en ny. Navn og e-post holdes oppdatert fra TIHLDE.
 */
async function findOrCreateUser(photonUser: PhotonUser) {
	const data = {
		name: photonUser.name,
		email: photonUser.email,
		photonId: photonUser.sub,
	};
	// Finnes også når brukeren er hentet fra en medlemsliste før hen logget inn selv.
	const linked = await prisma.person.findUnique({
		where: { photonId: photonUser.sub },
	});
	if (linked) {
		if (!linked.imageUrl && photonUser.picture) {
			await prisma.person.update({
				where: { id: linked.id },
				data: { imageUrl: photonUser.picture },
			});
		}
		if (linked.name !== data.name || linked.email !== data.email) {
			// E-posten kan allerede tilhøre en annen bruker (f.eks. i seed-dataene). Da beholdes den
			// gamle, i stedet for at innloggingen feiler.
			const emailTaken = await prisma.person.count({
				where: { email: data.email, id: { not: linked.id } },
			});
			await prisma.person.update({
				where: { id: linked.id },
				data: emailTaken ? { name: data.name } : data,
			});
		}
		return linked.id;
	}
	const user = await prisma.person.upsert({
		where: { email: photonUser.email },
		create: { ...data, imageUrl: photonUser.picture },
		update: { photonId: photonUser.sub, name: photonUser.name },
	});
	return user.id;
}

export async function getRole(
	userId: string,
	groupId: string,
): Promise<Role | null> {
	const membership = await prisma.membership.findUnique({
		where: { userId_groupId: { userId, groupId } },
	});
	return membership?.role ?? null;
}

/** Admin, eller Index som har samme tilgang. */
export const isAdmin = (role: Role | null) =>
	role === "admin" || role === "index";

export const isManager = (role: Role | null) =>
	role === "admin" || role === "subadmin" || role === "index";

/**
 * Botroller: botsjef (i hovedgruppen) og rollene over har bot-rydderrettigheter: snitches,
 * godkjenne/avvise bøter osv. Ikke samme som isManager (arrangementer, innstillinger, betalinger).
 */
export const isFineManager = (role: Role | null) =>
	isAdmin(role) || role === "subadmin";

/** Sub-/admin og botsjef kan gi fellesbot. Rollen gjelder i hovedgruppen, der bøtene hører til. */
export const canGiveCollectiveFine = (role: Role | null) =>
	isManager(role) || role === "botsjef";

export async function requireMember(userId: string, groupId: string) {
	const role = await getRole(userId, groupId);
	if (!role) throw new HttpError(403, "Du er ikke medlem av gruppen");
	return role;
}

/** Lesetilgang: medlem av gruppen, eller av hovedgruppen hvis det er en undergruppe. */
export async function requireAccess(userId: string, groupId: string) {
	const group = await prisma.group.findUnique({
		where: { id: groupId },
		select: { parentId: true },
	});
	if (!group) throw new HttpError(404, "Fant ikke gruppen");
	const role = await getRole(userId, groupId);
	if (!role && !(group.parentId && (await getRole(userId, group.parentId)))) {
		throw new HttpError(403, "Du har ikke tilgang til gruppen");
	}
	return { role, parentId: group.parentId };
}

/** Krever sub-/admin eller botsjef i gruppen (hovedgruppen, der bøtene hører til). */
export async function requireCollectiveFineGiver(
	userId: string,
	groupId: string,
) {
	if (!canGiveCollectiveFine(await getRole(userId, groupId)))
		throw new HttpError(403, "Krever sub-/admin eller botsjef i gruppen");
}

export async function requireManager(userId: string, groupId: string) {
	const role = await getRole(userId, groupId);
	if (!isManager(role)) throw new HttpError(403, "Krever sub-/admin i gruppen");
	return role;
}

/** Om brukeren er sub-/admin i gruppen, eller i hovedgruppen hvis det er en undergruppe. */
export async function canManageGroup(userId: string, groupId: string) {
	const group = await prisma.group.findUnique({
		where: { id: groupId },
		select: { parentId: true },
	});
	if (!group) return false;
	if (isManager(await getRole(userId, groupId))) return true;
	return Boolean(
		group.parentId && isManager(await getRole(userId, group.parentId)),
	);
}

/** Sub-/admin i gruppen, eller i hovedgruppen hvis det er en undergruppe. */
export async function requireManagerOrParent(userId: string, groupId: string) {
	const group = await prisma.group.findUnique({
		where: { id: groupId },
		select: { parentId: true },
	});
	if (!group) throw new HttpError(404, "Fant ikke gruppen");
	if (isManager(await getRole(userId, groupId))) return;
	if (group.parentId && isManager(await getRole(userId, group.parentId)))
		return;
	throw new HttpError(403, "Krever sub-/admin i gruppen");
}

/** Admin i gruppen, eller i hovedgruppen hvis det er en undergruppe. Subadmin er ikke nok. */
export async function requireAdminOrParent(userId: string, groupId: string) {
	const group = await prisma.group.findUnique({
		where: { id: groupId },
		select: { parentId: true },
	});
	if (!group) throw new HttpError(404, "Fant ikke gruppen");
	if (isAdmin(await getRole(userId, groupId))) return;
	if (group.parentId && isAdmin(await getRole(userId, group.parentId))) return;
	throw new HttpError(403, "Krever admin i gruppen");
}

/** Pakker inn en API-handler slik at HttpError blir riktig statuskode og alt annet 500. */
export function handler<P extends Record<string, string>>(
	fn: (request: Request, params: P) => Promise<unknown>,
) {
	return async (request: Request, params: P) => {
		try {
			const result = await fn(request, params);
			return result instanceof Response ? result : Response.json(result);
		} catch (error) {
			if (error instanceof HttpError) {
				return Response.json(
					{ error: error.message },
					{ status: error.status },
				);
			}
			console.error(error);
			return Response.json(
				{ error: "Noe gikk galt på serveren" },
				{ status: 500 },
			);
		}
	};
}

export async function readJson<T>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T;
	} catch {
		throw new HttpError(400, "Ugyldig JSON");
	}
}
