import { getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	await prisma.notification.updateMany({
		where: { userId, read: false },
		data: { read: true },
	});
	return { ok: true };
});
