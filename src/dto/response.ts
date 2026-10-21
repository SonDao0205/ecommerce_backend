export class ApiResponseData<T> {
  success: boolean;
  message: string;
  data: T;
  code: number;

  constructor(success: boolean, message: string, data: T, code: number) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.code = code;
  }
}
