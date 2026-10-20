import { formatDateLong } from "@sporty/api/rest/lib/dates";
import { formatFineCount, isUnpaid } from "@sporty/api/rest/lib/fines";
import type { NotificationSettings, Role } from "@sporty/api/rest/types";
import { Badge } from "@sporty/ui/components/badge";
import { Button } from "@sporty/ui/components/button";
import { cn } from "@sporty/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarPlusIcon, ChevronRightIcon, LogOutIcon } from "lucide-react";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { CheckboxField } from "@/components/checkbox-field";
import { GroupAvatar } from "@/components/group-avatar";
import { PageState } from "@/components/page-state";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";
import { downloadFile, eventsToIcs } from "@/lib/ics";
import {
	getTheme,
	setTheme,
	subscribeTheme,
	THEME_OPTIONS,
	type Theme,
} from "@/lib/theme";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/profil")({
	component: ProfileComponent,
});

const ROLE_LABEL: Record<Role, string> = {
	admin: "Admin",
	subadmin: "Subadmin",
	member: "Medlem",
};

/** Profilen: hvem du er, gruppene dine, varsler, kalender, utseende og utlogging. */
function ProfileComponent() {
	const trpc = useTRPC();
	const me = useQuery(trpc.me.queryOptions());
	const groups = useQuery(trpc.groups.list.queryOptions());
	const fines = useQuery(trpc.fines.mine.queryOptions());
	const unpaid = (fines.data ?? [])
		.filter(isUnpaid)
		.reduce((sum, fine) => sum + fine.count, 0);

	return (
		<div className="mx-auto grid max-w-2xl grid-cols-1 gap-8">
			<PageState query={me}>
				{(user) => (
					<div className="grid gap-4">
						<div className="flex items-center gap-4">
							<UserAvatar user={user} className="size-16 text-xl" />
							<div>
								<h1 className="text-2xl font-semibold">{user.name}</h1>
								{user.email && (
									<p className="text-muted-foreground">{user.email}</p>
								)}
							</div>
						</div>
						{user.inactiveIn.map((inactive) => (
							<div
								key={inactive.groupId}
								className="grid gap-1 rounded-xl border p-4"
							>
								<div className="flex items-center gap-2">
									<Badge variant="outline">Inaktiv</Badge>
									<span className="truncate font-medium">
										{inactive.groupName}
									</span>
								</div>
								<p>{inactive.reason}</p>
								<p className="text-xs text-muted-foreground">
									Siden {formatDateLong(inactive.since)}
								</p>
							</div>
						))}
					</div>
				)}
			</PageState>

			<Link
				to="/boter"
				className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted"
			>
				<span>
					<span className="block text-sm text-muted-foreground">
						Ubetalte bøter
					</span>
					<span className="text-xl font-semibold">
						{formatFineCount(unpaid)}
					</span>
				</span>
				<ChevronRightIcon className="size-4 text-muted-foreground" />
			</Link>

			<Section title="Mine grupper">
				<PageState query={groups}>
					{(data) => (
						<div className="divide-y">
							{data.map((group) => (
								<Link
									key={group.id}
									to="/grupper/$groupId"
									params={{ groupId: group.id }}
									className="flex items-center gap-3 py-3 hover:opacity-80"
								>
									<GroupAvatar group={group} size={32} />
									<span className="flex-1 font-medium">{group.name}</span>
									{group.myRole && group.myRole !== "member" && (
										<Badge variant="secondary">
											{ROLE_LABEL[group.myRole]}
										</Badge>
									)}
								</Link>
							))}
						</div>
					)}
				</PageState>
			</Section>

			<PushSection />
			<CalendarSection />
			<AppearanceSection />
			<SignOut />
		</div>
	);
}

function Section({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="grid gap-3">
			<div>
				<h2 className="font-medium">{title}</h2>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			<div className="rounded-xl border px-4 py-2">{children}</div>
		</section>
	);
}

/** Pushvarslene sendes til appen. Valgene lagres på brukeren, så de gjelder alle telefonene. */
function PushSection() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.settings.get.queryOptions());
	const update = useMutation(
		trpc.settings.update.mutationOptions({
			onSuccess: (data) =>
				queryClient.setQueryData(trpc.settings.get.queryKey(), data),
			onError: (error) => toast.error(error.message),
		}),
	);
	const set = (changes: Partial<NotificationSettings>) =>
		update.mutate(changes);

	return (
		<Section
			title="Pushvarsler"
			description="Varslene sendes til Sporty-appen på telefonen din."
		>
			<PageState query={settings}>
				{(data) => (
					<div className="grid gap-3 py-2">
						<CheckboxField
							checked={data.pushEnabled}
							onCheckedChange={(pushEnabled) => set({ pushEnabled })}
						>
							Alle pushvarsler
						</CheckboxField>
						<div
							className={cn(
								"grid gap-3 pl-6",
								!data.pushEnabled && "pointer-events-none opacity-50",
							)}
						>
							<CheckboxField
								checked={data.pushFines}
								disabled={!data.pushEnabled}
								onCheckedChange={(pushFines) => set({ pushFines })}
							>
								Når jeg får bot
							</CheckboxField>
							<CheckboxField
								checked={data.pushMessages}
								disabled={!data.pushEnabled}
								onCheckedChange={(pushMessages) => set({ pushMessages })}
							>
								Nye meldinger
							</CheckboxField>
							<CheckboxField
								checked={data.pushEventReminders}
								disabled={!data.pushEnabled}
								onCheckedChange={(pushEventReminders) =>
									set({ pushEventReminders })
								}
							>
								1 time før arrangement
							</CheckboxField>
							<CheckboxField
								checked={data.pushSignupReminders}
								disabled={!data.pushEnabled}
								onCheckedChange={(pushSignupReminders) =>
									set({ pushSignupReminders })
								}
							>
								1 time før påmeldingsfrist (bare hvis du ikke har svart)
							</CheckboxField>
						</div>
					</div>
				)}
			</PageState>
		</Section>
	);
}

/**
 * Appen legger arrangementene rett i kalenderen på telefonen. En nettside kan ikke det, så her
 * lastes de ned som en .ics-fil som kan åpnes i kalenderen. En ny fil oppdaterer arrangementene.
 */
function CalendarSection() {
	const trpc = useTRPC();
	const me = useQuery(trpc.me.queryOptions());
	const events = useQuery(trpc.events.upcoming.queryOptions());
	const [accepted, setAccepted] = useState(true);
	const [unanswered, setUnanswered] = useState(true);

	const myId = me.data?.id;
	const selected = (events.data ?? []).filter((event) => {
		const status = myId ? event.attendance[myId] : undefined;
		if (status === "kommer") return accepted;
		if (status === "kommer_ikke") return false;
		return unanswered && Boolean(myId && event.memberIds.includes(myId));
	});

	return (
		<Section
			title="Kalender"
			description="Last ned de kommende arrangementene og åpne filen i kalenderen din. Last ned på nytt for å få med endringer."
		>
			<div className="grid gap-3 py-2">
				<CheckboxField checked={accepted} onCheckedChange={setAccepted}>
					Arrangementer du har svart «Kommer» på
				</CheckboxField>
				<CheckboxField checked={unanswered} onCheckedChange={setUnanswered}>
					Arrangementer du ikke har svart på ennå
				</CheckboxField>
				<Button
					variant="outline"
					className="justify-self-start"
					disabled={!events.data || !me.data || selected.length === 0}
					onClick={() =>
						downloadFile(
							"sporty.ics",
							eventsToIcs(selected, window.location.origin),
							"text/calendar",
						)
					}
				>
					<CalendarPlusIcon />
					Last ned kalender ({selected.length})
				</Button>
			</div>
		</Section>
	);
}

function AppearanceSection() {
	// Valget ligger i nettleseren. Serveren vet det ikke, så den tegner «Automatisk».
	const stored = useSyncExternalStore(
		subscribeTheme,
		getTheme,
		() => "system" as const,
	);
	const [chosen, setChosen] = useState<Theme | null>(null);
	const theme = chosen ?? stored;

	return (
		<Section title="Utseende">
			<div className="grid gap-1 py-2 sm:grid-cols-3">
				{THEME_OPTIONS.map((option) => (
					<button
						key={option.value}
						type="button"
						aria-pressed={theme === option.value}
						onClick={() => {
							setTheme(option.value);
							setChosen(option.value);
						}}
						className="rounded-lg border border-transparent p-3 text-left hover:bg-muted aria-pressed:border-foreground"
					>
						<span className="block font-medium">{option.label}</span>
						<span className="text-xs text-muted-foreground">
							{option.description}
						</span>
					</button>
				))}
			</div>
		</Section>
	);
}

function SignOut() {
	const navigate = useNavigate();
	return (
		<Button
			variant="ghost"
			className="justify-self-start text-destructive"
			onClick={() =>
				window.confirm("Vil du logge ut av Sporty?") &&
				authClient.signOut({
					fetchOptions: { onSuccess: () => navigate({ to: "/login" }) },
				})
			}
		>
			<LogOutIcon />
			Logg ut
		</Button>
	);
}
