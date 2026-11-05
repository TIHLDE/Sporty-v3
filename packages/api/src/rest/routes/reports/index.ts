import { toUser } from "../../server/dto";
import { getUserId, handler } from "../../server/http";
import { moderatedReports } from "../../server/moderation";
import { prisma } from "../../server/prisma";
import type { MessageReport } from "../../types";

/** Åpne rapporter brukeren kan behandle, eldste først. Tom liste for alle andre. */
export const GET = handler(async (request): Promise<MessageReport[]> => {
	const userId = await getUserId(request);
	const rows = await prisma.messageReport.findMany({
		where: { status: "open", ...(await moderatedReports(userId)) },
		include: {
			reporter: true,
			group: { select: { name: true } },
			message: { include: { sender: true } },
		},
		orderBy: { createdAt: "asc" },
	});
	return rows.map((row) => ({
		id: row.id,
		reason: row.reason,
		body: row.body,
		gifUrl: row.gifUrl,
		createdAt: row.createdAt.toISOString(),
		reporter: toUser(row.reporter),
		sender: toUser(row.message.sender),
		groupName: row.group?.name ?? null,
	}));
});
