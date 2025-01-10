import { HttpStatusCode } from 'axios';
import nock from 'nock';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

import app from '../../../app';
import { getConfig } from '../../../config';
import {
	generateConnectInstallationCreateParams,
	generateExpiredFigmaOAuth2UserCredentialCreateParams,
	generateFigmaOAuth2UserCredentialCreateParams,
} from '../../../domain/entities/testing';
import { figmaAuthService } from '../../../infrastructure/figma';
import {
	generateOAuth2BasicAuthHeader,
	generateRefreshOAuth2TokenQueryParams,
	generateRefreshOAuth2TokenResponse,
} from '../../../infrastructure/figma/figma-client/testing';
import {
	connectInstallationRepository,
	figmaOAuth2UserCredentialsRepository,
} from '../../../infrastructure/repositories';
import {
	generateJiraServerSymmetricJwtToken,
	mockFigmaMeEndpoint,
} from '../../testing';

const FIGMA_OAUTH_API_BASE_URL = getConfig().figma.apiBaseUrl;
const FIGMA_OAUTH_REFRESH_TOKEN_ENDPOINT = '/v1/oauth/refresh';
const CHECK_AUTH_ENDPOINT = '/auth/checkAuth';

describe('/auth', () => {
	describe('/checkAuth', () => {
		const REFRESH_TOKEN = uuidv4();
		const REFRESH_TOKEN_QUERY_PARAMS = generateRefreshOAuth2TokenQueryParams({
			refresh_token: REFRESH_TOKEN,
		});

		const BASIC_AUTH_HEADER = generateOAuth2BasicAuthHeader({
			client_id: getConfig().figma.oauth2.clientId,
			client_secret: getConfig().figma.oauth2.clientSecret,
		});

		it('should return a response indicating that user is authorized if user is authorized', async () => {
			const connectInstallation = await connectInstallationRepository.upsert(
				generateConnectInstallationCreateParams(),
			);
			const atlassianUserId = uuidv4();
			await figmaOAuth2UserCredentialsRepository.upsert(
				generateFigmaOAuth2UserCredentialCreateParams({
					atlassianUserId,
					connectInstallationId: connectInstallation.id,
				}),
			);
			const jwt = generateJiraServerSymmetricJwtToken({
				request: {
					method: 'GET',
					pathname: '/auth/checkAuth',
					query: { userId: atlassianUserId },
				},
				connectInstallation,
			});

			mockFigmaMeEndpoint({ baseUrl: getConfig().figma.apiBaseUrl });

			return request(app)
				.get(CHECK_AUTH_ENDPOINT)
				.query({
					userId: atlassianUserId,
				})
				.set('Authorization', `JWT ${jwt}`)
				.expect(HttpStatusCode.Ok)
				.expect({ type: '3LO', authorized: true });
		});

		it('should return a response indicating that user is authorized if credentials were refreshed', async () => {
			const connectInstallation = await connectInstallationRepository.upsert(
				generateConnectInstallationCreateParams(),
			);
			const atlassianUserId = uuidv4();
			await figmaOAuth2UserCredentialsRepository.upsert(
				generateExpiredFigmaOAuth2UserCredentialCreateParams({
					refreshToken: REFRESH_TOKEN,
					atlassianUserId,
					connectInstallationId: connectInstallation.id,
				}),
			);
			const refreshTokenResponse = generateRefreshOAuth2TokenResponse();
			const jwt = generateJiraServerSymmetricJwtToken({
				request: {
					method: 'GET',
					pathname: '/auth/checkAuth',
					query: { userId: atlassianUserId },
				},
				connectInstallation,
			});

			nock(FIGMA_OAUTH_API_BASE_URL)
				.post(FIGMA_OAUTH_REFRESH_TOKEN_ENDPOINT)
				.query(REFRESH_TOKEN_QUERY_PARAMS)
				.matchHeader('Content-Type', 'application/x-www-form-urlencoded')
				.matchHeader('Authorization', BASIC_AUTH_HEADER)
				.reply(HttpStatusCode.Ok, refreshTokenResponse);
			mockFigmaMeEndpoint({ baseUrl: getConfig().figma.apiBaseUrl });

			await request(app)
				.get(CHECK_AUTH_ENDPOINT)
				.query({
					userId: atlassianUserId,
				})
				.set('Authorization', `JWT ${jwt}`)
				.expect(HttpStatusCode.Ok)
				.expect({ type: '3LO', authorized: true });

			const credentials = await figmaOAuth2UserCredentialsRepository.get(
				atlassianUserId,
				connectInstallation.id,
			);
			expect(credentials?.accessToken).toEqual(
				refreshTokenResponse.access_token,
			);
			expect(credentials?.isExpired()).toBeFalsy();
		});

		it('should return a response indicating that user is not authorized if no credentials stored', async () => {
			const connectInstallation = await connectInstallationRepository.upsert(
				generateConnectInstallationCreateParams(),
			);
			const atlassianUserId = uuidv4();
			const jwt = generateJiraServerSymmetricJwtToken({
				request: {
					method: 'GET',
					pathname: '/auth/checkAuth',
					query: { userId: atlassianUserId },
				},
				connectInstallation,
			});

			return request(app)
				.get(CHECK_AUTH_ENDPOINT)
				.query({
					userId: atlassianUserId,
				})
				.set('Authorization', `JWT ${jwt}`)
				.expect(HttpStatusCode.Ok)
				.then((response) => {
					expect(response.body).toStrictEqual({
						type: '3LO',
						authorized: false,
						grant: {
							authorizationEndpoint: expect.any(String),
						},
					});
				});
		});

		it('should return a response indicating that user is not authorized if credentials could not be refreshed', async () => {
			const connectInstallation = await connectInstallationRepository.upsert(
				generateConnectInstallationCreateParams(),
			);
			const atlassianUserId = uuidv4();
			await figmaOAuth2UserCredentialsRepository.upsert(
				generateExpiredFigmaOAuth2UserCredentialCreateParams({
					refreshToken: REFRESH_TOKEN,
					atlassianUserId,
					connectInstallationId: connectInstallation.id,
				}),
			);
			const jwt = generateJiraServerSymmetricJwtToken({
				request: {
					method: 'GET',
					pathname: '/auth/checkAuth',
					query: { userId: atlassianUserId },
				},
				connectInstallation,
			});

			nock(FIGMA_OAUTH_API_BASE_URL)
				.post(FIGMA_OAUTH_REFRESH_TOKEN_ENDPOINT)
				.query(REFRESH_TOKEN_QUERY_PARAMS)
				.reply(HttpStatusCode.InternalServerError);

			return request(app)
				.get(CHECK_AUTH_ENDPOINT)
				.query({
					userId: atlassianUserId,
				})
				.set('Authorization', `JWT ${jwt}`)
				.expect(HttpStatusCode.Ok)
				.then((response) => {
					expect(response.body).toStrictEqual({
						type: '3LO',
						authorized: false,
						grant: {
							authorizationEndpoint: expect.any(String),
						},
					});
				});
		});

		it('should return a response indicating that user is not authorized if the /me endpoint responds with a 403', async () => {
			const connectInstallation = await connectInstallationRepository.upsert(
				generateConnectInstallationCreateParams(),
			);
			const atlassianUserId = uuidv4();
			await figmaOAuth2UserCredentialsRepository.upsert(
				generateFigmaOAuth2UserCredentialCreateParams({
					atlassianUserId,
					connectInstallationId: connectInstallation.id,
				}),
			);
			const jwt = generateJiraServerSymmetricJwtToken({
				request: {
					method: 'GET',
					pathname: '/auth/checkAuth',
					query: { userId: atlassianUserId },
				},
				connectInstallation,
			});

			mockFigmaMeEndpoint({
				baseUrl: getConfig().figma.apiBaseUrl,
				status: HttpStatusCode.Forbidden,
			});

			return request(app)
				.get(CHECK_AUTH_ENDPOINT)
				.query({
					userId: atlassianUserId,
				})
				.set('Authorization', `JWT ${jwt}`)
				.expect(HttpStatusCode.Ok)
				.then((response) => {
					expect(response.body).toStrictEqual({
						type: '3LO',
						authorized: false,
						grant: {
							authorizationEndpoint: expect.any(String),
						},
					});
				});
		});

		it('should return a response indicating that user is not authorized with correct grant URL', async () => {
			const connectInstallation = await connectInstallationRepository.upsert(
				generateConnectInstallationCreateParams(),
			);
			const atlassianUserId = uuidv4();
			const jwt = generateJiraServerSymmetricJwtToken({
				request: {
					method: 'GET',
					pathname: '/auth/checkAuth',
					query: { userId: atlassianUserId },
				},
				connectInstallation,
			});

			return request(app)
				.get(CHECK_AUTH_ENDPOINT)
				.query({
					userId: atlassianUserId,
				})
				.set('Authorization', `JWT ${jwt}`)
				.expect(HttpStatusCode.Ok)
				.then((response) => {
					const authorizationEndpoint = new URL(
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
						response.body.grant.authorizationEndpoint,
					);

					expect(authorizationEndpoint.origin).toBe(
						getConfig().figma.oauth2.authorizationServerBaseUrl,
					);
					expect(authorizationEndpoint.pathname).toBe('/oauth');
					expect([
						...authorizationEndpoint.searchParams.entries(),
					]).toStrictEqual([
						['client_id', getConfig().figma.oauth2.clientId],
						['redirect_uri', `${getConfig().app.baseUrl}/figma/oauth/callback`],
						['scope', getConfig().figma.oauth2.scope],
						['state', expect.any(String)],
						['response_type', 'code'],
					]);
					expect(
						figmaAuthService.verifyOAuth2AuthorizationResponseState(
							authorizationEndpoint.searchParams.get('state'),
						),
					).toStrictEqual({
						atlassianUserId,
						connectClientKey: connectInstallation.clientKey,
					});
				});
		});
	});
});
