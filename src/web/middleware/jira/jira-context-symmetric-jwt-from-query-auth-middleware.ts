import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { jiraContextSymmetricJwtTokenVerifier } from '../../../infrastructure/jira/inbound-auth';
import { UnauthorizedResponseStatusError } from '../../errors';

/**
 * Authenticates requests using a symmetric JWT token received in a query param.
 *
 * In case of successful authentication, `connectInstallation` and `atlassianUserId` are set in locals.
 *
 * @remarks
 * Context JWT tokens are sent in a query param when loading an iframe
 *
 * @see https://developer.atlassian.com/cloud/jira/platform/understanding-jwt-for-connect-apps/#types-of-jwt-token
 * @see https://community.developer.atlassian.com/t/action-required-atlassian-connect-vulnerability-allows-bypass-of-app-qsh-verification-via-context-jwts/47072
 */
export const jiraContextSymmetricJwtFromQueryAuthMiddleware: RequestHandler = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const token = req.params.jwt;

	if (!token) {
		return next(new UnauthorizedResponseStatusError('Missing JWT token.'));
	}

	void jiraContextSymmetricJwtTokenVerifier
		.verify(token)
		.then(({ connectInstallation, atlassianUserId }) => {
			res.locals.connectInstallation = connectInstallation;
			res.locals.atlassianUserId = atlassianUserId;
			next();
		})
		.catch((e) =>
			next(new UnauthorizedResponseStatusError('Unauthorized.', undefined, e)),
		);
};
