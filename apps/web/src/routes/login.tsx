import { Button } from "@sporty/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import SplitFlapText from "@/components/split-flap-text";
import { getUser } from "@/functions/get-user";
import { authClient } from "@/lib/auth-client";

// The only page you can see without being signed in.
export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		if (await getUser()) {
			throw redirect({ to: "/" });
		}
	},
	component: LoginComponent,
});

/**
 * Innloggingen som en billett: SPORTY klaprer fram på flipbrikker i den mørke delen
 * (står stille med «Reduser bevegelse»), og selve innloggingen under.
 */
function LoginComponent() {
	const signIn = useMutation({
		mutationFn: async () => {
			const result = await authClient.signIn.social({
				provider: "photon",
				callbackURL: "/",
				errorCallbackURL: "/login",
			});
			if (result.error) {
				throw new Error(result.error.message ?? "Innlogging med TIHLDE feilet");
			}
		},
	});

	return (
		<main className="flex min-h-svh items-center justify-center bg-background p-4">
			<div className="w-full max-w-[32.5rem] overflow-hidden rounded-3xl border border-board-edge bg-card">
				<div className="flex flex-col items-center gap-4 bg-board px-5 pt-9 pb-8 sm:px-10 sm:pt-11">
					<h1 className="sr-only">Sporty</h1>
					<SplitFlapText
						aria-hidden
						text="SPORTY"
						padTo={6}
						loop={false}
						charset="alpha"
						flipsPerChar={6}
						stagger={0.08}
						tileColor="#1a1d24"
						textColor="#ffffff"
						tileRadius={8}
						fontSize="clamp(2.6rem, 11vw, 3.7rem)"
						gap="clamp(5px, 1.4vw, 8px)"
						style={{ fontFamily: "var(--font-sans)", fontWeight: 800 }}
					/>
					<p className="text-xs font-semibold tracking-[0.3em] text-board-subtle">
						TIHLDE
					</p>
				</div>
				<div className="grid gap-4 border-t border-dashed border-input p-6 sm:p-10 sm:pt-8">
					<div className="grid gap-1.5">
						<h2 className="text-2xl font-bold">Logg inn</h2>
						<p className="text-muted-foreground">
							Du logger inn med TIHLDE-kontoen din.
						</p>
					</div>
					<Button
						size="lg"
						className="h-12 rounded-xl text-[15px] font-bold"
						disabled={signIn.isPending}
						onClick={() => signIn.mutate()}
					>
						{signIn.isPending
							? "Sender deg til tihlde.org…"
							: "Logg inn med TIHLDE"}
					</Button>
					{signIn.isError && (
						<p role="alert" className="text-sm text-destructive">
							{signIn.error.message}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Alt i Sporty krever innlogging.
					</p>
				</div>
			</div>
		</main>
	);
}
