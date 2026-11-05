import { HttpError, getUserId, handler, readJson } from "../../server/http";
import { moderatedReports } from "../../server/moderation";
import { prisma } from "../../server/prisma";

/**
 * Behandle en rapport: `remove` sletter meldingen for alle, `dismiss` lar den stå. Andre åpne
 * rapporter om samme melding lukkes samtidig, så flere ikke må vurdere det samme.
 */
export const PATCH = handler<{ reportId: string }>(
	async (request, { reportId }) => {
		const userId = await getUserId(request);
		const { action } = await readJson<{ action?: "remove" | "dismiss" }>(
			request,
		);
		if (action !== "remove" && action !== "dismiss")
			throw new HttpError(400, "Ugyldig valg");

		const report = await prisma.messageReport.findFirst({
			where: { id: reportId, ...(await moderatedReports(userId)) },
		});
		if (!report) throw new HttpError(404, "Fant ikke rapporten");

		await prisma.$transaction([
			...(action === "remove"
				? [
						prisma.message.update({
							where: { id: report.messageId },
							data: {
								body: "",
								deletedAt: new Date(),
								gifSlug: null,
								gifUrl: null,
								gifWidth: null,
								gifHeight: null,
							},
						}),
					]
				: []),
			prisma.messageReport.updateMany({
				where: { messageId: report.messageId, status: "open" },
				data: {
					status: action === "remove" ? "removed" : "dismissed",
					resolvedAt: new Date(),
					resolvedById: userId,
				},
			}),
		]);
		return { ok: true };
	},
);
