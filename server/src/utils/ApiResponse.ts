import { Response } from "express";
import { ApiResponseShape, PaginationMeta } from "../types";

export class ApiResponse<T = unknown> {
  constructor(
    private res: Response,
    private statusCode: number,
    private message: string,
    private data?: T,
    private pagination?: PaginationMeta
  ) {}

  send(): Response {
    const body: ApiResponseShape<T> = {
      success: this.statusCode >= 200 && this.statusCode < 300,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
      ...(this.pagination && { pagination: this.pagination }),
    };
    return this.res.status(this.statusCode).json(body);
  }

  static ok<T>(res: Response, message: string, data?: T, pagination?: PaginationMeta) {
    return new ApiResponse(res, 200, message, data, pagination).send();
  }

  static created<T>(res: Response, message: string, data?: T) {
    return new ApiResponse(res, 201, message, data).send();
  }

  static noContent(res: Response) {
    return res.status(204).send();
  }
}
