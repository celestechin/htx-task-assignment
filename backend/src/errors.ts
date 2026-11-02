// for errors we expect and want the caller to see, e.g. task not found
// services throw these and errorHandler turns them into json
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
