import { fineContent } from "../../lib/notification-content";
import { notify } from "../../server/dto";
import {
	getFinesGroup,
	getLaws,
	inactiveNames,
	isTihldeFines,
	claimFineRequest,
	releaseFineRequest,
	requireCanGiveFines,
} from "../../server/fines";
import {
	HttpError,
	getAccessToken,
	getRole,
	getUserId,
	handler,
	isFineManager,
	readJson,
	requireAccess,
} from "../../server/http";
import { createPhotonFine, listPhotonFines } from "../../server/photon";
import { prisma } from "../../server/prisma";
import { sendPush } from "../../server/push";

const MAX_COUNT = 20;

type FinesGroup = Awaited<ReturnType<typeof getFinesGroup>>;

interface NonSnitch {
	id: string;
	name: string;
	email: string | null;
	imageUrl: string | null;
	finesReceived: number;
	/** Bare for tihlde-grupper: personen der. */
	photonId?: string | null;
}

/** Hentet ut av begge handlers: valider og parses `since`. */
function parseSince(since: string | null): Date {
	if (!since) throw new HttpError(400, "Dato mangler");
	const date = new Date(since);
	if (Number.isNaN(date.getTime())) throw new HttpError(400, "Ugyldig dato");
	return date;
}

/** Ikke-snitchere i en Sporty-gruppe: alle medlemmer som ikke har gitt bot siden datoen. */
async function localNonSnitches(groupId: string, date: Date): Promise<NonSnitch[]> {
	const rows = await prisma.person.findMany({
		where: {
			memberships: { some: { groupId } },
			givenFines: { none: { groupId, createdAt: { gte: date } } },
		},
		select: {
			id: true,
			name: true,
			email: true,
			imageUrl: true,
			_count: { select: { fines: { where: { groupId } } } },
		},
		orderBy: { name: "asc" },
	});
	return rows.map((person) => ({
		id: person.id,
		name: person.name,
		email: person.email,
		imageUrl: person.imageUrl,
		finesReceived: person._count.fines,
	}));
}

/**
 * Ikke-snitchere i et lag på tihlde.org: botene ligger der, så giverne hentes fra Photon
 * (`createdByUser` på hver bot) og sammenlignes med de lokale medlemmene.
 */
async function tihldeNonSnitches(
	group: FinesGroup,
	date: Date,
	accessToken: string,
): Promise<NonSnitch[]> {
	const members = await prisma.membership.findMany({
		where: { groupId: group.id },
		include: {
			user: {
				select: { id: true, name: true, email: true, imageUrl: true, photonId: true },
			},
		},
	});
	const fines = await listPhotonFines(accessToken, group.photonSlug!);
	const since = date.getTime();
	const givers = new Set(
		fines
			.filter(
				(f) =>
					f.createdByUser && new Date(f.createdAt).getTime() >= since,
			)
			.map((f) => f.createdByUser!.id),
	);
	const received = new Map<string, number>();
	for (const fine of fines) {
		received.set(fine.userId, (received.get(fine.userId) ?? 0) + 1);
	}
	return members
		.filter((m) => m.user.photonId && !givers.has(m.user.photonId))
		.map((m) => ({
			id: m.user.id,
			name: m.user.name,
			email: m.user.email,
			imageUrl: m.user.imageUrl,
			finesReceived: received.get(m.user.photonId!) ?? 0,
			photonId: m.user.photonId,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Handler for Snitches don't get stitches-funksjonalitet. */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	const url = new URL(request.url);
	const groupId = url.searchParams.get("groupId");
	if (!groupId) throw new HttpError(400, "GroupId mangler");
	const date = parseSince(url.searchParams.get("since"));
	await requireAccess(userId, groupId);
	const group = await getFinesGroup(groupId);

	if (isTihldeFines(group)) {
		const accessToken = await getAccessToken(request).catch(() => null);
		if (!accessToken) {
			throw new HttpError(
				401,
				"Snitches på tihlde.org krever innlogging mot tihlde.org",
			);
		}
		return tihldeNonSnitches(group, date, accessToken);
	}
	return localNonSnitches(group.id, date);
});

interface GiveNonSnitchFinesInput {
	groupId: string;
	since: string;
	lawId: string;
	count: number;
	reason: string;
	requestId: string;
}

/**
 * Gi like mange bøter til alle i gruppen som ikke har gitt en bot siden `since`.
 * På tihlde.org opprettes hver bot der; i Sporty-grupper lagres de lokalt.
 */
export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	const input = await readJson<GiveNonSnitchFinesInput>(request);
	const date = parseSince(input.since);
	const group = await requireCanGiveFines(userId, input.groupId);
	// Snitches gir bøter til mange på en gang: botsjef og sub-/admin (i hovedgruppen) får gjøre
	// det, også på tihlde.org der alle ellers kan gi enkeltbøter.
	if (!isFineManager(await getRole(userId, group.id))) {
		throw new HttpError(403, "Krever botsjef eller sub-/admin i gruppen");
	}
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

	const accessToken = () => getAccessToken(request);
	const law = (await getLaws(group.id, accessToken)).find(
		(l) => l.id === input.lawId,
	);
	if (!law) throw new HttpError(400, "Paragrafen hører ikke til gruppen");

	// Mottakerne beregnes på serveren: alle som ikke har gitt bot siden datoen.
	const nonSnitches = isTihldeFines(group)
		? await tihldeNonSnitches(group, date, await accessToken())
		: await localNonSnitches(group.id, date);
	if (nonSnitches.length === 0) {
		throw new HttpError(400, "Alle har gitt bøter siden denne datoen");
	}
	const receiverIds = nonSnitches.map((s) => s.id);

	const inactive = await inactiveNames(receiverIds, [group.id]);
	if (inactive.length > 0) {
		throw new HttpError(
			400,
			`${inactive.join(", ")} er inaktiv${inactive.length === 1 ? "" : "e"} og kan ikke få bøter`,
		);
	}

	// Samme innsending to ganger (dobbelttrykk, nytt forsøk etter nettfeil) gir ikke nye bøter.
	if (!(await claimFineRequest(input.requestId, userId))) {
		return Response.json(
			{ count: receiverIds.length, duplicate: true },
			{ status: 200 },
		);
	}

	let given = 0;
	try {
		if (isTihldeFines(group)) {
			for (const nonSnitch of nonSnitches) {
				if (!nonSnitch.photonId)
					throw new HttpError(400, "Fant ikke personen på tihlde.org");
				await createPhotonFine(await accessToken(), group.photonSlug, {
					userId: nonSnitch.photonId,
					reason,
					amount: input.count,
					lawId: law.id,
				});
				given++;
			}
		} else {
			await prisma.fine.createMany({
				data: receiverIds.map((receiverId) => ({
					groupId: group.id,
					lawId: law.id,
					userId: receiverId,
					givenById: userId,
					reason,
					count: input.count,
				})),
			});
			given = receiverIds.length;
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
			`Bare ${given} av ${nonSnitches.length} bøter ble gitt: ${(error as Error).message}`,
		);
	}

	const amount = `${input.count} ${input.count === 1 ? "bot" : "bøter"}`;
	await notify(receiverIds, {
		groupId: group.id,
		type: "fine",
		text: `Du har fått ${amount} i ${group.name} (§${law.paragraph} ${law.title})`,
		href: `/grupper/${group.id}`,
	});
	await sendPush(
		receiverIds,
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

	return Response.json({ count: receiverIds.length }, { status: 201 });
});
