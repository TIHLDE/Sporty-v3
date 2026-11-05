import { toUser } from "../../server/dto";
import { HttpError, getUserId, handler, readJson } from "../../server/http";
import { prisma } from "../../server/prisma";
import type { User } from "../../types";

/** Personene brukeren har blokkert, sist blokkert først. */
export const GET = handler(async (request): Promise<User[]> => {
	const userId = await getUserId(request);
	const rows = await prisma.userBlock.findMany({
		where: { blockerId: userId },
		include: { blocked: true },
		orderBy: { createdAt: "desc" },
	});
	return rows.map((row) => toUser(row.blocked));
});

/** Blokker en person. Er vedkommende blokkert fra før, skjer det ingenting. */
export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	const { userId: blockedId } = await readJson<{ userId?: string }>(request);
	if (!blockedId || blockedId === userId)
		throw new HttpError(400, "Velg en annen person");
	if (!(await prisma.person.findUnique({ where: { id: blockedId } })))
		throw new HttpError(404, "Fant ikke personen");

	await prisma.userBlock.upsert({
		where: { blockerId_blockedId: { blockerId: userId, blockedId } },
		create: { blockerId: userId, blockedId },
		update: {},
	});
	return Response.json({ ok: true }, { status: 201 });
});
