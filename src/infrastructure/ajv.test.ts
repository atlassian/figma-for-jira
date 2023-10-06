import {
	assertSchema,
	type JSONSchemaTypeWithId,
	parseJsonOfSchema,
	SchemaValidationError,
} from './ajv';

type TestObject = {
	value: string;
};

const TEST_SCHEMA: JSONSchemaTypeWithId<TestObject> = {
	$id: 'figma-for-jira:test-schema',
	type: 'object',
	properties: {
		value: {
			type: 'string',
		},
	},
	required: ['value'],
};

describe('ajv utils', () => {
	describe('assertSchema', () => {
		it('should not throw when validating a valid object', () => {
			const validObject: unknown = { value: 'test' };

			expect(() => assertSchema(validObject, TEST_SCHEMA)).not.toThrow();
		});

		it('should throw when validating a non-conforming object', () => {
			const validObject: unknown = { value: 123 };

			expect(() => {
				assertSchema(validObject, TEST_SCHEMA);
			}).toThrow(SchemaValidationError);
		});
	});

	describe('parseJsonOfSchema', () => {
		it('should not throw when parsing and validating a valid and conforming JSON string', () => {
			const toParse = '{"value":"test"}';

			const result = parseJsonOfSchema(toParse, TEST_SCHEMA);
			expect(result.value).toEqual('test');
		});

		it('should throw SchemaValidationError when parsing a non-string value', () => {
			const toParse = 123;

			expect(() => {
				parseJsonOfSchema(toParse, TEST_SCHEMA);
			}).toThrow(SchemaValidationError);
		});

		it('should throw SchemaValidationError when parsing an invalid JSON string', () => {
			const toParse = 'not JSON';

			expect(() => {
				parseJsonOfSchema(toParse, TEST_SCHEMA);
			}).toThrow(SchemaValidationError);
		});

		it('should throw SchemaValidationError when validating a non-conforming object', () => {
			const toParse = '{"value":123}';

			expect(() => {
				parseJsonOfSchema(toParse, TEST_SCHEMA);
			}).toThrow(SchemaValidationError);
		});
	});
});
