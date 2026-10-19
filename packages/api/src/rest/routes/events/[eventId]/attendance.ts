import { eventInclude, notify, toEvent } from "../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireMember,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { Answer } from "../../../types";

/** Svar "kommer" eller "kommer ikke". Sub-/admin i gruppen får et varsel. */
export const PUT = handler<{ eventId: string }>(
	async (request, { eventId }) => {
		const userId = await getUserId(request);
		const { status } = await readJson<{ status: Answer }>(request);
		if (status !== "kommer" && status !== "kommer_ikke")
			throw new HttpError(400, "Ugyldig svar");

		const event = await prisma.event.findUnique({ where: { id: eventId } });
		if (!event) throw new HttpError(404, "Fant ikke arrangementet");
		await requireMember(userId, event.groupId);
		const now = new Date();
		if ((event.endsAt ?? event.startsAt) < now)
			throw new HttpError(400, "Arrangementet er ferdig");
		if (event.signupDeadline && event.signupDeadline < now) {
			throw new HttpError(400, "Påmeldingsfristen har gått ut");
		}

		await prisma.attendance.upsert({
			where: { eventId_userId: { eventId, userId } },
			create: { eventId, userId, status },
			update: { status },
		});

		const [user, managers] = await Promise.all([
			prisma.person.findUniqueOrThrow({ where: { id: userId } }),
			prisma.membership.findMany({
				where: {
					groupId: event.groupId,
					role: { in: ["admin", "subadmin"] },
					userId: { not: userId },
				},
			}),
		]);
		await notify(
			managers.map((m) => m.userId),
			{
				groupId: event.groupId,
				type: "attendance",
				text: `${user.name} ${status === "kommer" ? "kommer på" : "kommer ikke på"} ${event.title}`,
				href: `/grupper/${event.groupId}/arrangement/${eventId}`,
			},
		);

		const updated = await prisma.event.findUniqueOrThrow({
			where: { id: eventId },
			include: eventInclude,
		});
		return toEvent(updated, userId);
	},
);
