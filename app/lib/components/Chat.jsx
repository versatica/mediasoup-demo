import React from 'react';
import { connect } from 'react-redux';
import * as appPropTypes from './appPropTypes';
import PropTypes from 'prop-types';
import { withRoomContext } from '../RoomContext';


const Chat = ({ messages }) =>
{
	return (
		<div data-component='Messages'>
			{
				messages.map((message) =>
          <div key={message.id}>
            <div>{message.peer}</div>
            <p>{message.text}</p>
          </div>
        )
      }
    </div>
  )
}

Chat.propTypes =
{
	messages: PropTypes.arrayOf(appPropTypes.Message).isRequired
}

const mapStateToProps = (state) =>
{
	const messages = state.messages || [];
	return { messages };
}

const ChatContainer = withRoomContext(connect(
	mapStateToProps,
	undefined
)(Chat))

export default ChatContainer
