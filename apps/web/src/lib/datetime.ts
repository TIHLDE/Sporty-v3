/** Et tidspunkt som verdi for `datetime-local` (lokal tid, uten sone). */
export function toLocalInput(date: Date) {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Om `days` dager kl. 23:59, en fornuftig standardfrist. */
export function deadlineInDays(days: number) {
	const date = new Date();
	date.setDate(date.getDate() + days);
	date.setHours(23, 59, 0, 0);
	return toLocalInput(date);
}

/** Om en `datetime-local`-verdi er nå eller tidligere. */
export const isPastInput = (value: string) =>
	Boolean(value) && new Date(value).getTime() <= Date.now();
