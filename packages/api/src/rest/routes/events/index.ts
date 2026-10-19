import { eventInclude, toEvent, upcomingEventsWhere } from "../../server/dto";
import { getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

/** Kommende arrangementer i alle grupper (og undergrupper) brukeren er med i. */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	const events = await prisma.event.findMany({
		where: {
			...upcomingEventsWhere(),
			group: { memberships: { some: { userId } } },
		},
		include: eventInclude,
		orderBy: { startsAt: "asc" },
	});
	return events.map((e) => toEvent(e, userId));
});
