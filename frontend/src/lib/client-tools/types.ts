/** A single output produced in the browser. */
export interface ClientFile {
  blob: Blob;
  filename: string;
}

export type ClientOptions = Record<string, string | number | boolean>;

/** Returns outputs, or `null` to signal "fall back to the server". */
export type ClientHandler = (
  files: File[],
  options: ClientOptions,
) => Promise<ClientFile[] | null>;
