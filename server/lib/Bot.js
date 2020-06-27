const Logger = require('./Logger');

const logger = new Logger('Bot');

class Bot
{
	static async create({ mediasoupRouter })
	{
		// Create a DirectTransport for connecting the bot.
		const transport = await mediasoupRouter.createDirectTransport(
			{
				maxMessageSize : 512
			});

		// Create DataProducer to send messages to peers.
		const dataProducer = await transport.produceData({ label: 'bot' });

		// Create the Bot instance.
		const bot = new Bot({ transport, dataProducer });

		return bot;
	}

	constructor({ transport, dataProducer })
	{
		// mediasoup DirectTransport.
		this._transport = transport;

		// mediasoup DataProducer.
		this._dataProducer = dataProducer;
	}

	get dataProducer()
	{
		return this._dataProducer;
	}

	close()
	{
		// No need to do anyting.
	}

	async handlePeerDataProducer({ dataProducerId, peer })
	{
		// Create a DataConsumer on the DirectTransport for each Peer.
		const dataConsumer = await this._transport.consumeData(
			{
				dataProducerId
			});

		dataConsumer.on('message', (message, ppid) =>
		{
			// Ensure it's a WebRTC DataChannel string.
			if (ppid !== 51)
			{
				logger.warn('ignoring non string messagee from a Peer');

				return;
			}

			const text = message.toString('utf8');

			logger.debug(
				'SCTP message received [peerId:%s, size:%d]', peer.id, message.byteLength);

			// Create a message to send it back to all Peers in behalf of the sending
			// Peer.
			const messageBack = `${peer.data.displayName} said me: "${text}"`;

			this._dataProducer.send(messageBack);
		});
	}
}

module.exports = Bot;
