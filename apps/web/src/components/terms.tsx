import { TERMS_SECTIONS } from "@sporty/api/rest/lib/terms";
import { Button } from "@sporty/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

/** Selve vilkårsteksten. */
export function TermsText() {
	return (
		<div className="grid gap-4">
			{TERMS_SECTIONS.map((section) => (
				<section key={section.title} className="grid gap-1">
					<h2 className="font-medium">{section.title}</h2>
					<p className="text-sm text-muted-foreground">{section.body}</p>
				</section>
			))}
		</div>
	);
}

/** Vises i stedet for siden til brukeren har godtatt gjeldende vilkår. */
export function TermsGate() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const accept = useMutation(
		trpc.acceptTerms.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: trpc.me.queryKey() }),
			onError: (error) =>
				toast.error(`Vilkårene ble ikke lagret: ${error.message}`),
		}),
	);

	return (
		<div className="grid w-full max-w-2xl min-w-0 grid-cols-1 gap-6">
			<div>
				<h1 className="text-2xl font-semibold">Brukervilkår</h1>
				<p className="text-sm text-muted-foreground">
					Du må godta vilkårene for å bruke Sporty.
				</p>
			</div>
			<TermsText />
			<Button
				className="justify-self-start"
				disabled={accept.isPending}
				onClick={() => accept.mutate()}
			>
				Jeg godtar vilkårene
			</Button>
		</div>
	);
}
