import { EmojiPicker as Picker } from "frimousse";

/**
 * Velg hvilken som helst emoji, med søk på norsk. Bygget på frimousse, som henter emoji-dataene
 * (emojibase) første gang den åpnes og bare viser emojier nettleseren kan tegne.
 */
export function EmojiPicker({
	onSelect,
}: {
	onSelect: (emoji: string) => void;
}) {
	return (
		<Picker.Root
			locale="nb"
			columns={8}
			onEmojiSelect={({ emoji }) => onSelect(emoji)}
			className="isolate flex h-[368px] w-fit flex-col"
		>
			<Picker.Search
				placeholder="Søk etter emoji"
				className="z-10 mx-2 mt-2 appearance-none rounded-md bg-muted px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
			/>
			<Picker.Viewport className="relative flex-1 outline-hidden">
				<Picker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
					Laster …
				</Picker.Loading>
				<Picker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
					Fant ingen emoji
				</Picker.Empty>
				<Picker.List
					className="pb-1.5 select-none"
					components={{
						CategoryHeader: ({ category, ...props }) => (
							<div
								className="bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground first-letter:uppercase"
								{...props}
							>
								{category.label}
							</div>
						),
						Row: ({ children, ...props }) => (
							<div className="scroll-my-1.5 px-1.5" {...props}>
								{children}
							</div>
						),
						Emoji: ({ emoji, ...props }) => (
							<button
								className="flex size-8 items-center justify-center rounded-md text-lg data-active:bg-accent"
								{...props}
							>
								{emoji.emoji}
							</button>
						),
					}}
				/>
			</Picker.Viewport>
		</Picker.Root>
	);
}
