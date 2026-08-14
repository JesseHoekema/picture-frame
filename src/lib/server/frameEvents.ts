import { EventEmitter } from 'node:events';

export const frameEvents = new EventEmitter();
frameEvents.setMaxListeners(1000);

export function notifyFrameChange(): void {
	frameEvents.emit('change');
}
