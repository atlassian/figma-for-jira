import { FileNodesResponse, FileResponse, NodeDevStatus } from './figma-client';

import {
	FIGMA_URL_REGEX,
	ISSUE_ASSOCIATED_DESIGN_RELATIONSHIP_TYPE,
} from '../../common/constants';
import { getConfig } from '../../config';
import {
	AtlassianDesign,
	DesignStatus,
	DesignType,
} from '../../domain/entities/design';
import { AssociateWith } from '../../web/routes/entities';

export type FigmaUrlData = {
	fileKey: string;
	nodeId?: string;
	isPrototype: boolean;
};

export const extractDataFromFigmaUrl = (url: string): FigmaUrlData | null => {
	const fileKeyRegex = /file\/([a-zA-Z0-9]+)/;
	const nodeIdRegex = /node-id=([a-zA-Z0-9-]+)/;
	const prototypeRegex = /proto\/([a-zA-Z0-9]+)/;

	const fileKeyMatch = url.match(fileKeyRegex);
	const nodeIdMatch = url.match(nodeIdRegex);
	const prototypeMatch = url.match(prototypeRegex);
	const isPrototype = prototypeRegex.test(url);

	if (!fileKeyMatch && !prototypeMatch) {
		return null;
	}

	const fileKey = fileKeyMatch ? fileKeyMatch[1] : prototypeMatch![1];
	const nodeId = nodeIdMatch ? nodeIdMatch[1] : undefined;

	return {
		fileKey,
		...(nodeId && { nodeId }),
		isPrototype,
	};
};

/**
 * Validates that a string is a valid Figma URL that will be handled by Figma's embed endpoint,
 * then transforms that string into a live embed URL.
 * @see https://www.figma.com/developers/embed
 */
export const buildLiveEmbedUrl = (url: string): string => {
	if (!FIGMA_URL_REGEX.test(url)) {
		throw new Error('Not a valid Figma URL');
	}
	const urlObject = new URL(`${getConfig().figma.baseUrl}/embed`);
	urlObject.searchParams.append('embed_host', 'atlassian');
	urlObject.searchParams.append('url', url);
	return urlObject.toString();
};

/**
 * Transforms a regular Figma URL into an Inspect mode URL.
 */
export const buildInspectUrl = (url: string): string => {
	const urlObject = new URL(url);
	urlObject.searchParams.delete('type');
	urlObject.searchParams.delete('t');
	urlObject.searchParams.set('mode', 'dev');
	return urlObject.toString();
};

export const transformNodeId = (nodeId: string): string => {
	return nodeId.replace('-', ':');
};

/**
 * Maps a Figma devStatus to an Atlassian Design entity status.
 * @see SECTION on https://www.figma.com/developers/api#node-types
 * @returns
 */
export const mapNodeStatusToDevStatus = (
	devStatus: NodeDevStatus,
): DesignStatus =>
	devStatus.type === 'READY_FOR_DEV'
		? DesignStatus.READY_FOR_DEVELOPMENT
		: DesignStatus.UNKNOWN;

/**
 * Maps a Figma node type to an Atlassian Design entity type.
 * @see https://www.figma.com/developers/api#node-types
 * @returns
 */
export const mapNodeTypeToDesignType = (
	type: string,
	isPrototype: boolean,
): DesignType => {
	if (isPrototype) {
		return DesignType.PROTOTYPE;
	}
	if (type === 'DOCUMENT') {
		return DesignType.FILE;
	}
	if (type === 'CANVAS') {
		return DesignType.CANVAS;
	}
	if (type === 'SECTION' || type === 'GROUP') {
		return DesignType.GROUP;
	}
	if (type === 'FRAME') {
		return DesignType.NODE;
	}
	return DesignType.OTHER;
};

const getUpdateSequenceNumber = (input: string): number => {
	const updateSequenceNumber = parseInt(input, 10);
	if (isNaN(updateSequenceNumber)) {
		throw new Error('Could not convert version to update sequence number');
	}
	return updateSequenceNumber;
};

type TransformNodeToAtlassianDesignArgs = {
	nodeId: string;
	url: string;
	isPrototype: boolean;
	associateWith: AssociateWith;
	fileNodesResponse: FileNodesResponse;
};

export const transformNodeToAtlassianDesign = ({
	nodeId,
	url,
	isPrototype,
	associateWith,
	fileNodesResponse,
}: TransformNodeToAtlassianDesignArgs): AtlassianDesign => {
	const node = fileNodesResponse.nodes[transformNodeId(nodeId)].document;
	return {
		id: node.id,
		displayName: node.name,
		url,
		liveEmbedUrl: buildLiveEmbedUrl(url),
		inspectUrl: buildInspectUrl(url),
		status: node.devStatus
			? mapNodeStatusToDevStatus(node.devStatus)
			: DesignStatus.NONE,
		type: mapNodeTypeToDesignType(node.type, isPrototype),
		// TODO: lastUpdated should come from the app database once polling is added
		lastUpdated: new Date().toISOString(),
		updateSequenceNumber: getUpdateSequenceNumber(fileNodesResponse.version),
		addAssociations: [
			{
				associationType: ISSUE_ASSOCIATED_DESIGN_RELATIONSHIP_TYPE,
				values: [associateWith.ari],
			},
		],
		removeAssociations: [],
	};
};

type TransformFileToAtlassianDesignArgs = {
	url: string;
	fileKey: string;
	isPrototype: boolean;
	associateWith: AssociateWith;
	fileResponse: FileResponse;
};

export const transformFileToAtlassianDesign = ({
	url,
	fileKey,
	isPrototype,
	associateWith,
	fileResponse,
}: TransformFileToAtlassianDesignArgs): AtlassianDesign => {
	return {
		id: fileKey,
		displayName: fileResponse.name,
		url,
		liveEmbedUrl: buildLiveEmbedUrl(url),
		inspectUrl: buildInspectUrl(url),
		status: DesignStatus.NONE,
		type: isPrototype ? DesignType.PROTOTYPE : DesignType.FILE,
		// TODO: lastUpdated should come from the app database once polling is added
		lastUpdated: new Date().toISOString(),
		updateSequenceNumber: getUpdateSequenceNumber(fileResponse.version),
		addAssociations: [
			{
				associationType: ISSUE_ASSOCIATED_DESIGN_RELATIONSHIP_TYPE,
				values: [associateWith.ari],
			},
		],
		removeAssociations: [],
	};
};