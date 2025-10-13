import * as undici from 'undici';
import * as undiciTypes from 'undici';

import { Logger } from './Logger';
import {
	RequestName,
	RequestApiMethod,
	RequestApiPath,
	RequestData,
	RequestResponseData,
	TypedApiRequest,
} from './signaling/apiMessages';
import { BroadcasterApiClientError } from './errors';
import * as utils from './utils';

const logger = new Logger('ApiClient');

export type ApiClientCreateOptions = {
	baseUrl: string;
};

type ApiClientConstructorOptions = {
	baseUrl: string;
	httpsAgent?: undiciTypes.Agent;
};

export class ApiClient {
	readonly #baseUrl: string;
	readonly #httpsAgent?: undiciTypes.Agent;

	static create({ baseUrl }: ApiClientCreateOptions): ApiClient {
		logger.debug('create()');

		let httpsAgent: undiciTypes.Agent | undefined;

		if (utils.isHttpsUrl(baseUrl)) {
			httpsAgent = new undici.Agent({
				connect: {
					rejectUnauthorized: false,
				},
			});
		}

		const apiClient = new ApiClient({
			baseUrl,
			httpsAgent,
		});

		return apiClient;
	}

	private constructor({ baseUrl, httpsAgent }: ApiClientConstructorOptions) {
		logger.debug('constructor()');

		this.#baseUrl = baseUrl;
		this.#httpsAgent = httpsAgent;
	}

	async request<Name extends RequestName>({
		name,
		method,
		path,
		data,
	}: RequestData<Name> extends undefined
		? {
				name: Name;
				method: RequestApiMethod<Name>;
				path: RequestApiPath<Name>;
				data?: undefined;
			}
		: {
				name: Name;
				method: RequestApiMethod<Name>;
				path: RequestApiPath<Name>;
				data: RequestData<Name>;
			}): Promise<RequestResponseData<Name>> {
		return new Promise((resolve, reject) => {
			logger.debug(
				'request() [name:%o, method:%o, path:%o]',
				name,
				method,
				path
			);

			this.requestInternal({
				name,
				method,
				path,
				data,
				accept: resolve,
			} as TypedApiRequest<RequestName>).catch(error => {
				if (
					error instanceof BroadcasterApiClientError &&
					name === 'disconnect'
				) {
					logger.debug(
						`request() | request failed [name:%o, method:%o, path:%o]: %s`,
						name,
						method,
						path,
						error.statusCode
							? `${error.statusCode} ${error.message}`
							: error.message
					);
				} else if (error instanceof BroadcasterApiClientError) {
					logger.error(
						`request() | request failed [name:%o, method:%o, path:%o]: %s`,
						name,
						method,
						path,
						error.statusCode
							? `${error.statusCode} ${error.message}`
							: error.message
					);
				} else {
					logger.error(
						`request() | request failed [name:%o, method:%o, path:%o]:`,
						name,
						method,
						path,
						error
					);
				}

				reject(error as Error);
			});
		});
	}

	private async requestInternal(
		request: TypedApiRequest<RequestName>
	): Promise<void> {
		const { name, method, path, data, accept } = request;
		const serializedPath = this.serializePath(path);
		const url = `${this.#baseUrl}${serializedPath}`;

		let response: undici.Dispatcher.ResponseData;

		try {
			response = await undici.request(url, {
				method,
				headers: {
					Origin: this.#baseUrl,
					'User-Agent': 'mediasoup-demo-broadcaster',
					'Content-Type': data ? 'application/json' : undefined,
				},
				body: data ? JSON.stringify(data) : undefined,
				dispatcher: this.#httpsAgent,
			});
		} catch (error) {
			throw new BroadcasterApiClientError((error as Error).message);
		}

		logger.debug(
			'requestInternal() | got %o response [name:%o, method:%o, path:%o]',
			response.statusCode,
			name,
			method,
			serializedPath
		);

		const contentType = response.headers['content-type'];

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let responseData: any = undefined;
		let errorText: string | undefined = undefined;

		if (this.isOkStatusCode(response.statusCode)) {
			if (this.isContentTypeJson(contentType)) {
				responseData = await response.body.json();
			} else {
				// Always consume the body anyway.
				await response.body.dump();
			}

			accept(responseData);
		} else {
			if (this.isContentTypeText(contentType)) {
				errorText = await response.body.text();
			} else {
				// Always consume the body anyway.
				await response.body.dump();
			}

			throw new BroadcasterApiClientError(
				errorText ?? 'unknown error',
				response.statusCode
			);
		}
	}

	private serializePath(path: RequestApiPath<RequestName>): string {
		let serializedPath: string = '';

		for (const subpath of path) {
			if (typeof subpath === 'string') {
				serializedPath += `/${subpath}`;
			} else {
				const value = Object.values(subpath)[0];

				serializedPath += `/${value}`;
			}
		}

		return serializedPath;
	}

	private isOkStatusCode(statusCode: number): boolean {
		return statusCode >= 200 && statusCode < 300;
	}

	private isContentTypeJson(contentType?: string | string[]): boolean {
		if (Array.isArray(contentType)) {
			contentType = contentType[0];
		}

		if (!contentType) {
			return false;
		}

		if (/^application\/json/i.test(contentType)) {
			return true;
		}

		return false;
	}

	private isContentTypeText(contentType?: string | string[]): boolean {
		if (Array.isArray(contentType)) {
			contentType = contentType[0];
		}

		if (!contentType) {
			return false;
		}

		if (/^text\/plain/i.test(contentType)) {
			return true;
		}

		return false;
	}
}
