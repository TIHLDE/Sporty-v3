import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAccess,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";

const MAX_LENGTH = 2000;

/** Kommenter på en avstemning, hvis kommentarer er slått på. */
export const POST = handler<{ pollId: string }>(async (request, { pollId }) => {
	const userId = await getUserId(request);
	const { body } = await readJson<{ body: string }>(request);
	const text = body?.trim();
	if (!text) throw new HttpError(400, "Kommentaren er tom");
	if (text.length > MAX_LENGTH)
		throw new HttpError(400, `Maks ${MAX_LENGTH} tegn`);

	const poll = await prisma.poll.findUnique({ where: { id: pollId } });
	if (!poll) throw new HttpError(404, "Fant ikke avstemningen");
	await requireAccess(userId, poll.groupId);
	if (!poll.allowComments) throw new HttpError(403, "Kommentarer er slått av");

	const comment = await prisma.pollComment.create({
		data: { pollId, authorId: userId, body: text },
	});
	return Response.json({ id: comment.id }, { status: 201 });
});
