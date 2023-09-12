import { AxiosError } from 'axios';

import { FigmaServiceCredentialsError } from './errors';
import { figmaAuthService } from './figma-auth-service';
import type { CreateDevResourcesResponse } from './figma-client';
import { figmaClient } from './figma-client';
import type { FigmaUrlData } from './figma-transformer';
import {
	buildDevResource,
	extractDataFromFigmaUrl,
	transformFileToAtlassianDesign,
	transformNodeIdForStorage,
	transformNodeToAtlassianDesign,
} from './figma-transformer';

import { HttpStatus } from '../../common/http-status';
import type {
	AtlassianDesign,
	FigmaOAuth2UserCredentials,
} from '../../domain/entities';
import { getLogger } from '../logger';

export const DEFAULT_FIGMA_FILE_NODE_ID = '0:0';

const extractDataFromFigmaUrlOrThrow = (url: string): FigmaUrlData => {
	const urlData = extractDataFromFigmaUrl(url);
	if (!urlData) {
		throw new Error(`Received invalid Figma URL: ${url}`);
	}
	return urlData;
};

export class FigmaService {
	getValidCredentialsOrThrow = async (
		atlassianUserId: string,
	): Promise<FigmaOAuth2UserCredentials> => {
		try {
			const credentials =
				await figmaAuthService.getCredentials(atlassianUserId);
			await figmaClient.me(credentials.accessToken);

			return credentials;
		} catch (e: unknown) {
			if (
				e instanceof AxiosError &&
				e.response?.status !== HttpStatus.UNAUTHORIZED &&
				e.response?.status !== HttpStatus.FORBIDDEN
			) {
				throw e;
			}

			throw new FigmaServiceCredentialsError(
				atlassianUserId,
				e instanceof Error ? e : undefined,
			);
		}
	};

	fetchDesignByUrl = async (
		url: string,
		atlassianUserId: string,
	): Promise<AtlassianDesign> => {
		const { fileKey, nodeId, isPrototype } =
			extractDataFromFigmaUrlOrThrow(url);

		const credentials = await this.getValidCredentialsOrThrow(atlassianUserId);

		const { accessToken } = credentials;

		if (nodeId) {
			const fileNodesResponse = await figmaClient.getFileNodes(
				fileKey,
				nodeId,
				accessToken,
			);
			return transformNodeToAtlassianDesign({
				fileKey,
				nodeId,
				isPrototype,
				fileNodesResponse,
			});
		} else {
			const fileResponse = await figmaClient.getFile(fileKey, accessToken);
			return transformFileToAtlassianDesign({
				fileKey,
				isPrototype,
				fileResponse,
			});
		}
	};

	createDevResource = async ({
		designUrl,
		issueUrl,
		issueTitle,
		atlassianUserId,
	}: {
		designUrl: string;
		issueUrl: string;
		issueTitle: string;
		atlassianUserId: string;
	}): Promise<CreateDevResourcesResponse> => {
		const { fileKey, nodeId } = extractDataFromFigmaUrlOrThrow(designUrl);
		const credentials = await this.getValidCredentialsOrThrow(atlassianUserId);

		const { accessToken } = credentials;

		const devResource = buildDevResource({
			name: issueTitle,
			url: issueUrl,
			file_key: fileKey,
			node_id: nodeId
				? transformNodeIdForStorage(nodeId)
				: DEFAULT_FIGMA_FILE_NODE_ID,
		});

		const response = await figmaClient.createDevResources(
			[devResource],
			accessToken,
		);

		if (response.errors?.length > 0) {
			const errorMessage = response.errors.map((err) => err.error).join('|');
			getLogger().error(errorMessage, 'Created dev resources with errors');
		}

		return response;
	};
}

export const figmaService = new FigmaService();
