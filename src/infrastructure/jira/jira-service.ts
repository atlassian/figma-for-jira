import type {
	GetIssuePropertyResponse,
	SubmitDesignsResponse,
} from './jira-client';
import { jiraClient } from './jira-client';
import {
	ATTACHED_DESIGN_URL_V2_VALUE_SCHEMA,
	INGESTED_DESIGN_URL_VALUE_SCHEMA,
} from './schemas';

import { CauseAwareError } from '../../common/errors';
import type { JSONSchemaTypeWithId } from '../../common/schema-validation';
import {
	assertSchema,
	parseJsonOfSchema,
	SchemaValidationError,
} from '../../common/schema-validation';
import { ensureString } from '../../common/string-utils';
import type {
	AtlassianDesign,
	ConnectInstallation,
	JiraIssue,
} from '../../domain/entities';
import {
	AtlassianAssociation,
	FigmaDesignIdentifier,
} from '../../domain/entities';
import { NotFoundHttpClientError } from '../http-client-errors';
import { getLogger } from '../logger';

type SubmitDesignParams = {
	readonly design: AtlassianDesign;
	readonly addAssociations?: AtlassianAssociation[];
	readonly removeAssociations?: AtlassianAssociation[];
};

export type AttachedDesignUrlV2IssuePropertyValue = {
	readonly url: string;
	readonly name: string;
};

export type IngestedDesignUrlIssuePropertyValue = string;

export const appPropertyKeys = {
	CONFIGURATION_STATE: 'is-configured',
};

export enum ConfigurationStatus {
	CONFIGURED = 'CONFIGURED',
	NOT_CONFIGURED = 'NOT_CONFIGURED',
}

export const issuePropertyKeys = {
	ATTACHED_DESIGN_URL: 'attached-design-url',
	ATTACHED_DESIGN_URL_V2: 'attached-design-url-v2',
	INGESTED_DESIGN_URLS: 'figma-for-jira:ingested-design-urls',
};

export const JIRA_ADMIN_GLOBAL_PERMISSION = 'ADMINISTER';

class JiraService {
	/**
	 * @throws {SubmitDesignJiraServiceError} Design submission fails.
	 */
	submitDesign = async (
		params: SubmitDesignParams,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		return this.submitDesigns([params], connectInstallation);
	};

	/**
	 * @throws {SubmitDesignJiraServiceError} Design submission fails.
	 */
	submitDesigns = async (
		designs: SubmitDesignParams[],
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		const associationsLastUpdated = new Date();
		const response = await jiraClient.submitDesigns(
			{
				designs: designs.map(
					({ design, addAssociations, removeAssociations }) => ({
						...design,
						addAssociations: addAssociations ?? null,
						removeAssociations: removeAssociations ?? null,
						associationsLastUpdated: associationsLastUpdated.toISOString(),
						associationsUpdateSequenceNumber: associationsLastUpdated.valueOf(),
					}),
				),
			},
			connectInstallation,
		);

		this.throwIfSubmitDesignResponseHasErrors(response);
	};

	deleteDesign = async (
		designId: FigmaDesignIdentifier,
		connectInstallation: ConnectInstallation,
	): Promise<FigmaDesignIdentifier> => {
		return await jiraClient.deleteDesign(designId, connectInstallation);
	};

	getIssue = async (
		issueIdOrKey: string,
		connectInstallation: ConnectInstallation,
	): Promise<JiraIssue> => {
		return await jiraClient.getIssue(issueIdOrKey, connectInstallation);
	};

	updateIngestedDesignsIssueProperty = async (
		issueIdOrKey: string,
		{ url }: AtlassianDesign,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		const storedValue =
			await this.getIssuePropertyJsonValue<IngestedDesignUrlIssuePropertyValue>(
				issueIdOrKey,
				issuePropertyKeys.INGESTED_DESIGN_URLS,
				connectInstallation,
				INGESTED_DESIGN_URL_VALUE_SCHEMA,
			);

		if (
			storedValue?.some((storedValue) =>
				this.areDesignIdentifiersEqual(storedValue, url),
			)
		) {
			return;
		}

		const newValue = storedValue ? [...storedValue, url] : [url];

		return jiraClient.setIssueProperty(
			issueIdOrKey,
			issuePropertyKeys.INGESTED_DESIGN_URLS,
			newValue,
			connectInstallation,
		);
	};

	saveDesignUrlInIssueProperties = async (
		issueIdOrKey: string,
		design: AtlassianDesign,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		await Promise.all([
			this.setAttachedDesignUrlInIssuePropertiesIfMissing(
				issueIdOrKey,
				design,
				connectInstallation,
			),
			this.updateAttachedDesignUrlV2IssueProperty(
				issueIdOrKey,
				design,
				connectInstallation,
			),
			this.updateIngestedDesignsIssueProperty(
				issueIdOrKey,
				design,
				connectInstallation,
			),
		]);
	};

	deleteDesignUrlInIssueProperties = async (
		issueIdOrKey: string,
		design: AtlassianDesign,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		await Promise.all([
			await this.deleteAttachedDesignUrlInIssuePropertiesIfPresent(
				issueIdOrKey,
				design,
				connectInstallation,
			),
			await this.deleteFromAttachedDesignUrlV2IssueProperties(
				issueIdOrKey,
				design,
				connectInstallation,
			),
		]);
	};

	setAppConfigurationStatus = async (
		configurationStatus: ConfigurationStatus,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		return await jiraClient.setAppProperty(
			appPropertyKeys.CONFIGURATION_STATE,
			{ status: configurationStatus },
			connectInstallation,
		);
	};

	isAdmin = async (
		atlassianUserId: string,
		connectInstallation: ConnectInstallation,
	): Promise<boolean> => {
		const response = await jiraClient.checkPermissions(
			{
				accountId: atlassianUserId,
				globalPermissions: [JIRA_ADMIN_GLOBAL_PERMISSION],
			},
			connectInstallation,
		);

		return response.globalPermissions.includes(JIRA_ADMIN_GLOBAL_PERMISSION);
	};

	/**
	 * @internal
	 * Only visible for testing. Please use {@link saveDesignUrlInIssueProperties}
	 */
	setAttachedDesignUrlInIssuePropertiesIfMissing = async (
		issueIdOrKey: string,
		{ url }: AtlassianDesign,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		try {
			await jiraClient.getIssueProperty(
				issueIdOrKey,
				issuePropertyKeys.ATTACHED_DESIGN_URL,
				connectInstallation,
			);
		} catch (error) {
			if (error instanceof NotFoundHttpClientError) {
				await jiraClient.setIssueProperty(
					issueIdOrKey,
					issuePropertyKeys.ATTACHED_DESIGN_URL,
					url,
					connectInstallation,
				);
			} else {
				throw error;
			}
		}
	};

	/**
	 * @internal
	 * Only visible for testing. Please use {@link saveDesignUrlInIssueProperties}
	 */
	updateAttachedDesignUrlV2IssueProperty = async (
		issueIdOrKey: string,
		{ url, displayName }: AtlassianDesign,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		const newValueItem: AttachedDesignUrlV2IssuePropertyValue = {
			url,
			name: displayName,
		};

		const storedValue =
			await this.getIssuePropertyJsonValue<AttachedDesignUrlV2IssuePropertyValue>(
				issueIdOrKey,
				issuePropertyKeys.ATTACHED_DESIGN_URL_V2,
				connectInstallation,
				ATTACHED_DESIGN_URL_V2_VALUE_SCHEMA,
			);

		if (
			storedValue?.some((storedValue) =>
				this.areDesignIdentifiersEqual(storedValue.url, url),
			)
		) {
			return;
		}

		const newValue = storedValue
			? [...storedValue, newValueItem]
			: [newValueItem];

		return jiraClient.setIssueProperty(
			issueIdOrKey,
			issuePropertyKeys.ATTACHED_DESIGN_URL_V2,
			// Stringify the value twice for backwards compatibility (once here and once by `JiraClient.setIssueProperty`)
			JSON.stringify(newValue),
			connectInstallation,
		);
	};

	/**
	 * @internal
	 * Only visible for testing. Please use {@link deleteDesignUrlInIssueProperties}
	 */
	deleteAttachedDesignUrlInIssuePropertiesIfPresent = async (
		issueIdOrKey: string,
		design: AtlassianDesign,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		try {
			const response = await jiraClient.getIssueProperty(
				issueIdOrKey,
				issuePropertyKeys.ATTACHED_DESIGN_URL,
				connectInstallation,
			);

			const storedUrl = response.value;

			if (storedUrl === design.url) {
				await jiraClient.deleteIssueProperty(
					issueIdOrKey,
					issuePropertyKeys.ATTACHED_DESIGN_URL,
					connectInstallation,
				);
			}
		} catch (error) {
			if (error instanceof NotFoundHttpClientError) {
				return; // Swallow not found errors
			}
			throw error;
		}
	};

	/**
	 * @internal
	 * Only visible for testing. Please use {@link saveDesignUrlInIssueProperties}
	 */
	deleteFromAttachedDesignUrlV2IssueProperties = async (
		issueIdOrKey: string,
		{ url }: AtlassianDesign,
		connectInstallation: ConnectInstallation,
	): Promise<void> => {
		let response: GetIssuePropertyResponse;
		try {
			response = await jiraClient.getIssueProperty(
				issueIdOrKey,
				issuePropertyKeys.ATTACHED_DESIGN_URL_V2,
				connectInstallation,
			);
		} catch (error) {
			if (error instanceof NotFoundHttpClientError) {
				return; // Swallow not found errors
			}
			throw error;
		}

		const storedAttachedDesignUrlIssuePropertyValue = JSON.parse(
			ensureString(response.value),
		) as unknown;

		assertSchema<AttachedDesignUrlV2IssuePropertyValue[]>(
			storedAttachedDesignUrlIssuePropertyValue,
			ATTACHED_DESIGN_URL_V2_VALUE_SCHEMA,
		);

		const newAttachedDesignUrlIssuePropertyValue =
			storedAttachedDesignUrlIssuePropertyValue.filter(
				(storedValue) => !this.areDesignIdentifiersEqual(storedValue.url, url),
			);

		if (
			newAttachedDesignUrlIssuePropertyValue.length <
			storedAttachedDesignUrlIssuePropertyValue.length
		) {
			await jiraClient.setIssueProperty(
				issueIdOrKey,
				issuePropertyKeys.ATTACHED_DESIGN_URL_V2,
				// Stringify the value twice for backwards compatibility (once here and once by `JiraClient.setIssueProperty`)
				JSON.stringify(newAttachedDesignUrlIssuePropertyValue),
				connectInstallation,
			);
		} else {
			getLogger().warn(
				`Design with url: ${url} that was requested to be deleted was not removed from the 'attached-design-v2' issue property array`,
			);
		}
	};

	private async getIssuePropertyJsonValue<T>(
		issueIdOrKey: string,
		propertyKey: string,
		connectInstallation: ConnectInstallation,
		schema: JSONSchemaTypeWithId<T[]>,
	): Promise<T[] | null> {
		try {
			const response = await jiraClient.getIssueProperty(
				issueIdOrKey,
				propertyKey,
				connectInstallation,
			);
			return parseJsonOfSchema(response.value, schema);
		} catch (error) {
			if (
				error instanceof NotFoundHttpClientError ||
				error instanceof SchemaValidationError
			) {
				return null; // If property does not exist or value is in unexpected format, return null
			} else {
				throw error;
			}
		}
	}

	private areDesignIdentifiersEqual = (storedUrl: string, url: string) => {
		try {
			return FigmaDesignIdentifier.fromFigmaDesignUrl(url).equals(
				FigmaDesignIdentifier.fromFigmaDesignUrl(storedUrl),
			);
		} catch (error) {
			// For existing designs that were previously stored in the issue property, we may not be able to parse the URL.
			return false;
		}
	};

	/**
	 * @throws {SubmitDesignJiraServiceError}
	 */
	private throwIfSubmitDesignResponseHasErrors = (
		response: SubmitDesignsResponse,
	) => {
		if (response.rejectedEntities.length) {
			const { key, errors } = response.rejectedEntities[0];
			throw SubmitDesignJiraServiceError.designRejected(key.designId, errors);
		}

		// TODO: Confirm whether we need to consider the use case below as a failure and throw or just leave a warning.
		if (response.unknownIssueKeys?.length) {
			throw SubmitDesignJiraServiceError.unknownIssueKeys(
				response.unknownIssueKeys,
			);
		}

		if (response.unknownAssociations?.length) {
			throw SubmitDesignJiraServiceError.unknownAssociations(
				response.unknownAssociations.map(
					(x) => new AtlassianAssociation(x.associationType, x.values),
				),
			);
		}
	};
}

export const jiraService = new JiraService();

export class SubmitDesignJiraServiceError extends CauseAwareError {
	designId?: string;
	rejectionErrors?: { readonly message: string }[];
	unknownIssueKeys?: string[];
	unknownAssociations?: AtlassianAssociation[];

	private constructor({
		message,
		designId,
		rejectionErrors,
		unknownIssueKeys,
		unknownAssociations,
	}: {
		message: string;
		designId?: string;
		rejectionErrors?: { readonly message: string }[];
		unknownIssueKeys?: string[];
		unknownAssociations?: AtlassianAssociation[];
	}) {
		super(message);
		this.designId = designId;
		this.rejectionErrors = rejectionErrors;
		this.unknownIssueKeys = unknownIssueKeys;
		this.unknownAssociations = unknownAssociations;
	}

	static designRejected(
		designId: string,
		rejectionErrors: { readonly message: string }[],
	): SubmitDesignJiraServiceError {
		return new SubmitDesignJiraServiceError({
			message: 'The design submission has been rejected',
			designId,
			rejectionErrors,
		});
	}

	static unknownIssueKeys(unknownIssueKeys: string[]) {
		return new SubmitDesignJiraServiceError({
			message: 'The design has unknown issue keys',
			unknownIssueKeys,
		});
	}

	static unknownAssociations(unknownAssociations: AtlassianAssociation[]) {
		return new SubmitDesignJiraServiceError({
			message: 'The design has unknown associations',
			unknownAssociations,
		});
	}
}
