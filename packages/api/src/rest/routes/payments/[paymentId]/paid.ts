import { paymentInclude, toPayment } from "../../../server/dto";
import {
	HttpError,
	canManageGroup,
	getUserId,
	handler,
	readJson,
	requireMember,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";

/** Medlemmet markerer selv at det har betalt (eller angrer). Betalingen skjer i Vipps. */
export const PUT = handler<{ paymentId: string }>(
	async (request, { paymentId }) => {
		const userId = await getUserId(request);
		const { paid } = await readJson<{ paid: boolean }>(request);

		const payment = await prisma.paymentRequest.findUnique({
			where: { id: paymentId },
		});
		if (!payment) throw new HttpError(404, "Fant ikke betalingen");
		await requireMember(userId, payment.groupId);

		if (paid) {
			await prisma.paymentConfirmation.upsert({
				where: { paymentId_userId: { paymentId, userId } },
				create: { paymentId, userId },
				update: {},
			});
		} else {
			await prisma.paymentConfirmation.deleteMany({
				where: { paymentId, userId },
			});
		}

		const updated = await prisma.paymentRequest.findUniqueOrThrow({
			where: { id: paymentId },
			include: paymentInclude,
		});
		return toPayment(updated, await canManageGroup(userId, payment.groupId));
	},
);
