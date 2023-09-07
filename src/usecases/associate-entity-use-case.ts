import type { AtlassianDesign, ConnectInstallation } from '../domain/entities';
import { AtlassianAssociation } from '../domain/entities';
import { figmaService } from '../infrastructure/figma';
import { jiraService } from '../infrastructure/jira';

export type AssociateWith = {
	readonly ati: string;
	readonly ari: string;
	readonly cloudId: string;
	readonly id: string;
};

export type AssociateEntityUseCaseParams = {
	readonly entity: {
		readonly url: string;
	};
	readonly associateWith: AssociateWith;
	readonly atlassianUserId: string;
	readonly connectInstallation: ConnectInstallation;
};

export const associateEntityUseCase = {
	execute: async ({
		entity,
		associateWith,
		atlassianUserId,
		connectInstallation,
	}: AssociateEntityUseCaseParams): Promise<AtlassianDesign> => {
		const [design, issue] = await Promise.all([
			figmaService.fetchDesign(entity.url, atlassianUserId),
			jiraService.getIssue(associateWith.id, connectInstallation),
		]);

		const designIssueAssociation =
			AtlassianAssociation.createDesignIssueAssociation(associateWith.ari);

		const { self: issueUrl, fields } = issue;

		await Promise.all([
			jiraService.submitDesign(
				{
					design,
					addAssociations: [designIssueAssociation],
				},
				connectInstallation,
			),
			figmaService.createDevResource({
				designUrl: entity.url,
				issueUrl,
				issueTitle: fields.summary,
				atlassianUserId,
			}),
		]);

		return design;
	},
};
