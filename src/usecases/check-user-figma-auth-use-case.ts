import {
	figmaService,
	FigmaServiceCredentialsError,
} from '../infrastructure/figma';

export const checkUserFigmaAuthUseCase = {
	execute: async (atlassianUserId: string): Promise<boolean> => {
		try {
			await figmaService.getValidCredentialsOrThrow(atlassianUserId);
			return true;
		} catch (e: unknown) {
			if (e instanceof FigmaServiceCredentialsError) {
				return false;
			}

			throw e;
		}
	},
};