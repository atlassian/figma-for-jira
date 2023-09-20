export type GetOAuth2TokenResponse = {
	readonly access_token: string;
	readonly refresh_token: string;
	readonly expires_in: number;
};

export type RefreshOAuth2TokenResponse = Omit<
	GetOAuth2TokenResponse,
	'refresh_token'
>;

export type MeResponse = {
	readonly id: string;
	readonly email: string;
	readonly handle: string;
	readonly img_url: string;
};

export type GetFileParams = {
	readonly depth?: number;
	readonly ids?: string[];
	readonly node_last_modified?: boolean;
};

export type FileResponse = {
	readonly name: string;
	readonly role: string;
	readonly version: string;
	readonly lastModified: string;
	readonly editorType: string;
	readonly thumbnailUrl: string;
	readonly document: Node;
};

export type Node = {
	readonly id: string;
	readonly name: string;
	readonly type: string;
	readonly devStatus?: NodeDevStatus;
	readonly children?: Node[];
};

export type NodeDevStatus = {
	readonly type: string;
};

export type DevResource = {
	readonly id: string;
	readonly name: string;
	readonly url: string;
	readonly file_key: string;
	readonly node_id: string;
};

export type CreateDevResourcesRequest = Omit<DevResource, 'id'>;

type CreateDevResourceError = {
	readonly file_key: string | null;
	readonly node_id: string | null;
	readonly error: string;
};

export type CreateDevResourcesResponse = {
	readonly links_created: DevResource[];
	readonly errors: CreateDevResourceError[];
};

export type GetDevResourcesRequest = {
	readonly fileKey: string;
	readonly nodeIds?: string;
	readonly accessToken: string;
};

export type GetDevResourcesResponse = {
	readonly dev_resources: DevResource[];
};

export type DeleteDevResourceRequest = {
	readonly fileKey: string;
	readonly devResourceId: string;
	readonly accessToken: string;
};