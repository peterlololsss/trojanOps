export async function uploadErrorMessage(response: Response): Promise<string> {
  const failure: unknown = await response.json().catch(() => null);
  if (failure !== null && typeof failure === 'object' && 'message' in failure
    && typeof failure.message === 'string' && failure.message.trim().length > 0) {
    return failure.message;
  }
  return `Upload failed (${response.status}). Try again or ask your club president for help.`;
}
