import { v4 as uuidv4 } from 'uuid';

import type {
	CreateDevResourceError,
	CreateDevResourcesRequest,
	CreateDevResourcesResponse,
	CreateWebhookResponse,
	GetDevResourcesResponse,
	GetFileMetaResponse,
	GetFileResponse,
	GetMeResponse,
	GetOAuth2TokenResponse,
	GetTeamProjectsResponse,
	Node,
	NodeDevStatus,
	RefreshOAuth2TokenResponse,
} from '..';
import { Duration } from '../../../../common/duration';
import {
	generateFigmaFileKey,
	generateFigmaFileName,
	generateFigmaNodeId,
	generateJiraIssueUrl,
} from '../../../../domain/entities/testing';

export const MOCK_DOCUMENT: Node = {
	id: '0:0',
	name: 'Document',
	type: 'DOCUMENT',
};

export const generateFrameNode = ({
	id = generateFigmaNodeId(),
	name = `Test Frame ${id}`,
	lastModified,
	devStatus,
	children = [],
}: {
	id?: string;
	name?: string;
	lastModified?: Date;
	devStatus?: NodeDevStatus;
	children?: Node[];
} = {}): Node => ({
	id,
	name,
	type: 'FRAME',
	devStatus: devStatus,
	lastModified: lastModified?.toISOString(),
	children,
});

export const generateChildNode = ({
	id = generateFigmaNodeId(),
	name = `Test Rectangle ${id}`,
} = {}): Node => ({
	id,
	name,
	type: 'RECTANGLE',
});

export const generateGetOAuth2TokenResponse = ({
	accessToken = uuidv4(),
	refreshToken = uuidv4(),
	expiresIn = Duration.ofMinutes(90),
} = {}): GetOAuth2TokenResponse => ({
	access_token: accessToken,
	refresh_token: refreshToken,
	expires_in: expiresIn.asSeconds,
});

export const generateRefreshOAuth2TokenResponse = ({
	accessToken = uuidv4(),
	expiresIn = Duration.ofMinutes(90),
} = {}): RefreshOAuth2TokenResponse => ({
	access_token: accessToken,
	expires_in: expiresIn.asSeconds,
});

export const generateGetOAuth2TokenQueryParams = ({
	redirect_uri = 'https://www.example.com/auth/callback',
	code = 'code-123',
	grant_type = 'authorization_code',
} = {}) => ({
	redirect_uri,
	code,
	grant_type,
});

export const generateRefreshOAuth2TokenQueryParams = ({
	refresh_token = 'refresh_token',
} = {}) => ({
	refresh_token,
});

export const generateOAuth2BasicAuthHeader = ({
	client_id = 'client-id',
	client_secret = 'client-secret',
} = {}) => 'Basic ' + btoa(`${client_id}:${client_secret}`);

export const generateGetMeResponse = ({
	id = uuidv4(),
	email = `uuidv4@figma.com`,
} = {}): GetMeResponse => ({
	id,
	email,
});

export const generateGetFileMetaResponse = ({
	name = generateFigmaFileName(),
	lastModified = new Date(),
	lastTouchedBy = { id: uuidv4() },
}: {
	name?: string;
	lastModified?: Date;
	lastTouchedBy?: { id: string } | null;
} = {}): GetFileMetaResponse => ({
	file: {
		name,
		last_touched_at: lastModified.toISOString(),
		last_touched_by: lastTouchedBy,
		editorType: 'figma',
	},
});

export const generateGetFileResponse = ({
	name = generateFigmaFileName(),
	lastModified = new Date(),
	document = MOCK_DOCUMENT,
} = {}): GetFileResponse => ({
	name,
	lastModified: lastModified.toISOString(),
	editorType: 'figma',
	document: document,
});

export const generateGetFileResponseWithNode = ({
	name = generateFigmaFileName(),
	lastModified = new Date(),
	node = generateChildNode(),
} = {}): GetFileResponse => ({
	name,
	lastModified: lastModified.toISOString(),
	editorType: 'figma',
	document: {
		...MOCK_DOCUMENT,
		children: [node],
	},
});

export const generateGetFileResponseWithNodes = ({
	name = generateFigmaFileName(),
	lastModified = new Date(),
	nodes = [generateChildNode()],
} = {}): GetFileResponse => ({
	name,
	lastModified: lastModified.toISOString(),
	editorType: 'figma',
	document: {
		...MOCK_DOCUMENT,
		children: nodes,
	},
});

export const generateCreateDevResourcesRequest = ({
	name = 'Mock dev resource',
	url = generateJiraIssueUrl(),
	fileKey = generateFigmaFileKey(),
	nodeId = generateFigmaNodeId(),
}: {
	name?: string;
	url?: string;
	fileKey?: string;
	nodeId?: string;
} = {}): CreateDevResourcesRequest => ({
	dev_resources: [
		{
			name,
			url,
			file_key: fileKey,
			node_id: nodeId,
		},
	],
});

export const generateCreateDevResourcesResponse = ({
	errors = [],
}: {
	errors?: CreateDevResourceError[];
} = {}): CreateDevResourcesResponse => ({
	errors,
});

export const generateGetDevResourcesResponse = ({
	id = uuidv4(),
	name = 'Mock dev resource',
	url = generateJiraIssueUrl(),
	file_key = generateFigmaFileKey(),
	node_id = generateFigmaNodeId(),
}: {
	id?: string;
	name?: string;
	url?: string;
	file_key?: string;
	node_id?: string;
} = {}): GetDevResourcesResponse => ({
	dev_resources: [{ id, name, url, file_key, node_id }],
});

export const generateEmptyDevResourcesResponse =
	(): GetDevResourcesResponse => ({
		dev_resources: [],
	});

export const generateCreateWebhookResponse = ({
	id = uuidv4(),
	teamId = uuidv4(),
	eventType = 'FILE_UPDATE',
	clientId = uuidv4(),
	endpoint = `https://figma-for-jira.atlassian.com/figma/webhooks`,
	passcode = uuidv4(),
	status = 'ACTIVE',
	description = 'Figma for Jira',
	protocolVersion = '2',
} = {}): CreateWebhookResponse => ({
	id: id,
	team_id: teamId,
	event_type: eventType,
	client_id: clientId,
	endpoint,
	passcode,
	status,
	description,
	protocol_version: protocolVersion,
});

export const generateGetTeamProjectsResponse = ({
	name = `Team ${uuidv4()}`,
} = {}): GetTeamProjectsResponse => ({
	name,
	projects: [],
});
