import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withRoomContext } from '../RoomContext';

const BotMessageRegex = new RegExp('^@bot (.*)');

class ChatInput extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state =
		{
			text : ''
		};

		// TextArea element got via React ref.
		// @type {HTMLElement}
		this._textareaElem = null;
	}

	render()
	{
		const {
			connected,
			chatDataProducer,
			botDataProducer
		} = this.props;

		const { text } = this.state;

		const disabled = !connected || (!chatDataProducer && !botDataProducer);

		return (
			<div data-component='ChatInput'>
				<textarea
					ref={(elem) => { this._textareaElem = elem; }}
					placeholder={disabled ? 'Chat unavailable' : 'Write here...'}
					dir='auto'
					autoComplete='off'
					disabled={disabled}
					value={text}
					onChange={this.handleChange.bind(this)}
					onKeyPress={this.handleKeyPress.bind(this)}
				/>
			</div>
		);
	}

	handleChange(event)
	{
		const text = event.target.value;

		this.setState({ text });
	}

	handleKeyPress(event)
	{
		// If Shift + Enter do nothing.
		if (event.key !== 'Enter' || (event.shiftKey || event.ctrlKey))
			return;

		// Don't add the sending Enter into the value.
		event.preventDefault();

		let text = this.state.text.trim();

		this.setState({ text: '' });

		if (text)
		{
			const { roomClient } = this.props;
			const match = BotMessageRegex.exec(text);

			// Chat message.
			if (!match)
			{
				text = text.trim();

				roomClient.sendChatMessage(text);
			}
			// Message to the bot.
			else
			{
				text = match[1].trim();

				roomClient.sendBotMessage(text);
			}
		}
	}
}

ChatInput.propTypes =
{
	roomClient       : PropTypes.any.isRequired,
	connected        : PropTypes.bool.isRequired,
	chatDataProducer : PropTypes.any,
	botDataProducer  : PropTypes.any
};

const mapStateToProps = (state) =>
{
	const dataProducersArray = Object.values(state.dataProducers);
	const chatDataProducer = dataProducersArray
		.find((dataProducer) => dataProducer.label === 'chat');
	const botDataProducer = dataProducersArray
		.find((dataProducer) => dataProducer.label === 'bot');

	return {
		connected : state.room.state === 'connected',
		chatDataProducer,
		botDataProducer
	};
};

const ChatInputContainer = withRoomContext(connect(
	mapStateToProps,
	undefined
)(ChatInput));

export default ChatInputContainer;
