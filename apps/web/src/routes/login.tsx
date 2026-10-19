import { Button } from "@sporty/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@sporty/ui/components/card";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

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
			<Card className="w-full max-w-sm">
				<CardHeader>
					<p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
						TIHLDE
					</p>
					<CardTitle className="text-3xl font-bold">Sporty</CardTitle>
					<CardDescription>
						Du logger inn med TIHLDE-kontoen din.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3">
					<Button
						size="lg"
						disabled={signIn.isPending}
						onClick={() => signIn.mutate()}
					>
						{signIn.isPending
							? "Sender deg til tihlde.org…"
							: "Logg inn med TIHLDE"}
					</Button>
					{signIn.isError && (
						<p className="text-sm text-destructive">{signIn.error.message}</p>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
