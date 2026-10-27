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

/** Lengste begrunnelse for «kommer ikke». */
const MAX_REASON_LENGTH = 300;

/**
 * Svar "kommer" eller "kommer ikke". «Kommer ikke» krever en begrunnelse (`reason`), som vises på
 * arrangementet. Personen selv får en bekreftelse i Varsler, som erstatter
 * bekreftelsen fra et tidligere svar på samme arrangement. Sub-/admin varsles ikke: svarene står
 * på arrangementet.
 */
export const PUT = handler<{ eventId: string }>(
	async (request, { eventId }) => {
		const userId = await getUserId(request);
		const body = await readJson<{ status: Answer; reason?: string }>(request);
		const { status } = body;
		if (status !== "kommer" && status !== "kommer_ikke")
			throw new HttpError(400, "Ugyldig svar");
		const reason = status === "kommer_ikke" ? (body.reason?.trim() ?? "") : "";
		if (status === "kommer_ikke" && !reason)
			throw new HttpError(400, "Skriv hvorfor du ikke kan komme");
		if (reason.length > MAX_REASON_LENGTH)
			throw new HttpError(400, `Maks ${MAX_REASON_LENGTH} tegn`);

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
			create: { eventId, userId, status, reason },
			update: { status, reason },
		});

		const href = `/grupper/${event.groupId}/arrangement/${eventId}`;
		await prisma.notification.deleteMany({
			where: { userId, type: "attendance", href },
		});
		await notify([userId], {
			groupId: event.groupId,
			type: "attendance",
			text:
				status === "kommer"
					? `Du er påmeldt ${event.title}`
					: `Du har meldt deg av ${event.title}`,
			href,
		});

		const updated = await prisma.event.findUniqueOrThrow({
			where: { id: eventId },
			include: eventInclude,
		});
		return toEvent(updated, userId);
	},
);
