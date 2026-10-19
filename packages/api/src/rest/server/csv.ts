// CSV for eksport. Semikolon som skilletegn og BOM først, så Excel med norsk oppsett åpner
// filen riktig (komma er desimaltegn i norsk Excel, og uten BOM blir æøå feil).

const escape = (value: string | number | null | undefined) => {
	const text = value == null ? "" : String(value);
	return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(rows: (string | number | null | undefined)[][]) {
	return "﻿" + rows.map((row) => row.map(escape).join(";")).join("\r\n");
}

export function csvResponse(
	fileName: string,
	rows: (string | number | null | undefined)[][],
) {
	return new Response(toCsv(rows), {
		headers: {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
		},
	});
}

const dateFormat = new Intl.DateTimeFormat("nb-NO", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	timeZone: "Europe/Oslo",
});
const timeFormat = new Intl.DateTimeFormat("nb-NO", {
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "Europe/Oslo",
});

export const csvDate = (date: Date) => dateFormat.format(date);
export const csvTime = (date: Date) => timeFormat.format(date);

/** Filnavn uten tegn som ikke tåles i filsystemer, f.eks. "Herrer 11'er" -> "Herrer-11er". */
export const fileSafe = (name: string) =>
	name
		.normalize("NFKD")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
