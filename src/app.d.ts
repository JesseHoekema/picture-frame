import type { UserRow } from '$lib/server/db';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: Pick<UserRow, 'id' | 'username'> | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
