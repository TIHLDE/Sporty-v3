import { HttpError, getUserId, handler, readJson } from "../../server/http";
import { moderatedReports } from "../../server/moderation";
import { prisma } from "../../server/prisma";

/** Sletter det rapporterte innholdet. Meldinger blir stående som «Meldingen ble slettet». */
function removeContent(report: {
	messageId: string | null;
	announcementCommentId: string | null;
	pollCommentId: string | null;
}) {
	if (report.messageId) {
		return prisma.message.update({
			where: { id: report.messageId },
			data: {
				body: "",
				deletedAt: new Date(),
				gifSlug: null,
				gifUrl: null,
				gifWidth: null,
				gifHeight: null,
			},
		});
	}
	if (report.announcementCommentId) {
		return prisma.announcementComment.deleteMany({
			where: { id: report.announcementCommentId },
		});
	}
	return prisma.pollComment.deleteMany({
		where: { id: report.pollCommentId ?? "" },
	});
}

/**
 * Behandle en rapport: `remove` sletter innholdet for alle, `dismiss` lar det stå. Andre åpne
 * rapporter om det samme lukkes samtidig, så flere ikke må vurdere det samme.
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

		const { messageId, announcementCommentId, pollCommentId } = report;
		const sameContent = messageId
			? { messageId }
			: announcementCommentId
				? { announcementCommentId }
				: pollCommentId
					? { pollCommentId }
					: { id: report.id };

		// Rapportene lukkes først: å slette en kommentar tømmer koblingen fra rapporten.
		await prisma.$transaction([
			prisma.messageReport.updateMany({
				where: { ...sameContent, status: "open" },
				data: {
					status: action === "remove" ? "removed" : "dismissed",
					resolvedAt: new Date(),
					resolvedById: userId,
				},
			}),
			...(action === "remove" ? [removeContent(report)] : []),
		]);
		return { ok: true };
	},
);
