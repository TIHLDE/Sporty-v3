import {
	csvDate,
	csvResponse,
	csvTime,
	fileSafe,
} from "../../../../server/csv";
import {
	getUserId,
	handler,
	requireManagerOrParent,
} from "../../../../server/http";
import { prisma } from "../../../../server/prisma";

/** (Sub-/admin) Kampresultater som CSV: alle kamper som har startet, med resultat og utfall. */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireManagerOrParent(userId, groupId);

		const group = await prisma.group.findUniqueOrThrow({
			where: { id: groupId },
		});
		const matches = await prisma.event.findMany({
			where: { groupId, type: "kamp", startsAt: { lte: new Date() } },
			orderBy: { startsAt: "asc" },
		});

		const rows = matches.map((m) => {
			const hasResult = m.ourScore !== null && m.theirScore !== null;
			const outcome = !hasResult
				? ""
				: m.ourScore! > m.theirScore!
					? "Seier"
					: m.ourScore! < m.theirScore!
						? "Tap"
						: "Uavgjort";
			return [
				csvDate(m.startsAt),
				csvTime(m.startsAt),
				m.title,
				m.opponent ?? "",
				m.locationName,
				hasResult ? `${m.ourScore}–${m.theirScore}` : "Ikke registrert",
				m.ourScore,
				m.theirScore,
				outcome,
			];
		});

		const played = matches.filter(
			(m) => m.ourScore !== null && m.theirScore !== null,
		);
		const count = (fn: (m: (typeof played)[number]) => boolean) =>
			played.filter(fn).length;
		const summary = [
			"Totalt",
			"",
			`${played.length} kamper med resultat`,
			"",
			"",
			"",
			played.reduce((sum, m) => sum + m.ourScore!, 0),
			played.reduce((sum, m) => sum + m.theirScore!, 0),
			`${count((m) => m.ourScore! > m.theirScore!)} seier, ${count((m) => m.ourScore! === m.theirScore!)} uavgjort, ${count((m) => m.ourScore! < m.theirScore!)} tap`,
		];

		const date = new Date().toISOString().slice(0, 10);
		return csvResponse(`Resultater-${fileSafe(group.name)}-${date}.csv`, [
			[
				"Dato",
				"Tid",
				"Kamp",
				"Motstander",
				"Sted",
				"Resultat",
				"Mål for",
				"Mål mot",
				"Utfall",
			],
			...rows,
			[],
			summary,
		]);
	},
);
