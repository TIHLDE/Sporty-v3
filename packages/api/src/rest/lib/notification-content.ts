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

/** Så mye av meldingen som vises i varselet. iOS kutter uansett etter noen linjer. */
const MESSAGE_PREVIEW_LENGTH = 150;

/** Ny melding: i gruppechatter med gruppenavnet som tittel og avsenderen foran teksten. */
export function messageContent(message: {
	conversationId: string;
	senderName: string;
	groupName: string | null;
	body: string;
}): NotificationContent {
	const text =
		message.body.length > MESSAGE_PREVIEW_LENGTH
			? `${message.body.slice(0, MESSAGE_PREVIEW_LENGTH).trimEnd()}…`
			: message.body;
	return {
		title: message.groupName ?? message.senderName,
		body: message.groupName ? `${message.senderName}: ${text}` : text,
		url: `/meldinger/${message.conversationId}`,
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
