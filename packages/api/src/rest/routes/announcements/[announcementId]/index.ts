import {
	announcementInclude,
	toAnnouncement,
	toUser,
} from "../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	requireAccess,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { AnnouncementDetails } from "../../../types";

export const GET = handler<{ announcementId: string }>(
	async (request, { announcementId }): Promise<AnnouncementDetails> => {
		const userId = await getUserId(request);
		const announcement = await prisma.announcement.findUnique({
			where: { id: announcementId },
			include: {
				...announcementInclude,
				comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
			},
		});
		if (!announcement) throw new HttpError(404, "Fant ikke kunngjøringen");
		await requireAccess(userId, announcement.groupId);

		return {
			...toAnnouncement(announcement),
			comments: announcement.comments.map((c) => ({
				id: c.id,
				author: toUser(c.author),
				body: c.body,
				createdAt: c.createdAt.toISOString(),
			})),
		};
	},
);
