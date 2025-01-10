import axios from 'axios';
import { withParser } from 'stream-json/filters/Filter';
import { streamValues } from 'stream-json/streamers/StreamValues';

import type { Stream } from 'stream';

import {
	CREATE_DEV_RESOURCE_RESPONSE_SCHEMA,
	CREATE_WEBHOOK_RESPONSE,
	GET_DEV_RESOURCE_RESPONSE_SCHEMA,
	GET_FILE_META_RESPONSE_SCHEMA,
	GET_FILE_RESPONSE_SCHEMA,
	GET_ME_RESPONSE_SCHEMA,
	GET_OAUTH2_TOKEN_RESPONSE_SCHEMA,
	GET_TEAM_PROJECTS_RESPONSE_SCHEMA,
	REFRESH_OAUTH2_TOKEN_RESPONSE_SCHEMA,
} from './schemas';
import type {
	CreateDevResourcesRequest,
	CreateDevResourcesResponse,
	CreateWebhookRequest,
	CreateWebhookResponse,
	DeleteDevResourceRequest,
	GetDevResourcesRequest,
	GetDevResourcesResponse,
	GetFileMetaResponse,
	GetFileParams,
	GetFileResponse,
	GetMeResponse,
	GetOAuth2TokenResponse,
	GetTeamProjectsResponse,
	Node,
	NodeDevStatus,
	RefreshOAuth2TokenResponse,
} from './types';

import { assertSchema } from '../../../common/schema-validation';
import { getConfig } from '../../../config';
import { withAxiosErrorTranslation } from '../../axios-utils';

const GET_FILE_RESPONSE_PROPERTIES = new Set<keyof GetFileResponse>([
	'name',
	'lastModified',
	'editorType',
	'document',
]);

const GET_FILE_NODE_PROPERTIES = new Set<keyof Node>([
	'id',
	'name',
	'type',
	'devStatus',
	'lastModified',
	'children',
]);

const GET_FILE_NODE_DEV_STATUS_PROPERTIES = new Set<keyof NodeDevStatus>([
	'type',
]);

/**
 * A generic Figma API client.
 *
 * @see https://www.figma.com/developers/api
 * @internal
 */
export class FigmaClient {
	/**
	 * Returns the user's access token.
	 *
	 * @see https://www.figma.com/developers/api#oauth2
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	getOAuth2Token = async (code: string): Promise<GetOAuth2TokenResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL('/v1/oauth/token', getConfig().figma.apiBaseUrl);

			const basicAuthHeader =
				'Basic ' +
				btoa(
					`${getConfig().figma.oauth2.clientId}:${
						getConfig().figma.oauth2.clientSecret
					}`,
				);

			url.searchParams.append(
				'redirect_uri',
				`${getConfig().app.baseUrl}/figma/oauth/callback`,
			);
			url.searchParams.append('code', code);
			url.searchParams.append('grant_type', 'authorization_code');

			const response = await axios.post<unknown>(url.toString(), null, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: basicAuthHeader,
				},
			});

			assertSchema(response.data, GET_OAUTH2_TOKEN_RESPONSE_SCHEMA);

			return response.data;
		});

	/**
	 * Request a new access token using a refresh token.
	 *
	 * @see https://www.figma.com/developers/api#refresh-oauth2
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	refreshOAuth2Token = async (
		refreshToken: string,
	): Promise<RefreshOAuth2TokenResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL('/v1/oauth/refresh', getConfig().figma.apiBaseUrl);
			const basicAuthHeader =
				'Basic ' +
				btoa(
					`${getConfig().figma.oauth2.clientId}:${
						getConfig().figma.oauth2.clientSecret
					}`,
				);

			url.searchParams.append('refresh_token', refreshToken);

			const response = await axios.post<unknown>(url.toString(), null, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: basicAuthHeader,
				},
			});

			assertSchema(response.data, REFRESH_OAUTH2_TOKEN_RESPONSE_SCHEMA);

			return response.data;
		});

	/**
	 * Returns user information for the authenticated user.
	 *
	 * @see https://www.figma.com/developers/api#get-me-endpoint
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	me = async (accessToken: string): Promise<GetMeResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(`/v1/me`, getConfig().figma.apiBaseUrl);

			const response = await axios.get<unknown>(url.toString(), {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
			});

			assertSchema(response.data, GET_ME_RESPONSE_SCHEMA);

			return response.data;
		});

	/**
	 * Returns a Figma file metadata.
	 *
	 * @remarks
	 * The REST API endpoint is not documented but fully supported. It provides a significantly better
	 * latency than `GET `/v1/files/:fileKey` endpoint.
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	getFileMeta = async (
		fileKey: string,
		accessToken: string,
	): Promise<GetFileMetaResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(
				`/v1/files/${encodeURIComponent(fileKey)}/meta`,
				getConfig().figma.apiBaseUrl,
			);

			const response = await axios.get<unknown>(url.toString(), {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
			});

			assertSchema(response.data, GET_FILE_META_RESPONSE_SCHEMA);

			return response.data;
		});

	/**
	 * Returns a Figma file/document including metadata about that file.
	 *
	 * @see https://www.figma.com/developers/api#get-files-endpoint
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	getFile = async (
		fileKey: string,
		params: GetFileParams,
		accessToken: string,
	): Promise<GetFileResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(
				`/v1/files/${encodeURIComponent(fileKey)}`,
				getConfig().figma.apiBaseUrl,
			);

			if (params.ids != null) {
				url.searchParams.append('ids', params.ids.join(','));
			}
			if (params.depth != null) {
				url.searchParams.append('depth', params.depth.toString());
			}
			if (params.node_last_modified != null) {
				url.searchParams.append(
					'node_last_modified',
					params.node_last_modified.toString(),
				);
			}

			// Since the file json string that gets returned can be longer than the max
			// string size allowed in node - we instead the json as a stream
			const response = await axios.get<unknown>(url.toString(), {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
				responseType: 'stream',
			});
			const fileJson = await new Promise((resolve, reject) => {
				let result: unknown = {};
				(response.data as Stream)
					.pipe(
						withParser({
							filter: (stack) => {
								if (stack.length === 0) {
									return false;
								}

								const property = stack[stack.length - 1];
								const parentProperty = stack[stack.length - 2];
								const grandParentProperty = stack[stack.length - 3];

								if (parentProperty == null) {
									return (
										GET_FILE_RESPONSE_PROPERTIES as Set<typeof property>
									).has(property);
								}

								if (
									parentProperty === 'document' ||
									(typeof parentProperty === 'number' &&
										grandParentProperty === 'children')
								) {
									return (GET_FILE_NODE_PROPERTIES as Set<typeof property>).has(
										property,
									);
								}

								if (parentProperty === 'devStatus') {
									return (
										GET_FILE_NODE_DEV_STATUS_PROPERTIES as Set<typeof property>
									).has(property);
								}

								return false;
							},
						}),
					)
					.pipe(streamValues())
					.on('data', ({ value }) => {
						result = value;
					})
					.on('end', () => {
						resolve(result);
					})
					.on('error', (err) => {
						reject(err);
					});
			});

			assertSchema(fileJson, GET_FILE_RESPONSE_SCHEMA);

			return fileJson;
		});

	/**
	 * Creates Figma Dev Resources using the POST dev resources endpoint
	 *
	 * @see https://www.figma.com/developers/api#post-dev-resources-endpoint
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	createDevResources = async (
		request: CreateDevResourcesRequest,
		accessToken: string,
	): Promise<CreateDevResourcesResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(`/v1/dev_resources`, getConfig().figma.apiBaseUrl);

			const response = await axios.post<unknown>(url.toString(), request, {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
			});

			assertSchema(response.data, CREATE_DEV_RESOURCE_RESPONSE_SCHEMA);

			return response.data;
		});

	/**
	 * Fetches Figma Dev Resources using the GET dev resources endpoint
	 *
	 * @see https://www.figma.com/developers/api#get-dev-resources-endpoint
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	getDevResources = async ({
		fileKey,
		nodeIds,
		accessToken,
	}: GetDevResourcesRequest): Promise<GetDevResourcesResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(
				`/v1/files/${encodeURIComponent(fileKey)}/dev_resources`,
				getConfig().figma.apiBaseUrl,
			);
			if (nodeIds?.length) {
				url.searchParams.append('node_ids', nodeIds.join(','));
			}

			const response = await axios.get<unknown>(url.toString(), {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
			});

			assertSchema(response.data, GET_DEV_RESOURCE_RESPONSE_SCHEMA);

			return response.data;
		});

	/**
	 * Deletes a Figma Dev Resource using the DELETE dev resources endpoint
	 *
	 * @see https://www.figma.com/developers/api#delete-dev-resources-endpoint
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	deleteDevResource = async ({
		fileKey,
		devResourceId,
		accessToken,
	}: DeleteDevResourceRequest): Promise<void> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(
				`/v1/files/${encodeURIComponent(
					fileKey,
				)}/dev_resources/${encodeURIComponent(devResourceId)}`,
				getConfig().figma.apiBaseUrl,
			);

			await axios.delete<unknown>(url.toString(), {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
			});
		});

	/**
	 * Creates a new Figma webhook using the POST webhook endpoint
	 *
	 * @see https://www.figma.com/developers/api#webhooks-v2-post-endpoint
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	createWebhook = async (
		request: CreateWebhookRequest,
		accessToken: string,
	): Promise<CreateWebhookResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(`/v2/webhooks`, getConfig().figma.apiBaseUrl);

			const response = await axios.post<unknown>(url.toString(), request, {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
			});

			assertSchema(response.data, CREATE_WEBHOOK_RESPONSE);

			return response.data;
		});

	/**
	 * Deletes the specified webhook.
	 *
	 * @see https://www.figma.com/developers/api#webhooks-v2-delete-endpoint
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	deleteWebhook = async (
		webhookId: string,
		accessToken: string,
	): Promise<void> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(
				`/v2/webhooks/${encodeURIComponent(webhookId)}`,
				getConfig().figma.apiBaseUrl,
			);

			await axios.delete<unknown>(url.toString(), {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
			});
		});

	/**
	 * Returns a list of all the Projects within the specified team.
	 *
	 * @see https://www.figma.com/developers/api#projects-endpoints
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	getTeamProjects = async (
		teamId: string,
		accessToken: string,
	): Promise<GetTeamProjectsResponse> =>
		withAxiosErrorTranslation(async () => {
			const url = new URL(
				`/v1/teams/${encodeURIComponent(teamId)}/projects`,
				getConfig().figma.apiBaseUrl,
			);

			const response = await axios.get<unknown>(url.toString(), {
				headers: {
					['Authorization']: `Bearer ${accessToken}`,
				},
			});

			assertSchema(response.data, GET_TEAM_PROJECTS_RESPONSE_SCHEMA);

			return response.data;
		});
}

export const figmaClient = new FigmaClient();
