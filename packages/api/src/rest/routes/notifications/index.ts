import { getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

const PAGE_SIZE = 100;

/**
 * Varsler til brukeren, nyeste først, 100 om gangen. Varslene slettes ikke når de leses, så hele
 * historikken kan blas gjennom: `?cursor=<varsel-id>` henter de som er eldre enn det.
 * `?groupId=` begrenser til én gruppe.
 */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	const params = new URL(request.url).searchParams;
	const groupId = params.get("groupId");
	const cursor = params.get("cursor");
	const notifications = await prisma.notification.findMany({
		where: { userId, ...(groupId ? { groupId } : {}) },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: PAGE_SIZE,
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
	});
	return notifications.map(({ userId: _userId, ...n }) => ({
		...n,
		createdAt: n.createdAt.toISOString(),
	}));
});
