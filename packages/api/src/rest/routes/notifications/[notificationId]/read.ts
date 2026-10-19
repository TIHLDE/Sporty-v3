import { getUserId, handler } from "../../../server/http";
import { prisma } from "../../../server/prisma";

export const POST = handler<{ notificationId: string }>(
	async (request, { notificationId }) => {
		const userId = await getUserId(request);
		await prisma.notification.updateMany({
			where: { id: notificationId, userId },
			data: { read: true },
		});
		return { ok: true };
	},
);
