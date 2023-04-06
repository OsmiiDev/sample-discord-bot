import {configure} from 'log4js';


export const now = new Date();
const pad = (num: number) => (num < 10 ? `0${num}` : num);

export const _logger = configure({
  appenders: {
    main: {
      filename: `logs/${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}.log`,
      type: 'file',
    },
    stdout: {type: 'stdout'},
  },
  categories: {
    default: {
      appenders: ['main', 'stdout'],
      level: 'debug',
    },
  },
});

export const logger = _logger.getLogger();
