import { handleRestRequest } from "@sporty/api/rest/index";
import { createFileRoute } from "@tanstack/react-router";

import "../../services";

/**
 * REST-API-et for mobilappen (Sporty Native), under /api. /api/auth og /api/trpc har egne ruter
 * og treffes før denne. services sørger for at Better Auth er koblet til, så nettsidens cookie
 * også virker her.
 */
function handler({ request }: { request: Request }) {
	const path = new URL(request.url).pathname.replace(/^\/api/, "");
	return handleRestRequest(request, path);
}

export const Route = createFileRoute("/api/$")({
	server: {
		handlers: {
			GET: handler,
			POST: handler,
			PUT: handler,
			PATCH: handler,
			DELETE: handler,
		},
	},
});
