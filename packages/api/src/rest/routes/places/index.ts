import { getUserId, handler, requireAccess } from "../../server/http";
import { prisma } from "../../server/prisma";
import type { Place } from "../../types";

/**
 * Stedsforslag når man lager arrangement: gruppens nylig brukte steder først, så felles forslag.
 * ?groupId= (påkrevd) og ?q= for å filtrere på navn.
 */
export const GET = handler(async (request): Promise<Place[]> => {
	const userId = await getUserId(request);
	const params = new URL(request.url).searchParams;
	const groupId = params.get("groupId") ?? "";
	const q = params.get("q")?.trim() ?? "";
	const { parentId } = await requireAccess(userId, groupId);

	const places = await prisma.place.findMany({
		where: {
			groupId: { in: [parentId ?? groupId] },
			...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
		},
		orderBy: { lastUsedAt: "desc" },
		take: 10,
	});
	const shared = await prisma.place.findMany({
		where: {
			groupId: null,
			...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
		},
		orderBy: { name: "asc" },
	});

	const seen = new Set(places.map((p) => p.name.toLowerCase()));
	return [
		...places,
		...shared.filter((p) => !seen.has(p.name.toLowerCase())),
	].map((p) => ({
		id: p.id,
		name: p.name,
		address: p.address,
		latitude: p.latitude,
		longitude: p.longitude,
	}));
});
