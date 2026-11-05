import { getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

/** Opphev en blokkering. */
export const DELETE = handler<{ userId: string }>(
	async (request, { userId: blockedId }) => {
		const userId = await getUserId(request);
		await prisma.userBlock.deleteMany({
			where: { blockerId: userId, blockedId },
		});
		return { ok: true };
	},
);
