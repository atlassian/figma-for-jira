import type { JSONSchemaType } from 'ajv';

import type {
	FigmaAuthCallbackQueryParameters,
	FigmaWebhookEventPayload,
} from './types';

import type { FigmaWebhookEventType } from '../../../domain/entities';
import type { JSONSchemaTypeWithId } from '../../../infrastructure';

export const FIGMA_WEBHOOK_EVENT_TYPE_SCHEMA: JSONSchemaType<FigmaWebhookEventType> =
	{
		type: 'string',
		enum: [
			'PING',
			'FILE_UPDATE',
			'FILE_VERSION_UPDATE',
			'FILE_DELETE',
			'LIBRARY_PUBLISH',
			'FILE_COMMENT',
		],
	};

/**
 * While AJV supports optional fields in schemas, it requires these fields to
 * also be marked as nullable. If you mark an optional field as non-nullable,
 * the schema validation works correctly but the typechecking complains that
 * the field is not marked nullable.
 *
 * This function works around the typechecking by casting the field schema to
 * the appropriate type. This is supposed to be fixed in the next major version
 * of AJV.
 *
 * @see https://github.com/ajv-validator/ajv/issues/1664#issuecomment-873613644
 */
const optionalNonNullable = <T>(schema: T): T & { nullable: true } =>
	schema as T & { nullable: true };

export const FIGMA_WEBHOOK_PAYLOAD_SCHEMA: JSONSchemaTypeWithId<FigmaWebhookEventPayload> =
	{
		$id: 'figma-rest-api:webhook:event-payload',
		type: 'object',
		properties: {
			event_type: FIGMA_WEBHOOK_EVENT_TYPE_SCHEMA,
			file_key: optionalNonNullable({ type: 'string' }),
			file_name: optionalNonNullable({ type: 'string' }),
			passcode: { type: 'string' },
			protocol_version: { type: 'string' },
			retries: { type: 'integer' },
			timestamp: { type: 'string' },
			webhook_id: { type: 'string' },
			triggered_by: {
				type: 'object',
				nullable: true,
				properties: {
					id: { type: 'string' },
					handle: { type: 'string' },
				},
				required: ['id', 'handle'],
			},
		},
		required: [
			'event_type',
			'passcode',
			'protocol_version',
			'retries',
			'timestamp',
			'webhook_id',
		],
		if: {
			properties: { event_type: { const: 'PING' } },
		},
		then: {
			required: [],
		},
		else: {
			required: ['file_key', 'file_name'],
		},
	};

export const FIGMA_OAUTH_CALLBACK_QUERY_PARAMETERS_SCHEMA: JSONSchemaTypeWithId<FigmaAuthCallbackQueryParameters> =
	{
		$id: 'figma-for-jira:auth-callback-query-parameters',
		type: 'object',
		properties: {
			code: { type: 'string' },
			state: { type: 'string' },
		},
		required: ['code', 'state'],
	};
