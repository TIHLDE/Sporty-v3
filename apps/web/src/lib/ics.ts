import type { Event } from "@sporty/api/rest/types";

import { EVENT_TYPE_LABEL, locationLabel } from "@/lib/events";

const HOUR = 60 * 60 * 1000;

/** UTC-tid i iCalendar-format, f.eks. 20261015T160000Z. */
const icsDate = (date: Date) =>
	date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");

/** Tekst i iCalendar må ha \, ; , og linjeskift escapet. */
const icsText = (text: string) =>
	text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");

/**
 * En .ics-fil med arrangementene, som kan åpnes i Kalender, Outlook eller Google Kalender. UID-en
 * er fast per arrangement, så en ny fil oppdaterer arrangementene i stedet for å lage kopier.
 */
export function eventsToIcs(events: Event[], origin: string) {
	const now = icsDate(new Date());
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//TIHLDE//Sporty//NO",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:Sporty",
	];
	for (const event of events) {
		const start = new Date(event.start);
		// Uten sluttid: vis det som 1,5 time, som standarden når man skrur på sluttid.
		const end = event.end
			? new Date(event.end)
			: new Date(start.getTime() + 1.5 * HOUR);
		const title = `${event.title}${event.opponent ? ` mot ${event.opponent}` : ""}`;
		const description = [
			`${EVENT_TYPE_LABEL[event.type]} i ${event.groupName}`,
			event.description,
			`${origin}/arrangementer/${event.id}`,
		]
			.filter(Boolean)
			.join("\n\n");
		lines.push(
			"BEGIN:VEVENT",
			`UID:sporty-${event.id}@tihlde.org`,
			`DTSTAMP:${now}`,
			`DTSTART:${icsDate(start)}`,
			`DTEND:${icsDate(end)}`,
			`SUMMARY:${icsText(title)}`,
			`LOCATION:${icsText(locationLabel(event.location))}`,
			`GEO:${event.location.latitude};${event.location.longitude}`,
			`DESCRIPTION:${icsText(description)}`,
			`URL:${origin}/arrangementer/${event.id}`,
			"END:VEVENT",
		);
	}
	lines.push("END:VCALENDAR");
	return lines.join("\r\n");
}

/** Laster ned teksten som en fil i nettleseren. */
export function downloadFile(name: string, text: string, type: string) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	URL.revokeObjectURL(url);
}
