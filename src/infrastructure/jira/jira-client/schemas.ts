import type { JSONSchemaType } from 'ajv';

import type {
	Association,
	DesignKey,
	GetIssueResponse,
	SubmitDesignsResponse,
} from './types';

export const GET_ISSUE_RESPONSE_SCHEMA: JSONSchemaType<GetIssueResponse> = {
	type: 'object',
	properties: {
		id: { type: 'string' },
		key: { type: 'string' },
		fields: {
			type: 'object',
			properties: {
				summary: { type: 'string' },
			},
			required: [],
		},
	},
	required: [],
} as const;

const DESIGN_KEY_SCHEMA: JSONSchemaType<DesignKey> = {
	type: 'object',
	properties: {
		designId: { type: 'string' },
	},
	required: ['designId'],
};

const ASSOCIATION_SCHEMA: JSONSchemaType<Association> = {
	type: 'object',
	properties: {
		associationType: { type: 'string' },
		values: {
			type: 'array',
			items: { type: 'string' },
		},
	},
	required: ['associationType', 'values'],
};

export const SUBMIT_DESIGNS_RESPONSE_SCHEMA: JSONSchemaType<SubmitDesignsResponse> =
	{
		type: 'object',
		properties: {
			acceptedEntities: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						designId: { type: 'string' },
					},
					required: ['designId'],
				},
			},
			rejectedEntities: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						key: DESIGN_KEY_SCHEMA,
						errors: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									message: { type: 'string' },
								},
								required: ['message'],
							},
						},
					},
					required: ['key', 'errors'],
				},
			},
			unknownIssueKeys: {
				type: 'array',
				items: { type: 'string' },
				nullable: true,
			},
			unknownAssociations: {
				type: 'array',
				items: ASSOCIATION_SCHEMA,
				nullable: true,
			},
		},
		required: ['acceptedEntities', 'rejectedEntities'],
	} as const;
