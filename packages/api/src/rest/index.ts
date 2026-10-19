// REST-API-et appen (Sporty Native) bruker: samme stier og svar som appens egen server hadde.
// Nettsiden monterer det under /api (se apps/web/src/routes/api/$.ts). Nettsiden selv bruker tRPC.

import { routes } from "./routes.gen";

export { configureWebAuth, type WebAuth } from "./server/http";

type Handler = (
	request: Request,
	params: Record<string, string>,
) => Promise<Response> | Response;

/** Sammenligner `/groups/:groupId` med `/groups/abc`, og gir parametrene hvis stien passer. */
function match(pattern: string, path: string): Record<string, string> | null {
	const want = pattern.split("/").filter(Boolean);
	const got = path.split("/").filter(Boolean);
	if (want.length !== got.length) return null;
	const params: Record<string, string> = {};
	for (const [i, segment] of want.entries()) {
		const actual = got[i]!;
		if (segment.startsWith(":"))
			params[segment.slice(1)] = decodeURIComponent(actual);
		else if (segment !== actual) return null;
	}
	return params;
}

/** Besvarer en forespørsel til `/api<path>`. `path` er stien uten `/api`, f.eks. `/groups`. */
export async function handleRestRequest(
	request: Request,
	path: string,
): Promise<Response> {
	for (const route of routes) {
		const params = match(route.pattern, path);
		if (!params) continue;
		const handler = (route.module as Record<string, unknown>)[request.method];
		if (typeof handler !== "function") {
			return Response.json({ error: "Metoden støttes ikke" }, { status: 405 });
		}
		return (handler as Handler)(request, params);
	}
	return Response.json({ error: "Fant ikke API-ruten" }, { status: 404 });
}
