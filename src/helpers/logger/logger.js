const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        // Console transport with colors
        new winston.transports.Console(),
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(__dirname, '../../../logs/combined.log'),
            format: winston.format.uncolorize() // Remove colors for file output
        }),
        // Separate file for error logs
        new winston.transports.File({
            filename: path.join(__dirname, '../../../logs/error.log'),
            level: 'error',
            format: winston.format.uncolorize() // Remove colors for file output
        })
    ]
});

module.exports = {
    info: (message) => logger.info(message),
    warn: (message) => logger.warn(message),
    error: (message) => logger.error(message)
};