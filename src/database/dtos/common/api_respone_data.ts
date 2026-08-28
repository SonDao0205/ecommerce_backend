export interface ApiResponseData<T> {
  status: boolean;
  data: T;
  message: string;
  code: number;
}
