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

/**
 * Medlemmet markerer selv at det har betalt, eller angrer mens det venter. Betalingen skjer i Vipps,
 * og sub/admin godkjenner eller avviser etterpå. Etter en avvisning kan man prøve igjen.
 */
export const PUT = handler<{ paymentId: string }>(
	async (request, { paymentId }) => {
		const userId = await getUserId(request);
		const { paid } = await readJson<{ paid: boolean }>(request);

		const payment = await prisma.paymentRequest.findUnique({
			where: { id: paymentId },
		});
		if (!payment) throw new HttpError(404, "Fant ikke betalingen");
		await requireMember(userId, payment.groupId);

		const key = { paymentId_userId: { paymentId, userId } };
		const existing = await prisma.paymentConfirmation.findUnique({
			where: key,
		});
		if (existing?.status === "approved")
			throw new HttpError(400, "Betalingen er allerede godkjent");

		if (paid) {
			await prisma.paymentConfirmation.upsert({
				where: key,
				create: { paymentId, userId },
				update: { status: "pending", reviewedAt: null, createdAt: new Date() },
			});
		} else if (existing) {
			await prisma.paymentConfirmation.delete({ where: key });
		}

		const updated = await prisma.paymentRequest.findUniqueOrThrow({
			where: { id: paymentId },
			include: paymentInclude,
		});
		return toPayment(
			updated,
			userId,
			await canManageGroup(userId, payment.groupId),
		);
	},
);
