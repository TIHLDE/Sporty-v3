import { formatRelative } from "@sporty/api/rest/lib/dates";
import {
	FINE_STATUS_LABEL,
	formatFineCount,
	formatLaw,
} from "@sporty/api/rest/lib/fines";
import type { Fine, FineStatus, GroupDetails } from "@sporty/api/rest/types";
import { Badge } from "@sporty/ui/components/badge";
import { Button } from "@sporty/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@sporty/ui/components/dialog";
import { Input } from "@sporty/ui/components/input";
import { Label } from "@sporty/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@sporty/ui/components/select";
import { Textarea } from "@sporty/ui/components/textarea";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	CircleDollarSignIcon,
	ImageIcon,
	MinusIcon,
	PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { CheckboxField } from "@/components/checkbox-field";
import { GroupAvatar } from "@/components/group-avatar";
import { EmptyText, PageState } from "@/components/page-state";
import { uploadFile } from "@/lib/upload";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/boter")({
	validateSearch: z.object({ gruppe: z.string().optional() }),
	component: FinesComponent,
});

const MAX_COUNT = 20;

/**
 * Bøtene i et lag. For lag fra tihlde.org hentes de derfra: alle medlemmer ser alle, alle kan gi
 * bot, og botsjefen og lederne godkjenner. Sporty-grupper bruker Sporty sitt eget botsystem.
 */
function FinesComponent() {
	const { gruppe } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const trpc = useTRPC();
	const groups = useQuery(trpc.groups.list.queryOptions());

	return (
		<PageState query={groups}>
			{(list) => {
				if (list.length === 0)
					return <EmptyText>Du er ikke med i noen grupper.</EmptyText>;
				const selected = list.find((g) => g.id === gruppe) ?? list[0]!;
				return (
					<div className="grid min-w-4xl grid-cols-1 items-center justify-center gap-6">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<h1 className="text-2xl font-semibold">Bøter</h1>
							<Select
								value={selected.id}
								onValueChange={(value) =>
									value && navigate({ search: { gruppe: value } })
								}
							>
								<SelectTrigger className="w-64">
									<SelectValue>
										<GroupAvatar group={selected} size={20} />
										{selected.name}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{list.map((group) => (
										<SelectItem key={group.id} value={group.id}>
											<GroupAvatar group={group} size={20} />
											{group.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<GroupFines key={selected.id} groupId={selected.id} />
					</div>
				);
			}}
		</PageState>
	);
}

function GroupFines({ groupId }: { groupId: string }) {
	const trpc = useTRPC();
	const group = useQuery(trpc.groups.get.queryOptions({ groupId }));
	return (
		<PageState query={group}>{(data) => <FinesList group={data} />}</PageState>
	);
}

function FinesList({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const { source, activated, canGive, canSettle } = group.fines;
	const fromTihlde = source === "tihlde";
	const [giving, setGiving] = useState(false);
	const [open, setOpen] = useState<Fine | null>(null);
	const fines = useInfiniteQuery(
		trpc.fines.page.infiniteQueryOptions(
			{ groupId: group.id },
			{ getNextPageParam: (last) => last.nextPage, enabled: activated },
		),
	);

	if (fromTihlde && !activated) {
		return (
			<EmptyText>Bøter er ikke slått på for laget på tihlde.org.</EmptyText>
		);
	}

	const all = fines.data?.pages.flatMap((page) => page.fines) ?? [];
	const unpaid = fines.data?.pages[0]?.unpaidCount ?? 0;

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
				<div>
					<p className="text-sm text-muted-foreground">
						{fromTihlde
							? "Ubetalt i laget"
							: group.canManage
								? "Ubetalt i gruppen"
								: "Dine ubetalte bøter"}
					</p>
					<p className="text-2xl font-semibold">{formatFineCount(unpaid)}</p>
				</div>
				{canGive && (
					<Button onClick={() => setGiving(true)}>
						<CircleDollarSignIcon />
						Gi bot
					</Button>
				)}
			</div>
			{fromTihlde && (
				<p className="text-sm text-muted-foreground">
					Bøtene hentes fra tihlde.org. Nye bøter venter på godkjenning fra
					botsjefen
					{canSettle
						? ". Trykk på en bot for å godkjenne, markere som betalt eller avvise."
						: "."}
				</p>
			)}

			<PageState query={{ ...fines, data: fines.data ? all : undefined }}>
				{(list) =>
					list.length === 0 ? (
						<EmptyText>Ingen bøter 🎉</EmptyText>
					) : (
						<div className="divide-y rounded-xl border">
							{list.map((fine) => (
								<FineRow
									key={fine.id}
									fine={fine}
									onOpen={() => setOpen(fine)}
								/>
							))}
						</div>
					)
				}
			</PageState>

			{fines.hasNextPage && (
				<Button
					variant="outline"
					disabled={fines.isFetchingNextPage}
					onClick={() => fines.fetchNextPage()}
				>
					{fines.isFetchingNextPage ? "Laster…" : "Last inn flere"}
				</Button>
			)}

			{open && (
				<FineDialog
					fine={open}
					canSettle={canSettle && open.source === "tihlde"}
					onClose={() => setOpen(null)}
				/>
			)}
			{giving && (
				<GiveFineDialog group={group} onClose={() => setGiving(false)} />
			)}
		</div>
	);
}

const settled = (status: FineStatus) =>
	status === "paid" || status === "rejected";

function FineRow({ fine, onOpen }: { fine: Fine; onOpen: () => void }) {
	return (
		<button
			type="button"
			onClick={onOpen}
			aria-label={`${formatFineCount(fine.count)} til ${fine.user.name}: ${fine.reason}`}
			className="flex w-full items-center gap-4 rounded-xl p-4 text-left hover:bg-muted/50"
		>
			<div className="min-w-0 flex-1">
				<p className="font-medium">{fine.user.name}</p>
				<p className="text-sm">{formatLaw(fine.law)}</p>
				<p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
					{fine.reason}
					{fine.imageUrl && <ImageIcon className="size-3.5 shrink-0" />}
				</p>
				<p className="text-xs text-muted-foreground">
					{fine.collective ? "Fellesbot" : `Fra ${fine.givenByName}`} ·{" "}
					{formatRelative(fine.createdAt)}
				</p>
			</div>
			<div className="grid justify-items-end gap-1">
				<span
					className={
						settled(fine.status) ? "text-muted-foreground" : "font-semibold"
					}
				>
					{formatFineCount(fine.count)}
				</span>
				<Badge variant={settled(fine.status) ? "secondary" : "outline"}>
					{FINE_STATUS_LABEL[fine.status]}
				</Badge>
			</div>
		</button>
	);
}

/** Detaljer om én bot, med bilde og (for botsjef og leder) godkjenning. */
function FineDialog({
	fine,
	canSettle,
	onClose,
}: {
	fine: Fine;
	canSettle: boolean;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const setStatus = useMutation(
		trpc.fines.setStatus.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.fines.pathKey() });
				toast.success("Boten er oppdatert");
				onClose();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const change = (status: FineStatus) =>
		setStatus.mutate({ groupId: fine.groupId, fineId: fine.id, status });

	const actions: {
		label: string;
		status: FineStatus;
		variant: "default" | "outline" | "destructive";
	}[] =
		fine.status === "pending"
			? [
					{ label: "Avvis", status: "rejected", variant: "destructive" },
					{ label: "Godkjenn", status: "approved", variant: "default" },
				]
			: fine.status === "approved"
				? [
						{ label: "Avvis", status: "rejected", variant: "destructive" },
						{ label: "Marker som betalt", status: "paid", variant: "default" },
					]
				: [
						{
							label: "Sett tilbake til venter",
							status: "pending",
							variant: "outline",
						},
					];

	// tihlde.org-bilder er private: hentes via serveren, som legger på innloggingen. Sporty-bilder
	// ligger hos oss (/api/uploads/…).
	const imageSrc =
		fine.source === "tihlde"
			? `/api/fines/${encodeURIComponent(fine.id)}/image?groupId=${encodeURIComponent(fine.groupId)}`
			: fine.imageUrl;

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{formatFineCount(fine.count)} til {fine.user.name}
					</DialogTitle>
					<DialogDescription>{formatLaw(fine.law)}</DialogDescription>
				</DialogHeader>
				<dl className="grid gap-3 text-sm">
					<Detail label="Status">{FINE_STATUS_LABEL[fine.status]}</Detail>
					<Detail label="Begrunnelse">{fine.reason}</Detail>
					<Detail label="Gitt av">
						{fine.collective ? "Fellesbot" : fine.givenByName}
					</Detail>
					<Detail label="Når">
						{new Date(fine.createdAt).toLocaleString("nb-NO")}
					</Detail>
					{fine.defense && <Detail label="Forsvar">{fine.defense}</Detail>}
				</dl>
				{fine.imageUrl && imageSrc && (
					<img
						src={imageSrc}
						alt="Bildet til boten"
						className="max-h-80 w-full rounded-lg object-contain"
					/>
				)}
				{canSettle && (
					<DialogFooter>
						{actions.map((action) => (
							<Button
								key={action.status}
								variant={action.variant}
								disabled={setStatus.isPending}
								onClick={() => change(action.status)}
							>
								{action.label}
							</Button>
						))}
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}

function Detail({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="whitespace-pre-wrap">{children}</dd>
		</div>
	);
}

/** Gi bot: paragraf fra lovverket, hvem, antall og begrunnelse. Inaktive kan ikke få bøter. */
function GiveFineDialog({
	group,
	onClose,
}: {
	group: GroupDetails;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const me = useQuery(trpc.me.queryOptions());
	const laws = useQuery(trpc.fines.laws.queryOptions({ groupId: group.id }));
	// Samme id for alle forsøk med dette skjemaet, så serveren ikke gir bøtene to ganger.
	const [requestId] = useState(() => crypto.randomUUID());
	const [lawId, setLawId] = useState<string | null>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [search, setSearch] = useState("");
	const [chosenCount, setCount] = useState<number | null>(null);
	const [reason, setReason] = useState("");
	const [image, setImage] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);

	const law = laws.data?.find((l) => l.id === lawId);
	const count =
		chosenCount ?? Math.min(Math.max(law?.defaultCount ?? 1, 1), MAX_COUNT);
	const members = group.members
		.filter((m) => m.user.id !== me.data?.id)
		.filter((m) =>
			m.user.name.toLowerCase().includes(search.trim().toLowerCase()),
		)
		.sort(
			(a, b) =>
				Number(Boolean(a.inactive)) - Number(Boolean(b.inactive)) ||
				a.user.name.localeCompare(b.user.name),
		);

	const give = useMutation(
		trpc.fines.give.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.fines.pathKey() });
				toast.success(
					group.fines.source === "tihlde"
						? "Boten er gitt og venter på godkjenning"
						: "Boten er gitt",
				);
				onClose();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const toggle = (id: string) =>
		setSelected((current) =>
			current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
		);
	const valid = lawId && selected.length > 0 && reason.trim();

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Gi bot</DialogTitle>
					<DialogDescription>
						{group.fines.source === "tihlde"
							? "Boten gis på tihlde.org og venter på godkjenning fra botsjefen."
							: group.name}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-2">
					<Label>Paragraf</Label>
					<Select value={lawId} onValueChange={(value) => setLawId(value)}>
						<SelectTrigger className="w-full">
							<SelectValue>
								{law ? formatLaw(law) : "Velg paragraf"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{(laws.data ?? []).map((l) => (
								<SelectItem key={l.id} value={l.id}>
									{formatLaw(l)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="grid gap-2">
					<Label>Hvem ({selected.length} valgt)</Label>
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Søk etter navn"
					/>
					<div className="max-h-56 divide-y overflow-y-auto rounded-md border">
						{members.map((member) =>
							member.inactive ? (
								<div
									key={member.user.id}
									className="flex items-center gap-3 px-3 py-2 opacity-50"
								>
									<span className="flex-1">{member.user.name}</span>
									<Badge variant="outline">Inaktiv</Badge>
								</div>
							) : (
								<div
									key={member.user.id}
									className="px-3 py-2 hover:bg-muted/50"
								>
									<CheckboxField
										checked={selected.includes(member.user.id)}
										onCheckedChange={() => toggle(member.user.id)}
									>
										{member.user.name}
									</CheckboxField>
								</div>
							),
						)}
					</div>
				</div>

				<div className="grid gap-2">
					<Label>Antall bøter</Label>
					<div className="flex items-center gap-3">
						<Button
							type="button"
							size="icon"
							variant="outline"
							disabled={count <= 1}
							onClick={() => setCount(count - 1)}
						>
							<MinusIcon />
						</Button>
						<span className="w-8 text-center text-xl font-semibold">
							{count}
						</span>
						<Button
							type="button"
							size="icon"
							variant="outline"
							disabled={count >= MAX_COUNT}
							onClick={() => setCount(count + 1)}
						>
							<PlusIcon />
						</Button>
					</div>
				</div>

				<div className="grid gap-2">
					<Label>Begrunnelse</Label>
					<Textarea
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Beskriv hvorfor boten gis…"
					/>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="fine-image">Bilde (valgfritt)</Label>
					<Input
						id="fine-image"
						type="file"
						accept="image/*"
						onChange={(e) => setImage(e.target.files?.[0] ?? null)}
					/>
					{group.fines.source === "tihlde" && (
						<p className="text-xs text-muted-foreground">
							Bildet vises også på boten på tihlde.org.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button
						disabled={!valid || give.isPending || uploading}
						onClick={async () => {
							if (!lawId) return;
							let imageUploadId: string | null = null;
							if (image) {
								setUploading(true);
								try {
									imageUploadId = (await uploadFile(image)).id;
								} catch (error) {
									toast.error(
										`Kunne ikke laste opp bildet: ${(error as Error).message}`,
									);
									return;
								} finally {
									setUploading(false);
								}
							}
							give.mutate({
								requestId,
								groupId: group.id,
								lawId,
								userIds: selected,
								count,
								reason: reason.trim(),
								imageUploadId,
							});
						}}
					>
						Gi {formatFineCount(count)}
						{selected.length > 1 ? ` til ${selected.length}` : ""}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
