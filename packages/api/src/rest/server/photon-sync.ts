// Henter idrettslagene brukeren er med i på tihlde.org, med hele medlemslisten, og speiler dem
// som grupper og medlemskap i Sporty. Kjøres når appen henter /me (innlogging og oppstart).
// Kun serverkode.

import { GROUP_COLORS } from "../lib/group-colors";
import { getAccessToken } from "./http";
import { defaultMatchStatTypes } from "./match-facts";
import { removeFromGroup } from "./memberships";
import {
	type PhotonGroup,
	getMyPhotonGroups,
	getPhotonGroupMembers,
	isSportsGroup,
} from "./photon";
import { prisma } from "./prisma";
import { shared } from "./shared";

/** Fargen til en ny gruppe fra tihlde.org, valgt fast ut fra slug-en så den ikke bytter. */
function colorFor(slug: string) {
	let hash = 0;
	for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length] ?? GROUP_COLORS[0]!;
}

/**
 * Medlemslisten til en gruppe hentes maks så ofte. Uten dette ville hver oppstart hos hvert
 * medlem hentet hele lista på nytt. Brukerens eget medlemskap synkes likevel hver gang.
 */
const ROSTER_INTERVAL_MS = 5 * 60_000;
const rosterSyncedAt = shared(
	"roster-synced-at",
	() => new Map<string, number>(),
);

/**
 * Synker brukerens idrettslag fra tihlde.org:
 * - Gruppen lages i Sporty første gang noen fra den logger inn, og navnet holdes oppdatert.
 * - Hele medlemslisten hentes, også de som ikke har logget inn i Sporty ennå (uten e-post).
 * - Leder på tihlde.org blir admin. Vanlige medlemmer beholder rollen de har fått i Sporty
 *   (f.eks. subadmin), og nye medlemmer blir member.
 * - Den som ikke lenger er med i gruppen på tihlde.org, fjernes fra den her også.
 */
export async function syncPhotonGroups(userId: string, accessToken: string) {
	const groups = (await getMyPhotonGroups(accessToken)).filter(isSportsGroup);

	await Promise.all(
		groups.map(async (photonGroup) => {
			const groupId = await upsertGroup(photonGroup);
			await upsertMembership(
				userId,
				groupId,
				photonGroup.membership.role === "leader",
			);

			const last = rosterSyncedAt.get(photonGroup.slug) ?? 0;
			if (Date.now() - last < ROSTER_INTERVAL_MS) return;
			rosterSyncedAt.set(photonGroup.slug, Date.now());
			try {
				await syncRoster(accessToken, photonGroup.slug, groupId);
			} catch (error) {
				// Prøv igjen ved neste oppstart i stedet for å vente ut intervallet.
				rosterSyncedAt.delete(photonGroup.slug);
				throw error;
			}
		}),
	);

	// Brukeren har gått ut av gruppen på tihlde.org: fjern fra den og alt under den. Grupper
	// laget i Sporty røres ikke.
	const left = await prisma.membership.findMany({
		where: {
			userId,
			group: { photonSlug: { not: null, notIn: groups.map((g) => g.slug) } },
		},
		select: { groupId: true },
	});
	for (const { groupId } of left) await removeFromGroup(groupId, [userId]);
}

async function upsertGroup(photonGroup: PhotonGroup) {
	const group = await prisma.group.upsert({
		where: { photonSlug: photonGroup.slug },
		create: {
			photonSlug: photonGroup.slug,
			name: photonGroup.name,
			description: photonGroup.description ?? "",
			color: colorFor(photonGroup.slug),
			photonFinesActivated: photonGroup.finesActivated,
			photonFinesAdminId: photonGroup.finesAdminId,
			logoUrl: photonGroup.logoUrl,
			matchStatTypes: defaultMatchStatTypes,
		},
		update: {
			name: photonGroup.name,
			photonFinesActivated: photonGroup.finesActivated,
			photonFinesAdminId: photonGroup.finesAdminId,
			logoUrl: photonGroup.logoUrl,
		},
	});
	return group.id;
}

async function upsertMembership(
	userId: string,
	groupId: string,
	leader: boolean,
) {
	await prisma.membership.upsert({
		where: { userId_groupId: { userId, groupId } },
		create: { userId, groupId, role: leader ? "admin" : "member" },
		update: leader ? { role: "admin" } : {},
	});
}

/** Gjør medlemmene av gruppen i Sporty like medlemslisten på tihlde.org. */
async function syncRoster(accessToken: string, slug: string, groupId: string) {
	const members = await getPhotonGroupMembers(accessToken, slug);
	const photonIds = members.map((m) => m.userId);

	// Brukere for medlemmer som ikke har logget inn ennå. De kobles til ved første innlogging,
	// fordi id-en her er den samme som `sub` fra innloggingen.
	await prisma.person.createMany({
		data: members.map((m) => ({
			photonId: m.userId,
			name: m.user.name,
			imageUrl: m.user.image || null,
		})),
		skipDuplicates: true,
	});
	const users = await prisma.person.findMany({
		where: { photonId: { in: photonIds } },
		select: { id: true, name: true, imageUrl: true, photonId: true },
	});
	const userIdByPhotonId = new Map(users.map((u) => [u.photonId!, u.id]));

	// Navn og profilbilder som er endret på tihlde.org.
	for (const member of members) {
		const user = users.find((u) => u.photonId === member.userId);
		const imageUrl = member.user.image || null;
		if (
			user &&
			(user.name !== member.user.name || user.imageUrl !== imageUrl)
		) {
			await prisma.person.update({
				where: { id: user.id },
				data: { name: member.user.name, imageUrl },
			});
		}
	}

	await prisma.membership.createMany({
		data: members.map((m) => ({
			userId: userIdByPhotonId.get(m.userId)!,
			groupId,
			role: m.role === "leader" ? ("admin" as const) : ("member" as const),
		})),
		skipDuplicates: true,
	});
	const leaderIds = members
		.filter((m) => m.role === "leader")
		.map((m) => userIdByPhotonId.get(m.userId)!);
	await prisma.membership.updateMany({
		where: { groupId, userId: { in: leaderIds }, role: { not: "admin" } },
		data: { role: "admin" },
	});

	// Ikke lenger med på tihlde.org: fjern fra gruppen og alt under den.
	const gone = await prisma.membership.findMany({
		where: { groupId, userId: { notIn: [...userIdByPhotonId.values()] } },
		select: { userId: true },
	});
	await removeFromGroup(
		groupId,
		gone.map((m) => m.userId),
	);
}

/** Når hver bruker sist ble synket, for synk som skjer i bakgrunnen av vanlige forespørsler. */
const userSyncedAt = shared("user-synced-at", () => new Map<string, number>());
const USER_SYNC_INTERVAL_MS = 2 * 60_000;

/**
 * Synker fra tihlde.org for den som gjør forespørselen, men høyst hvert andre minutt per bruker,
 * og uten å feile forespørselen hvis tihlde.org ikke svarer. Første gang (f.eks. ved innlogging)
 * synkes det alltid, fordi brukeren ikke er synket før.
 * Ikke når man har byttet bruker i utvikling: da er tokenet ikke den brukerens.
 */
export async function syncFromRequest(request: Request, userId: string) {
	if (request.headers.get("x-act-as")) return;
	const last = userSyncedAt.get(userId) ?? 0;
	if (Date.now() - last < USER_SYNC_INTERVAL_MS) return;
	userSyncedAt.set(userId, Date.now());
	try {
		// Inni try: får vi ikke tak i Photon-tokenet (f.eks. utløpt innlogging på nettsiden),
		// skal det ikke stoppe forespørselen, bare synken.
		await syncPhotonGroups(userId, await getAccessToken(request));
	} catch (error) {
		userSyncedAt.delete(userId);
		// tihlde.org nede skal ikke stoppe appen: da vises gruppene fra forrige synk.
		console.warn(
			"[photon] Kunne ikke synke grupper fra tihlde.org:",
			(error as Error).message,
		);
	}
}
