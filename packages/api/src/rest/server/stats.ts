// Statistikk for en gruppe per semester eller alle år. Kun serverkode.
//
// Oppmøte er påmelding: svart «kommer» på arrangementer som har startet. Det regnes ut fra dagens
// aktive medlemmer og deres siste svar, siden det ikke lagres når noen ble medlem eller hva de
// svarte først. Semestre følger norsk tid: vår = januar–juni, høst = juli–desember.

import type * as Dto from "../types";
import { toUser } from "./dto";
import { prisma } from "./prisma";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const osloFormat = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Europe/Oslo",
	year: "numeric",
	month: "2-digit",
	weekday: "short",
	hour: "2-digit",
	hourCycle: "h23",
});

/** År, måned (1–12), ukedag (0 = mandag) og time i norsk tid. */
function osloParts(date: Date) {
	const parts = Object.fromEntries(
		osloFormat.formatToParts(date).map((p) => [p.type, p.value]),
	);
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		weekday: WEEKDAYS.indexOf(parts.weekday ?? ""),
		hour: Number(parts.hour),
	};
}

/** «2026-H» for høsten 2026, «2026-V» for våren. */
function semesterOf(date: Date) {
	const { year, month } = osloParts(date);
	return `${year}-${month <= 6 ? "V" : "H"}`;
}

function periodLabel(id: string) {
	if (id === "all") return "Alle år";
	const [year, half] = id.split("-");
	return `${half === "H" ? "Høst" : "Vår"} ${year}`;
}

function previousSemester(id: string) {
	const [year, half] = id.split("-");
	return half === "H" ? `${year}-V` : `${Number(year) - 1}-H`;
}

/** Start og slutt for et semester, til databasespørringer (norsk tid, med sommertid). */
function semesterRange(id: string) {
	const [year, half] = id.split("-");
	const y = Number(year);
	return half === "V"
		? {
				gte: new Date(`${y}-01-01T00:00:00+01:00`),
				lt: new Date(`${y}-07-01T00:00:00+02:00`),
			}
		: {
				gte: new Date(`${y}-07-01T00:00:00+02:00`),
				lt: new Date(`${y + 1}-01-01T00:00:00+01:00`),
			};
}

const rate = (count: number, total: number) =>
	total > 0 ? count / total : null;

/** Høyest verdi først, med navn som tie-break. Uten `includeZero` bare de over null. */
function ranked(rows: Dto.StatsPerson[], { includeZero = false } = {}) {
	return rows
		.filter((r) => includeZero || r.value > 0)
		.sort(
			(a, b) => b.value - a.value || a.user.name.localeCompare(b.user.name),
		);
}

export async function getGroupStats(
	groupId: string,
	userId: string,
	requestedPeriod: string | null,
	canManage: boolean,
): Promise<Dto.GroupStats> {
	const now = new Date();
	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		include: { memberships: { include: { user: true } } },
	});
	const active = group.memberships.filter((m) => !m.inactiveSince);
	const activeIds = new Set(active.map((m) => m.userId));

	const allEvents = await prisma.event.findMany({
		where: { groupId, startsAt: { lt: now } },
		include: {
			attendances: true,
			matchStats: { include: { type: true, user: true } },
		},
		orderBy: { startsAt: "asc" },
	});

	const currentSemester = semesterOf(now);
	const semesters = [
		...new Set([
			currentSemester,
			...allEvents.map((e) => semesterOf(e.startsAt)),
		]),
	].sort((a, b) => b.localeCompare(a));
	const periodId =
		requestedPeriod &&
		(requestedPeriod === "all" || semesters.includes(requestedPeriod))
			? requestedPeriod
			: currentSemester;
	const inPeriod = (date: Date) =>
		periodId === "all" || semesterOf(date) === periodId;
	const events = allEvents.filter((e) => inPeriod(e.startsAt));

	const statusOf = (event: (typeof events)[number], memberId: string) =>
		event.attendances.find((a) => a.userId === memberId) ?? null;
	const comingCount = (event: (typeof events)[number]) =>
		event.attendances.filter(
			(a) => a.status === "kommer" && activeIds.has(a.userId),
		).length;
	const teamRate = (list: typeof events) =>
		rate(
			list.reduce((sum, e) => sum + comingCount(e), 0),
			list.length * activeIds.size,
		);
	const isGoal = (name: string) => name.trim().toLowerCase() === "mål";
	const trainings = events.filter((e) => e.type === "trening");

	// Per medlem: hvor mange arrangementer og treninger de har sagt «kommer» til.
	const attendedBy = new Map<string, number>();
	const trainingsBy = new Map<string, number>();
	for (const event of events) {
		for (const a of event.attendances) {
			if (a.status !== "kommer") continue;
			attendedBy.set(a.userId, (attendedBy.get(a.userId) ?? 0) + 1);
			if (event.type === "trening")
				trainingsBy.set(a.userId, (trainingsBy.get(a.userId) ?? 0) + 1);
		}
	}

	// Lagets tall
	const scored = events.filter(
		(e) => e.type === "kamp" && e.ourScore !== null && e.theirScore !== null,
	);
	const resultOf = (e: (typeof scored)[number]): Dto.MatchResult =>
		e.ourScore! > e.theirScore! ? "S" : e.ourScore! < e.theirScore! ? "T" : "U";
	const results = scored.map(resultOf);
	// Samme motstander skrevet litt ulikt («NTNUI» / «ntnui ») telles sammen.
	const opponents = new Map<string, Dto.StatsOpponent>();
	for (const e of scored) {
		const name = e.opponent?.trim() || "Ukjent motstander";
		const key = name.toLowerCase();
		const row = opponents.get(key) ?? {
			name,
			wins: 0,
			draws: 0,
			losses: 0,
			goalsFor: 0,
			goalsAgainst: 0,
		};
		const result = resultOf(e);
		if (result === "S") row.wins++;
		else if (result === "U") row.draws++;
		else row.losses++;
		row.goalsFor += e.ourScore!;
		row.goalsAgainst += e.theirScore!;
		opponents.set(key, row);
	}
	const goalsBy = new Map<string, { user: Dto.User; value: number }>();
	for (const stat of events.flatMap((e) => e.matchStats)) {
		if (!isGoal(stat.type.name)) continue;
		const row = goalsBy.get(stat.userId) ?? {
			user: toUser(stat.user),
			value: 0,
		};
		row.value++;
		goalsBy.set(stat.userId, row);
	}
	const slots = new Map<
		string,
		{ weekday: number; hour: number; list: typeof events }
	>();
	for (const event of events) {
		const { weekday, hour } = osloParts(event.startsAt);
		const key = `${weekday}-${hour}`;
		const slot = slots.get(key) ?? { weekday, hour, list: [] };
		slot.list.push(event);
		slots.set(key, slot);
	}
	const bestSlot =
		[...slots.values()]
			.filter((s) => s.list.length >= 2)
			.map((s) => ({
				weekday: s.weekday,
				hour: s.hour,
				rate: teamRate(s.list) ?? 0,
			}))
			.sort((a, b) => b.rate - a.rate)[0] ?? null;

	const team: Dto.TeamStats = {
		attendanceRate: teamRate(events),
		previousAttendanceRate:
			periodId === "all"
				? null
				: teamRate(
						allEvents.filter(
							(e) => semesterOf(e.startsAt) === previousSemester(periodId),
						),
					),
		events: {
			total: events.length,
			trening: trainings.length,
			kamp: events.filter((e) => e.type === "kamp").length,
			sosialt: events.filter((e) => e.type === "sosialt").length,
			annet: events.filter((e) => e.type === "annet").length,
		},
		matches: {
			wins: results.filter((r) => r === "S").length,
			draws: results.filter((r) => r === "U").length,
			losses: results.filter((r) => r === "T").length,
			goalsFor: scored.reduce((sum, e) => sum + e.ourScore!, 0),
			goalsAgainst: scored.reduce((sum, e) => sum + e.theirScore!, 0),
			form: results.slice(-5),
			games: scored
				.map((e) => ({
					eventId: e.id,
					title: e.title,
					opponent: e.opponent,
					start: e.startsAt.toISOString(),
					ourScore: e.ourScore!,
					theirScore: e.theirScore!,
					result: resultOf(e),
				}))
				.reverse(),
			opponents: [...opponents.values()].sort(
				(a, b) =>
					b.wins + b.draws + b.losses - (a.wins + a.draws + a.losses) ||
					a.name.localeCompare(b.name),
			),
		},
		scorers: ranked([...goalsBy.values()].map((r) => ({ ...r, total: null }))),
		trainings: ranked(
			active.map((m) => ({
				user: toUser(m.user),
				value: trainingsBy.get(m.userId) ?? 0,
				total: trainings.length,
			})),
			// Alle aktive medlemmer, også de som ikke har vært på noen.
			{ includeZero: true },
		),
		bestSlot,
	};

	// Mine tall
	const fineGroupId = group.parentId ?? group.id;
	const createdAt = periodId === "all" ? undefined : semesterRange(periodId);
	let me: Dto.MyStats | null = null;
	if (group.memberships.some((m) => m.userId === userId)) {
		const mine = (list: typeof events) => ({
			count: list.filter((e) => statusOf(e, userId)?.status === "kommer")
				.length,
			total: list.length,
		});
		const absent = events.filter(
			(e) => statusOf(e, userId)?.status === "kommer_ikke",
		);
		const months = new Map<string, typeof events>();
		for (const event of events) {
			const { year, month } = osloParts(event.startsAt);
			const key = `${year}-${String(month).padStart(2, "0")}`;
			months.set(key, [...(months.get(key) ?? []), event]);
		}
		const weekdays = new Map<number, typeof events>();
		for (const event of events) {
			const { weekday } = osloParts(event.startsAt);
			weekdays.set(weekday, [...(weekdays.get(weekday) ?? []), event]);
		}
		const favorite = [...weekdays.entries()]
			.map(([weekday, list]) => ({ weekday, ...mine(list) }))
			.filter((w) => w.count > 0)
			.sort((a, b) => b.count - a.count || a.weekday - b.weekday)[0];
		const myAttended = attendedBy.get(userId) ?? 0;
		const fines = await prisma.fine.aggregate({
			_sum: { count: true },
			where: { groupId: fineGroupId, userId, createdAt },
		});

		me = {
			attendance: mine(events),
			trainings: mine(trainings),
			matches: mine(events.filter((e) => e.type === "kamp")),
			goals: goalsBy.get(userId)?.value ?? 0,
			fines: fines._sum.count ?? 0,
			absences: {
				count: absent.length,
				total: events.length,
				withReason: absent.filter((e) => statusOf(e, userId)?.reason).length,
			},
			monthly: [...months.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([month, list]) => ({ month, ...mine(list) })),
			rank:
				events.length === 0
					? null
					: 1 +
						active.filter((m) => (attendedBy.get(m.userId) ?? 0) > myAttended)
							.length,
			favoriteWeekday: favorite ?? null,
		};
	}

	// Bare for sub-/admin
	let admin: Dto.AdminStats | null = null;
	if (canManage) {
		const unansweredBy = new Map<string, number>();
		let unanswered = 0;
		for (const event of events) {
			for (const id of activeIds) {
				if (statusOf(event, id)) continue;
				unanswered++;
				unansweredBy.set(id, (unansweredBy.get(id) ?? 0) + 1);
			}
		}
		const collective = events.filter((e) => e.collectiveFineAt !== null);
		const collectiveFines = await prisma.fine.aggregate({
			_sum: { count: true },
			where: { collective: true, eventId: { in: collective.map((e) => e.id) } },
		});
		const payments = (
			await prisma.paymentRequest.findMany({
				where: { groupId },
				include: { confirmations: true },
				orderBy: { dueDate: "desc" },
			})
		).filter((p) => inPeriod(p.dueDate));
		const approved = payments.flatMap((p) =>
			p.confirmations
				.filter((c) => c.status === "approved")
				.map((c) => ({ ...c, dueDate: p.dueDate })),
		);
		const reviewed = approved.filter((c) => c.reviewedAt);

		admin = {
			unansweredRate: rate(unanswered, events.length * activeIds.size),
			collectiveFines: {
				events: collective.length,
				fines: collectiveFines._sum.count ?? 0,
			},
			leastResponsive: ranked(
				active.map((m) => ({
					user: toUser(m.user),
					value: unansweredBy.get(m.userId) ?? 0,
					total: events.length,
				})),
			).slice(0, 3),
			payments: {
				onTimeRate: rate(
					approved.filter((c) => c.createdAt <= c.dueDate).length,
					approved.length,
				),
				avgApprovalHours:
					reviewed.length === 0
						? null
						: reviewed.reduce(
								(sum, c) =>
									sum + (c.reviewedAt!.getTime() - c.createdAt.getTime()),
								0,
							) /
							reviewed.length /
							3_600_000,
				open: payments
					.map((p) => ({
						id: p.id,
						title: p.title,
						approved: p.confirmations.filter((c) => c.status === "approved")
							.length,
						pending: p.confirmations.filter((c) => c.status === "pending")
							.length,
						memberCount: group.memberships.length,
					}))
					.filter((p) => p.approved < p.memberCount)
					.slice(0, 5),
			},
		};
	}

	return {
		period: { id: periodId, label: periodLabel(periodId) },
		periods: [...semesters, "all"].map((id) => ({
			id,
			label: periodLabel(id),
		})),
		me,
		team,
		admin,
	};
}
