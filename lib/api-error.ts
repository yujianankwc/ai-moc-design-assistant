export function getHttpStatusFromErrorMessage(message: string) {
  if (message.includes("无权限访问管理接口") || message.includes("管理接口未启用访问口令")) {
    return 401;
  }
  return 500;
}
