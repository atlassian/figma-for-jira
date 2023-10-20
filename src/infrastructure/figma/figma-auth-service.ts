import {
	decodeSymmetric,
	encodeSymmetric,
	SymmetricAlgorithm,
} from 'atlassian-jwt';

import { figmaClient } from './figma-client';

import { Duration } from '../../common/duration';
import {
	NotFoundOperationError,
	UnauthorizedOperationError,
} from '../../common/errors';
import { ensureString } from '../../common/string-utils';
import { getConfig } from '../../config';
import type {
	ConnectInstallation,
	ConnectUserInfo,
	FigmaOAuth2UserCredentials,
} from '../../domain/entities';
import type { JSONSchemaTypeWithId } from '../ajv';
import { assertSchema } from '../ajv';
import { figmaOAuth2UserCredentialsRepository } from '../repositories';

type FigmaOAuth2StateJwtClaims = {
	readonly iss: string;
	readonly iat: number;
	readonly exp: number;
	readonly sub: string;
	readonly aud: string[];
};

const FIGMA_OAUTH2_STATE_JWT_CLAIMS_SCHEMA: JSONSchemaTypeWithId<FigmaOAuth2StateJwtClaims> =
	{
		$id: 'figma-for-jira:oauth2-state-jwt-token-claims',
		type: 'object',
		properties: {
			iss: { type: 'string', minLength: 1 },
			iat: { type: 'integer' },
			exp: { type: 'integer' },
			sub: { type: 'string', minLength: 1 },
			aud: {
				type: 'array',
				items: { type: 'string' },
			},
		},
		required: ['iss', 'iat', 'exp', 'sub', 'aud'],
	};

export class FigmaAuthService {
	/**
	 * Exchanges the given code on OAuth 2.0 token and stores the credentials for the future usage.
	 */
	createCredentials = async (
		code: string,
		user: ConnectUserInfo,
	): Promise<FigmaOAuth2UserCredentials> => {
		const response = await figmaClient.getOAuth2Token(code);

		return await figmaOAuth2UserCredentialsRepository.upsert({
			atlassianUserId: user.atlassianUserId,
			accessToken: response.access_token,
			refreshToken: response.refresh_token,
			expiresAt: this.createExpiryDate(response.expires_in),
			connectInstallationId: user.connectInstallationId,
		});
	};

	/**
	 * Returns OAuth 2.0 credentials for the given user if he/she completed OAuth 2.0 flow; otherwise -- `null`.
	 *
	 * The method refreshes access token when required, so the caller does not need to handle token expiration.
	 */
	getCredentials = async (
		user: ConnectUserInfo,
	): Promise<FigmaOAuth2UserCredentials> => {
		let credentials: FigmaOAuth2UserCredentials;

		try {
			credentials = await figmaOAuth2UserCredentialsRepository.get(
				user.atlassianUserId,
				user.connectInstallationId,
			);
		} catch (e: unknown) {
			if (e instanceof NotFoundOperationError) {
				throw new UnauthorizedOperationError(
					'Cannot get Figma credentials.',
					e,
				);
			}

			throw e;
		}

		try {
			if (credentials.isExpired()) {
				credentials = await this.refreshCredentials(credentials);
			}

			return credentials;
		} catch (e: unknown) {
			throw new UnauthorizedOperationError(
				'Cannot refresh Figma credentials.',
				e,
			);
		}
	};

	/**
	 * Returns an authorization endpoint URL for the given user.
	 *
	 * @remarks
	 * As a countermeasure against Cross-Site Request Forgery (CSRF) attacks, the URL includes the `state`
	 * query parameter, which represents a user-bound signed JWT token.
	 *
	 * @see https://www.figma.com/developers/api#oauth2
	 */
	createOAuth2AuthorizationRequest = ({
		atlassianUserId,
		connectInstallation,
		redirectEndpoint,
	}: {
		atlassianUserId: string;
		connectInstallation: ConnectInstallation;
		redirectEndpoint: string;
	}): string => {
		const authorizationEndpoint = new URL(
			'/oauth',
			getConfig().figma.oauth2.authorizationServerBaseUrl,
		);

		const nowInSeconds = Math.floor(Date.now() / 1000);

		const state = encodeSymmetric(
			{
				iss: connectInstallation.clientKey,
				iat: nowInSeconds,
				exp: nowInSeconds + Duration.ofMinutes(5).asSeconds,
				sub: atlassianUserId,
				aud: [getConfig().app.baseUrl],
			},
			getConfig().figma.oauth2.stateSecretKey,
			SymmetricAlgorithm.HS256,
		);

		authorizationEndpoint.search = new URLSearchParams({
			client_id: getConfig().figma.oauth2.clientId,
			redirect_uri: `${getConfig().app.baseUrl}/${redirectEndpoint}`,
			scope: getConfig().figma.oauth2.scope,
			state,
			response_type: 'code',
		}).toString();

		return authorizationEndpoint.toString();
	};

	/**
	 * Verifies and returns the OAuth 2.0 authorization response state.
	 *
	 * It verifies the state represents an authentic non-expired JWT token.
	 *
	 * @see https://www.figma.com/developers/api#oauth2
	 */
	verifyOAuth2AuthorizationResponseState = (
		state: unknown,
	): { atlassianUserId: string; connectClientKey: string } => {
		const encodedState = ensureString(state);

		const claims = decodeSymmetric(
			encodedState,
			getConfig().figma.oauth2.stateSecretKey,
			SymmetricAlgorithm.HS256,
		) as unknown;

		assertSchema(claims, FIGMA_OAUTH2_STATE_JWT_CLAIMS_SCHEMA);

		const nowInSeconds = Date.now() / 1000;

		if (nowInSeconds > claims.exp) {
			throw new Error('The token is expired.');
		}

		if (claims.aud[0] !== getConfig().app.baseUrl) {
			throw new Error('The token contains an invalid `aud` claim.');
		}

		return {
			atlassianUserId: claims.sub,
			connectClientKey: claims.iss,
		};
	};

	private refreshCredentials = async (
		credentials: FigmaOAuth2UserCredentials,
	): Promise<FigmaOAuth2UserCredentials> => {
		const response = await figmaClient.refreshOAuth2Token(
			credentials.refreshToken,
		);

		return figmaOAuth2UserCredentialsRepository.upsert({
			atlassianUserId: credentials.atlassianUserId,
			accessToken: response.access_token,
			refreshToken: credentials.refreshToken,
			expiresAt: this.createExpiryDate(response.expires_in),
			connectInstallationId: credentials.connectInstallationId,
		});
	};

	private createExpiryDate(expiresInSeconds: number): Date {
		return new Date(Date.now() + expiresInSeconds * 1000);
	}
}

export const figmaAuthService = new FigmaAuthService();
