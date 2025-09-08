export const APP_API_URL = process.env.APP_API_URL || 'https://localhost:8001';
export const ITEMS_URL = `${APP_API_URL}/app/ui/items`;
export const UPLOAD_URL = `${APP_API_URL}/app/ui/upload-items`;
export const getReportUrl = (filename: string) => `${APP_API_URL}/app/ui/reports/${filename}`;