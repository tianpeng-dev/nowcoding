export type CliAuthConfirmation = {
  userCode: string | null;
  joinArena: boolean;
};

type ConfirmationRequest = Pick<Request, 'formData' | 'headers' | 'json'>;

function isJsonRequest(request: ConfirmationRequest): boolean {
  return (request.headers.get('content-type') ?? '').includes('application/json');
}

export async function getCliAuthConfirmation(
  request: ConfirmationRequest,
): Promise<CliAuthConfirmation> {
  if (isJsonRequest(request)) {
    const body = (await request.json().catch(() => null)) as {
      joinArena?: unknown;
      userCode?: unknown;
    } | null;

    return {
      userCode: typeof body?.userCode === 'string' ? body.userCode : null,
      joinArena: body?.joinArena === true,
    };
  }

  const form = await request.formData().catch(() => null);
  const userCode = form?.get('userCode');

  return {
    userCode: typeof userCode === 'string' ? userCode : null,
    joinArena: form?.has('joinArena') ?? false,
  };
}
