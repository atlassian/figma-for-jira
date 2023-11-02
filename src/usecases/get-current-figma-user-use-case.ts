import type { ConnectInstallation, FigmaUser } from '../domain/entities';
import { figmaService } from '../infrastructure/figma';

export const getCurrentFigmaUserUseCase = {
	execute: async (
		atlassianUserId: string,
		connectInstallation: ConnectInstallation,
	): Promise<FigmaUser | null> => {
		return await figmaService.fetchCurrentUser({
			atlassianUserId,
			connectInstallationId: connectInstallation.id,
		});
	},
};