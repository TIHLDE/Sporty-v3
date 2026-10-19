import { HttpError, getUserId, handler, readJson } from "../../server/http";
import { prisma } from "../../server/prisma";

/**
 * Åpne en direktemelding med en person. Gjenbruker samtalen hvis den finnes. Man kan bare sende
 * direktemeldinger til folk man deler en gruppe med.
 */
export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	const { userId: otherId } = await readJson<{ userId: string }>(request);
	if (!otherId || otherId === userId)
		throw new HttpError(400, "Velg en annen person");

	const shared = await prisma.membership.count({
		where: { userId: otherId, group: { memberships: { some: { userId } } } },
	});
	if (shared === 0) throw new HttpError(403, "Dere er ikke i samme gruppe");

	const existing = await prisma.conversation.findFirst({
		where: {
			groupId: null,
			AND: [
				{ members: { some: { userId } } },
				{ members: { some: { userId: otherId } } },
			],
		},
	});
	if (existing) return { id: existing.id };

	const created = await prisma.conversation.create({
		data: { members: { create: [{ userId }, { userId: otherId }] } },
	});
	return Response.json({ id: created.id }, { status: 201 });
});
