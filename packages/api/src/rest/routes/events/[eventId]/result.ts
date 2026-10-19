import { eventInclude, toEvent } from "../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireManagerOrParent,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";

const isScore = (n: unknown) =>
	Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;

/**
 * (Sub-/admin) Registrer resultat på en kamp som har startet. Send null for begge for å fjerne
 * resultatet.
 */
export const PUT = handler<{ eventId: string }>(
	async (request, { eventId }) => {
		const userId = await getUserId(request);
		const { ourScore, theirScore } = await readJson<{
			ourScore: number | null;
			theirScore: number | null;
		}>(request);

		const event = await prisma.event.findUnique({ where: { id: eventId } });
		if (!event) throw new HttpError(404, "Fant ikke arrangementet");
		await requireManagerOrParent(userId, event.groupId);
		if (event.type !== "kamp")
			throw new HttpError(400, "Resultat kan bare registreres på kamper");
		if (event.startsAt > new Date())
			throw new HttpError(400, "Kampen har ikke startet ennå");

		const clearing = ourScore === null && theirScore === null;
		if (!clearing && !(isScore(ourScore) && isScore(theirScore))) {
			throw new HttpError(
				400,
				"Resultatet må være to hele tall mellom 0 og 99",
			);
		}

		const updated = await prisma.event.update({
			where: { id: eventId },
			data: {
				ourScore: clearing ? null : ourScore,
				theirScore: clearing ? null : theirScore,
			},
			include: eventInclude,
		});
		return toEvent(updated, userId);
	},
);
