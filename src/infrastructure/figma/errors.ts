export class FigmaServiceError extends Error {}

export class FigmaServiceCredentialsError extends FigmaServiceError {
	cause?: Error;

	constructor(atlassianUserId: string, cause?: Error) {
		super(`No valid Figma OAuth2 credentials for ${atlassianUserId}`);
		this.cause = cause;
	}
}

export class FigmaWebhookServiceValidationError extends Error {}

export class FigmaWebhookServiceEventTypeValidationError extends FigmaWebhookServiceValidationError {
	constructor(webhookId: string) {
		super(`Received webhook event for ${webhookId} with invalid event type`);
	}
}

export class FigmaWebhookServicePasscodeValidationError extends FigmaWebhookServiceValidationError {
	constructor(webhookId: string) {
		super(`Received webhook event for ${webhookId} with invalid passcode`);
	}
}
