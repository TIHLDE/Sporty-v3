import { formatRelative } from "@sporty/api/rest/lib/dates";
import type {
	Announcement,
	GroupDetails,
	UploadedFile,
} from "@sporty/api/rest/types";
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
import { Textarea } from "@sporty/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquareIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CheckboxField } from "@/components/checkbox-field";
import { EmptyText, PageState } from "@/components/page-state";
import { uploadFile } from "@/lib/upload";
import { useTRPC } from "@/utils/trpc";

/** Kunngjøringene i gruppen, nyeste først. Sub-/admin kan legge ut nye. */
export function AnnouncementsTab({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const announcements = useQuery(
		trpc.announcements.byGroup.queryOptions({ groupId: group.id }),
	);
	const [creating, setCreating] = useState(false);

	return (
		<div className="grid gap-3">
			{group.canManage && (
				<Button
					className="justify-self-start"
					onClick={() => setCreating(true)}
				>
					<PlusIcon />
					Ny kunngjøring
				</Button>
			)}
			<PageState query={announcements}>
				{(data) =>
					data.length === 0 ? (
						<EmptyText>Ingen kunngjøringer.</EmptyText>
					) : (
						data.map((a) => <AnnouncementCard key={a.id} announcement={a} />)
					)
				}
			</PageState>
			{creating && (
				<NewAnnouncementDialog
					group={group}
					onClose={() => setCreating(false)}
				/>
			)}
		</div>
	);
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
	return (
		<Link
			to="/kunngjoringer/$announcementId"
			params={{ announcementId: announcement.id }}
			className="grid gap-2 rounded-xl border p-4 hover:bg-muted/40"
		>
			<p className="font-medium">{announcement.title}</p>
			<p className="line-clamp-3 text-sm whitespace-pre-wrap">
				{announcement.body}
			</p>
			{announcement.media.length > 0 && (
				<div className="flex gap-2 overflow-hidden">
					{announcement.media.slice(0, 4).map((file) =>
						file.kind === "image" ? (
							<img
								key={file.id}
								src={file.url}
								alt=""
								className="size-20 rounded-md object-cover"
							/>
						) : (
							<span
								key={file.id}
								className="flex size-20 items-center justify-center rounded-md bg-muted text-xs"
							>
								Video
							</span>
						),
					)}
				</div>
			)}
			<p className="flex items-center gap-3 text-xs text-muted-foreground">
				<span>
					{announcement.authorName} · {formatRelative(announcement.createdAt)}
				</span>
				{announcement.allowComments && (
					<span className="flex items-center gap-1">
						<MessageSquareIcon className="size-3.5" />
						{announcement.commentCount}
					</span>
				)}
				{announcement.attachments.length > 0 && (
					<span className="flex items-center gap-1">
						<PaperclipIcon className="size-3.5" />
						{announcement.attachments.length}
					</span>
				)}
			</p>
		</Link>
	);
}

/** Bilder og video vises, vedlegg som lenker. */
export function AnnouncementMedia({
	media,
	attachments,
}: {
	media: UploadedFile[];
	attachments: UploadedFile[];
}) {
	return (
		<>
			{media.length > 0 && (
				<div className="grid gap-3 sm:grid-cols-2">
					{media.map((file) =>
						file.kind === "image" ? (
							<img
								key={file.id}
								src={file.url}
								alt={file.fileName}
								className="w-full rounded-lg object-cover"
							/>
						) : (
							// oxlint-disable-next-line jsx-a11y/media-has-caption -- videoer lastet opp av brukerne har ikke tekstspor.
							<video
								key={file.id}
								src={file.url}
								controls
								className="w-full rounded-lg"
							/>
						),
					)}
				</div>
			)}
			{attachments.length > 0 && (
				<ul className="grid gap-1">
					{attachments.map((file) => (
						<li key={file.id}>
							<a
								href={file.url}
								target="_blank"
								rel="noreferrer"
								className="flex items-center gap-2 text-sm hover:underline"
							>
								<PaperclipIcon className="size-4" />
								{file.fileName}
							</a>
						</li>
					))}
				</ul>
			)}
		</>
	);
}

function NewAnnouncementDialog({
	group,
	onClose,
}: {
	group: GroupDetails;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [allowComments, setAllowComments] = useState(true);
	const [files, setFiles] = useState<File[]>([]);
	const [uploading, setUploading] = useState(false);

	const create = useMutation(
		trpc.announcements.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.announcements.pathKey(),
				});
				toast.success("Kunngjøringen er lagt ut");
				onClose();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = async () => {
		setUploading(true);
		try {
			const uploads = [];
			for (const file of files) uploads.push(await uploadFile(file));
			create.mutate({
				groupId: group.id,
				title: title.trim(),
				body: body.trim(),
				allowComments,
				uploadIds: uploads.map((u) => u.id),
			});
		} catch (error) {
			toast.error((error as Error).message);
		} finally {
			setUploading(false);
		}
	};

	const busy = uploading || create.isPending;
	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Ny kunngjøring</DialogTitle>
					<DialogDescription>
						{group.name}. Alle medlemmene får varsel.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="announcement-title">Tittel</Label>
					<Input
						id="announcement-title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="announcement-body">Tekst</Label>
					<Textarea
						id="announcement-body"
						value={body}
						onChange={(e) => setBody(e.target.value)}
						className="min-h-32"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="announcement-files">
						Bilder, video og vedlegg (valgfritt)
					</Label>
					<Input
						id="announcement-files"
						type="file"
						multiple
						onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
					/>
				</div>
				<CheckboxField
					checked={allowComments}
					onCheckedChange={(checked) => setAllowComments(checked)}
				>
					Tillat kommentarer
				</CheckboxField>
				<DialogFooter>
					<Button disabled={!title.trim() || busy} onClick={submit}>
						{uploading ? "Laster opp…" : "Legg ut"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
