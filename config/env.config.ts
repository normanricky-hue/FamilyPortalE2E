import path from "path";

export const ENV_CONFIG = {
  baseUrl: process.env.BASE_URL || "https://working.kantimehealth.net",

  urls: {
    login: "/identity/v2/Accounts/Authorize",
  },

  credentials: {
    username: process.env.APP_USERNAME || "1test@1245.com",
    password: process.env.APP_PASSWORD || "Demo@123",
  },

};
