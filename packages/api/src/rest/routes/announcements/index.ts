import { announcementInclude, toAnnouncement } from "../../server/dto";
import { getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

/** Siste kunngjøringer fra alle gruppene brukeren er med i. */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	const announcements = await prisma.announcement.findMany({
		where: { group: { memberships: { some: { userId } } } },
		include: announcementInclude,
		orderBy: { createdAt: "desc" },
		take: 20,
	});
	return announcements.map(toAnnouncement);
});
