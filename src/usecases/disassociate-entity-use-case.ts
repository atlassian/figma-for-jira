import type { AtlassianEntity } from './types';

import { JIRA_ISSUE_ATI } from '../common/constants';
import type { AtlassianDesign, ConnectInstallation } from '../domain/entities';
import { AtlassianAssociation } from '../domain/entities';
import { figmaService } from '../infrastructure/figma';
import { buildIssueUrl, jiraService } from '../infrastructure/jira';

export type DisassociateEntityUseCaseParams = {
	readonly entity: {
		readonly ari: string;
		readonly id: string;
	};
	readonly disassociateFrom: AtlassianEntity;
	readonly atlassianUserId: string;
	readonly connectInstallation: ConnectInstallation;
};

export const disassociateEntityUseCase = {
	execute: async ({
		entity,
		disassociateFrom,
		atlassianUserId,
		connectInstallation,
	}: DisassociateEntityUseCaseParams): Promise<AtlassianDesign> => {
		if (disassociateFrom.ati !== JIRA_ISSUE_ATI) {
			throw new Error('Unrecognised ATI');
		}
		const [design, issue] = await Promise.all([
			figmaService.fetchDesignById(entity.id, atlassianUserId),
			jiraService.getIssue(disassociateFrom.id, connectInstallation),
		]);

		const designIssueAssociation =
			AtlassianAssociation.createDesignIssueAssociation(disassociateFrom.ari);

		const { key: issueKey, id: issueId } = issue;

		await Promise.all([
			jiraService.submitDesign(
				{
					design,
					removeAssociations: [designIssueAssociation],
				},
				connectInstallation,
			),
			jiraService.deleteDesignUrlInIssueProperties(
				issueId,
				design,
				connectInstallation,
			),
			figmaService.deleteDevResourceIfExists({
				designId: entity.id,
				issueUrl: buildIssueUrl(connectInstallation.baseUrl, issueKey),
				atlassianUserId,
			}),
		]);

		return design;
	},
};
