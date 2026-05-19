import readline from 'node:readline/promises';
import { type Readable, Writable } from 'node:stream';

export async function ask(
  question: string,
  defaultValue?: string,
  input: Readable = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer || defaultValue || '';
  } finally {
    rl.close();
  }
}

export async function askHidden(
  question: string,
  input: Readable = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<string> {
  const hiddenOutput = new HiddenPromptOutput(output);
  const rl = readline.createInterface({ input, output: hiddenOutput, terminal: true });
  try {
    hiddenOutput.showNextWrite();
    const answer = (await rl.question(`${question}: `)).trim();
    output.write('\n');
    return answer;
  } finally {
    rl.close();
  }
}

export async function askYesNo(
  question: string,
  defaultNo = true,
  input: Readable = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<boolean> {
  const defaultAnswer = !defaultNo;
  const suffix = defaultNo ? '[y/N]' : '[Y/n]';
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question(`${question} ${suffix}:`)).trim().toLowerCase();
    if (answer.length === 0) return defaultAnswer;
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

class HiddenPromptOutput extends Writable {
  private shouldShowNextWrite = false;

  constructor(private readonly output: NodeJS.WritableStream) {
    super();
  }

  showNextWrite(): void {
    this.shouldShowNextWrite = true;
  }

  override _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (this.shouldShowNextWrite) {
      this.shouldShowNextWrite = false;
      this.output.write(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk);
    }
    callback();
  }
}
