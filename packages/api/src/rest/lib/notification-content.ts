// Tekstene i push-varsler og påminnelser. Brukes både av serveren (bøter) og appen (påminnelser),
// og av dev-skjermen som viser hvordan varslene ser ut.

import type { Event } from "../types";
import { formatTime } from "./dates";
import { formatFineCount } from "./fines";

export interface NotificationContent {
	title: string;
	body: string;
	/** Skjermen som åpnes når man trykker på varselet. */
	url: string;
}

/** Hvor lenge før start / påmeldingsfrist påminnelsene kommer. */
export const REMINDER_LEAD_MS = 60 * 60 * 1000;

export function fineContent(fine: {
	count: number;
	groupId: string;
	groupName: string;
	paragraph: string;
	lawTitle: string;
	reason: string;
}): NotificationContent {
	return {
		title: `Du har fått ${formatFineCount(fine.count)}`,
		body: `${fine.groupName} · §${fine.paragraph} ${fine.lawTitle}: ${fine.reason}`,
		url: `/grupper/${fine.groupId}`,
	};
}

type ReminderEvent = Pick<
	Event,
	"id" | "title" | "groupName" | "start" | "location"
>;

export function eventStartContent(event: ReminderEvent): NotificationContent {
	return {
		title: `${event.title} om 1 time`,
		body: `Kl. ${formatTime(event.start)} · ${event.location.name} · ${event.groupName}`,
		url: `/arrangement/${event.id}`,
	};
}

export function signupDeadlineContent(
	event: ReminderEvent & { signupDeadline: string },
): NotificationContent {
	return {
		title: `Du har ikke svart på ${event.title}`,
		body: `Påmeldingsfristen går ut kl. ${formatTime(event.signupDeadline)}. Trykk for å svare.`,
		url: `/arrangement/${event.id}`,
	};
}
