import type * as mediasoupTypes from 'mediasoup/types';

import { Logger } from './Logger';
import type { Peer } from './Peer';
import type {
	DataProducerAppData,
	BotDataProducerAppData,
	DataConsumerAppData,
} from './types';

const logger = new Logger('Bot');

export type BotCreateOptions = {
	mediasoupRouter: mediasoupTypes.Router;
};

type BotConstructorOptions = {
	directTransport: mediasoupTypes.DirectTransport;
	dataProducer: mediasoupTypes.DataProducer<BotDataProducerAppData>;
};

/**
 * @remarks
 * - No need for close() method since evenrything here is closed when the
 *   mediasoup Router is closed.
 */
export class Bot {
	readonly #directTransport: mediasoupTypes.DirectTransport;
	readonly #dataProducer: mediasoupTypes.DataProducer<BotDataProducerAppData>;

	static async create({ mediasoupRouter }: BotCreateOptions): Promise<Bot> {
		logger.debug('create()');

		const directTransport = await mediasoupRouter.createDirectTransport({
			maxMessageSize: 512,
		});
		const dataProducer =
			await directTransport.produceData<BotDataProducerAppData>({
				label: 'bot',
				appData: {
					channel: 'bot',
				},
			});

		const bot = new Bot({ directTransport, dataProducer });

		return bot;
	}

	private constructor({
		directTransport,
		dataProducer,
	}: BotConstructorOptions) {
		logger.debug('constructor()');

		this.#directTransport = directTransport;
		this.#dataProducer = dataProducer;
	}

	getDataProducer(): mediasoupTypes.DataProducer<BotDataProducerAppData> {
		return this.#dataProducer;
	}

	async consumeData({
		dataProducer,
		peer,
	}: {
		dataProducer: mediasoupTypes.DataProducer<DataProducerAppData>;
		peer: Peer;
	}): Promise<void> {
		logger.debug(
			'consumeData() [peerId:%o, dataProducerId:%o]',
			peer.id,
			dataProducer.id
		);

		let dataConsumer: mediasoupTypes.DataConsumer<DataConsumerAppData>;

		try {
			dataConsumer =
				await this.#directTransport.consumeData<DataConsumerAppData>({
					dataProducerId: dataProducer.id,
					appData: {
						peerId: undefined,
						channel: 'bot',
					},
				});
		} catch (error) {
			logger.warn(`consumeData() | transport.consumeData() failed: ${error}`);

			return;
		}

		this.handleDataConsumer(dataConsumer, peer);
	}

	private handleDataConsumer(
		dataConsumer: mediasoupTypes.DataConsumer<DataConsumerAppData>,
		peer: Peer
	): void {
		dataConsumer.on('message', (message, ppid) => {
			// Ensure it's a WebRTC DataChannel string.
			if (ppid !== 51) {
				logger.warn('ignoring non string messagee from a Peer');

				return;
			}

			const text = message.toString('utf8');

			// Create a message to send it back to all Peers in behalf of the sending
			// Peer.
			const messageBack = `${peer.displayName} told me: '${text}'`;

			this.#dataProducer.send(messageBack);
		});
	}
}
