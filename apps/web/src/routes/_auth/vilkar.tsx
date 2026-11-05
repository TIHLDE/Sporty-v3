import { createFileRoute } from "@tanstack/react-router";

import { TermsText } from "@/components/terms";

export const Route = createFileRoute("/_auth/vilkar")({
	component: TermsComponent,
});

function TermsComponent() {
	return (
		<div className="grid w-full max-w-2xl min-w-0 grid-cols-1 gap-6">
			<h1 className="text-2xl font-semibold">Brukervilkår</h1>
			<TermsText />
		</div>
	);
}
