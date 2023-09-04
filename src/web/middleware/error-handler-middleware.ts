import { NextFunction, Request, Response } from 'express';

import { JwtVerificationError } from './jwt-utils';

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
		res.status(401).send(err.message);
	} else if (err instanceof RepositoryRecordNotFoundError) {
		res.status(404).send(err.message);
	} else {
		res.sendStatus(500);
	}

	next();
};
