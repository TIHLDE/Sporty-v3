// Tilstand som skal deles mellom alle API-rutene. I utvikling bygger Expo hver rute for seg med
// sin egen kopi av modulene, så et vanlig `new Map()` på toppnivå ville bare gjelde én rute.
// Kun serverkode.

const store = globalThis as unknown as { __sporty?: Map<string, unknown> };

/** Samme verdi for alle rutene: lages første gang med `init`, og gjenbrukes etterpå. */
export function shared<T>(key: string, init: () => T): T {
	store.__sporty ??= new Map();
	if (!store.__sporty.has(key)) store.__sporty.set(key, init());
	return store.__sporty.get(key) as T;
}
