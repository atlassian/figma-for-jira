import { fromExpressRequest } from 'atlassian-jwt';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { jiraAsymmetricJwtAuthMiddleware } from './jira-asymmetric-jwt-auth-middleware';

import { flushPromises } from '../../../common/testing/utils';
import { jiraAsymmetricJwtTokenVerifier } from '../../../infrastructure/jira/inbound-auth';
import { UnauthorizedError } from '../errors';

describe('jiraAsymmetricJwtAuthMiddleware', () => {
	it('should authenticate request with valid token ', async () => {
		const token = uuidv4();
		const request = {
			headers: {
				authorization: `JWT ${token}`,
			},
		} as Request;
		const next = jest.fn();
		jest.spyOn(jiraAsymmetricJwtTokenVerifier, 'verify').mockResolvedValue();

		jiraAsymmetricJwtAuthMiddleware(request, {} as Response, next);
		await flushPromises();

		expect(next).toHaveBeenCalledWith();
		expect(jiraAsymmetricJwtTokenVerifier.verify).toHaveBeenCalledWith(
			token,
			fromExpressRequest(request),
		);
	});

	it('should not authenticate request with invalid JWT token ', async () => {
		const token = uuidv4();
		const request = {
			headers: {
				authorization: `JWT ${token}`,
			},
		} as Request;
		const next = jest.fn();
		const error = new UnauthorizedError();
		jest
			.spyOn(jiraAsymmetricJwtTokenVerifier, 'verify')
			.mockRejectedValue(error);

		jiraAsymmetricJwtAuthMiddleware(request, {} as Response, next);
		await flushPromises();

		expect(next).toHaveBeenCalledWith(error);
	});

	it('should not authenticate request with no token', async () => {
		const request = {
			headers: {},
		} as Request;
		const next = jest.fn();

		jiraAsymmetricJwtAuthMiddleware(request, {} as Response, next);
		await flushPromises();

		expect(next).toHaveBeenCalledWith(
			new UnauthorizedError('Missing JWT token.'),
		);
	});
});