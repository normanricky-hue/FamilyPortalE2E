import path from "path";

export const ENV_CONFIG = {
  baseUrl: process.env.BASE_URL || "https://working.kantimehealth.net",

  urls: {
    login: "/identity/v2/Accounts/Authorize",
    dashboard: "/HH/Z1/UI/Common/DashboardMaster.aspx",
  },

  credentials: {
    username: process.env.APP_USERNAME || "1test@1245.com",
    password: process.env.APP_PASSWORD || "Demo@123",
  },

  csv: {
    baseDir: path.resolve(process.cwd(), "excelData"),
    fileName: process.env.CSV_FILE || "EF15.csv",
    get fullPath() {
      return path.join(this.baseDir, this.fileName);
    },
  },
};
