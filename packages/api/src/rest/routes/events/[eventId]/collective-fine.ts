import { fineContent } from "../../../lib/notification-content";
import { notify } from "../../../server/dto";
import { getLaws, isTihldeFines } from "../../../server/fines";
import {
	HttpError,
	getAccessToken,
	getUserId,
	handler,
	requireManager,
} from "../../../server/http";
import { createPhotonFine } from "../../../server/photon";
import { prisma } from "../../../server/prisma";
import { sendPush } from "../../../server/push";

/** Paragrafen som brukes for fellesbot (ikke svart innen fristen). */
const SVARFRIST_PARAGRAPH = "1.01";

/**
 * (Sub-/admin) Gi én bot til alle aktive medlemmer som ikke har svart på arrangementet. Kan bare
 * gis én gang per arrangement. For lag fra tihlde.org gis bøtene der, under §1.01 hvis lovverket
 * har den, ellers uten paragraf.
 */
export const POST = handler<{ eventId: string }>(
	async (request, { eventId }) => {
		const userId = await getUserId(request);
		const event = await prisma.event.findUnique({
			where: { id: eventId },
			include: { group: { include: { memberships: true } }, attendances: true },
		});
		if (!event) throw new HttpError(404, "Fant ikke arrangementet");
		// Bøter gjelder hele gruppen, så fellesbot for et arrangement i en undergruppe havner i
		// hovedgruppen, og krever sub-/admin der.
		const fineGroupId = event.group.parentId ?? event.groupId;
		await requireManager(userId, fineGroupId);

		// Bare når man ikke lenger kan svare: etter fristen, eller etter start hvis det ikke er frist.
		const closesAt = event.signupDeadline ?? event.startsAt;
		if (closesAt > new Date()) {
			throw new HttpError(
				400,
				event.signupDeadline
					? "Fellesbot kan gis når påmeldingsfristen har gått ut"
					: "Fellesbot kan gis når arrangementet har startet",
			);
		}

		const fineGroup = await prisma.group.findUniqueOrThrow({
			where: { id: fineGroupId },
		});
		const accessToken = () => getAccessToken(request);
		const law =
			(await getLaws(fineGroupId, accessToken)).find(
				(l) => l.paragraph === SVARFRIST_PARAGRAPH,
			) ?? null;
		if (!law && !isTihldeFines(fineGroup)) {
			throw new HttpError(
				400,
				`Gruppen mangler §${SVARFRIST_PARAGRAPH} i botreglene`,
			);
		}
		if (isTihldeFines(fineGroup) && !fineGroup.photonFinesActivated) {
			throw new HttpError(
				400,
				"Bøter er ikke slått på for laget på tihlde.org",
			);
		}

		// Inaktive får ikke bøter, verken når de er inaktive i undergruppen eller i laget.
		const answered = new Set(event.attendances.map((a) => a.userId));
		const candidates = event.group.memberships
			.filter((m) => !m.inactiveSince)
			.map((m) => m.userId)
			.filter((id) => !answered.has(id));
		const inactiveInFineGroup = new Set(
			(
				await prisma.membership.findMany({
					where: {
						groupId: fineGroupId,
						userId: { in: candidates },
						inactiveSince: { not: null },
					},
					select: { userId: true },
				})
			).map((m) => m.userId),
		);
		const receivers = candidates.filter((id) => !inactiveInFineGroup.has(id));
		if (receivers.length === 0) return { count: 0 };

		// Bare én fellesbot per arrangement. Databasen avgjør, så to trykk samtidig gir ikke to.
		const claimed = await prisma.event.updateMany({
			where: { id: eventId, collectiveFineAt: null },
			data: { collectiveFineAt: new Date() },
		});
		if (claimed.count === 0) {
			throw new HttpError(
				400,
				"Fellesbot er allerede gitt for dette arrangementet",
			);
		}

		const reason = `Svarte ikke på ${event.title}`;
		let given = 0;
		try {
			if (isTihldeFines(fineGroup)) {
				const users = await prisma.person.findMany({
					where: { id: { in: receivers } },
					select: { photonId: true },
				});
				for (const { photonId } of users) {
					if (!photonId) continue;
					await createPhotonFine(await accessToken(), fineGroup.photonSlug, {
						userId: photonId,
						reason,
						amount: 1,
						...(law ? { lawId: law.id } : {}),
					});
					given++;
				}
			} else {
				await prisma.fine.createMany({
					data: receivers.map((receiverId) => ({
						groupId: fineGroupId,
						lawId: law!.id,
						userId: receiverId,
						givenById: userId,
						reason,
						collective: true,
						eventId,
					})),
				});
				given = receivers.length;
			}
		} catch (error) {
			// Ingen bøter gitt: fellesbot kan prøves igjen. Noen gitt: la merket stå, ellers ville et nytt
			// forsøk gitt dem en bot til.
			if (given === 0) {
				await prisma.event.update({
					where: { id: eventId },
					data: { collectiveFineAt: null },
				});
				throw error;
			}
			throw new HttpError(
				502,
				`Bare ${given} av ${receivers.length} bøter ble gitt: ${(error as Error).message}`,
			);
		}
		await notify(receivers, {
			groupId: fineGroupId,
			type: "fine",
			text: `Du har fått 1 bot i ${fineGroup.name}: svarte ikke på ${event.title}`,
			href: `/grupper/${fineGroupId}`,
		});
		await sendPush(
			receivers,
			"fine",
			fineContent({
				count: 1,
				groupId: fineGroupId,
				groupName: fineGroup.name,
				paragraph: law?.paragraph ?? "",
				lawTitle: law?.title ?? "Svarfrist",
				reason,
			}),
		);

		return { count: receivers.length };
	},
);
