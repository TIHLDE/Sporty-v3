import { Checkbox } from "@sporty/ui/components/checkbox";
import { Label } from "@sporty/ui/components/label";
import { type ReactNode, useId } from "react";

/** Avkrysningsboks med klikkbar etikett, koblet sammen med htmlFor (også for skjermlesere). */
export function CheckboxField({
	checked,
	onCheckedChange,
	disabled,
	children,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<div className="flex items-center gap-2">
			<Checkbox
				id={id}
				checked={checked}
				disabled={disabled}
				onCheckedChange={(value) => onCheckedChange(value === true)}
			/>
			<Label htmlFor={id} className="font-normal">
				{children}
			</Label>
		</div>
	);
}
