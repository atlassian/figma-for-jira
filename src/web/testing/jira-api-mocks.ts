import { HttpStatusCode } from 'axios';
import type { RequestBodyMatcher } from 'nock';
import nock from 'nock';

import { generateJiraIssueId } from '../../domain/entities/testing';
import type {
	CheckPermissionsRequest,
	CheckPermissionsResponse,
	GetIssuePropertyResponse,
	SubmitDesignsRequest,
	SubmitDesignsResponse,
} from '../../infrastructure/jira/jira-client';
import {
	generateCheckPermissionsResponse,
	generateGetIssuePropertyResponse,
	generateGetIssueResponse,
	generateSuccessfulSubmitDesignsResponse,
} from '../../infrastructure/jira/jira-client/testing';

export const mockJiraSubmitDesignsEndpoint = ({
	baseUrl,
	request,
	response = generateSuccessfulSubmitDesignsResponse(),
	status = HttpStatusCode.Ok,
}: {
	baseUrl: string;
	request?: SubmitDesignsRequest | RequestBodyMatcher;
	response?: SubmitDesignsResponse;
	status?: HttpStatusCode;
}) => {
	nock(baseUrl).post('/rest/designs/1.0/bulk', request).reply(status, response);
};

export const mockJiraGetIssueEndpoint = ({
	baseUrl,
	issueId,
	status = HttpStatusCode.Ok,
	response = generateGetIssueResponse({ id: issueId }),
}: {
	baseUrl: string;
	issueId: string;
	status?: HttpStatusCode;
	response?: Record<string, unknown>;
}) => {
	nock(baseUrl).get(`/rest/api/3/issue/${issueId}`).reply(status, response);
};

export const mockJiraGetIssuePropertyEndpoint = ({
	baseUrl,
	issueId = generateJiraIssueId(),
	propertyKey = '',
	status = HttpStatusCode.Ok,
	response = generateGetIssuePropertyResponse(),
}: {
	baseUrl: string;
	issueId: string;
	propertyKey: string;
	status?: HttpStatusCode;
	response?: GetIssuePropertyResponse;
}) => {
	nock(baseUrl)
		.get(`/rest/api/2/issue/${issueId}/properties/${propertyKey}`)
		.reply(status, status === HttpStatusCode.Ok ? response : undefined);
};

export const mockJiraSetIssuePropertyEndpoint = ({
	baseUrl,
	issueId,
	propertyKey,
	request,
	status = HttpStatusCode.Ok,
}: {
	baseUrl: string;
	issueId: string;
	propertyKey: string;
	request: RequestBodyMatcher;
	status?: HttpStatusCode;
}) => {
	nock(baseUrl)
		.put(`/rest/api/2/issue/${issueId}/properties/${propertyKey}`, request)
		.reply(status);
};

export const mockJiraDeleteIssuePropertyEndpoint = ({
	baseUrl,
	issueId,
	propertyKey,
	status = HttpStatusCode.Ok,
}: {
	baseUrl: string;
	issueId: string;
	propertyKey?: string;
	status?: HttpStatusCode;
}) => {
	nock(baseUrl)
		.delete(`/rest/api/2/issue/${issueId}/properties/${propertyKey}`)
		.reply(status);
};

export const mockJiraSetAppPropertyEndpoint = ({
	baseUrl,
	appKey,
	propertyKey,
	request,
	status = HttpStatusCode.Ok,
}: {
	baseUrl: string;
	appKey: string;
	propertyKey: string;
	request: RequestBodyMatcher;
	status?: HttpStatusCode;
}) => {
	nock(baseUrl)
		.put(
			`/rest/atlassian-connect/1/addons/${appKey}/properties/${propertyKey}`,
			request,
		)
		.reply(status);
};

export const mockJiraCheckPermissionsEndpoint = ({
	baseUrl,
	request,
	status = HttpStatusCode.Ok,
	response = generateCheckPermissionsResponse(),
}: {
	baseUrl: string;
	request: CheckPermissionsRequest;
	status?: HttpStatusCode;
	response?: CheckPermissionsResponse;
}) => {
	nock(baseUrl)
		.post(`/rest/api/3/permissions/check`, request)
		.reply(status, response);
};
