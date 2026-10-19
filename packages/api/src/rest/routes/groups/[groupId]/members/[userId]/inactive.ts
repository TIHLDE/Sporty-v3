import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireManagerOrParent,
} from "../../../../../server/http";
import { prisma } from "../../../../../server/prisma";

/**
 * (Sub-/admin) Gjør et medlem inaktivt med en begrunnelse, eller aktivt igjen med `null`.
 * Begrunnelsen lagres på medlemskapet og vises på profilen til medlemmet.
 */
export const PUT = handler<{ groupId: string; userId: string }>(
	async (request, { groupId, userId: memberId }) => {
		const userId = await getUserId(request);
		await requireManagerOrParent(userId, groupId);
		const input = await readJson<{ reason: string | null }>(request);

		let data: { inactiveSince: Date | null; inactiveReason: string | null };
		if (input.reason === null) {
			data = { inactiveSince: null, inactiveReason: null };
		} else {
			const reason =
				typeof input.reason === "string" ? input.reason.trim() : "";
			if (!reason) throw new HttpError(400, "Skriv en begrunnelse");
			if (reason.length > 500)
				throw new HttpError(400, "Begrunnelsen kan ha maks 500 tegn");
			const membership = await prisma.membership.findUnique({
				where: { userId_groupId: { userId: memberId, groupId } },
			});
			// Behold datoen hvis bare begrunnelsen endres.
			data = {
				inactiveSince: membership?.inactiveSince ?? new Date(),
				inactiveReason: reason,
			};
		}

		const updated = await prisma.membership.updateMany({
			where: { groupId, userId: memberId },
			data,
		});
		if (updated.count === 0)
			throw new HttpError(404, "Brukeren er ikke medlem av gruppen");
		return {
			inactiveSince: data.inactiveSince?.toISOString() ?? null,
			reason: data.inactiveReason,
		};
	},
);
