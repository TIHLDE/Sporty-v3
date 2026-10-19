import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAccess,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";

const MAX_LENGTH = 2000;

/** Kommenter på en kunngjøring, hvis kommentarer er slått på. */
export const POST = handler<{ announcementId: string }>(
	async (request, { announcementId }) => {
		const userId = await getUserId(request);
		const { body } = await readJson<{ body: string }>(request);
		const text = body?.trim();
		if (!text) throw new HttpError(400, "Kommentaren er tom");
		if (text.length > MAX_LENGTH)
			throw new HttpError(400, `Maks ${MAX_LENGTH} tegn`);

		const announcement = await prisma.announcement.findUnique({
			where: { id: announcementId },
		});
		if (!announcement) throw new HttpError(404, "Fant ikke kunngjøringen");
		await requireAccess(userId, announcement.groupId);
		if (!announcement.allowComments)
			throw new HttpError(403, "Kommentarer er slått av");

		const comment = await prisma.announcementComment.create({
			data: { announcementId, authorId: userId, body: text },
		});
		return Response.json({ id: comment.id }, { status: 201 });
	},
);
