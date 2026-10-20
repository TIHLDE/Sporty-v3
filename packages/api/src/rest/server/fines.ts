// Bøter fra to kilder: tihlde.org (Photon) for lag derfra, og Sporty sitt eget botsystem for
// grupper laget i Sporty. Rutene spør her om hvilken kilde som gjelder. Kun serverkode.

import type * as Dto from "../types";
import { toUser } from "./dto";
import { HttpError, getRole, isManager } from "./http";
import {
	type PhotonFine,
	type PhotonLaw,
	listPhotonLaws,
	photonFineImageUrl,
} from "./photon";
import { prisma } from "./prisma";

/** Gruppen bøtene hører til. Bøter gjelder alltid hovedgruppen, også fra en undergruppe. */
export async function getFinesGroup(groupId: string) {
	const group = await prisma.group.findUnique({ where: { id: groupId } });
	if (!group) throw new HttpError(404, "Fant ikke gruppen");
	if (!group.parentId) return group;
	return prisma.group.findUniqueOrThrow({ where: { id: group.parentId } });
}

type FinesGroup = Awaited<ReturnType<typeof getFinesGroup>>;

/** Lag fra tihlde.org: der er tihlde.org kilden for bøtene. */
export function isTihldeFines(
	group: FinesGroup,
): group is FinesGroup & { photonSlug: string } {
	return group.photonSlug !== null;
}

/** Hva brukeren kan gjøre med bøtene i gruppen (se GroupFinesInfo). */
export async function getFinesInfo(
	userId: string,
	groupId: string,
): Promise<Dto.GroupFinesInfo> {
	const group = await getFinesGroup(groupId);
	const role = await getRole(userId, group.id);
	if (!isTihldeFines(group)) {
		return {
			source: "sporty",
			activated: true,
			canGive: isManager(role),
			canSettle: false,
		};
	}
	const user = await prisma.person.findUnique({
		where: { id: userId },
		select: { photonId: true },
	});
	const activated = group.photonFinesActivated;
	return {
		source: "tihlde",
		activated,
		// På tihlde.org kan alle medlemmer gi bot. Den venter på godkjenning.
		canGive: activated && role !== null,
		// Botsjefen og lederne (som blir admin her). tihlde.org avgjør likevel selv ved hvert kall.
		canSettle:
			activated &&
			(role === "admin" ||
				(user?.photonId != null && user.photonId === group.photonFinesAdminId)),
	};
}

/** Krever at brukeren kan gi bøter i gruppen, og returnerer hovedgruppen. */
export async function requireCanGiveFines(userId: string, groupId: string) {
	const info = await getFinesInfo(userId, groupId);
	if (info.source === "tihlde" && !info.activated) {
		throw new HttpError(400, "Bøter er ikke slått på for laget på tihlde.org");
	}
	if (!info.canGive) {
		throw new HttpError(
			403,
			info.source === "tihlde"
				? "Du er ikke medlem av laget"
				: "Krever sub-/admin i gruppen",
		);
	}
	return getFinesGroup(groupId);
}

export function toLawFromPhoton(law: PhotonLaw, groupId: string): Dto.Law {
	return {
		id: law.id,
		groupId,
		paragraph: law.paragraph,
		title: law.title,
		description: law.description,
		defaultCount: law.amount || null,
	};
}

/** Lovverket til gruppen: fra tihlde.org for lag derfra, ellers Sporty sine botregler. */
export async function getLaws(
	groupId: string,
	/** Henter Photon-tokenet. Kalles bare for lag fra tihlde.org: Sporty-grupper trenger det ikke. */
	accessToken: () => Promise<string>,
): Promise<Dto.Law[]> {
	const group = await getFinesGroup(groupId);
	if (isTihldeFines(group)) {
		const laws = await listPhotonLaws(await accessToken(), group.photonSlug);
		return laws.map((law) => toLawFromPhoton(law, group.id));
	}
	const laws = await prisma.law.findMany({
		where: { groupId: group.id },
		orderBy: { paragraph: "asc" },
	});
	return laws.map((law) => ({ ...law, defaultCount: null }));
}

/**
 * Gjør bøter fra tihlde.org om til samme form som Sporty sine. Personene slås opp i Sporty via
 * Photon-id-en, så navnet og avataren er de samme som ellers i appen.
 */
export async function toFinesFromPhoton(
	fines: PhotonFine[],
	group: { id: string; photonSlug: string },
): Promise<Dto.Fine[]> {
	const photonIds = [...new Set(fines.map((f) => f.userId))];
	const users = await prisma.person.findMany({
		where: { photonId: { in: photonIds } },
		select: {
			id: true,
			name: true,
			email: true,
			imageUrl: true,
			photonId: true,
		},
	});
	const byPhotonId = new Map(users.map((u) => [u.photonId!, u]));

	return fines.map((fine) => {
		const user = byPhotonId.get(fine.userId);
		return {
			id: fine.id,
			groupId: group.id,
			source: "tihlde",
			status: fine.status,
			law: fine.law
				? { paragraph: fine.law.paragraph, title: fine.law.title }
				: null,
			user: user
				? toUser(user)
				: {
						id: `photon:${fine.userId}`,
						name: fine.user.name,
						email: null,
						imageUrl: null,
					},
			givenByName: fine.createdByUser?.name ?? "tihlde.org",
			reason: fine.reason,
			count: fine.amount,
			imageUrl: fine.image
				? photonFineImageUrl(group.photonSlug, fine.id)
				: null,
			defense: fine.defense ?? null,
			paid: fine.status === "paid",
			collective: false,
			createdAt: fine.createdAt,
		};
	});
}

/**
 * Reserverer en «Gi bot»-innsending. Gir false hvis den allerede er utført (eller pågår), så
 * bøtene ikke gis to ganger. Databasen avgjør, så det gjelder også når to like forespørsler
 * kommer samtidig.
 */
export async function claimFineRequest(requestId: string, userId: string) {
	if (!requestId || requestId.length > 100)
		throw new HttpError(400, "Mangler requestId");
	try {
		await prisma.fineRequest.create({ data: { id: requestId, userId } });
		return true;
	} catch (error) {
		if ((error as { code?: string })?.code === "P2002") return false;
		throw error;
	}
}

/** Slipper reservasjonen når ingen bøter ble gitt, så innsendingen kan prøves igjen. */
export async function releaseFineRequest(requestId: string) {
	await prisma.fineRequest.deleteMany({ where: { id: requestId } });
}

/** Navnene til dem som er inaktive i noen av gruppene. Inaktive medlemmer får ikke bøter. */
export async function inactiveNames(userIds: string[], groupIds: string[]) {
	const inactive = await prisma.membership.findMany({
		where: {
			userId: { in: userIds },
			groupId: { in: groupIds },
			inactiveSince: { not: null },
		},
		select: { userId: true, user: { select: { name: true } } },
	});
	return [...new Map(inactive.map((m) => [m.userId, m.user.name])).values()];
}
