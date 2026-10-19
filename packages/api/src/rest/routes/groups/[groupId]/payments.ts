import { notify, paymentInclude, toPayment } from "../../../server/dto";
import {
	HttpError,
	canManageGroup,
	getUserId,
	handler,
	readJson,
	requireAccess,
	requireManagerOrParent,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { CreatePaymentInput } from "../../../types";

export const GET = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		const canManage = await canManageGroup(userId, groupId);
		const payments = await prisma.paymentRequest.findMany({
			where: { groupId },
			include: paymentInclude,
			orderBy: { dueDate: "asc" },
		});
		return payments.map((p) => toPayment(p, canManage));
	},
);

/**
 * (Sub-/admin i gruppen eller i hovedgruppen) Post en betalingsoppfordring. Selve betalingen
 * skjer i Vipps.
 */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireManagerOrParent(userId, groupId);
		const input = await readJson<CreatePaymentInput>(request);

		if (
			!input.title?.trim() ||
			!input.vippsNumber?.trim() ||
			!(input.amount > 0)
		) {
			throw new HttpError(400, "Tittel, beløp og Vipps-nummer må fylles ut");
		}
		const dueDate = new Date(input.dueDate);
		if (Number.isNaN(dueDate.getTime()))
			throw new HttpError(400, "Ugyldig frist");
		if (dueDate <= new Date())
			throw new HttpError(400, "Fristen må være frem i tid");

		const payment = await prisma.paymentRequest.create({
			data: {
				groupId,
				createdById: userId,
				title: input.title.trim(),
				description: input.description?.trim() ?? "",
				amount: Math.round(input.amount),
				vippsNumber: input.vippsNumber.trim(),
				dueDate,
			},
			include: paymentInclude,
		});

		const [members, group] = await Promise.all([
			prisma.membership.findMany({
				where: { groupId, userId: { not: userId } },
			}),
			prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
		]);
		await notify(
			members.map((m) => m.userId),
			{
				groupId,
				type: "payment",
				text: `Ny betaling i ${group.name}: ${payment.title} (${payment.amount} kr)`,
				href: `/grupper/${groupId}`,
			},
		);

		return Response.json(toPayment(payment, true), { status: 201 });
	},
);
