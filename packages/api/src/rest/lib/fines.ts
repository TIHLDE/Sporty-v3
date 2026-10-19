import type { FineStatus } from "../types";

/** "1 bot", "2 bøter" */
export function formatFineCount(count: number) {
	return `${count} ${count === 1 ? "bot" : "bøter"}`;
}

/** "§1.00 — Oppmøte", eller "Uten paragraf" for bøter fra tihlde.org gitt uten en. */
export function formatLaw(law: { paragraph: string; title: string } | null) {
	return law ? `§${law.paragraph} — ${law.title}` : "Uten paragraf";
}

/** Ubetalte bøter er de som venter og de som er godkjent. Avviste og betalte skyldes ikke. */
export function isUnpaid(fine: { status: FineStatus }) {
	return fine.status === "pending" || fine.status === "approved";
}

export const FINE_STATUS_LABEL: Record<FineStatus, string> = {
	pending: "Venter",
	approved: "Ubetalt",
	paid: "Betalt",
	rejected: "Avvist",
};
