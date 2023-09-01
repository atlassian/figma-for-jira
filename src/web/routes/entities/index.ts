import type { NextFunction} from 'express';
import { Router } from 'express';

import { associateEntityUseCase } from '../../../usecases';
import { authHeaderSymmetricJwtMiddleware } from '../../middleware';
import type { TypedRequest } from '../types';

type Entity = {
	readonly url: string;
};

export type AssociateWith = {
	readonly ari: string;
};

export type AssociateEntityPayload = {
	readonly cloudId: string;
	readonly entity: Entity;
	readonly associateWith: AssociateWith;
};

export const entitiesRouter = Router();

entitiesRouter.post(
	'/associateEntity',
	authHeaderSymmetricJwtMiddleware,
	(req: TypedRequest<AssociateEntityPayload>, res, next: NextFunction) => {
		const atlassianUserId = req.headers['user-context'];
		if (!atlassianUserId || typeof atlassianUserId !== 'string') {
			res.status(401).send('Missing or invalid User-Context header');
			return;
		}
		associateEntityUseCase
			.execute({ ...req.body, atlassianUserId })
			.then((design) => res.status(201).send({ design }))
			.catch((error) => next(error));
	},
);
