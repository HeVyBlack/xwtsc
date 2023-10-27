export class XwtscOptions {
  constructor(raw: Record<string, any>) {
    if ('xwtsc' in raw) this.xwtsc = raw['xwtsc'];
    else this.xwtsc = {};
  }

  private readonly xwtsc: Record<string, unknown>;

  get fileToRun(): string | undefined {
    if (!('fileToRun' in this.xwtsc)) return undefined;

    const fileToRun = this.xwtsc['fileToRun'];
    if (typeof fileToRun !== 'string') return undefined;
    else return fileToRun;
  }

  get fileArgs(): string[] {
    if (!('fileArgs' in this.xwtsc)) return [];

    const fileArgs = this.xwtsc['fileArgs'];
    if (Array.isArray(fileArgs)) return fileArgs as string[];
    else return [];
  }

  get nodeArgs(): string[] {
    if (!('nodeArgs' in this.xwtsc)) return [];

    const nodeArgs = this.xwtsc['nodeArgs'];
    if (Array.isArray(nodeArgs)) return nodeArgs as string[];
    else return [];
  }
}
