import { figmaBackfillService } from './figma-backfill-service';
import {
	buildDesignUrl,
	buildInspectUrl,
	buildLiveEmbedUrl,
} from './transformers/utils';

import * as configModule from '../../config';
import { mockConfig } from '../../config/testing';
import {
	AtlassianDesignStatus,
	AtlassianDesignType,
	FigmaDesignIdentifier,
} from '../../domain/entities';
import {
	generateFigmaFileKey,
	generateFigmaNodeId,
} from '../../domain/entities/testing';

jest.mock('../../config', () => {
	return {
		...jest.requireActual('../../config'),
		getConfig: jest.fn(),
	};
});

describe('FigmaBackfillService', () => {
	beforeEach(() => {
		(configModule.getConfig as jest.Mock).mockReturnValue(mockConfig);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('isDesignForBackfill', () => {
		it('should return `true` if backfill-indicating query parameter is set to `true`', () => {
			const fileKey = generateFigmaFileKey();

			const result = figmaBackfillService.isDesignForBackfill(
				new URL(
					`https://www.figma.com/file/${fileKey}?com.atlassian.designs.backfill=true`,
				),
			);

			expect(result).toBe(true);
		});

		it('should return `false` if URL backfill-indicating query parameter is set to `false`', () => {
			const fileKey = generateFigmaFileKey();

			const result = figmaBackfillService.isDesignForBackfill(
				new URL(
					`https://www.figma.com/file/${fileKey}?com.atlassian.designs.backfill=false`,
				),
			);

			expect(result).toBe(false);
		});

		it('should return `false` if URL does not contain backfill-indicating query parameter', () => {
			const fileKey = generateFigmaFileKey();

			const result = figmaBackfillService.isDesignForBackfill(
				new URL(`https://www.figma.com/file/${fileKey}`),
			);

			expect(result).toBe(false);
		});
	});

	describe('buildMinimalDesignFromUrl', () => {
		it('should return design for Figma file URL', () => {
			const fileKey = generateFigmaFileKey();
			const fileName = 'Design1';
			const designId = new FigmaDesignIdentifier(fileKey);

			const result = figmaBackfillService.buildMinimalDesignFromUrl(
				new URL(`https://www.figma.com/file/${fileKey}/${fileName}`),
			);

			expect(result).toStrictEqual({
				id: designId.toAtlassianDesignId(),
				displayName: fileName,
				url: buildDesignUrl(designId).toString(),
				liveEmbedUrl: buildLiveEmbedUrl(designId).toString(),
				inspectUrl: buildInspectUrl(designId).toString(),
				status: AtlassianDesignStatus.UNKNOWN,
				type: AtlassianDesignType.FILE,
				lastUpdated: new Date(0).toISOString(),
				updateSequenceNumber: 0,
			});
		});

		it('should return design for Figma node URL', () => {
			const fileKey = generateFigmaFileKey();
			const nodeId = generateFigmaNodeId();
			const fileName = 'Design1';
			const designId = new FigmaDesignIdentifier(fileKey, nodeId);

			const result = figmaBackfillService.buildMinimalDesignFromUrl(
				new URL(
					`https://www.figma.com/file/${fileKey}/${fileName}?node-id=${nodeId}`,
				),
			);

			expect(result).toStrictEqual({
				id: designId.toAtlassianDesignId(),
				displayName: fileName,
				url: buildDesignUrl(designId).toString(),
				liveEmbedUrl: buildLiveEmbedUrl(designId).toString(),
				inspectUrl: buildInspectUrl(designId).toString(),
				status: AtlassianDesignStatus.UNKNOWN,
				type: AtlassianDesignType.NODE,
				lastUpdated: new Date(0).toISOString(),
				updateSequenceNumber: 0,
			});
		});

		it('should return design for Figma URL with minimal information', () => {
			const fileKey = generateFigmaFileKey();
			const designId = new FigmaDesignIdentifier(fileKey);

			const result = figmaBackfillService.buildMinimalDesignFromUrl(
				new URL(`https://www.figma.com/file/${fileKey}`),
			);

			expect(result).toStrictEqual({
				id: designId.toAtlassianDesignId(),
				displayName: 'Untitled',
				url: buildDesignUrl(designId).toString(),
				liveEmbedUrl: buildLiveEmbedUrl(designId).toString(),
				inspectUrl: buildInspectUrl(designId).toString(),
				status: AtlassianDesignStatus.UNKNOWN,
				type: AtlassianDesignType.FILE,
				lastUpdated: new Date(0).toISOString(),
				updateSequenceNumber: 0,
			});
		});

		it('should decode URL path component with name', () => {
			const fileKey = generateFigmaFileKey();

			const result = figmaBackfillService.buildMinimalDesignFromUrl(
				new URL(`https://www.figma.com/file/${fileKey}/Test-%2F-Design-1`),
			);

			expect(result.displayName).toStrictEqual('Test / Design 1');
		});
	});
});