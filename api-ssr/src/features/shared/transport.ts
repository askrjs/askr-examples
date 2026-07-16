export async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const problem = await response.json().catch(() => ({ detail: response.statusText })) as {
      detail?: string;
    };
    throw new Error(problem.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}
