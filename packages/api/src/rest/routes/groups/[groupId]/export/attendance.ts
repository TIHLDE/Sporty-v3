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

const TYPE_LABEL = {
	trening: "Trening",
	kamp: "Kamp",
	sosialt: "Sosialt",
	annet: "Annet",
};
const STATUS_LABEL = { kommer: "Kommer", kommer_ikke: "Kommer ikke" };

/**
 * (Sub-/admin) Oppmøtehistorikk som CSV: én rad per arrangement som har startet, med svaret
 * til hvert medlem i hver sin kolonne. Nederst en oppsummering per medlem.
 */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireManagerOrParent(userId, groupId);

		const group = await prisma.group.findUniqueOrThrow({
			where: { id: groupId },
			include: { memberships: { include: { user: true } } },
		});
		const members = group.memberships
			.map((m) => m.user)
			.sort((a, b) => a.name.localeCompare(b.name, "nb"));
		const events = await prisma.event.findMany({
			where: { groupId, startsAt: { lte: new Date() } },
			include: { attendances: true },
			orderBy: { startsAt: "asc" },
		});

		const header = [
			"Dato",
			"Tid",
			"Arrangement",
			"Type",
			"Kommer",
			"Kommer ikke",
			"Ikke svart",
		];
		const rows = events.map((event) => {
			const answers = new Map(
				event.attendances.map((a) => [a.userId, a.status]),
			);
			const statuses = members.map((m) => answers.get(m.id));
			return [
				csvDate(event.startsAt),
				csvTime(event.startsAt),
				event.title,
				TYPE_LABEL[event.type],
				statuses.filter((s) => s === "kommer").length,
				statuses.filter((s) => s === "kommer_ikke").length,
				statuses.filter((s) => !s).length,
				...statuses.map((s) => (s ? STATUS_LABEL[s] : "Ikke svart")),
			];
		});

		const attended = members.map(
			(m) =>
				events.filter((e) =>
					e.attendances.some((a) => a.userId === m.id && a.status === "kommer"),
				).length,
		);
		const summary = [
			"",
			"",
			"Totalt «Kommer»",
			"",
			"",
			"",
			"",
			...attended.map((n) => `${n} av ${events.length}`),
		];

		const date = new Date().toISOString().slice(0, 10);
		return csvResponse(`Oppmote-${fileSafe(group.name)}-${date}.csv`, [
			[...header, ...members.map((m) => m.name)],
			...rows,
			[],
			summary,
		]);
	},
);
