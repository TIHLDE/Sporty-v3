function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

export const ENV = {
	NODE_ENV: process.env.NODE_ENV ?? "development",
	DATABASE_URL: required("DATABASE_URL"),
	BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
	BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
	// Everything is behind TIHLDE login, so the app is useless without these.
	PHOTON_CLIENT_ID: required("PHOTON_CLIENT_ID"),
	PHOTON_CLIENT_SECRET: required("PHOTON_CLIENT_SECRET"),
};
