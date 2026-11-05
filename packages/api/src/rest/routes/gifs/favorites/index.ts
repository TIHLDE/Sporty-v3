import { parseGif } from "../../../server/gifs";
import { getUserId, handler, readJson } from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { FavoriteGif } from "../../../types";

const toFavorite = (row: FavoriteGif) => ({
	slug: row.slug,
	title: row.title,
	url: row.url,
	width: row.width,
	height: row.height,
});

/** Brukerens favoritt-GIF-er, sist lagret først. */
export const GET = handler(async (request): Promise<FavoriteGif[]> => {
	const userId = await getUserId(request);
	const rows = await prisma.favoriteGif.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});
	return rows.map(toFavorite);
});

/** Lagre en GIF i favorittene. Er den der fra før, skjer det ingenting. */
export const POST = handler(async (request): Promise<FavoriteGif> => {
	const userId = await getUserId(request);
	const input = await readJson<Partial<FavoriteGif>>(request);
	const gif = parseGif(input);
	const title =
		typeof input.title === "string" ? input.title.slice(0, 200) : "";
	const row = await prisma.favoriteGif.upsert({
		where: { userId_slug: { userId, slug: gif.slug } },
		create: { userId, title, ...gif },
		update: {},
	});
	return toFavorite(row);
});
