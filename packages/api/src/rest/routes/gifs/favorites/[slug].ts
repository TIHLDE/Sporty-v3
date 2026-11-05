import { getUserId, handler } from "../../../server/http";
import { prisma } from "../../../server/prisma";

/** Fjern en GIF fra favorittene. */
export const DELETE = handler<{ slug: string }>(
	async (request, { slug }) => {
		const userId = await getUserId(request);
		await prisma.favoriteGif.deleteMany({ where: { userId, slug } });
		return { ok: true };
	},
);
