import { fineContent } from "../../lib/notification-content";
import { notify } from "../../server/dto";
import {
	claimFineRequest,
	getLaws,
	inactiveNames,
	isTihldeFines,
	releaseFineRequest,
	requireCanGiveFines,
} from "../../server/fines";
import {
	HttpError,
	getAccessToken,
	getUserId,
	handler,
	readJson,
} from "../../server/http";
import { createPhotonFine } from "../../server/photon";
import { prisma } from "../../server/prisma";
import { sendPush } from "../../server/push";
import type { GiveFinesInput } from "../../types";

const MAX_COUNT = 20;

/**
 * Gi bot til én eller flere brukere for brudd på en paragraf. For lag fra tihlde.org lages boten
 * der (alle medlemmer kan gi bot, og den venter på godkjenning fra botsjefen). I Sporty-grupper
 * kreves sub-/admin.
 */
export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	const input = await readJson<GiveFinesInput>(request);
	const group = await requireCanGiveFines(userId, input.groupId);
	if (group.id !== input.groupId) {
		throw new HttpError(400, "Bøter gis i hovedgruppen, ikke i undergrupper");
	}

	const reason = input.reason?.trim();
	if (!reason) throw new HttpError(400, "Begrunnelse må fylles ut");
	if (
		!Number.isInteger(input.count) ||
		input.count < 1 ||
		input.count > MAX_COUNT
	) {
		throw new HttpError(400, `Antall bøter må være mellom 1 og ${MAX_COUNT}`);
	}
	if (!input.userIds?.length) throw new HttpError(400, "Velg minst én bruker");

	// Tokenet hentes bare når det trengs: Sporty-grupper snakker ikke med tihlde.org.
	const accessToken = () => getAccessToken(request);
	const law = (await getLaws(group.id, accessToken)).find(
		(l) => l.id === input.lawId,
	);
	if (!law) throw new HttpError(400, "Paragrafen hører ikke til gruppen");
	const members = await prisma.membership.findMany({
		where: { groupId: group.id, userId: { in: input.userIds } },
		include: { user: { select: { photonId: true } } },
	});
	if (members.length !== input.userIds.length) {
		throw new HttpError(400, "Alle må være medlem av gruppen");
	}
	const inactive = await inactiveNames(input.userIds, [group.id]);
	if (inactive.length > 0) {
		throw new HttpError(
			400,
			`${inactive.join(", ")} er inaktiv${inactive.length === 1 ? "" : "e"} og kan ikke få bøter`,
		);
	}

	// Samme innsending to ganger (dobbelttrykk, nytt forsøk etter nettfeil) gir ikke nye bøter.
	if (!(await claimFineRequest(input.requestId, userId))) {
		return Response.json(
			{ count: input.userIds.length, duplicate: true },
			{ status: 200 },
		);
	}

	let given = 0;
	try {
		if (isTihldeFines(group)) {
			for (const member of members) {
				if (!member.user.photonId)
					throw new HttpError(400, "Fant ikke personen på tihlde.org");
				await createPhotonFine(await accessToken(), group.photonSlug, {
					userId: member.user.photonId,
					reason,
					amount: input.count,
					lawId: law.id,
				});
				given++;
			}
		} else {
			await prisma.fine.createMany({
				data: input.userIds.map((receiverId) => ({
					groupId: group.id,
					lawId: law.id,
					userId: receiverId,
					givenById: userId,
					reason,
					count: input.count,
					imageUri: input.imageUri,
				})),
			});
			given = input.userIds.length;
		}
	} catch (error) {
		// Ingen bøter gitt: innsendingen kan prøves igjen. Noen gitt: behold reservasjonen, ellers
		// ville et nytt forsøk gitt dem samme bot en gang til.
		if (given === 0) {
			await releaseFineRequest(input.requestId);
			throw error;
		}
		throw new HttpError(
			502,
			`Bare ${given} av ${members.length} bøter ble gitt: ${(error as Error).message}`,
		);
	}

	const amount = `${input.count} ${input.count === 1 ? "bot" : "bøter"}`;
	await notify(input.userIds, {
		groupId: group.id,
		type: "fine",
		text: `Du har fått ${amount} i ${group.name} (§${law.paragraph} ${law.title})`,
		href: `/grupper/${group.id}`,
	});
	await sendPush(
		input.userIds,
		"fine",
		fineContent({
			count: input.count,
			groupId: group.id,
			groupName: group.name,
			paragraph: law.paragraph,
			lawTitle: law.title,
			reason,
		}),
	);

	return Response.json({ count: input.userIds.length }, { status: 201 });
});
