import { fineInclude, toFine } from "../../server/dto";
import { toFinesFromPhoton } from "../../server/fines";
import { getAccessToken, getUserId, handler } from "../../server/http";
import { listPhotonFines } from "../../server/photon";
import { prisma } from "../../server/prisma";
import type { Fine } from "../../types";

/** Den innloggede brukerens bøter: fra Sporty-gruppene og fra lagene på tihlde.org. */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	const local = await prisma.fine.findMany({
		where: { userId },
		include: fineInclude,
		orderBy: { createdAt: "desc" },
	});

	const user = await prisma.person.findUniqueOrThrow({ where: { id: userId } });
	const tihldeGroups = user.photonId
		? await prisma.group.findMany({
				where: {
					photonSlug: { not: null },
					photonFinesActivated: true,
					memberships: { some: { userId } },
				},
			})
		: [];
	// Bare når det finnes lag fra tihlde.org, og uten token vises Sporty-bøtene likevel (f.eks. når
	// innloggingen mot tihlde.org på nettsiden har utløpt).
	const accessToken =
		tihldeGroups.length > 0
			? await getAccessToken(request).catch(() => null)
			: null;
	const fromTihlde = await Promise.all(
		tihldeGroups.map(async (group) => {
			if (!accessToken) return [];
			try {
				const fines = await listPhotonFines(accessToken, group.photonSlug!, {
					userId: user.photonId!,
				});
				return await toFinesFromPhoton(fines, {
					id: group.id,
					photonSlug: group.photonSlug!,
				});
			} catch (error) {
				// Ett lag som ikke svarer skal ikke skjule bøtene fra de andre.
				console.warn(
					`[photon] Kunne ikke hente bøter for ${group.photonSlug}:`,
					error,
				);
				return [];
			}
		}),
	);

	return [...local.map(toFine), ...fromTihlde.flat()].sort((a: Fine, b: Fine) =>
		b.createdAt.localeCompare(a.createdAt),
	);
});
