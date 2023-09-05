import { AxiosError } from 'axios';

import {
	figmaAuthService,
	NoFigmaCredentialsError,
	RefreshFigmaCredentialsError,
} from './figma-auth-service';
import type { CreateDevResourcesResponse } from './figma-client';
import { figmaClient } from './figma-client';
import type { FigmaUrlData } from './figma-transformer';
import {
	buildDevResource,
	extractDataFromFigmaUrl,
	transformFileToAtlassianDesign,
	transformNodeId,
	transformNodeToAtlassianDesign,
} from './figma-transformer';

import { HttpStatus } from '../../common/http-status';
import type {
	AtlassianDesign,
	FigmaOAuth2UserCredentials,
} from '../../domain/entities';
import { getLogger } from '../logger';

export const DEFAULT_FIGMA_FILE_NODE_ID = '0:0';

// TODO: Replace with call to Jira service to get issue details
const getIssueDetailsStub = () => {
	return {
		issueUrl: 'https://jira-issue.com/123',
		issueTitle: 'Test Issue',
	};
};

const extractDataFromFigmaUrlOrThrow = (url: string): FigmaUrlData => {
	const urlData = extractDataFromFigmaUrl(url);
	if (!urlData) {
		const errorMessage = `Received invalid Figma URL: ${url}`;
		getLogger().error(errorMessage);
		throw new Error(errorMessage);
	}
	return urlData;
};

export class FigmaService {
	getValidCredentials = async (
		atlassianUserId: string,
	): Promise<FigmaOAuth2UserCredentials | null> => {
		try {
			const credentials =
				await figmaAuthService.getCredentials(atlassianUserId);
			await figmaClient.me(credentials.accessToken);

			return credentials;
		} catch (e: unknown) {
			if (
				e instanceof NoFigmaCredentialsError ||
				e instanceof RefreshFigmaCredentialsError
			)
				return null;

			const forbidden =
				e instanceof AxiosError && e?.response?.status == HttpStatus.FORBIDDEN;

			if (forbidden) return null;

			throw e;
		}
	};

	fetchDesign = async (
		url: string,
		atlassianUserId: string,
	): Promise<AtlassianDesign> => {
		const { fileKey, nodeId, isPrototype } =
			extractDataFromFigmaUrlOrThrow(url);

		const credentials = await this.getValidCredentials(atlassianUserId);
		if (!credentials) {
			throw new Error('Invalid credentials');
		}

		const { accessToken } = credentials;

		if (nodeId) {
			const fileNodesResponse = await figmaClient.getFileNodes(
				fileKey,
				nodeId,
				accessToken,
			);
			return transformNodeToAtlassianDesign({
				nodeId,
				url,
				isPrototype,
				fileNodesResponse,
			});
		} else {
			const fileResponse = await figmaClient.getFile(fileKey, accessToken);
			return transformFileToAtlassianDesign({
				url,
				fileKey,
				isPrototype,
				fileResponse,
			});
		}
	};

	createDevResource = async (
		url: string,
		atlassianUserId: string,
	): Promise<CreateDevResourcesResponse> => {
		try {
			const { fileKey, nodeId } = extractDataFromFigmaUrlOrThrow(url);
			const credentials = await this.getValidCredentials(atlassianUserId);
			if (!credentials) {
				throw new Error('Invalid credentials');
			}

			const { accessToken } = credentials;

			// TODO: Replace with call to Jira service to get issue details
			const { issueUrl, issueTitle } = getIssueDetailsStub();

			const devResource = buildDevResource({
				name: issueTitle,
				url: issueUrl,
				file_key: fileKey,
				node_id: nodeId ? transformNodeId(nodeId) : DEFAULT_FIGMA_FILE_NODE_ID,
			});

			const response = await figmaClient.createDevResources(
				[devResource],
				accessToken,
			);

			if (response.errors.length > 0) {
				const errorMessage = response.errors.map((err) => err.error).join('|');
				getLogger().error(errorMessage, 'Created dev resources with errors');
			}

			return response;
		} catch (err) {
			getLogger().error(err, 'Failed to create dev resources');
			throw err;
		}
	};
}

export const figmaService = new FigmaService();
