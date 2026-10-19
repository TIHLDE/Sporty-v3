const LOCALE = "nb-NO";

const monthShort = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const weekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat(LOCALE, {
	day: "numeric",
	month: "short",
});
const dayMonthLong = new Intl.DateTimeFormat(LOCALE, {
	day: "numeric",
	month: "long",
});
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
	day: "numeric",
	month: "long",
	year: "numeric",
});
const time = new Intl.DateTimeFormat(LOCALE, {
	hour: "2-digit",
	minute: "2-digit",
});

/** "NOV" */
export function formatMonthShort(iso: string) {
	return monthShort.format(new Date(iso)).replace(".", "").toUpperCase();
}

/** "11" */
export function formatDayOfMonth(iso: string) {
	return String(new Date(iso).getDate());
}

/** "18:00" */
export function formatTime(iso: string) {
	return time.format(new Date(iso));
}

/** "onsdag 11. nov. kl. 20:00" */
export function formatEventStart(iso: string) {
	return `${weekdayLong.format(new Date(iso))} ${dayMonth.format(new Date(iso))} kl. ${formatTime(iso)}`;
}

/** "onsdag 11. november, 18:00–20:00", eller bare "…, 18:00" uten sluttid. */
export function formatEventRange(startIso: string, endIso: string | null) {
	const start = new Date(startIso);
	const day = `${weekdayLong.format(start)} ${dayMonthLong.format(start)}`;
	if (!endIso) return `${day}, ${formatTime(startIso)}`;
	const sameDay = new Date(endIso).toDateString() === start.toDateString();
	return sameDay
		? `${day}, ${formatTime(startIso)}–${formatTime(endIso)}`
		: `${day} ${formatTime(startIso)} – ${formatEventStart(endIso)}`;
}

/** "tor. 22. okt. kl. 18:00", kort format for skjemafelt. */
export function formatDateTimeShort(date: Date) {
	return `${weekdayShort.format(date)} ${dayMonth.format(date)} kl. ${time.format(date)}`;
}

/** "13. oktober 2026" */
export function formatDateLong(iso: string) {
	return dayMonthYear.format(new Date(iso));
}

/** "nå", "for 5 min siden", "i går", "12. okt." */
export function formatRelative(iso: string) {
	const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
	if (minutes < 1) return "nå";
	if (minutes < 60) return `for ${minutes} min siden`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `for ${hours} t siden`;
	if (hours < 48) return "i går";
	return dayMonth.format(new Date(iso));
}

/** ISO 8601-ukenummer, som brukes i Norge. */
export function getIsoWeek(iso: string) {
	const date = new Date(iso);
	const target = new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
	);
	const dayNumber = target.getUTCDay() || 7;
	target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
	const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
	return Math.ceil(
		((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
	);
}

/** Lager en ISO-dato relativt til i dag, slik at eksempeldataene alltid ligger rundt "nå". */
export function daysFromNow(days: number, hour = 18, minute = 0) {
	const date = new Date();
	date.setDate(date.getDate() + days);
	date.setHours(hour, minute, 0, 0);
	return date.toISOString();
}

export function hoursFromNow(hours: number) {
	return new Date(Date.now() + hours * 3_600_000).toISOString();
}
