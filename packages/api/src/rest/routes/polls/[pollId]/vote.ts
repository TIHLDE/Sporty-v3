import { pollInclude, toPoll } from "../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireMember,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";

/**
 * Sett brukerens stemme. `optionIds` erstatter tidligere stemmer, så man kan endre seg frem til
 * fristen. Tom liste fjerner stemmen. Uten flervalg er bare ett alternativ lov.
 */
export const PUT = handler<{ pollId: string }>(async (request, { pollId }) => {
	const userId = await getUserId(request);
	const { optionIds } = await readJson<{ optionIds: string[] }>(request);
	if (!Array.isArray(optionIds)) throw new HttpError(400, "Mangler optionIds");

	const poll = await prisma.poll.findUnique({
		where: { id: pollId },
		include: { options: true },
	});
	if (!poll) throw new HttpError(404, "Fant ikke avstemningen");
	const role = await requireMember(userId, poll.groupId);
	if (poll.closesAt < new Date())
		throw new HttpError(400, "Avstemningen er stengt");

	const unique = [...new Set(optionIds)];
	if (!poll.allowMultiple && unique.length > 1)
		throw new HttpError(400, "Du kan bare velge ett alternativ");
	const validIds = new Set(poll.options.map((o) => o.id));
	if (unique.some((id) => !validIds.has(id)))
		throw new HttpError(400, "Ugyldig alternativ");

	await prisma.$transaction([
		prisma.pollVote.deleteMany({ where: { pollId, userId } }),
		prisma.pollVote.createMany({
			data: unique.map((optionId) => ({ pollId, optionId, userId })),
		}),
	]);

	const updated = await prisma.poll.findUniqueOrThrow({
		where: { id: pollId },
		include: pollInclude,
	});
	return toPoll(updated, userId, role);
});
