import dotenv from "dotenv";

dotenv.config();

if (!process.env.BASE_URL) {
  throw new Error(
    "BASE_URL is not set. Add it to your .env file or GitHub Actions secrets."
  );
}

export const ENV_CONFIG = {
  baseUrl: process.env.BASE_URL,

  urls: {
    login: "/identity/v2/Accounts/Authorize",
  },
};
