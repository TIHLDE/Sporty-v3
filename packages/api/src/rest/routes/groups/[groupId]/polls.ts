import { notify, pollInclude, toPoll } from "../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAccess,
	requireManagerOrParent,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { CreatePollInput } from "../../../types";

const MAX_OPTIONS = 20;

export const GET = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		const { role } = await requireAccess(userId, groupId);
		const polls = await prisma.poll.findMany({
			where: { groupId },
			include: pollInclude,
			// Åpne avstemninger først (nærmeste frist øverst), så de som er stengt.
			orderBy: { closesAt: "desc" },
		});
		const now = new Date();
		return polls
			.sort((a, b) => {
				const aOpen = a.closesAt >= now;
				const bOpen = b.closesAt >= now;
				if (aOpen !== bOpen) return aOpen ? -1 : 1;
				return aOpen ? a.closesAt.getTime() - b.closesAt.getTime() : 0;
			})
			.map((p) => toPoll(p, userId, role));
	},
);

/** (Sub-/admin) Lag en avstemning. Alle medlemmer i gruppen får et varsel. */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireManagerOrParent(userId, groupId);
		const { role } = await requireAccess(userId, groupId);
		const input = await readJson<CreatePollInput>(request);

		const question = input.question?.trim();
		if (!question) throw new HttpError(400, "Avstemningen må ha et spørsmål");
		const options = (input.options ?? []).map((o) => o.trim()).filter(Boolean);
		if (options.length < 2)
			throw new HttpError(400, "Legg til minst to alternativer");
		if (options.length > MAX_OPTIONS)
			throw new HttpError(400, `Maks ${MAX_OPTIONS} alternativer`);
		if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
			throw new HttpError(400, "To alternativer er like");
		}
		const closesAt = new Date(input.closesAt);
		if (Number.isNaN(closesAt.getTime()))
			throw new HttpError(400, "Ugyldig frist");
		if (closesAt <= new Date())
			throw new HttpError(400, "Fristen må være frem i tid");

		const poll = await prisma.poll.create({
			data: {
				groupId,
				createdById: userId,
				question,
				description: input.description?.trim() ?? "",
				allowMultiple: Boolean(input.allowMultiple),
				hideVotes: Boolean(input.hideVotes),
				allowComments: input.allowComments !== false,
				closesAt,
				options: {
					create: options.map((label, position) => ({ label, position })),
				},
			},
			include: { ...pollInclude, group: { select: { name: true } } },
		});

		const members = await prisma.membership.findMany({
			where: { groupId, userId: { not: userId } },
		});
		await notify(
			members.map((m) => m.userId),
			{
				groupId,
				type: "poll",
				text: `Ny avstemning i ${poll.group.name}: ${question}`,
				href: `/grupper/${groupId}/avstemning/${poll.id}`,
			},
		);

		return Response.json(toPoll(poll, userId, role), { status: 201 });
	},
);
