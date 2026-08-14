import type { RequestHandler } from './$types';
import { computeFrameLiveState } from '$lib/server/displayController';
import { getSettings } from '$lib/server/settings';
import { frameEvents } from '$lib/server/frameEvents';

export const GET: RequestHandler = async () => {
	const encoder = new TextEncoder();
	let closed = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let onChange: (() => void) | undefined;

	const stream = new ReadableStream({
		async start(controller) {
			const send = async () => {
				if (closed) return;
				try {
					const state = await computeFrameLiveState();
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
				} catch {
					/* ignore */
				}
			};

			const scheduleNext = () => {
				if (closed) return;
				const ms = Math.max(2, getSettings().pollIntervalSec) * 1000;
				timer = setTimeout(async () => {
					await send();
					scheduleNext();
				}, ms);
			};

			await send();
			onChange = () => {
				void send();
			};
			frameEvents.on('change', onChange);
			scheduleNext();
		},
		cancel() {
			closed = true;
			if (timer) clearTimeout(timer);
			if (onChange) frameEvents.off('change', onChange);
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store',
			connection: 'keep-alive'
		}
	});
};
