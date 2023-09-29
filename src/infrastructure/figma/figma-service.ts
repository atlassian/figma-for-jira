import { AxiosError, HttpStatusCode } from 'axios';

import { FigmaServiceCredentialsError, FigmaServiceError } from './errors';
import { figmaAuthService } from './figma-auth-service';
import type {
	CreateDevResourcesRequest,
	CreateWebhookRequest,
} from './figma-client';
import { figmaClient, FigmaClientNotFoundError } from './figma-client';
import {
	transformFileToAtlassianDesign,
	transformNodeToAtlassianDesign,
} from './transformers';

import { getConfig } from '../../config';
import type {
	AtlassianDesign,
	FigmaDesignIdentifier,
	FigmaOAuth2UserCredentials,
} from '../../domain/entities';
import { getLogger } from '../logger';

export const buildDevResourceNameFromJiraIssue = (
	issueKey: string,
	issueSummary: string,
) => `[${issueKey}] ${issueSummary}`;

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
				e.response?.status !== HttpStatusCode.Unauthorized &&
				e.response?.status !== HttpStatusCode.Forbidden
			) {
				throw e;
			}

			throw new FigmaServiceCredentialsError(
				atlassianUserId,
				e instanceof Error ? e : undefined,
			);
		}
	};

	fetchDesignById = async (
		designId: FigmaDesignIdentifier,
		atlassianUserId: string,
	): Promise<AtlassianDesign> => {
		const credentials = await this.getValidCredentialsOrThrow(atlassianUserId);

		const { accessToken } = credentials;

		if (designId.nodeId) {
			const fileResponse = await figmaClient.getFile(
				designId.fileKey,
				{
					ids: [designId.nodeId],
					node_last_modified: true,
				},
				accessToken,
			);
			return transformNodeToAtlassianDesign({
				fileKey: designId.fileKey,
				nodeId: designId.nodeId,
				fileResponse,
			});
		} else {
			const fileResponse = await figmaClient.getFile(
				designId.fileKey,
				{ depth: 1 },
				accessToken,
			);
			return transformFileToAtlassianDesign({
				fileKey: designId.fileKey,
				fileResponse,
			});
		}
	};

	fetchDesignsByIds = async (
		designIds: FigmaDesignIdentifier[],
		atlassianUserId: string,
	): Promise<AtlassianDesign[]> => {
		if (!designIds.length) {
			return [];
		}

		// Ensure all design identifiers have the same file key
		const fileKey = designIds[0].fileKey;
		for (const designId of designIds.slice(1)) {
			if (designId.fileKey !== fileKey) {
				throw new FigmaServiceError('designIds must all have the same fileKey');
			}
		}

		const credentials = await this.getValidCredentialsOrThrow(atlassianUserId);

		const { accessToken } = credentials;

		const fileResponse = await figmaClient.getFile(
			fileKey,
			{
				ids: designIds.flatMap((designId) =>
					designId.nodeId ? designId.nodeId : [],
				),
				node_last_modified: true,
			},
			accessToken,
		);

		return designIds.map((designId) => {
			if (!designId.nodeId) {
				return transformFileToAtlassianDesign({
					fileKey: designId.fileKey,
					fileResponse,
				});
			} else {
				return transformNodeToAtlassianDesign({
					fileKey: designId.fileKey,
					nodeId: designId.nodeId,
					fileResponse,
				});
			}
		});
	};

	createDevResourceForJiraIssue = async ({
		designId,
		issue,
		atlassianUserId,
	}: {
		designId: FigmaDesignIdentifier;
		issue: {
			url: string;
			key: string;
			title: string;
		};
		atlassianUserId: string;
	}): Promise<void> => {
		const credentials = await this.getValidCredentialsOrThrow(atlassianUserId);

		const { accessToken } = credentials;

		const devResource: CreateDevResourcesRequest = {
			name: buildDevResourceNameFromJiraIssue(issue.key, issue.title),
			url: issue.url,
			file_key: designId.fileKey,
			node_id: designId.nodeIdOrDefaultDocumentId,
		};

		const response = await figmaClient.createDevResources(
			[devResource],
			accessToken,
		);

		if (response.errors?.length > 0) {
			getLogger().error(
				{ errors: response.errors },
				'Created dev resources with errors',
			);
		}
	};

	deleteDevResourceIfExists = async ({
		designId,
		devResourceUrl,
		atlassianUserId,
	}: {
		designId: FigmaDesignIdentifier;
		devResourceUrl: string;
		atlassianUserId: string;
	}): Promise<void> => {
		const credentials = await this.getValidCredentialsOrThrow(atlassianUserId);

		const { accessToken } = credentials;

		const { dev_resources } = await figmaClient.getDevResources({
			fileKey: designId.fileKey,
			nodeIds: designId.nodeIdOrDefaultDocumentId,
			accessToken,
		});

		const devResourceToDelete = dev_resources.find(
			(devResource) => devResource.url === devResourceUrl,
		);

		if (!devResourceToDelete) {
			getLogger().error(
				`No matching dev resource found to delete for file ${designId.fileKey} and node ${designId.nodeId}`,
			);
			return;
		}

		await figmaClient.deleteDevResource({
			fileKey: designId.fileKey,
			devResourceId: devResourceToDelete.id,
			accessToken,
		});
	};

	createFileUpdateWebhook = async (
		teamId: string,
		atlassianUserId: string,
		passcode: string,
	): Promise<{ webhookId: string; teamId: string }> => {
		const { accessToken } =
			await this.getValidCredentialsOrThrow(atlassianUserId);

		const request: CreateWebhookRequest = {
			event_type: 'FILE_UPDATE',
			team_id: teamId,
			endpoint: `${getConfig().app.baseUrl}/figma/webhook`,
			passcode,
			description: 'Figma for Jira Cloud',
		};

		const result = await figmaClient.createWebhook(request, accessToken);
		return { webhookId: result.id, teamId: result.team_id };
	};

	deleteWebhook = async (
		webhookId: string,
		atlassianUserId: string,
	): Promise<void> => {
		const { accessToken } =
			await this.getValidCredentialsOrThrow(atlassianUserId);

		try {
			await figmaClient.deleteWebhook(webhookId, accessToken);
		} catch (e) {
			if (e instanceof FigmaClientNotFoundError) return;

			throw e;
		}
	};

	getTeamName = async (
		teamId: string,
		atlassianUserId: string,
	): Promise<string> => {
		const { accessToken } =
			await this.getValidCredentialsOrThrow(atlassianUserId);

		const response = await figmaClient.getTeamProjects(teamId, accessToken);
		return response.name;
	};
}

export const figmaService = new FigmaService();
