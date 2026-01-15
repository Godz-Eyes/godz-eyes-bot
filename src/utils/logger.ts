export const logger = {
  log: (...args: any[]) => {
    if (process.env.DEBUG === "true") {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    if (process.env.DEBUG === "true") {
      console.error(...args);
    }
  },
  warn: (...args: any[]) => {
    if (process.env.DEBUG === "true") {
      console.warn(...args);
    }
  },
};
