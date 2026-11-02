// Lagring av opplastede filer på disk. Holder for lokal utvikling; i produksjon byttes dette
// ut med objektlagring (f.eks. S3), mens Upload-tabellen og API-et kan forbli det samme.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

export async function saveFile(id: string, data: ArrayBuffer | Uint8Array) {
	await mkdir(UPLOAD_DIR, { recursive: true });
	await writeFile(
		path.join(UPLOAD_DIR, id),
		data instanceof Uint8Array ? data : Buffer.from(data),
	);
}

export async function readStoredFile(id: string) {
	// id er alltid en cuid fra databasen, men vi sjekker likevel at den ikke kan peke ut av mappen.
	if (!/^[a-z0-9]+$/i.test(id)) throw new Error("Ugyldig fil-id");
	return readFile(path.join(UPLOAD_DIR, id));
}
