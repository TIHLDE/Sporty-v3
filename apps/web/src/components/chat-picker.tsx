import { Button } from "@sporty/ui/components/button";
import { Input } from "@sporty/ui/components/input";
import { Tabs, TabsList, TabsTrigger } from "@sporty/ui/components/tabs";
import { cn } from "@sporty/ui/lib/utils";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Loader2, SearchIcon, StarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmojiPicker } from "@/components/emoji-picker";
import { fetchGifs, klipyCustomerId, type Gif } from "@/lib/klipy";
import { useTRPC } from "@/utils/trpc";

const SEARCH_DEBOUNCE_MS = 400;

type PanelTab = "emoji" | "gif" | "favoritter";

/** Klipy-id-en til brukeren. Se `klipyCustomerId`. */
export function useKlipyCustomerId(userId: string | undefined) {
	return useQuery({
		queryKey: ["klipy-customer", userId],
		queryFn: () => klipyCustomerId(userId ?? ""),
		enabled: Boolean(userId),
		staleTime: Number.POSITIVE_INFINITY,
	}).data;
}

/** Favorittene brukeren har lagret, og en funksjon for å legge til eller fjerne en. */
export function useFavoriteGifs() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const favorites = useQuery(trpc.messages.favoriteGifs.queryOptions());
	const options = {
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: trpc.messages.favoriteGifs.queryKey(),
			}),
		onError: (error: { message: string }) =>
			toast.error(`Favoritten ble ikke lagret: ${error.message}`),
	};
	const add = useMutation(trpc.messages.addFavoriteGif.mutationOptions(options));
	const remove = useMutation(
		trpc.messages.removeFavoriteGif.mutationOptions(options),
	);

	return {
		favorites,
		isFavorite: (slug: string) =>
			favorites.data?.some((gif) => gif.slug === slug) ?? false,
		setFavorite: (gif: Gif, favorite: boolean) =>
			favorite ? add.mutate(gif) : remove.mutate({ slug: gif.slug }),
	};
}

/** Innholdet i menyen ved skrivefeltet: Emoji, GIF og Favoritter. */
export function ChatPicker({
	customerId,
	onEmoji,
	onGif,
}: {
	customerId: string | undefined;
	onEmoji: (emoji: string) => void;
	onGif: (gif: Gif, query: string) => void;
}) {
	const [tab, setTab] = useState<PanelTab>("emoji");

	return (
		<div className="flex w-[352px] max-w-[calc(100vw-2rem)] flex-col gap-2 p-2">
			<Tabs value={tab} onValueChange={(value) => setTab(value as PanelTab)}>
				<TabsList className="w-full">
					<TabsTrigger value="emoji">Emoji</TabsTrigger>
					<TabsTrigger value="gif">GIF</TabsTrigger>
					<TabsTrigger value="favoritter">Favoritter</TabsTrigger>
				</TabsList>
			</Tabs>
			{tab === "emoji" ? (
				<EmojiPicker onSelect={onEmoji} />
			) : tab === "gif" ? (
				<GifSearch customerId={customerId} onSelect={onGif} />
			) : (
				<Favorites onSelect={(gif) => onGif(gif, "")} />
			)}
		</div>
	);
}

function GifSearch({
	customerId,
	onSelect,
}: {
	customerId: string | undefined;
	onSelect: (gif: Gif, query: string) => void;
}) {
	const [input, setInput] = useState("");
	const [query, setQuery] = useState("");
	// Lang `staleTime` fordi testnøkler har 100 kall i timen.
	const gifs = useInfiniteQuery({
		queryKey: ["klipy", query],
		queryFn: ({ pageParam }) => fetchGifs(query, pageParam, customerId ?? ""),
		initialPageParam: 1,
		getNextPageParam: (page) => page.nextPage,
		enabled: Boolean(customerId),
		staleTime: 10 * 60 * 1000,
	});

	// Vent til man har sluttet å skrive, så ikke hvert tastetrykk blir et kall til Klipy.
	useEffect(() => {
		const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [input]);

	return (
		<>
			<div className="relative">
				<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					aria-label="Søk etter GIF"
					// Klipy krever denne teksten i søkefeltet.
					placeholder="Search KLIPY"
					className="pl-8"
					value={input}
					onChange={(event) => setInput(event.target.value)}
				/>
			</div>
			{gifs.isPending ? (
				<Centered>
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</Centered>
			) : gifs.isError ? (
				<Centered>{gifs.error.message}</Centered>
			) : (
				<GifGrid
					gifs={gifs.data.pages.flatMap((page) => page.gifs)}
					onSelect={(gif) => onSelect(gif, query)}
					empty={`Fant ingen GIF-er for «${query}»`}
					footer={
						gifs.hasNextPage && (
							<Button
								variant="ghost"
								size="sm"
								className="col-span-2"
								disabled={gifs.isFetchingNextPage}
								onClick={() => gifs.fetchNextPage()}
							>
								{gifs.isFetchingNextPage ? "Laster…" : "Vis flere"}
							</Button>
						)
					}
				/>
			)}
		</>
	);
}

function Favorites({ onSelect }: { onSelect: (gif: Gif) => void }) {
	const { favorites } = useFavoriteGifs();

	if (favorites.isPending) {
		return (
			<Centered>
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</Centered>
		);
	}
	if (favorites.isError) return <Centered>{favorites.error.message}</Centered>;
	return (
		<GifGrid
			gifs={favorites.data}
			onSelect={onSelect}
			empty="Klikk på stjernen på en GIF for å lagre den her"
		/>
	);
}

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-[368px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
			{children}
		</div>
	);
}

function GifGrid({
	gifs,
	onSelect,
	empty,
	footer,
}: {
	gifs: Gif[];
	onSelect: (gif: Gif) => void;
	empty: string;
	footer?: React.ReactNode;
}) {
	const { isFavorite, setFavorite } = useFavoriteGifs();

	if (gifs.length === 0) return <Centered>{empty}</Centered>;
	return (
		<div className="grid h-[368px] auto-rows-[96px] grid-cols-2 gap-1.5 overflow-y-auto">
			{gifs.map((gif) => {
				const favorite = isFavorite(gif.slug);
				return (
					<div key={gif.slug} className="group/gif relative">
						<button
							type="button"
							aria-label={gif.title ? `Send ${gif.title}` : "Send GIF"}
							className="block size-full overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							onClick={() => onSelect(gif)}
						>
							<img
								src={gif.url}
								alt=""
								loading="lazy"
								className="size-full object-cover"
							/>
						</button>
						<button
							type="button"
							aria-label={
								favorite ? "Fjern fra favoritter" : "Legg til i favoritter"
							}
							aria-pressed={favorite}
							className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/50 text-white"
							onClick={() => setFavorite(gif, !favorite)}
						>
							<StarIcon
								className={cn(
									"size-4",
									favorite && "fill-yellow-400 text-yellow-400",
								)}
							/>
						</button>
					</div>
				);
			})}
			{footer}
		</div>
	);
}
