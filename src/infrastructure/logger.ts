import pino, { type Logger as PinoLogger } from "pino";
import pinoHttp, { type HttpLogger } from "pino-http";
import { Logger } from "../domain/services/logger";

const isProduction = process.env.NODE_ENV === "production";
const defaultProdLogLevel = process.env.LOG_LEVEL || "info";
const defaultNonProdLogLevel = process.env.LOG_LEVEL || "debug";

const devOptions = {
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
		},
	},
};

class PinoLoggerImpl implements Logger {
	logger: PinoLogger;
	httpLogger: HttpLogger;
	constructor() {
		this.logger = pino({
			level: isProduction ? defaultProdLogLevel : defaultNonProdLogLevel,
			...(!isProduction && devOptions),
		});
		this.httpLogger = pinoHttp({ logger: this.logger });
	}

	info(message: string, ...args: any[]) {
		this.logger.info(message, args);
	}

	debug(message: string, ...args: any[]) {
		this.logger.debug(message, args);
	}

	error(message: string, ...args: any[]) {
		this.logger.error(message, args);
	}
}

export default new PinoLoggerImpl();