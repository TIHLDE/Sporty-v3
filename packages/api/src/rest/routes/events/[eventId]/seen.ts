import {
	HttpError,
	getUserId,
	handler,
	requireAccess,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";

/** Marker at brukeren har åpnet arrangementet nå. Sub-/admin ser det under «Ikke svart». */
export const POST = handler<{ eventId: string }>(
	async (request, { eventId }) => {
		const userId = await getUserId(request);
		const event = await prisma.event.findUnique({
			where: { id: eventId },
			select: { groupId: true },
		});
		if (!event) throw new HttpError(404, "Fant ikke arrangementet");
		await requireAccess(userId, event.groupId);
		const now = new Date();
		await prisma.eventView.upsert({
			where: { eventId_userId: { eventId, userId } },
			create: { eventId, userId, seenAt: now },
			update: { seenAt: now },
		});
		return { ok: true };
	},
);
