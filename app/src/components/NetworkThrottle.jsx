import React from 'react';
import Draggable from 'react-draggable';
import PropTypes from 'prop-types';
import { withRoomContext } from '../RoomContext';

class NetworkThrottle extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			up: '',
			down: '',
			rtt: '',
			packetLoss: '',
			localhost: false,
			disabled: false,
		};
	}

	render() {
		const { up, down, rtt, packetLoss, localhost, disabled } = this.state;

		return (
			<Draggable
				bounds="parent"
				defaultPosition={{ x: 20, y: 20 }}
				handle="h1.draggable"
			>
				<form
					data-component="NetworkThrottle"
					onSubmit={event => {
						event.preventDefault();

						this._apply();
					}}
				>
					<h1 className="draggable">Network Throttle</h1>

					<div className="inputs">
						<div className="row">
							<p className="key">UPLINK (kbps)</p>

							<input
								className="text-value"
								type="text"
								placeholder="NO LIMIT"
								disabled={disabled}
								pattern="[0-9]*"
								value={up}
								autoCorrect="false"
								spellCheck="false"
								onChange={event => this.setState({ up: event.target.value })}
							/>
						</div>

						<div className="row">
							<p className="key">DOWNLINK (kbps)</p>

							<input
								className="text-value"
								type="text"
								placeholder="NO LIMIT"
								disabled={disabled}
								pattern="[0-9]*"
								value={down}
								autoCorrect="false"
								spellCheck="false"
								onChange={event => this.setState({ down: event.target.value })}
							/>
						</div>

						<div className="row">
							<p className="key">RTT (ms)</p>

							<input
								className="text-value"
								type="text"
								placeholder="NOT SET"
								disabled={disabled}
								pattern="[0-9]*"
								value={rtt}
								autoCorrect="false"
								spellCheck="false"
								onChange={event => this.setState({ rtt: event.target.value })}
							/>
						</div>

						<div className="row">
							<p className="key">PACKETLOSS (%)</p>

							<input
								className="text-value"
								type="text"
								placeholder="NOT SET"
								disabled={disabled}
								pattern="[0-9]*"
								value={packetLoss}
								autoCorrect="false"
								spellCheck="false"
								onChange={event =>
									this.setState({ packetLoss: event.target.value })
								}
							/>
						</div>

						<div className="row">
							<p className="key">LOCALHOST</p>

							<input
								className="checkbox-value"
								type="checkbox"
								disabled={disabled}
								checked={localhost}
								onChange={() => {
									this.setState({ localhost: !localhost });
								}}
							/>
						</div>
					</div>

					<div className="buttons">
						<button
							type="button"
							className="reset"
							disabled={disabled}
							onClick={() => this._reset()}
						>
							RESET
						</button>

						<button type="submit" className="apply" disabled={disabled}>
							APPLY
						</button>
					</div>
				</form>
			</Draggable>
		);
	}

	componentWillUnmount() {
		const { roomClient } = this.props;

		roomClient.stopNetworkThrottle({ silent: true });
	}

	async _apply() {
		const { roomClient, secret } = this.props;
		const { localhost } = this.state;
		let { up, down, rtt, packetLoss } = this.state;

		up = Number(up) || 0;
		down = Number(down) || 0;
		rtt = Number(rtt) || 0;
		packetLoss = Number(packetLoss) || 0;

		this.setState({ disabled: true });

		await roomClient.applyNetworkThrottle({
			secret,
			up,
			down,
			rtt,
			packetLoss,
			localhost,
		});

		window.onunload = () => {
			roomClient.stopNetworkThrottle({ silent: true, secret });
		};

		this.setState({ disabled: false });
	}

	async _reset() {
		const { roomClient, secret } = this.props;

		this.setState({
			up: '',
			down: '',
			rtt: '',
			packetLoss: '',
			localhost: false,
			disabled: false,
		});

		this.setState({ disabled: true });

		await roomClient.stopNetworkThrottle({ secret });

		this.setState({ disabled: false });
	}
}

NetworkThrottle.propTypes = {
	roomClient: PropTypes.any.isRequired,
	secret: PropTypes.string.isRequired,
};

export default withRoomContext(NetworkThrottle);
