import { notify, paymentInclude, toPayment } from "../../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireManagerOrParent,
} from "../../../../server/http";
import { prisma } from "../../../../server/prisma";
import type { PaymentRequest } from "../../../../types";

/**
 * (Sub-/admin) Godkjenn eller avvis et medlems «Jeg har betalt» etter å ha sjekket Vipps.
 * Medlemmet får varsel. Etter en avvisning kan medlemmet trykke «Jeg har betalt» på nytt.
 */
export const PUT = handler<{ paymentId: string; userId: string }>(
	async (request, params): Promise<PaymentRequest> => {
		const userId = await getUserId(request);
		const { status } = await readJson<{ status: string }>(request);
		if (status !== "approved" && status !== "rejected")
			throw new HttpError(400, "Ugyldig status");

		const payment = await prisma.paymentRequest.findUnique({
			where: { id: params.paymentId },
		});
		if (!payment) throw new HttpError(404, "Fant ikke betalingen");
		await requireManagerOrParent(userId, payment.groupId);

		const key = {
			paymentId_userId: { paymentId: payment.id, userId: params.userId },
		};
		const confirmation = await prisma.paymentConfirmation.findUnique({
			where: key,
		});
		if (!confirmation)
			throw new HttpError(404, "Medlemmet har ikke markert betalingen");

		await prisma.paymentConfirmation.update({
			where: key,
			data: { status, reviewedAt: new Date() },
		});
		if (confirmation.status !== status) {
			await notify([params.userId], {
				groupId: payment.groupId,
				type: "payment",
				text:
					status === "approved"
						? `Betalingen for ${payment.title} er godkjent`
						: `Betalingen for ${payment.title} ble avvist. Sjekk at du har betalt riktig beløp.`,
				href: `/grupper/${payment.groupId}`,
			});
		}

		const updated = await prisma.paymentRequest.findUniqueOrThrow({
			where: { id: payment.id },
			include: paymentInclude,
		});
		return toPayment(updated, userId, true);
	},
);
