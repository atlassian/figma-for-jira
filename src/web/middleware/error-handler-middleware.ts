import type { NextFunction, Request, Response } from 'express';

import { InstallationNotFoundError, JwtVerificationError } from './jwt-utils';

import { HttpStatus } from '../../common/http-status';
import { FigmaServiceCredentialsError } from '../../infrastructure/figma';
import { RepositoryRecordNotFoundError } from '../../infrastructure/repositories';

export const errorHandlerMiddleware = (
	err: Error,
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	// Must delegate to default Express error handler if we've already started writing the response
	if (res.headersSent) {
		return next(err);
	}

	// Setting `err` on the response so it can be picked up by the `pino-http` logger
	res.err = err;

	if (err instanceof JwtVerificationError) {
		res.status(HttpStatus.UNAUTHORIZED).send(err.message);
	} else if (
		err instanceof RepositoryRecordNotFoundError ||
		err instanceof InstallationNotFoundError
	) {
		res.status(HttpStatus.NOT_FOUND).send(err.message);
	} else if (err instanceof FigmaServiceCredentialsError) {
		res.status(HttpStatus.FORBIDDEN).send(err.message);
	} else {
		res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
	}

	next();
};
