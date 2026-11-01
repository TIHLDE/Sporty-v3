// Felles for vervhistorikken: vervene og periodene til et lag. Kun serverkode.

import type * as Dto from "../types";
import { toUser } from "./dto";
import { HttpError, isAdmin, getRole } from "./http";
import { prisma } from "./prisma";

const osloDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" });

/** Dagens dato i Norge som «2026-01-01». */
export const todayInOslo = () => osloDate.format(new Date());

/** En `@db.Date` fra databasen som «2026-01-01». */
export const toDateString = (date: Date) => date.toISOString().slice(0, 10);

/** Hovedgruppen vervene hører til: gruppen selv, eller hovedgruppen til en undergruppe. */
export async function getOfficeGroupId(groupId: string) {
	const group = await prisma.group.findUnique({
		where: { id: groupId },
		select: { id: true, parentId: true },
	});
	if (!group) throw new HttpError(404, "Fant ikke gruppen");
	return group.parentId ?? group.id;
}

export async function requireOfficeGroup(groupId: string) {
	if ((await getOfficeGroupId(groupId)) !== groupId)
		throw new HttpError(400, "Vervene styres av hovedgruppen");
}

export function parseOfficeName(name: unknown) {
	const trimmed = typeof name === "string" ? name.trim() : "";
	if (!trimmed) throw new HttpError(400, "Vervet må ha et navn");
	if (trimmed.length > 40)
		throw new HttpError(400, "Navnet kan ha maks 40 tegn");
	return trimmed;
}

function parseDate(value: unknown, label: string) {
	const text = typeof value === "string" ? value : "";
	const date = new Date(`${text}T00:00:00.000Z`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || toDateString(date) !== text)
		throw new HttpError(400, `Ugyldig ${label}`);
	return date;
}

export function parsePeriodInput(input: Partial<Dto.OfficePeriodInput>) {
	const name = typeof input.name === "string" ? input.name.trim() : "";
	if (name.length > 60) throw new HttpError(400, "Navnet kan ha maks 60 tegn");
	const startsOn = parseDate(input.from, "fra-dato");
	const endsOn = parseDate(input.to, "til-dato");
	if (endsOn < startsOn)
		throw new HttpError(400, "Til-datoen kan ikke være før fra-datoen");
	return { name, startsOn, endsOn };
}

export async function findPeriod(groupId: string, periodId: string) {
	const period = await prisma.officePeriod.findUnique({
		where: { id: periodId },
	});
	if (!period || period.groupId !== groupId)
		throw new HttpError(404, "Fant ikke perioden");
	return period;
}

/** Vervhistorikken for gruppen (fra hovedgruppen hvis det er en undergruppe). */
export async function getOfficeHistory(
	groupId: string,
	userId: string,
): Promise<Dto.OfficeHistory> {
	const officeGroupId = await getOfficeGroupId(groupId);
	const [offices, periods, role] = await Promise.all([
		prisma.groupOffice.findMany({
			where: { groupId: officeGroupId },
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		}),
		prisma.officePeriod.findMany({
			where: { groupId: officeGroupId },
			include: { holders: { include: { user: true } } },
			orderBy: [{ startsOn: "desc" }, { endsOn: "desc" }],
		}),
		getRole(userId, officeGroupId),
	]);

	return {
		groupId: officeGroupId,
		offices,
		periods: periods.map((period) => ({
			id: period.id,
			name: period.name,
			from: toDateString(period.startsOn),
			to: toDateString(period.endsOn),
			holders: offices
				.map((office) => ({
					office,
					users: period.holders
						.filter((h) => h.officeId === office.id)
						.map((h) => toUser(h.user))
						.sort((a, b) => a.name.localeCompare(b.name)),
				}))
				.filter((h) => h.users.length > 0),
		})),
		canEdit: isAdmin(role),
	};
}

/** Vervene hver person har i periodene som gjelder i dag, til medlemslisten. */
export async function getCurrentOffices(groupId: string) {
	const today = new Date(`${todayInOslo()}T00:00:00.000Z`);
	const holders = await prisma.officeHolder.findMany({
		where: {
			period: {
				groupId: await getOfficeGroupId(groupId),
				startsOn: { lte: today },
				endsOn: { gte: today },
			},
		},
		select: { userId: true, office: { select: { name: true } } },
	});
	const byUser = new Map<string, string[]>();
	for (const holder of holders) {
		const names = byUser.get(holder.userId) ?? [];
		// Overlappende perioder kan gi samme verv to ganger.
		if (!names.includes(holder.office.name)) names.push(holder.office.name);
		byUser.set(holder.userId, names);
	}
	for (const names of byUser.values()) names.sort((a, b) => a.localeCompare(b));
	return byUser;
}
